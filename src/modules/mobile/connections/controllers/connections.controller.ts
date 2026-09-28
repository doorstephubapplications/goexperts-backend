import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';

export const getConnections = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user.id;
    const connections = await prisma.connection.findMany({
      where: { OR: [{ userOneId: userId }, { userTwoId: userId }], status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
    const formatted = (await Promise.all(connections.map(async (connection) => {
      const peerId = connection.userOneId === userId
        ? connection.userTwoId
        : connection.userOneId;
      const peer = await prisma.user.findUnique({
        where: { id: peerId },
        select: { id: true, fullName: true, avatarUrl: true, role: true },
      });
      if (!peer) return null;
      const conversation = await prisma.conversation.findFirst({
        where: { OR: [
          { userA: connection.userOneId, userB: connection.userTwoId },
          { userA: connection.userTwoId, userB: connection.userOneId },
        ] },
        select: { id: true },
      });
      return {
        id: connection.id,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
        peerId: peer.id,
        name: peer.fullName,
        role: peer.role,
        avatar: peer.avatarUrl,
        conversationId: conversation?.id,
      };
    }))).filter((connection): connection is NonNullable<typeof connection> => connection !== null);
    return res.json(successResponse('Connections fetched successfully', formatted));
  } catch (error) { next(error); }
};

const profileIds = async (userId: string) => {
  const profiles = await Promise.all([
    prisma.clientProfile.findUnique({ where: { userId } }),
    prisma.freelancerProfile.findUnique({ where: { userId } }),
    prisma.investorProfile.findUnique({ where: { userId } }),
    prisma.founderProfile.findUnique({ where: { userId } }),
  ]);
  return [userId, ...profiles.filter(Boolean).map(profile => profile!.id)];
};

const resolveInvitationUser = async (id: string) => {
  const select = { id: true, fullName: true, avatarUrl: true, role: true } as const;
  const direct = await prisma.user.findUnique({ where: { id }, select }).catch(() => null);
  if (direct) return direct;

  const profiles = await Promise.all([
    prisma.clientProfile.findUnique({ where: { id }, select: { userId: true } }),
    prisma.freelancerProfile.findUnique({ where: { id }, select: { userId: true } }),
    prisma.investorProfile.findUnique({ where: { id }, select: { userId: true } }),
    prisma.founderProfile.findUnique({ where: { id }, select: { userId: true } }),
  ]);
  const userId = profiles.find(Boolean)?.userId;
  return userId
    ? prisma.user.findUnique({ where: { id: userId }, select }).catch(() => null)
    : null;
};

const shapeInvitation = async (invitation: any, peerKey: 'senderId' | 'receiverId') => {
  const peer = await resolveInvitationUser(invitation[peerKey]);
  if (!peer) return null;
  return {
    ...invitation,
    sender: peerKey === 'senderId' ? peer : undefined,
    receiver: peerKey === 'receiverId' ? peer : undefined,
  };
};

export const getReceivedInvitations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitations = await prisma.connectionInvitation.findMany({
      where: { receiverId: { in: await profileIds(req.user.id) }, status: { not: 'ACCEPTED' } },
      orderBy: { createdAt: 'desc' },
    });
    const shaped = (await Promise.all(
      invitations.map((invitation) => shapeInvitation(invitation, 'senderId')),
    )).filter(Boolean);
    return res.json(successResponse('Received invitations retrieved', shaped));
  } catch (error) { next(error); }
};

export const getSentInvitations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitations = await prisma.connectionInvitation.findMany({
      where: { senderId: { in: await profileIds(req.user.id) }, status: { not: 'ACCEPTED' } },
      orderBy: { createdAt: 'desc' },
    });
    const shaped = (await Promise.all(
      invitations.map((invitation) => shapeInvitation(invitation, 'receiverId')),
    )).filter(Boolean);
    return res.json(successResponse('Sent invitations retrieved', shaped));
  } catch (error) { next(error); }
};

