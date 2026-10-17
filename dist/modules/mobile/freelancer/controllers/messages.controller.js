import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { sendMessage as chatSendMessage, resolveConversation } from '../../chat/controllers/chat.controller.js';
export const listConversations = async (req, res, next) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: {
                deletedAt: null,
                OR: [
                    { status: 'active', OR: [{ userA: req.user.id }, { userB: req.user.id }] },
                    { status: 'ACTIVE', OR: [{ userA: req.user.id }, { userB: req.user.id }] },
                    { status: 'PENDING', OR: [{ userA: req.user.id }, { userB: req.user.id }] },
                ],
            },
            include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
            orderBy: { updatedAt: 'desc' },
            take: 50
        });
        const userIds = new Set();
        conversations.forEach((c) => {
            if (c.userA && c.userA !== req.user.id)
                userIds.add(c.userA);
            if (c.userB && c.userB !== req.user.id)
                userIds.add(c.userB);
        });
        const userMap = new Map();
        if (userIds.size > 0) {
            const users = await prisma.user.findMany({
                where: { id: { in: Array.from(userIds) } },
                select: { id: true, fullName: true, avatarUrl: true, role: true }
            });
            users.forEach(u => userMap.set(u.id, u));
        }
        // Compute unread count per conversation for the viewer
        const conversationIds = conversations.map((c) => c.id);
        const unreadGroups = conversationIds.length > 0 ? await prisma.message.groupBy({
            by: ['conversationId'],
            where: {
                conversationId: { in: conversationIds },
                readAt: null,
                senderId: { not: req.user.id },
            },
            _count: { id: true },
        }).catch(() => []) : [];
        const unreadMap = new Map();
        unreadGroups.forEach((g) => {
            unreadMap.set(g.conversationId, g._count?.id ?? 0);
        });
        const shapedConversations = conversations.map((c) => {
            const otherId = c.userA === req.user.id ? c.userB : (c.userB === req.user.id ? c.userA : null);
            const otherUser = otherId ? userMap.get(otherId) : null;
            const lastMsg = (c.messages && c.messages[0]) ? c.messages[0] : null;
            let fallbackName = c.name;
            if (!fallbackName || fallbackName === 'Chat' || fallbackName === 'Conversation') {
                if (lastMsg && lastMsg.from && lastMsg.from !== 'me' && lastMsg.from !== req.user.fullName) {
                    fallbackName = lastMsg.from;
                }
                else {
                    fallbackName = otherUser ? otherUser.fullName : 'Unknown User';
                }
            }
            const lastText = lastMsg?.text || c.msg || 'No messages yet';
            const lastTime = lastMsg?.createdAt
                ? (typeof lastMsg.createdAt === 'string' ? lastMsg.createdAt : lastMsg.createdAt.toISOString())
                : (lastMsg?.time || (c.updatedAt ? c.updatedAt.toISOString() : c.createdAt?.toISOString()) || new Date().toISOString());
            const unreadCount = unreadMap.get(c.id) ?? (c.unread || 0);
            const result = {
                ...c,
                participantId: otherId,
                otherUserId: otherId,
                peerId: otherId,
                name: otherUser ? otherUser.fullName : fallbackName,
                avatar: otherUser ? otherUser.avatarUrl : (c.avatar || null),
                role: otherUser ? otherUser.role : c.role,
                participant: otherUser
                    ? {
                        id: otherUser.id,
                        fullName: otherUser.fullName,
                        avatarUrl: otherUser.avatarUrl,
                        role: otherUser.role,
                    }
                    : null,
                msg: lastText,
                lastMessage: lastText,
                time: lastTime,
                lastMessageAt: lastTime,
                unread: unreadCount,
                unreadCount: unreadCount,
                conversationStatus: c.status,
                isMuted: c.status === 'PENDING',
                _sortTime: new Date(lastTime).getTime(),
            };
            delete result.userA;
            delete result.userB;
            delete result.messages;
            return result;
        });
        // Sort by latest message descending so the most recent chat is at the top
        shapedConversations.sort((a, b) => (b._sortTime || 0) - (a._sortTime || 0));
        shapedConversations.forEach((c) => delete c._sortTime);
        return res.json(successResponse('Conversations retrieved', shapedConversations));
    }
    catch (error) {
        next(error);
    }
};
export const getConversationDetails = async (req, res, next) => {
    try {
        const conv = await resolveConversation(req.user.id, req.user.role, req.params.id);
        if (!conv) {
            return res.json(successResponse('Messages retrieved', []));
        }
        const messages = await prisma.message.findMany({
            where: { conversationId: conv.id },
            orderBy: { createdAt: 'asc' }
        });
        const peerId = conv.userA === req.user.id ? conv.userB : conv.userA;
        const peer = peerId
            ? await prisma.user.findUnique({ where: { id: peerId }, select: { role: true } }).catch(() => null)
            : null;
        // Mark messages as read for this viewer
        await prisma.message.updateMany({
            where: {
                conversationId: conv.id,
                readAt: null,
                NOT: [
                    { senderId: req.user.id },
                    { from: 'me' },
                    ...(req.user.fullName ? [{ from: req.user.fullName }] : []),
                ],
            },
            data: { readAt: new Date() },
        }).catch(() => null);
        await prisma.conversation.update({
            where: { id: conv.id },
            data: { unread: 0 },
        }).catch(() => null);
        const shaped = messages.map((m) => {
            const senderId = m.senderId;
            const isMine = senderId
                ? senderId === req.user.id
                : Boolean(req.user.fullName && m.from === req.user.fullName);
            return {
                ...m,
                conversationId: conv.id,
                conversationStatus: conv.status,
                from: isMine ? 'me' : m.from,
                senderId: senderId || (isMine
                    ? req.user.id
                    : (conv.userA === req.user.id ? conv.userB : conv.userA)),
                senderRole: isMine ? req.user.role : peer?.role || null,
                isMine,
            };
        });
        return res.json(successResponse('Messages retrieved', shaped));
    }
    catch (error) {
        next(error);
    }
};
export const sendMessage = chatSendMessage;
export const deleteMessage = async (req, res, next) => {
    try {
        await prisma.message.delete({ where: { id: req.params.id } });
        return res.json(successResponse('Message deleted'));
    }
    catch (error) {
        next(error);
    }
};
