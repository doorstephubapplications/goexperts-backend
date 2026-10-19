import { Response, NextFunction } from 'express';
import { prisma } from '../../config/database.js';
import type { AuthenticatedRequest } from '../../middlewares/auth.middleware.js';
import { emitNotification } from '../../services/notifications/notification-events.service.js';
import { withAdvisoryLock } from '../../services/concurrency/advisory-lock.service.js';

// GET /connections or /network/connections
export const getConnections = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [connections, total] = await Promise.all([
      prisma.connection.findMany({
        where: {
          OR: [
            { userOneId: userId },
            { userTwoId: userId }
          ],
          status: 'ACTIVE'
        },
        include: {
          userOne: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
              bio: true,
              city: true,
              country: true,
              isVerified: true
            }
          },
          userTwo: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
              role: true,
              bio: true,
              city: true,
              country: true,
              isVerified: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.connection.count({
        where: {
          OR: [
            { userOneId: userId },
            { userTwoId: userId }
          ],
          status: 'ACTIVE'
        }
      })
    ]);

    const formatted = await Promise.all(connections.map(async c => {
      const isUserOne = c.userOneId === userId;
      const peer = isUserOne ? c.userTwo : c.userOne;

      // Find associated conversation
      const conv = await prisma.conversation.findFirst({
        where: {
          OR: [
            { userA: c.userOneId, userB: c.userTwoId },
            { userA: c.userTwoId, userB: c.userOneId }
          ]
        },
        select: { id: true }
      });

      return {
        id: c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        peerId: peer.id,
        name: peer.fullName,
        role: peer.role,
        avatar: peer.avatarUrl,
        headline: peer.bio || `${peer.role} on Go Experts`,
        location: [peer.city, peer.country].filter(Boolean).join(', ') || 'India',
        isVerified: peer.isVerified,
        conversationId: conv?.id
      };
    }));

    return res.json({
      success: true,
      rows: formatted,
      data: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) { next(error); }
};

// GET /connections/summary or /network/summary
export const getNetworkSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const [
      connectionsCount,
      receivedCount,
      sentCount,
      rejectedReceivedCount,
      rejectedSentCount
    ] = await Promise.all([
      prisma.connection.count({
        where: {
          OR: [{ userOneId: userId }, { userTwoId: userId }],
          status: 'ACTIVE'
        }
      }),
      prisma.connectionInvitation.count({
        where: { receiverId: userId, status: 'PENDING' }
      }),
      prisma.connectionInvitation.count({
        where: { senderId: userId, status: 'PENDING' }
      }),
      prisma.connectionInvitation.count({
        where: { receiverId: userId, status: 'REJECTED' }
      }),
      prisma.connectionInvitation.count({
        where: { senderId: userId, status: 'REJECTED' }
      })
    ]);

    const rejectedCount = rejectedReceivedCount + rejectedSentCount;

    return res.json({
      success: true,
      data: {
        // Preserved backward-compatible fields:
        connectionsCount,
        receivedCount,
        sentCount,

        // Enhanced detailed breakdown:
        acceptedCount: connectionsCount,
        pendingReceivedCount: receivedCount,
        pendingSentCount: sentCount,
        rejectedReceivedCount,
        rejectedSentCount,
        rejectedCount
      }
    });
  } catch (error) { next(error); }
};

// GET /connections/invitations or /network/invitations/received
export const getReceivedInvitations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const invitations = await prisma.connectionInvitation.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            role: true,
            bio: true,
            city: true,
            country: true,
            isVerified: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = invitations.map(inv => ({
      id: inv.id,
      senderId: inv.senderId,
      receiverId: inv.receiverId,
      firstMessage: inv.firstMessage,
      status: inv.status,
      createdAt: inv.createdAt,
      sender: {
        id: inv.sender.id,
        name: inv.sender.fullName,
        fullName: inv.sender.fullName,
        avatar: inv.sender.avatarUrl,
        avatarUrl: inv.sender.avatarUrl,
        role: inv.sender.role,
        headline: inv.sender.bio || `${inv.sender.role} on Go Experts`,
        location: [inv.sender.city, inv.sender.country].filter(Boolean).join(', ') || 'India',
        isVerified: inv.sender.isVerified
      }
    }));

    return res.json({ success: true, rows: formatted, data: formatted });
  } catch (error) { next(error); }
};

