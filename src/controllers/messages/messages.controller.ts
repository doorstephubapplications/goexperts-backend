import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { canCreateConversation, ConversationContextType } from "../../common/helpers/conversation-permissions.js";
import { emitNotification } from "../../services/notifications/notification-events.service.js";

function requireUser(req: AuthenticatedRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

export const listConversations = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    
    const { contextType } = req.query;

    const whereClause: any = {
      OR: [{ userA: userId }, { userB: userId }],
    };
    
    // Admins can see all support tickets
    if (req.user?.role === "admin" && contextType === "SUPPORT") {
      delete whereClause.OR;
      whereClause.contextType = "SUPPORT";
    }

    if (contextType) {
      whereClause.contextType = String(contextType);
    }

    const convs = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        project: { select: { id: true, title: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

        const states = await prisma.conversationState.findMany({ where: { userId, conversationId: { in: convs.map(c => c.id) } } });
    const stateMap = states.reduce((acc, s) => { acc[s.conversationId] = s; return acc; }, {} as Record<string, any>);

    const formatted = await Promise.all(convs.map(async (c: any) => {
      const state = stateMap[c.id] || { isPinned: false, isMuted: false, isArchived: false };
      const otherId = c.userA === userId ? c.userB : c.userA;
      let otherUser: any = { fullName: "Unknown User", avatarUrl: null, headline: "User", isBlockedByMe: false, isBlockedByThem: false };
      
      if (otherId) {
        const [u, blockedByMe, blockedByThem, connectionInvitation] = await Promise.all([
          prisma.user.findUnique({ where: { id: otherId } }),
          prisma.blockedUser.findFirst({ where: { blockerId: userId, blockedId: otherId } }),
          prisma.blockedUser.findFirst({ where: { blockerId: otherId, blockedId: userId } }),
          (prisma as any).connectionInvitation.findFirst({
            where: {
              OR: [
                { senderId: userId, receiverId: otherId },
                { senderId: otherId, receiverId: userId }
              ]
            },
            orderBy: { createdAt: 'desc' }
          }).catch(() => null)
        ]);
        if (u) {
          otherUser = {
            id: u.id,
            role: u.role,
            fullName: u.fullName || u.email || "Unknown",
            avatarUrl: u.avatarUrl,
            headline: u.role || "User",
            isBlockedByMe: !!blockedByMe,
            isBlockedByThem: !!blockedByThem,
            connectionStatus: connectionInvitation?.status || "NONE",
            connectionInvitationId: connectionInvitation?.id || null,
            iamSender: connectionInvitation?.senderId === userId
          };
        }
      }
      
      let convTitle = (c.name && c.name !== "Conversation") ? c.name : otherUser.fullName;
      // if (c.contextType === "PROJECT" && c.project) convTitle = c.project.title; // Keep client name instead
      if (c.contextType === "SUPPORT") convTitle = `Support: ${c.name}`;

      return {
        id: c.id,
        name: convTitle,
        contextType: c.contextType,
        projectId: c.projectId,
        investmentId: c.investmentId,
        startupIdeaId: c.startupIdeaId,
        supportTicketId: c.supportTicketId,
        project: c.project,
        role: otherUser.headline,
        avatar: otherUser.avatarUrl,
        preview: c.msg || "No messages yet",
        lastMessageAt: c.updatedAt,
        unread: c.unread,
        online: c.online,
        status: c.status,
        otherUser: otherUser,
        isPinned: state.isPinned,
        isMuted: state.isMuted,
        isArchived: state.isArchived,
      };
    }));

    res.json({ success: true, rows: formatted, total: formatted.length });
  } catch (err) {
    next(err);
  }
};

export const getConversationMessages = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: "conversation id required" });

    const conv = await prisma.conversation.findUnique({ 
      where: { id },
      include: { 
        project: { select: { id: true, title: true, client: true } },
      }
    });
    
    if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });
    
    if (conv.userA !== userId && conv.userB !== userId && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    const formatted = messages.map(m => ({
        id: m.id,
        clientMessageId: m.clientMessageId,
        senderId: m.senderId,
        from: m.senderId === userId ? "me" : (m.from === "System" ? "system" : "them"),
        text: m.text,
        time: m.time,
        createdAt: m.createdAt,
        read: !!m.readAt,
        attachmentUrl: m.attachmentUrl,
      }));

    if (conv.userA === userId || conv.userB === userId) {
      await prisma.conversation.update({
        where: { id },
        data: { unread: 0 },
      });
    }

    res.json({ 
      success: true, 
      rows: formatted, 
      total: formatted.length,
      conversation: {
        id: conv.id,
        contextType: conv.contextType,
        projectId: conv.projectId,
        project: conv.project,
        startupIdeaId: conv.startupIdeaId,
        status: conv.status
      }
    });
  } catch (err) {
    next(err);
  }
};

