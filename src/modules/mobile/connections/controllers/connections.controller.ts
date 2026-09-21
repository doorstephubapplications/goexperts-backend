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
      include: {
        userOne: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
        userTwo: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const formatted = await Promise.all(connections.map(async (connection) => {
      const peer = connection.userOneId === userId ? connection.userTwo : connection.userOne;
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
    }));
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

export const getReceivedInvitations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitations = await prisma.connectionInvitation.findMany({
      where: { receiverId: { in: await profileIds(req.user.id) } },
      include: { sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(successResponse('Received invitations retrieved', invitations));
  } catch (error) { next(error); }
};

export const getSentInvitations = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const invitations = await prisma.connectionInvitation.findMany({
      where: { senderId: { in: await profileIds(req.user.id) } },
      include: { receiver: { select: { id: true, fullName: true, avatarUrl: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(successResponse('Sent invitations retrieved', invitations));
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
      where: { userA: userOneId, userB: userTwoId, status: 'PENDING', deletedAt: null },
      data: { status: 'active', updatedAt: new Date() },
    });
    const conversation = await prisma.conversation.findFirst({
      where: { userA: userOneId, userB: userTwoId, deletedAt: null },
      orderBy: { updatedAt: 'desc' }, select: { id: true },
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