// GET /connections/invitations/sent or /network/invitations/sent
export const getSentInvitations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const invitations = await prisma.connectionInvitation.findMany({
      where: { senderId: userId, status: 'PENDING' },
      include: {
        receiver: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            role: true,
            bio: true,
            city: true,
            country: true,
            isVerified: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = invitations.map(inv => ({
      id: inv.id,
      senderId: inv.senderId,
      receiverId: inv.receiverId,
      firstMessage: inv.firstMessage,
      status: inv.status,
      createdAt: inv.createdAt,
      receiver: {
        id: inv.receiver.id,
        name: inv.receiver.fullName,
        fullName: inv.receiver.fullName,
        avatar: inv.receiver.avatarUrl,
        avatarUrl: inv.receiver.avatarUrl,
        role: inv.receiver.role,
        headline: inv.receiver.bio || `${inv.receiver.role} on Go Experts`,
        location: [inv.receiver.city, inv.receiver.country].filter(Boolean).join(', ') || 'India',
        isVerified: inv.receiver.isVerified
      }
    }));

    return res.json({ success: true, rows: formatted, data: formatted });
  } catch (error) { next(error); }
};

// POST /connections/invitations or /network/invitations
export const sendInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { recipientId, targetUserId, message, initialMessage } = req.body;
    const finalRecipientId = targetUserId || recipientId;
    const note = message || initialMessage || '';

    if (!finalRecipientId) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required' });
    }

    if (finalRecipientId === userId) {
      return res.status(400).json({ success: false, message: 'You cannot send a connection invitation to yourself' });
    }

    // Verify recipient exists
    const recipientUser = await prisma.user.findUnique({
      where: { id: finalRecipientId },
      select: { id: true, fullName: true, email: true, role: true }
    });
    if (!recipientUser) {
      return res.status(404).json({ success: false, message: 'Recipient user not found' });
    }

    // Check blocked status
    const isBlocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: finalRecipientId },
          { blockerId: finalRecipientId, blockedId: userId }
        ]
      }
    });
    if (isBlocked) {
      return res.status(403).json({ success: false, message: 'Unable to connect with this user' });
    }

    // Check active connection
    const [userOneId, userTwoId] = [userId, finalRecipientId].sort();
    const existingConn = await prisma.connection.findUnique({
      where: { userOneId_userTwoId: { userOneId, userTwoId } }
    });
    if (existingConn && existingConn.status === 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'You are already connected with this user' });
    }

    // Check active pending invitations
    const existingInvite = await prisma.connectionInvitation.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: finalRecipientId },
          { senderId: finalRecipientId, receiverId: userId }
        ],
        status: 'PENDING'
      }
    });
    if (existingInvite) {
      return res.status(400).json({ success: false, message: 'An active invitation between these accounts already exists' });
    }

    // Assert and consume sendInvitation quota from authoritative entitlement service
    const authSenderRole = (req.user?.role || 'freelancer').toLowerCase();
    let quotaEntitlement: any = null;
    try {
      const { assertAndConsumeActionQuota } = await import('../../services/subscription/entitlement.service.js');
      const result = await assertAndConsumeActionQuota(userId, authSenderRole, 'sendInvitation');
      quotaEntitlement = result.entitlement;
    } catch (gateErr: any) {
      if (gateErr.name === 'ActionGateError') {
        return res.status(403).json({
          success: false,
          code: gateErr.code || 'QUOTA_EXHAUSTED',
          message: gateErr.message || 'Connection invitation quota exceeded. Upgrade your plan to send more invitations.',
          details: gateErr.details,
        });
      }
      throw gateErr;
    }

    // Create invitation atomically within transaction with canonical pair locking held across COMMIT
    let newInvite: any;
    try {
      const lockKey = `conn_inv_${userOneId}_${userTwoId}`;
      newInvite = await withAdvisoryLock(lockKey, 10, async () => {
        return await prisma.$transaction(async (tx) => {
          // 1. Check active connection inside lock
          const connInside = await tx.connection.findUnique({
            where: { userOneId_userTwoId: { userOneId, userTwoId } }
          });
          if (connInside && connInside.status === 'ACTIVE') {
            throw new Error('You are already connected with this user');
          }

          // 2. Check active pending invitations in either direction inside lock
          const existing = await tx.connectionInvitation.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: finalRecipientId },
                { senderId: finalRecipientId, receiverId: userId }
              ],
              status: 'PENDING'
            }
          });
          if (existing) {
            throw new Error('An active invitation between these accounts already exists');
          }

          return await tx.connectionInvitation.upsert({
            where: {
              senderId_receiverId: { senderId: userId, receiverId: finalRecipientId }
            },
            update: {
              firstMessage: note,
              status: 'PENDING',
              updatedAt: new Date()
            },
            create: {
              senderId: userId,
              receiverId: finalRecipientId,
              firstMessage: note,
              status: 'PENDING'
            },
            include: {
              sender: {
                select: { id: true, fullName: true, avatarUrl: true, role: true }
              }
            }
          });
        }, {
          isolationLevel: 'ReadCommitted',
          timeout: 10000,
          maxWait: 5000
        });
      });
    } catch (err: any) {
      if (quotaEntitlement?.subscriptionId) {
        try {
          const { rollbackActionUsage } = await import('../../services/subscription/entitlement.service.js');
          await rollbackActionUsage(quotaEntitlement.subscriptionId, 'sendInvitation');
        } catch {}
      }
      return res.status(400).json({ success: false, message: err.message || 'Unable to send invitation' });
    }

    const senderName = req.user?.fullName || newInvite.sender.fullName || 'A professional';
    const senderRole = newInvite.sender.role || 'Member';
    const senderHeadline = newInvite.sender.bio || `${senderRole} on Go Experts`;
    const title = `${senderName} wants to connect`;
    const bodyText = note || `${senderName} wants to connect with you on Go Experts.`;

    // Emit in-app notification & push
    try {
      await emitNotification({
        userId: finalRecipientId,
        type: 'CONNECTION_REQUEST',
        title,
        message: bodyText,
        contextType: 'CONNECTION',
        contextId: newInvite.id,
        actionUrl: '/dashboard/network',
        metadata: {
          eventType: 'CONNECTION_REQUEST',
          category: 'CONNECTION_REQUEST',
          invitationId: newInvite.id,
          invitation_id: newInvite.id,
          senderId: userId,
          sender_id: userId,
          senderName,
          sender_name: senderName,
          senderRole,
          sender_role: senderRole,
          senderHeadline,
          sender_headline: senderHeadline,
          senderAvatar: newInvite.sender.avatarUrl || '',
          sender_avatar: newInvite.sender.avatarUrl || '',
          imageUrl: newInvite.sender.avatarUrl || '',
          firstMessage: note,
          first_message: note
        }
      });
    } catch {}

    // Emit Socket.io event
    try {
      const { getIo } = await import('../../socket/index.js');
      getIo().to(finalRecipientId).emit('connection_request_received', {
        invitationId: newInvite.id,
        sender: newInvite.sender
      });
    } catch {}

    // Send email alert asynchronously
    try {
      const { sendConnectionRequestEmail } = await import('../../services/mobile/email.service.js');
      await sendConnectionRequestEmail(
        recipientUser.email,
        recipientUser.fullName,
        senderName,
        `${process.env.PUBLIC_WEB_URL || process.env.FRONTEND_URL || 'https://goexperts.in'}/dashboard/network`
      ).catch(() => {});
    } catch {}

    return res.status(201).json({
      success: true,
      message: 'Connection invitation sent successfully',
      data: newInvite
    });
  } catch (error) { next(error); }
};