export const createOrFindConversation = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const userRole = req.user?.role || "client";

    const { 
      recipientId, 
      initialMessage, 
      title, 
      contextType, 
      projectId, 
      investmentId, 
      startupIdeaId, 
      supportTicketId 
    } = req.body;
    
    if (!recipientId && contextType !== "SUPPORT") {
      return res.status(400).json({ success: false, message: "recipientId is required" });
    }

    let targetUser = null;
    if (recipientId) {
      targetUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: recipientId },
            { email: recipientId },
            { fullName: recipientId },
          ],
        },
      });
      // Fallback to check if recipientId is a Profile ID
      if (!targetUser) {
        const cp = await prisma.clientProfile.findUnique({ where: { id: recipientId } }).catch(() => null);
        if (cp) targetUser = await prisma.user.findUnique({ where: { id: cp.userId } }).catch(() => null);
      }
      if (!targetUser) {
        const fp = await prisma.freelancerProfile.findUnique({ where: { id: recipientId } }).catch(() => null);
        if (fp) targetUser = await prisma.user.findUnique({ where: { id: fp.userId } }).catch(() => null);
      }
    }

    if (!targetUser && startupIdeaId) {
      const idea = await prisma.startupIdea.findUnique({ where: { id: startupIdeaId } });
      if (idea?.founder) {
        targetUser = await prisma.user.findFirst({
          where: {
            OR: [
              { id: idea.founder },
              { email: idea.founder },
              { fullName: idea.founder },
            ],
          },
        });
      }
    }

    let finalRecipientId = targetUser?.id || recipientId;
    let targetRole = targetUser?.role || "founder"; 

    let actualContextId = projectId || investmentId || startupIdeaId || supportTicketId;
    
    const isAuthorized = canCreateConversation(userRole, targetRole, contextType, actualContextId);
    if (!isAuthorized && contextType !== "SUPPORT") {
       return res.status(403).json({ success: false, message: "Not authorized to create a conversation with this context." });
    }

    if (contextType === "SUPPORT" && !recipientId) {
       const admin = await prisma.user.findFirst({ where: { role: "admin" } });
       if (admin) finalRecipientId = admin.id;
    }

    const whereConditions: any = {
      contextType,
    };
    if (projectId) whereConditions.projectId = projectId;
    if (investmentId) whereConditions.investmentId = investmentId;
    if (startupIdeaId) whereConditions.startupIdeaId = startupIdeaId;
    if (supportTicketId) whereConditions.supportTicketId = supportTicketId;

    if (finalRecipientId) {
      whereConditions.OR = [
        { userA: userId, userB: finalRecipientId },
        { userA: finalRecipientId, userB: userId },
      ];
    } else {
      whereConditions.userA = userId;
    }

    let conv = await prisma.conversation.findFirst({
      where: whereConditions,
    });

    // --- NEW: Connection & Invitation Check ---
    if (!conv && contextType !== "SUPPORT" && finalRecipientId && finalRecipientId !== userId) {
      const [a, b] = [userId, finalRecipientId].sort();
      const connection = await prisma.connection.findUnique({
        where: { userOneId_userTwoId: { userOneId: a, userTwoId: b } }
      });
      
      if (!connection || connection.status !== 'ACTIVE') {
        const existingInvite = await prisma.connectionInvitation.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: finalRecipientId },
              { senderId: finalRecipientId, receiverId: userId }
            ]
          }
        });

        if (existingInvite) {
          return res.status(400).json({ success: false, message: 'Connection invitation already exists or was rejected' });
        }

        if (!initialMessage) {
           return res.json({ success: true, message: 'Ready to send connection request', data: { pendingConnection: true } });
        }

        const newInvite = await prisma.connectionInvitation.create({
          data: {
            senderId: userId,
            receiverId: finalRecipientId,
            firstMessage: initialMessage,
            status: 'PENDING'
          },
          include: { sender: true }
        });

        const title = 'New Connection Request';
        const body = `${newInvite.sender.fullName} sent you a connection request.`;
        
        try {
          await emitNotification({
            userId: finalRecipientId,
            type: 'CONNECTION_REQUEST',
            title,
            message: body,
            contextType: 'CONNECTION',
            contextId: newInvite.id
          });
        } catch(err) {}

        const { getIo } = await import('../../socket/index.js');
        try {
          getIo().to(finalRecipientId).emit('connection_request_received', {
            invitationId: newInvite.id,
            sender: newInvite.sender
          });
        } catch(err) {}

        return res.status(200).json({ success: true, message: 'Connection request sent', data: newInvite });
      }
    }
    // --- END NEW ---

    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          name: title || "Conversation",
          role: contextType || "Context",
          userA: userId,
          userB: finalRecipientId,
          contextType: contextType,
          projectId: projectId || null,
          investmentId: investmentId || null,
          startupIdeaId: startupIdeaId || null,
          supportTicketId: supportTicketId || null
        },
      });
    }

    if (initialMessage && finalRecipientId) {
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderId: userId,
          from: userId,
          text: initialMessage,
          time: new Date().toISOString(),
        }
      });
      conv = await prisma.conversation.update({
        where: { id: conv.id },
        data: { msg: initialMessage, updatedAt: new Date(), unread: { increment: 1 } },
      });

      await emitNotification({
         userId: finalRecipientId,
         type: "MESSAGE_RECEIVED",
         title: "New Message",
         message: initialMessage.length > 50 ? initialMessage.substring(0, 50) + "..." : initialMessage,
         contextType: contextType,
         contextId: actualContextId,
         actionUrl: "/business/messages?conv=" + conv.id
      } as any);
    }

    res.status(201).json({ success: true, conversation: conv });
  } catch (err) {
    next(err);
  }
};