export const acceptInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitation = await prisma.connectionInvitation.findUnique({
      where: { id: req.params.id }, include: { sender: true, receiver: true },
    });
    if (!invitation || invitation.receiverId !== req.user.id) return res.status(404).json(errorResponse('Invitation not found', 'NOT_FOUND'));
    if (invitation.status !== 'PENDING') return res.status(400).json(errorResponse('Invitation is no longer pending', 'INVALID_STATUS'));

    const updated = await prisma.connectionInvitation.update({ where: { id: invitation.id }, data: { status: 'ACCEPTED', acceptedAt: new Date() } });
    const [userOneId, userTwoId] = [invitation.senderId, invitation.receiverId].sort();
    await prisma.connection.upsert({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
      update: { status: 'ACTIVE' }, create: { userOneId, userTwoId, status: 'ACTIVE' },
    });

    await prisma.conversation.updateMany({
      where: {
        deletedAt: null,
        status: 'PENDING',
        OR: [
          { userA: invitation.senderId, userB: invitation.receiverId },
          { userA: invitation.receiverId, userB: invitation.senderId },
          { userA: userOneId, userB: userTwoId },
          { userA: userTwoId, userB: userOneId },
        ],
      },
      data: { status: 'active', updatedAt: new Date() },
    });

    const conversation = await prisma.conversation.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { userA: invitation.senderId, userB: invitation.receiverId },
          { userA: invitation.receiverId, userB: invitation.senderId },
          { userA: userOneId, userB: userTwoId },
          { userA: userTwoId, userB: userOneId },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
    await NotificationEngine.queueNotification({
      userId: invitation.senderId, type: 'connection_accepted', title: 'Connection Accepted',
      message: `${invitation.receiver.fullName} accepted your connection request.`, channel: 'all',
      payload: { connectionId: invitation.id, conversationId: conversation?.id },
    });
    const { getIO } = await import('../../../../modules/realtime/socket.js');
    getIO().to(invitation.senderId).emit('connection_request_accepted', { invitationId: invitation.id, conversationId: conversation?.id });
    return res.json(successResponse('Invitation accepted successfully', { ...updated, conversationId: conversation?.id }));
  } catch (error) { next(error); }
};

export const rejectInvitation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitation = await prisma.connectionInvitation.findUnique({ where: { id: req.params.id } });
    if (!invitation || (invitation.receiverId !== req.user.id && invitation.senderId !== req.user.id)) return res.status(404).json(errorResponse('Invitation not found', 'NOT_FOUND'));
    if (invitation.status !== 'PENDING') return res.status(400).json(errorResponse('Invitation is no longer pending', 'INVALID_STATUS'));
    if (invitation.senderId === req.user.id) {
      await prisma.connectionInvitation.delete({ where: { id: invitation.id } });
      return res.json(successResponse('Invitation withdrawn successfully', { id: invitation.id }));
    }
    const updated = await prisma.connectionInvitation.update({ where: { id: invitation.id }, data: { status: 'REJECTED', rejectedAt: new Date() } });
    await prisma.conversation.deleteMany({ where: { OR: [
      { userA: invitation.senderId, userB: invitation.receiverId },
      { userA: invitation.receiverId, userB: invitation.senderId },
    ], projectId: null } });
    const [userOneId, userTwoId] = [invitation.senderId, invitation.receiverId].sort();
    await prisma.connection.upsert({
      where: { userOneId_userTwoId: { userOneId, userTwoId } },
      update: { status: 'BLOCKED' }, create: { userOneId, userTwoId, status: 'BLOCKED' },
    });
    await NotificationEngine.queueNotification({
      userId: invitation.senderId, type: 'CONNECTION_REJECTED', title: 'Connection Request Rejected',
      message: `${req.user.fullName || 'The user'} rejected your connection request.`, channel: 'all',
      payload: { invitationId: invitation.id },
    }).catch(() => null);
    const { getIO } = await import('../../../../modules/realtime/socket.js');
    getIO().to(invitation.senderId).emit('connection_request_rejected', { invitationId: invitation.id });
    return res.json(successResponse('Invitation rejected successfully', updated));
  } catch (error) { next(error); }
};