// PATCH /connections/invitations/:id/accept or POST /connections/invitations/:id/accept
export const acceptInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    
    const invitation = await prisma.connectionInvitation.findUnique({
      where: { id },
      include: { sender: true, receiver: true }
    });

    if (!invitation || invitation.receiverId !== userId) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `Invitation is already ${invitation.status.toLowerCase()}` });
    }

    // 1-3. Execute atomic conditional acceptance with canonical pair locking
    const [userOneId, userTwoId] = [invitation.senderId, invitation.receiverId].sort();
    const lockKey = `conn_inv_${userOneId}_${userTwoId}`;

    let updated: any;
    let conversation: any;

    try {
      const result = await withAdvisoryLock(lockKey, 10, async () => {
        return await prisma.$transaction(async (tx) => {
          // 1. Atomic conditional update: only transitions if status is PENDING
          const updateResult = await tx.connectionInvitation.updateMany({
            where: {
              id,
              status: 'PENDING'
            },
            data: {
              status: 'ACCEPTED',
              acceptedAt: new Date()
            }
          });

          if (updateResult.count === 0) {
            throw new Error(`Invitation is already ${invitation.status.toLowerCase()}`);
          }

          const updatedInv = await tx.connectionInvitation.findUniqueOrThrow({
            where: { id }
          });

          await tx.connection.upsert({
            where: {
              userOneId_userTwoId: { userOneId, userTwoId }
            },
            update: { status: 'ACTIVE' },
            create: {
              userOneId,
              userTwoId,
              status: 'ACTIVE'
            }
          });

          let conv = await tx.conversation.findFirst({
            where: {
              OR: [
                { userA: userOneId, userB: userTwoId },
                { userA: userTwoId, userB: userOneId }
              ]
            }
          });

          if (!conv) {
            conv = await tx.conversation.create({
              data: {
                name: 'Chat',
                role: invitation.sender.role,
                status: 'active',
                userA: userOneId,
                userB: userTwoId,
                msg: invitation.firstMessage || 'Connected on Go Experts',
                time: new Date().toISOString()
              }
            });

            if (invitation.firstMessage) {
              await tx.message.create({
                data: {
                  conversationId: conv.id,
                  from: invitation.sender.fullName,
                  senderId: invitation.senderId,
                  text: invitation.firstMessage,
                  time: new Date().toISOString()
                }
              });
            }
          }

          return { updated: updatedInv, conversation: conv };
        }, {
          isolationLevel: 'ReadCommitted',
          timeout: 10000,
          maxWait: 5000
        });
      });

      updated = result.updated;
      conversation = result.conversation;
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message || 'Unable to accept invitation' });
    }

    // 4. Notify sender
    const title = 'Connection Accepted';
    const body = `${invitation.receiver.fullName} accepted your connection request.`;
    
    try {
      await emitNotification({
        userId: invitation.senderId,
        type: 'CONNECTION_ACCEPTED',
        title,
        message: body,
        contextType: 'CONNECTION',
        contextId: id,
        actionUrl: `/dashboard/messages?conversationId=${conversation.id}`,
        metadata: { peer_name: invitation.receiver.fullName, conversation_id: conversation.id }
      });
    } catch {}

    try {
      const { getIo } = await import('../../socket/index.js');
      getIo().to(invitation.senderId).emit('connection_request_accepted', {
        connectionId: userOneId,
        invitationId: id,
        conversationId: conversation.id
      });
    } catch {}
    
    try {
      const { sendConnectionAcceptedEmail } = await import('../../services/mobile/email.service.js');
      await sendConnectionAcceptedEmail(
        invitation.sender.email,
        invitation.sender.fullName,
        invitation.receiver.fullName,
        `${process.env.PUBLIC_WEB_URL || process.env.FRONTEND_URL || 'https://goexperts.in'}/dashboard/messages`
      ).catch(() => {});
    } catch {}

    return res.json({
      success: true,
      message: 'Invitation accepted successfully',
      data: {
        invitation: updated,
        conversationId: conversation.id
      }
    });
  } catch (error) { next(error); }
};