export const updateConversationStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { id } = req.params;
    const { status } = req.body;

    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

    if (conv.userA !== userId && conv.userB !== userId && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (status === "BLOCKED" && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Only admins can block conversations" });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { status }
    });

    res.json({ success: true, conversation: updated });
  } catch (err) {
    next(err);
  }
};

export const addAdminNote = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    if (req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { id } = req.params;
    const { note } = req.body;

    await prisma.conversation.update({
      where: { id },
      data: { adminNote: note }
    });

    res.json({ success: true, message: "Note added" });
  } catch (err) {
    next(err);
  }
};

export const updateConversationState = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { id } = req.params;
    const { isPinned, isMuted, isArchived } = req.body;

    const state = await prisma.conversationState.upsert({
      where: { userId_conversationId: { userId, conversationId: id } },
      update: {
        isPinned: isPinned !== undefined ? isPinned : undefined,
        isMuted: isMuted !== undefined ? isMuted : undefined,
        isArchived: isArchived !== undefined ? isArchived : undefined,
      },
      create: {
        userId,
        conversationId: id,
        isPinned: isPinned || false,
        isMuted: isMuted || false,
        isArchived: isArchived || false,
      }
    });

    res.json({ success: true, state });
  } catch (err) {
    next(err);
  }
};

export const blockUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const blockedId = req.params.id;

    await prisma.blockedUser.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId } },
      update: {},
      create: { blockerId: userId, blockedId }
    });

    res.json({ success: true, message: "User blocked successfully" });
  } catch (err) {
    next(err);
  }
};

export const unblockUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;
    const blockedId = req.params.id;

    await prisma.blockedUser.deleteMany({
      where: { blockerId: userId, blockedId }
    });

    res.json({ success: true, message: "User unblocked successfully" });
  } catch (err) {
    next(err);
  }
};

export const acceptConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { invitationId } = req.params;

    const invitation = await (prisma as any).connectionInvitation.findUnique({
      where: { id: invitationId },
      include: { sender: true }
    });

    if (!invitation) return res.status(404).json({ success: false, message: "Invitation not found" });
    if (invitation.receiverId !== userId) return res.status(403).json({ success: false, message: "Access denied" });
    if (invitation.status !== "PENDING") return res.status(400).json({ success: false, message: "Invitation already resolved" });

    // Update invitation status
    await (prisma as any).connectionInvitation.update({
      where: { id: invitationId },
      data: { status: "ACCEPTED", acceptedAt: new Date() }
    });

    // Create the actual conversation
    const existingConv = await prisma.conversation.findFirst({
      where: {
        OR: [
          { userA: invitation.senderId, userB: userId },
          { userA: userId, userB: invitation.senderId }
        ]
      }
    });

    let conv = existingConv;
    if (!conv) {
      conv = await prisma.conversation.create({
        data: {
          name: invitation.sender.fullName || "Conversation",
          role: "CONNECTION",
          userA: invitation.senderId,
          userB: userId,
          contextType: "CONNECTION",
          msg: invitation.firstMessage || null
        }
      });
    }

    // Create the first message from sender if it exists
    if (invitation.firstMessage) {
      const exists = await prisma.message.findFirst({
        where: { conversationId: conv.id }
      });
      if (!exists) {
        await prisma.message.create({
          data: {
            conversationId: conv.id,
            senderId: invitation.senderId,
            from: invitation.senderId,
            text: invitation.firstMessage,
            time: invitation.createdAt.toISOString()
          }
        });
      }
    }

    // Notify the sender
    try {
      await emitNotification({
        userId: invitation.senderId,
        type: "CONNECTION_ACCEPTED",
        title: "Connection Accepted",
        message: `Your connection request was accepted.`,
        contextType: "CONNECTION",
        contextId: conv.id
      });
    } catch (e) {}

    res.json({ success: true, message: "Connection accepted", conversationId: conv.id });
  } catch (err) {
    next(err);
  }
};

export const rejectConnection = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = requireUser(req, res);
    if (!userId) return;

    const { invitationId } = req.params;

    const invitation = await (prisma as any).connectionInvitation.findUnique({
      where: { id: invitationId }
    });

    if (!invitation) return res.status(404).json({ success: false, message: "Invitation not found" });
    if (invitation.receiverId !== userId) return res.status(403).json({ success: false, message: "Access denied" });

    await (prisma as any).connectionInvitation.update({
      where: { id: invitationId },
      data: { status: "REJECTED", rejectedAt: new Date() }
    });

    res.json({ success: true, message: "Connection rejected" });
  } catch (err) {
    next(err);
  }
};