// PATCH /connections/invitations/:id/reject or POST /connections/invitations/:id/reject
export const rejectInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    
    const invitation = await prisma.connectionInvitation.findUnique({ where: { id } });

    if (!invitation || invitation.receiverId !== userId) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Invitation is no longer pending' });
    }

    const [userOneId, userTwoId] = [invitation.senderId, invitation.receiverId].sort();
    const lockKey = `conn_inv_${userOneId}_${userTwoId}`;

    const updated = await withAdvisoryLock(lockKey, 10, async () => {
      return await prisma.$transaction(async (tx) => {
        const updateResult = await tx.connectionInvitation.updateMany({
          where: { id, status: 'PENDING' },
          data: { status: 'REJECTED', rejectedAt: new Date() }
        });

        if (updateResult.count === 0) {
          throw new Error('Invitation is no longer pending');
        }

        return await tx.connectionInvitation.findUniqueOrThrow({ where: { id } });
      }, { isolationLevel: 'ReadCommitted', timeout: 10000 });
    });

    try {
      const { getIo } = await import('../../socket/index.js');
      getIo().to(invitation.senderId).emit('connection_request_rejected', {
        invitationId: id
      });
    } catch {}

    return res.json({ success: true, message: 'Invitation declined', data: updated });
  } catch (error) { next(error); }
};

// POST /connections/invitations/:id/ignore
export const ignoreInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const invitation = await prisma.connectionInvitation.findUnique({ where: { id } });

    if (!invitation || invitation.receiverId !== userId) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    const updated = await prisma.connectionInvitation.update({
      where: { id },
      data: { status: 'IGNORED', rejectedAt: new Date() }
    });

    return res.json({ success: true, message: 'Invitation ignored', data: updated });
  } catch (error) { next(error); }
};

// POST /connections/invitations/:id/withdraw or DELETE /connections/invitations/:id
export const withdrawInvitation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const invitation = await prisma.connectionInvitation.findUnique({ where: { id } });

    if (!invitation || invitation.senderId !== userId) {
      return res.status(404).json({ success: false, message: 'Invitation not found or not owned by you' });
    }

    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Only pending invitations can be withdrawn' });
    }

    const updated = await prisma.connectionInvitation.update({
      where: { id },
      data: { status: 'WITHDRAWN', rejectedAt: new Date() }
    });

    return res.json({ success: true, message: 'Invitation withdrawn successfully', data: updated });
  } catch (error) { next(error); }
};

// DELETE /connections/:id
export const removeConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { id } = req.params;
    const connection = await prisma.connection.findFirst({
      where: {
        id,
        OR: [{ userOneId: userId }, { userTwoId: userId }]
      }
    });

    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection not found' });
    }

    await prisma.connection.delete({ where: { id } });

    return res.json({ success: true, message: 'Connection removed successfully' });
  } catch (error) { next(error); }
};

// GET /connections/users/:id/relationship
export const getRelationship = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const targetId = req.params.id;
    if (!targetId || targetId === userId) {
      return res.json({
        success: true,
        data: {
          userId: targetId || userId,
          connectionStatus: 'SELF',
          connectionId: null,
          invitationId: null,
          canSendRequest: false,
          canWithdrawRequest: false,
          canRespond: false,
          state: 'SELF'
        }
      });
    }

    // Check block
    const isBlocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetId },
          { blockerId: targetId, blockedId: userId }
        ]
      }
    });
    if (isBlocked) {
      return res.json({
        success: true,
        data: {
          userId: targetId,
          connectionStatus: 'BLOCKED',
          connectionId: null,
          invitationId: null,
          canSendRequest: false,
          canWithdrawRequest: false,
          canRespond: false,
          state: 'BLOCKED',
          isBlocker: isBlocked.blockerId === userId
        }
      });
    }

    // Check mutual connection
    const [a, b] = [userId, targetId].sort();
    const conn = await prisma.connection.findUnique({
      where: { userOneId_userTwoId: { userOneId: a, userTwoId: b } }
    });
    if (conn && conn.status === 'ACTIVE') {
      return res.json({
        success: true,
        data: {
          userId: targetId,
          connectionStatus: 'CONNECTED',
          connectionId: conn.id,
          invitationId: null,
          canSendRequest: false,
          canWithdrawRequest: false,
          canRespond: false,
          state: 'CONNECTED'
        }
      });
    }

    // Check invites (PENDING or REJECTED)
    const invite = await prisma.connectionInvitation.findFirst({
      where: {
        OR: [
          { senderId: userId, receiverId: targetId },
          { senderId: targetId, receiverId: userId }
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (invite) {
      if (invite.status === 'PENDING') {
        if (invite.senderId === userId) {
          return res.json({
            success: true,
            data: {
              userId: targetId,
              connectionStatus: 'PENDING_SENT',
              connectionId: null,
              invitationId: invite.id,
              canSendRequest: false,
              canWithdrawRequest: true,
              canRespond: false,
              state: 'PENDING_SENT'
            }
          });
        } else {
          return res.json({
            success: true,
            data: {
              userId: targetId,
              connectionStatus: 'PENDING_RECEIVED',
              connectionId: null,
              invitationId: invite.id,
              canSendRequest: false,
              canWithdrawRequest: false,
              canRespond: true,
              state: 'PENDING_RECEIVED'
            }
          });
        }
      }

      if (invite.status === 'REJECTED') {
        return res.json({
          success: true,
          data: {
            userId: targetId,
            connectionStatus: 'REJECTED',
            connectionId: null,
            invitationId: invite.id,
            canSendRequest: true,
            canWithdrawRequest: false,
            canRespond: false,
            state: 'REJECTED'
          }
        });
      }
    }

    return res.json({
      success: true,
      data: {
        userId: targetId,
        connectionStatus: 'NOT_CONNECTED',
        connectionId: null,
        invitationId: null,
        canSendRequest: true,
        canWithdrawRequest: false,
        canRespond: false,
        state: 'NONE'
      }
    });
  } catch (error) { next(error); }
};

// POST /connections/relationships/batch
// Bulk status lookup for user listing pages to prevent N+1 queries
export const getBatchRelationships = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let userIds: string[] = [];
    if (Array.isArray(req.body?.userIds)) {
      userIds = req.body.userIds;
    } else if (typeof req.query.userIds === 'string') {
      userIds = req.query.userIds.split(',').map(s => s.trim()).filter(Boolean);
    } else if (typeof req.query.ids === 'string') {
      userIds = req.query.ids.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Deduplicate and cap at 100 for safety
    const uniqueTargetIds = [...new Set(userIds.filter(id => Boolean(id) && typeof id === 'string'))].slice(0, 100);

    const result: Record<string, any> = {};

    // Handle empty query
    if (uniqueTargetIds.length === 0) {
      return res.json({ success: true, data: { relationships: {} } });
    }

    // Handle self in targets
    const targetIdsExcludingSelf = uniqueTargetIds.filter(id => {
      if (id === userId) {
        result[id] = {
          userId: id,
          connectionStatus: 'SELF',
          connectionId: null,
          invitationId: null,
          canSendRequest: false,
          canWithdrawRequest: false,
          canRespond: false,
          state: 'SELF'
        };
        return false;
      }
      return true;
    });

    if (targetIdsExcludingSelf.length === 0) {
      return res.json({ success: true, data: { relationships: result } });
    }

    // Run 3 optimized batched queries in parallel
    const [connections, invitations, blocks] = await Promise.all([
      // 1. Check active connections
      prisma.connection.findMany({
        where: {
          OR: [
            { userOneId: userId, userTwoId: { in: targetIdsExcludingSelf } },
            { userTwoId: userId, userOneId: { in: targetIdsExcludingSelf } }
          ],
          status: 'ACTIVE'
        },
        select: { id: true, userOneId: true, userTwoId: true, status: true }
      }),

      // 2. Check invitations in either direction
      prisma.connectionInvitation.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: { in: targetIdsExcludingSelf } },
            { receiverId: userId, senderId: { in: targetIdsExcludingSelf } }
          ]
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, senderId: true, receiverId: true, status: true }
      }),

      // 3. Check blocked users
      prisma.blockedUser.findMany({
        where: {
          OR: [
            { blockerId: userId, blockedId: { in: targetIdsExcludingSelf } },
            { blockerId: { in: targetIdsExcludingSelf }, blockedId: userId }
          ]
        },
        select: { blockerId: true, blockedId: true }
      })
    ]);

    // Map blocks
    const blockMap = new Map<string, string>(); // peerId -> blockerId
    blocks.forEach(b => {
      const peerId = b.blockerId === userId ? b.blockedId : b.blockerId;
      blockMap.set(peerId, b.blockerId);
    });

    // Map active connections
    const connMap = new Map<string, string>(); // peerId -> connectionId
    connections.forEach(c => {
      const peerId = c.userOneId === userId ? c.userTwoId : c.userOneId;
      connMap.set(peerId, c.id);
    });

    // Map invitations (latest per peer)
    const invMap = new Map<string, { id: string; senderId: string; receiverId: string; status: string }>();
    invitations.forEach(inv => {
      const peerId = inv.senderId === userId ? inv.receiverId : inv.senderId;
      if (!invMap.has(peerId)) {
        invMap.set(peerId, inv);
      }
    });

    // Assemble relationship status for each target
    for (const targetId of targetIdsExcludingSelf) {
      // 1. Blocked
      if (blockMap.has(targetId)) {
        const blockerId = blockMap.get(targetId);
        result[targetId] = {
          userId: targetId,
          connectionStatus: 'BLOCKED',
          connectionId: null,
          invitationId: null,
          canSendRequest: false,
          canWithdrawRequest: false,
          canRespond: false,
          state: 'BLOCKED',
          isBlocker: blockerId === userId
        };
        continue;
      }

      // 2. Active Connection
      if (connMap.has(targetId)) {
        const connectionId = connMap.get(targetId)!;
        result[targetId] = {
          userId: targetId,
          connectionStatus: 'CONNECTED',
          connectionId,
          invitationId: null,
          canSendRequest: false,
          canWithdrawRequest: false,
          canRespond: false,
          state: 'CONNECTED'
        };
        continue;
      }

      // 3. Invitation (Pending or Rejected)
      if (invMap.has(targetId)) {
        const inv = invMap.get(targetId)!;
        if (inv.status === 'PENDING') {
          if (inv.senderId === userId) {
            result[targetId] = {
              userId: targetId,
              connectionStatus: 'PENDING_SENT',
              connectionId: null,
              invitationId: inv.id,
              canSendRequest: false,
              canWithdrawRequest: true,
              canRespond: false,
              state: 'PENDING_SENT'
            };
          } else {
            result[targetId] = {
              userId: targetId,
              connectionStatus: 'PENDING_RECEIVED',
              connectionId: null,
              invitationId: inv.id,
              canSendRequest: false,
              canWithdrawRequest: false,
              canRespond: true,
              state: 'PENDING_RECEIVED'
            };
          }
          continue;
        }

        if (inv.status === 'REJECTED') {
          result[targetId] = {
            userId: targetId,
            connectionStatus: 'REJECTED',
            connectionId: null,
            invitationId: inv.id,
            canSendRequest: true,
            canWithdrawRequest: false,
            canRespond: false,
            state: 'REJECTED'
          };
          continue;
        }
      }

      // 4. Not connected (Default)
      result[targetId] = {
        userId: targetId,
        connectionStatus: 'NOT_CONNECTED',
        connectionId: null,
        invitationId: null,
        canSendRequest: true,
        canWithdrawRequest: false,
        canRespond: false,
        state: 'NONE'
      };
    }

    return res.json({
      success: true,
      data: {
        relationships: result
      }
    });
  } catch (error) { next(error); }
};

// GET /connections/users/:id/mutual-connections
export const getMutualConnections = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const targetId = req.params.id;
    if (!targetId) return res.status(400).json({ success: false, message: 'Target user ID is required' });

    const [myConns, targetConns] = await Promise.all([
      prisma.connection.findMany({
        where: {
          OR: [{ userOneId: userId }, { userTwoId: userId }],
          status: 'ACTIVE'
        }
      }),
      prisma.connection.findMany({
        where: {
          OR: [{ userOneId: targetId }, { userTwoId: targetId }],
          status: 'ACTIVE'
        }
      })
    ]);

    const myPeerIds = new Set(myConns.map(c => c.userOneId === userId ? c.userTwoId : c.userOneId));
    const targetPeerIds = new Set(targetConns.map(c => c.userOneId === targetId ? c.userTwoId : c.userOneId));

    const mutualIds = [...myPeerIds].filter(id => targetPeerIds.has(id));

    const mutualUsers = await prisma.user.findMany({
      where: { id: { in: mutualIds } },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        role: true,
        bio: true
      }
    });

    return res.json({
      success: true,
      data: {
        count: mutualUsers.length,
        rows: mutualUsers
      }
    });
  } catch (error) { next(error); }
};

// POST /connections/users/:id/block
export const blockUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const targetId = req.params.id;
    if (targetId === userId) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself' });
    }

    await prisma.blockedUser.upsert({
      where: {
        blockerId_blockedId: { blockerId: userId, blockedId: targetId }
      },
      update: {},
      create: {
        blockerId: userId,
        blockedId: targetId
      }
    });

    // Remove active connection if any
    const [a, b] = [userId, targetId].sort();
    await prisma.connection.deleteMany({
      where: { userOneId: a, userTwoId: b }
    }).catch(() => {});

    return res.json({ success: true, message: 'User blocked successfully' });
  } catch (error) { next(error); }
};

// DELETE /connections/users/:id/block
export const unblockUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const targetId = req.params.id;
    await prisma.blockedUser.deleteMany({
      where: { blockerId: userId, blockedId: targetId }
    });

    return res.json({ success: true, message: 'User unblocked successfully' });
  } catch (error) { next(error); }
};

// POST /connections/users/:id/report
export const reportUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const targetId = req.params.id;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Report reason is required' });
    }

    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        reportedUserId: targetId,
        reason: reason.trim(),
        status: 'PENDING'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Report submitted successfully. Our safety team will review it.',
      data: report
    });
  } catch (error) { next(error); }
};

// GET /connections/discover or /network/discover
export const discoverPeople = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 12));
    const skip = (page - 1) * limit;

    const { role, search } = req.query;

    const where: any = {
      id: { not: userId },
      status: 'active'
    };

    if (role && typeof role === 'string' && role !== 'all') {
      where.role = role.toLowerCase().trim();
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q } },
        { bio: { contains: q } },
        { city: { contains: q } },
        { country: { contains: q } }
      ];
    }

    // Exclude users blocked by me or who blocked me
    const blockedRows = await prisma.blockedUser.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }]
      }
    });
    const blockedIds = blockedRows.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);
    if (blockedIds.length > 0) {
      where.id = { notIn: [userId, ...blockedIds] };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          avatarUrl: true,
          role: true,
          bio: true,
          city: true,
          country: true,
          isVerified: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    // Fetch existing connections and pending invites for these users
    const userIds = users.map(u => u.id);
    const [existingConns, pendingInvites] = await Promise.all([
      prisma.connection.findMany({
        where: {
          OR: [
            { userOneId: userId, userTwoId: { in: userIds } },
            { userTwoId: userId, userOneId: { in: userIds } }
          ],
          status: 'ACTIVE'
        }
      }),
      prisma.connectionInvitation.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: { in: userIds } },
            { receiverId: userId, senderId: { in: userIds } }
          ],
          status: 'PENDING'
        }
      })
    ]);

    const connMap = new Set(existingConns.map(c => c.userOneId === userId ? c.userTwoId : c.userOneId));
    const sentInviteMap = new Map<string, string>();
    const receivedInviteMap = new Map<string, string>();

    for (const inv of pendingInvites) {
      if (inv.senderId === userId) {
        sentInviteMap.set(inv.receiverId, inv.id);
      } else {
        receivedInviteMap.set(inv.senderId, inv.id);
      }
    }

    const rows = users.map(u => {
      let relationshipState: 'Connected' | 'Pending' | 'Respond' | 'Connect' = 'Connect';
      let invitationId: string | undefined = undefined;

      if (connMap.has(u.id)) {
        relationshipState = 'Connected';
      } else if (sentInviteMap.has(u.id)) {
        relationshipState = 'Pending';
        invitationId = sentInviteMap.get(u.id);
      } else if (receivedInviteMap.has(u.id)) {
        relationshipState = 'Respond';
        invitationId = receivedInviteMap.get(u.id);
      }

      return {
        id: u.id,
        name: u.fullName,
        avatar: u.avatarUrl,
        role: u.role,
        headline: u.bio || `${u.role} on Go Experts`,
        location: [u.city, u.country].filter(Boolean).join(', ') || 'India',
        isVerified: u.isVerified,
        relationshipState,
        invitationId
      };
    });

    return res.json({
      success: true,
      rows,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (error) { next(error); }
};
