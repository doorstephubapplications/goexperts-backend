import { prisma } from "../../config/database.js";
import { canCreateConversation } from "../../common/helpers/conversation-permissions.js";
import { emitNotification } from "../../services/notifications/notification-events.service.js";
import { getIo } from "../../socket/index.js";
function requireUser(req, res) {
    if (!req.user?.id) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return null;
    }
    return req.user.id;
}
export const listConversations = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { contextType, page = "1", pageSize = "10", search = "", role = "ALL", participantRole, dateFrom, dateTo, status = "all", sortBy = "recent_desc" } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
        // 1. Fetch user's conversation states (for archiving, pinned, muted)
        const states = await prisma.conversationState.findMany({
            where: { userId }
        });
        const stateMap = new Map(states.map(s => [s.conversationId, s]));
        const archivedConvIds = states.filter(s => s.isArchived).map(s => s.conversationId);
        // 2. Base where clause
        const whereClause = {
            OR: [{ userA: userId }, { userB: userId }],
            deletedAt: null,
        };
        // Admins can see all conversations
        if (req.user?.role?.includes("admin")) {
            delete whereClause.OR;
        }
        if (contextType) {
            whereClause.contextType = String(contextType);
        }
        // "Delete for Me" filter: exclude archived conversations by default unless status === 'archived'
        if (status === 'archived') {
            whereClause.id = { in: archivedConvIds };
        }
        else if (archivedConvIds.length > 0) {
            whereClause.id = { notIn: archivedConvIds };
        }
        // Date range filter on updatedAt
        if (dateFrom || dateTo) {
            whereClause.updatedAt = {};
            if (dateFrom) {
                const dFrom = new Date(dateFrom);
                dFrom.setHours(0, 0, 0, 0);
                whereClause.updatedAt.gte = dFrom;
            }
            if (dateTo) {
                const dTo = new Date(dateTo);
                dTo.setHours(23, 59, 59, 999);
                whereClause.updatedAt.lte = dTo;
            }
        }
        // Status filter
        if (status === 'unread') {
            whereClause.unread = { gt: 0 };
        }
        else if (status === 'read') {
            whereClause.unread = 0;
        }
        // Determine orderBy
        let orderBy = { updatedAt: "desc" };
        if (sortBy === "recent_asc") {
            orderBy = { updatedAt: "asc" };
        }
        else if (sortBy === "name_asc") {
            orderBy = { name: "asc" };
        }
        else if (sortBy === "name_desc") {
            orderBy = { name: "desc" };
        }
        else if (sortBy === "unread") {
            orderBy = [{ unread: "desc" }, { updatedAt: "desc" }];
        }
        // Fetch conversations
        const convs = await prisma.conversation.findMany({
            where: whereClause,
            include: {
                project: { select: { id: true, title: true } },
            },
            orderBy,
        });
        // Batch fetch other users info
        const otherUserIds = Array.from(new Set(convs.map(c => c.userA === userId ? c.userB : c.userA).filter(Boolean)));
        const [otherUsers, myBlocks, theirBlocks, connectionInvites] = await Promise.all([
            prisma.user.findMany({
                where: { id: { in: otherUserIds } },
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatarUrl: true,
                    role: true,
                    city: true,
                    country: true,
                    lastLoginAt: true,
                    freelancerProfile: { select: { titleHeadline: true, experience: true } },
                    clientProfile: { select: { company: true, industry: true } },
                    founderProfile: { select: { startupName: true, industry: true, founderRole: true } },
                    investorProfile: { select: { firm: true, investorType: true } }
                }
            }),
            prisma.blockedUser.findMany({
                where: { blockerId: userId, blockedId: { in: otherUserIds } }
            }),
            prisma.blockedUser.findMany({
                where: { blockerId: { in: otherUserIds }, blockedId: userId }
            }),
            prisma.connectionInvitation.findMany({
                where: {
                    OR: [
                        { senderId: userId, receiverId: { in: otherUserIds } },
                        { senderId: { in: otherUserIds }, receiverId: userId }
                    ]
                },
                orderBy: { createdAt: 'desc' }
            }).catch(() => [])
        ]);
        const otherUserMap = new Map(otherUsers.map(u => [u.id, u]));
        const myBlockSet = new Set(myBlocks.map(b => b.blockedId));
        const theirBlockSet = new Set(theirBlocks.map(b => b.blockerId));
        const inviteMap = new Map();
        for (const inv of connectionInvites) {
            const pairKey1 = `${inv.senderId}_${inv.receiverId}`;
            const pairKey2 = `${inv.receiverId}_${inv.senderId}`;
            if (!inviteMap.has(pairKey1))
                inviteMap.set(pairKey1, inv);
            if (!inviteMap.has(pairKey2))
                inviteMap.set(pairKey2, inv);
        }
        const io = getIo();
        // Map and filter conversations
        const activeRoleFilter = (participantRole || role || "ALL").toUpperCase();
        const searchLower = search.trim().toLowerCase();
        let formattedList = convs.map((c) => {
            const state = stateMap.get(c.id) || { isPinned: false, isMuted: false, isArchived: false };
            const otherId = c.userA === userId ? c.userB : c.userA;
            const u = otherId ? otherUserMap.get(otherId) : null;
            const isBlockedByMe = otherId ? myBlockSet.has(otherId) : false;
            const isBlockedByThem = otherId ? theirBlockSet.has(otherId) : false;
            const invitation = otherId ? inviteMap.get(`${userId}_${otherId}`) : null;
            // Real-time online presence check from active socket connections
            const isOnline = otherId && io ? ((io.sockets.adapter.rooms.get(otherId)?.size ?? 0) > 0) : !!c.online;
            // Extract descriptor & location
            let descriptor = u?.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : "User";
            let location = [u?.city, u?.country].filter(Boolean).join(", ") || "Remote";
            let businessOrFirmName = null;
            if (u?.freelancerProfile) {
                if (u.freelancerProfile.titleHeadline)
                    descriptor = `Freelancer • ${u.freelancerProfile.titleHeadline}`;
                else
                    descriptor = "Freelancer";
            }
            else if (u?.clientProfile) {
                if (u.clientProfile.company) {
                    businessOrFirmName = u.clientProfile.company;
                    descriptor = `Client • ${u.clientProfile.company}`;
                }
                else if (u.clientProfile.industry) {
                    descriptor = `Client • ${u.clientProfile.industry}`;
                }
                else {
                    descriptor = "Client";
                }
            }
            else if (u?.founderProfile) {
                if (u.founderProfile.startupName) {
                    businessOrFirmName = u.founderProfile.startupName;
                    descriptor = `Founder • ${u.founderProfile.startupName}`;
                }
                else {
                    descriptor = "Founder";
                }
            }
            else if (u?.investorProfile) {
                if (u.investorProfile.firm) {
                    businessOrFirmName = u.investorProfile.firm;
                    descriptor = `Investor • ${u.investorProfile.firm}`;
                }
                else {
                    descriptor = "Investor";
                }
            }
            let profileUrl = "/dashboard/profile";
            const rLower = (u?.role || "").toLowerCase();
            if (rLower === "client" || rLower === "business")
                profileUrl = `/clients/${u?.id || otherId}`;
            else if (rLower === "freelancer")
                profileUrl = `/freelancers/${u?.id || otherId}`;
            else if (rLower === "founder")
                profileUrl = `/founders/${u?.id || otherId}`;
            else if (rLower === "investor")
                profileUrl = `/investors/${u?.id || otherId}`;
            const displayName = u?.fullName?.trim() || businessOrFirmName || (u?.email ? u.email.split("@")[0] : (c.name && c.name !== "Conversation" ? c.name : "Professional"));
            const participant = {
                id: u?.id || otherId,
                displayName,
                fullName: displayName,
                role: u?.role || "user",
                avatarUrl: u?.avatarUrl || null,
                professionalHeadline: descriptor,
                businessOrFirmName,
                location,
                publicProfileUrl: profileUrl,
                onlineStatus: isOnline ? "ONLINE" : "OFFLINE",
                isOnline,
                lastSeenAt: u?.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
                isBlockedByMe,
                isBlockedByThem,
                connectionStatus: invitation?.status || "NONE",
                connectionInvitationId: invitation?.id || null,
                iamSender: invitation?.senderId === userId
            };
            let convTitle = participant.displayName;
            if (c.contextType === "SUPPORT")
                convTitle = `Support: ${c.name}`;
            return {
                id: c.id,
                name: convTitle,
                contextType: c.contextType,
                projectId: c.projectId,
                investmentId: c.investmentId,
                startupIdeaId: c.startupIdeaId,
                supportTicketId: c.supportTicketId,
                project: c.project,
                role: participant.professionalHeadline,
                avatar: participant.avatarUrl,
                preview: c.msg || "No messages yet",
                lastMessageAt: c.updatedAt,
                unread: c.unread,
                online: isOnline,
                status: c.status,
                participant,
                otherUser: participant,
                isPinned: state.isPinned,
                isMuted: state.isMuted,
                isArchived: state.isArchived,
            };
        });
        // Filter by role chip if specified
        if (activeRoleFilter && activeRoleFilter !== "ALL") {
            formattedList = formattedList.filter(item => {
                const uRole = (item.otherUser?.role || "").toUpperCase();
                if (activeRoleFilter === "FREELANCERS" || activeRoleFilter === "FREELANCER") {
                    return uRole.includes("FREELANCER");
                }
                if (activeRoleFilter === "CLIENTS" || activeRoleFilter === "CLIENT") {
                    return uRole.includes("CLIENT") || uRole.includes("BUSINESS");
                }
                if (activeRoleFilter === "STARTUPS" || activeRoleFilter === "FOUNDERS" || activeRoleFilter === "FOUNDER") {
                    return uRole.includes("FOUNDER") || uRole.includes("STARTUP");
                }
                if (activeRoleFilter === "INVESTORS" || activeRoleFilter === "INVESTOR") {
                    return uRole.includes("INVESTOR");
                }
                return true;
            });
        }
        // Additional status filters: online, offline, blocked
        if (status === "online") {
            formattedList = formattedList.filter(item => item.online);
        }
        else if (status === "offline") {
            formattedList = formattedList.filter(item => !item.online);
        }
        else if (status === "blocked") {
            formattedList = formattedList.filter(item => item.otherUser?.isBlockedByMe);
        }
        // Search filter across name, role descriptor, preview
        if (searchLower) {
            formattedList = formattedList.filter(item => {
                const name = (item.name || "").toLowerCase();
                const role = (item.role || "").toLowerCase();
                const preview = (item.preview || "").toLowerCase();
                const otherName = (item.otherUser?.fullName || "").toLowerCase();
                return name.includes(searchLower) || role.includes(searchLower) || preview.includes(searchLower) || otherName.includes(searchLower);
            });
        }
        const totalCount = formattedList.length;
        const totalPages = Math.ceil(totalCount / limit) || 1;
        const startIndex = (pageNum - 1) * limit;
        const paginatedList = formattedList.slice(startIndex, startIndex + limit);
        res.json({
            success: true,
            rows: paginatedList,
            items: paginatedList,
            total: totalCount,
            page: pageNum,
            pageSize: limit,
            totalPages,
            appliedFilters: {
                role: activeRoleFilter,
                search: searchLower,
                status,
                dateFrom,
                dateTo
            }
        });
    }
    catch (err) {
        next(err);
    }
};
export const getConversationMessages = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        if (!id)
            return res.status(400).json({ success: false, message: "conversation id required" });
        const conv = await prisma.conversation.findUnique({
            where: { id },
            include: {
                project: { select: { id: true, title: true, client: true } },
            }
        });
        if (!conv)
            return res.status(404).json({ success: false, message: "Conversation not found" });
        if (conv.userA !== userId && conv.userB !== userId && !req.user?.role?.includes("admin")) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }
        const { page = "1", pageSize = "200" } = req.query || {};
        const pageNum = parseInt(page, 10) || 1;
        const limit = parseInt(pageSize, 10) || 200;
        const skip = (pageNum - 1) * limit;
        const totalCount = await prisma.message.count({ where: { conversationId: id } });
        const messages = await prisma.message.findMany({
            where: { conversationId: id },
            include: {
                reactions: true
            },
            orderBy: { createdAt: "asc" },
            skip,
            take: limit,
        });
        const formatted = messages.map(m => {
            const isDeletedForMe = m.reactions?.some((r) => r.userId === userId && r.reaction === "DELETED_FOR_ME");
            if (isDeletedForMe)
                return null;
            const isStarred = m.reactions?.some((r) => r.userId === userId && r.reaction === "STAR");
            const isPinned = m.reactions?.some((r) => r.reaction === "PIN");
            return {
                id: m.id,
                clientMessageId: m.clientMessageId,
                senderId: m.senderId,
                from: m.senderId === userId ? "me" : (m.from === "System" ? "system" : "them"),
                text: m.text,
                time: m.time,
                createdAt: m.createdAt,
                read: !!m.readAt,
                readAt: m.readAt,
                deliveryStatus: m.deliveryStatus,
                attachmentUrl: m.attachmentUrl,
                isStarred: !!isStarred,
                isPinned: !!isPinned,
                isDeletedForEveryone: !!m.deletedAt
            };
        }).filter(Boolean);
        // Resolve the other participant accurately
        const otherId = conv.userA === userId ? conv.userB : conv.userA;
        let participant = {
            id: otherId,
            displayName: "Professional",
            role: "User",
            avatarUrl: null,
            professionalHeadline: "Marketplace Member",
            businessOrFirmName: null,
            publicProfileUrl: "/dashboard/profile",
            onlineStatus: "OFFLINE",
            lastSeenAt: null
        };
        if (otherId) {
            const [u, blockedByMe, blockedByThem] = await Promise.all([
                prisma.user.findUnique({
                    where: { id: otherId },
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        avatarUrl: true,
                        role: true,
                        city: true,
                        country: true,
                        lastLoginAt: true,
                        freelancerProfile: { select: { titleHeadline: true, experience: true } },
                        clientProfile: { select: { company: true, industry: true } },
                        founderProfile: { select: { startupName: true, industry: true, founderRole: true } },
                        investorProfile: { select: { firm: true, investorType: true } }
                    }
                }),
                prisma.blockedUser.findFirst({ where: { blockerId: userId, blockedId: otherId } }),
                prisma.blockedUser.findFirst({ where: { blockerId: otherId, blockedId: userId } })
            ]);
            if (u) {
                let descriptor = u.role ? (u.role.charAt(0).toUpperCase() + u.role.slice(1)) : "User";
                let businessOrFirmName = null;
                let location = [u.city, u.country].filter(Boolean).join(", ") || "Remote";
                if (u.freelancerProfile) {
                    if (u.freelancerProfile.titleHeadline)
                        descriptor = `Freelancer • ${u.freelancerProfile.titleHeadline}`;
                    else
                        descriptor = "Freelancer";
                }
                else if (u.clientProfile) {
                    if (u.clientProfile.company) {
                        businessOrFirmName = u.clientProfile.company;
                        descriptor = `Client • ${u.clientProfile.company}`;
                    }
                    else if (u.clientProfile.industry) {
                        descriptor = `Client • ${u.clientProfile.industry}`;
                    }
                    else {
                        descriptor = "Client";
                    }
                }
                else if (u.founderProfile) {
                    if (u.founderProfile.startupName) {
                        businessOrFirmName = u.founderProfile.startupName;
                        descriptor = `Founder • ${u.founderProfile.startupName}`;
                    }
                    else {
                        descriptor = "Founder";
                    }
                }
                else if (u.investorProfile) {
                    if (u.investorProfile.firm) {
                        businessOrFirmName = u.investorProfile.firm;
                        descriptor = `Investor • ${u.investorProfile.firm}`;
                    }
                    else {
                        descriptor = "Investor";
                    }
                }
                const io = getIo();
                const isOnline = io ? ((io.sockets.adapter.rooms.get(otherId)?.size ?? 0) > 0) : false;
                let profileUrl = "/dashboard/profile";
                const rLower = (u.role || "").toLowerCase();
                if (rLower === "client" || rLower === "business")
                    profileUrl = `/clients/${u.id}`;
                else if (rLower === "freelancer")
                    profileUrl = `/freelancers/${u.id}`;
                else if (rLower === "founder")
                    profileUrl = `/founders/${u.id}`;
                else if (rLower === "investor")
                    profileUrl = `/investors/${u.id}`;
                participant = {
                    id: u.id,
                    displayName: u.fullName?.trim() || businessOrFirmName || (u.email ? u.email.split("@")[0] : "Professional"),
                    role: u.role || "user",
                    avatarUrl: u.avatarUrl,
                    professionalHeadline: descriptor,
                    businessOrFirmName,
                    location,
                    publicProfileUrl: profileUrl,
                    onlineStatus: isOnline ? "ONLINE" : "OFFLINE",
                    isOnline,
                    lastSeenAt: u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : null,
                    isBlockedByMe: !!blockedByMe,
                    isBlockedByThem: !!blockedByThem
                };
            }
        }
        const userState = await prisma.conversationState.findUnique({
            where: { userId_conversationId: { userId, conversationId: id } }
        });
        if (conv.userA === userId || conv.userB === userId) {
            await prisma.conversation.update({
                where: { id },
                data: { unread: 0 },
            });
        }
        res.json({
            success: true,
            rows: formatted,
            total: totalCount,
            page: pageNum,
            pageSize: limit,
            totalPages: Math.ceil(totalCount / limit),
            conversation: {
                id: conv.id,
                name: participant.displayName,
                avatar: participant.avatarUrl,
                role: participant.professionalHeadline,
                contextType: conv.contextType,
                projectId: conv.projectId,
                project: conv.project,
                startupIdeaId: conv.startupIdeaId,
                status: conv.status,
                participant,
                otherUser: participant,
                isMuted: !!userState?.isMuted,
                isPinned: !!userState?.isPinned,
                isArchived: !!userState?.isArchived
            }
        });
    }
    catch (err) {
        next(err);
    }
};
export const createOrFindConversation = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const userRole = req.user?.role || "client";
        const { recipientId, initialMessage, title, contextType, projectId, investmentId, startupIdeaId, supportTicketId } = req.body;
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
                if (cp)
                    targetUser = await prisma.user.findUnique({ where: { id: cp.userId } }).catch(() => null);
            }
            if (!targetUser) {
                const fp = await prisma.freelancerProfile.findUnique({ where: { id: recipientId } }).catch(() => null);
                if (fp)
                    targetUser = await prisma.user.findUnique({ where: { id: fp.userId } }).catch(() => null);
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
            if (admin)
                finalRecipientId = admin.id;
        }
        const whereConditions = {
            contextType,
        };
        if (projectId)
            whereConditions.projectId = projectId;
        if (investmentId)
            whereConditions.investmentId = investmentId;
        if (startupIdeaId)
            whereConditions.startupIdeaId = startupIdeaId;
        if (supportTicketId)
            whereConditions.supportTicketId = supportTicketId;
        if (finalRecipientId) {
            whereConditions.OR = [
                { userA: userId, userB: finalRecipientId },
                { userA: finalRecipientId, userB: userId },
            ];
        }
        else {
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
                const senderName = newInvite.sender.fullName || 'A professional';
                const senderRole = newInvite.sender.role || 'Member';
                const senderHeadline = newInvite.sender.bio || `${senderRole} on Go Experts`;
                const title = `${senderName} wants to connect`;
                const body = initialMessage || `${senderName} wants to connect with you on Go Experts.`;
                try {
                    await emitNotification({
                        userId: finalRecipientId,
                        type: 'CONNECTION_REQUEST',
                        title,
                        message: body,
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
                            firstMessage: initialMessage,
                            first_message: initialMessage
                        }
                    });
                }
                catch (err) { }
                const { getIo } = await import('../../socket/index.js');
                try {
                    getIo().to(finalRecipientId).emit('connection_request_received', {
                        invitationId: newInvite.id,
                        sender: newInvite.sender
                    });
                }
                catch (err) { }
                const finalRecipientUser = await prisma.user.findUnique({ where: { id: finalRecipientId } });
                if (finalRecipientUser) {
                    const { sendConnectionRequestEmail } = await import("../../services/mobile/email.service.js");
                    await sendConnectionRequestEmail(finalRecipientUser.email, finalRecipientUser.fullName, newInvite.sender.fullName, `${process.env.FRONTEND_URL || 'https://goexperts.in'}/dashboard/network`).catch(e => console.error("Failed to send connection request email:", e));
                }
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
                actionUrl: "/business/messages?conv=" + conv.id,
                metadata: { sender_name: req.user?.fullName || "A user" }
            });
        }
        res.status(201).json({ success: true, conversation: conv });
    }
    catch (err) {
        next(err);
    }
};
export const updateConversationStatus = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        const { status } = req.body;
        const conv = await prisma.conversation.findUnique({ where: { id } });
        if (!conv)
            return res.status(404).json({ success: false, message: "Conversation not found" });
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
    }
    catch (err) {
        next(err);
    }
};
export const addAdminNote = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
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
    }
    catch (err) {
        next(err);
    }
};
export const updateConversationState = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
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
    }
    catch (err) {
        next(err);
    }
};
export const blockUser = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const blockedId = req.params.id;
        await prisma.blockedUser.upsert({
            where: { blockerId_blockedId: { blockerId: userId, blockedId } },
            update: {},
            create: { blockerId: userId, blockedId }
        });
        res.json({ success: true, message: "User blocked successfully" });
    }
    catch (err) {
        next(err);
    }
};
export const unblockUser = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const blockedId = req.params.id;
        await prisma.blockedUser.deleteMany({
            where: { blockerId: userId, blockedId }
        });
        res.json({ success: true, message: "User unblocked successfully" });
    }
    catch (err) {
        next(err);
    }
};
export const acceptConnection = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { invitationId } = req.params;
        const invitation = await prisma.connectionInvitation.findUnique({
            where: { id: invitationId },
            include: { sender: true }
        });
        if (!invitation)
            return res.status(404).json({ success: false, message: "Invitation not found" });
        if (invitation.receiverId !== userId)
            return res.status(403).json({ success: false, message: "Access denied" });
        if (invitation.status !== "PENDING")
            return res.status(400).json({ success: false, message: "Invitation already resolved" });
        // Update invitation status
        await prisma.connectionInvitation.update({
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
                contextId: conv.id,
                metadata: { sender_name: req.user?.fullName || "A user" }
            });
        }
        catch (e) { }
        res.json({ success: true, message: "Connection accepted", conversationId: conv.id });
    }
    catch (err) {
        next(err);
    }
};
export const rejectConnection = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { invitationId } = req.params;
        const invitation = await prisma.connectionInvitation.findUnique({
            where: { id: invitationId }
        });
        if (!invitation)
            return res.status(404).json({ success: false, message: "Invitation not found" });
        if (invitation.receiverId !== userId)
            return res.status(403).json({ success: false, message: "Access denied" });
        await prisma.connectionInvitation.update({
            where: { id: invitationId },
            data: { status: "REJECTED", rejectedAt: new Date() }
        });
        res.json({ success: true, message: "Connection rejected" });
    }
    catch (err) {
        next(err);
    }
};
export const deleteConversation = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        const conv = await prisma.conversation.findUnique({ where: { id } });
        if (!conv)
            return res.status(404).json({ success: false, message: "Conversation not found" });
        if (conv.userA !== userId && conv.userB !== userId && !req.user?.role?.includes("admin")) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }
        // Set isArchived = true for this user ("Delete for Me" semantics)
        await prisma.conversationState.upsert({
            where: { userId_conversationId: { userId, conversationId: id } },
            update: { isArchived: true },
            create: { userId, conversationId: id, isArchived: true }
        });
        res.json({ success: true, message: "Conversation deleted for you" });
    }
    catch (err) {
        next(err);
    }
};
export const bulkDeleteConversations = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { conversationIds } = req.body;
        if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
            return res.status(400).json({ success: false, message: "conversationIds array is required" });
        }
        // Verify ownership of the conversations
        const validConvs = await prisma.conversation.findMany({
            where: {
                id: { in: conversationIds },
                OR: [{ userA: userId }, { userB: userId }]
            },
            select: { id: true }
        });
        const validIds = validConvs.map(c => c.id);
        // Apply isArchived = true for each verified conversation
        await Promise.all(validIds.map(convId => prisma.conversationState.upsert({
            where: { userId_conversationId: { userId, conversationId: convId } },
            update: { isArchived: true },
            create: { userId, conversationId: convId, isArchived: true }
        })));
        res.json({
            success: true,
            message: `${validIds.length} conversations deleted for you`,
            deletedCount: validIds.length,
            deletedIds: validIds
        });
    }
    catch (err) {
        next(err);
    }
};
export const getConversationAttachments = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        const conv = await prisma.conversation.findUnique({ where: { id } });
        if (!conv)
            return res.status(404).json({ success: false, message: "Conversation not found" });
        if (conv.userA !== userId && conv.userB !== userId && !req.user?.role?.includes("admin")) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }
        const rawMessages = await prisma.message.findMany({
            where: {
                conversationId: id,
                attachmentUrl: { not: null },
            },
            orderBy: { createdAt: "desc" },
        });
        const messagesWithAttachments = rawMessages.filter((m) => m.attachmentUrl && m.attachmentUrl.trim().length > 0);
        const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp"];
        const formatted = messagesWithAttachments.map(m => {
            const url = m.attachmentUrl || "";
            const filename = (m.text && m.text.includes(".") && !m.text.includes(" "))
                ? m.text
                : (url.split("/").pop()?.split("?")[0] || "attachment");
            const cleanUrl = url.split("?")[0].toLowerCase();
            const ext = filename.lastIndexOf(".") !== -1 ? filename.substring(filename.lastIndexOf(".")).toLowerCase() : "";
            const isImage = imageExts.some(e => cleanUrl.endsWith(e) || ext === e) || url.startsWith("data:image/");
            return {
                id: m.id,
                url,
                filename,
                extension: ext.replace(".", "").toUpperCase() || (isImage ? "IMAGE" : "FILE"),
                isImage,
                createdAt: m.createdAt,
                time: m.time,
                senderId: m.senderId,
                size: "Image"
            };
        });
        const images = formatted.filter(f => f.isImage);
        const documents = formatted.filter(f => !f.isImage);
        res.json({
            success: true,
            all: formatted,
            images,
            documents,
            totalCount: formatted.length
        });
    }
    catch (err) {
        next(err);
    }
};
export const sendConversationMessage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id: conversationId } = req.params;
        const { text, attachmentUrl, clientMessageId, replyToId } = req.body;
        if (!text && !attachmentUrl) {
            return res.status(400).json({ success: false, message: "Message text or attachment is required" });
        }
        const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
        if (!conv)
            return res.status(404).json({ success: false, message: "Conversation not found" });
        if (conv.userA !== userId && conv.userB !== userId && !req.user?.role?.includes("admin")) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }
        const recipientId = conv.userA === userId ? conv.userB : conv.userA;
        // Check if blocked
        if (recipientId) {
            const isBlocked = await prisma.blockedUser.findFirst({
                where: {
                    OR: [
                        { blockerId: userId, blockedId: recipientId },
                        { blockerId: recipientId, blockedId: userId }
                    ]
                }
            });
            if (isBlocked) {
                return res.status(403).json({ success: false, message: "Cannot send message. User is blocked." });
            }
        }
        // Idempotency check
        if (clientMessageId) {
            const existing = await prisma.message.findFirst({
                where: { clientMessageId, conversationId, senderId: userId }
            });
            if (existing) {
                return res.json({ success: true, message: existing });
            }
        }
        const message = await prisma.message.create({
            data: {
                clientMessageId,
                conversationId,
                senderId: userId,
                from: userId,
                text: text || "Sent an attachment",
                attachmentUrl: attachmentUrl || null,
                replyToId: replyToId || null,
                time: new Date().toISOString(),
            },
            include: { replyTo: true }
        });
        await prisma.conversation.update({
            where: { id: conversationId },
            data: { msg: text || "Attachment", updatedAt: new Date(), unread: { increment: 1 } }
        });
        // Unarchive for both participants on new message
        if (recipientId) {
            await prisma.conversationState.updateMany({
                where: { conversationId, isArchived: true },
                data: { isArchived: false }
            });
        }
        // Broadcast real-time socket event
        const io = getIo();
        if (io) {
            const payload = {
                id: message.id,
                clientMessageId: message.clientMessageId,
                conversationId,
                from: 'them',
                senderId: userId,
                text: message.text,
                attachmentUrl: message.attachmentUrl,
                replyToId: message.replyToId,
                replyTo: message.replyTo,
                time: message.time,
                createdAt: message.createdAt,
                read: false,
                deliveryStatus: message.deliveryStatus,
            };
            io.to(`conversation:${conversationId}`).emit('message:new', payload);
            if (recipientId) {
                io.to(recipientId).emit('message:new', payload);
            }
        }
        res.status(201).json({ success: true, message });
    }
    catch (err) {
        next(err);
    }
};
export const getBlockStatus = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const targetId = req.params.id;
        const [blockedByMe, blockedByThem] = await Promise.all([
            prisma.blockedUser.findFirst({ where: { blockerId: userId, blockedId: targetId } }),
            prisma.blockedUser.findFirst({ where: { blockerId: targetId, blockedId: userId } })
        ]);
        res.json({
            success: true,
            isBlockedByMe: !!blockedByMe,
            isBlockedByThem: !!blockedByThem,
            isBlocked: !!blockedByMe || !!blockedByThem
        });
    }
    catch (err) {
        next(err);
    }
};
export const muteConversation = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        const { duration = "always" } = req.body;
        const conv = await prisma.conversation.findUnique({ where: { id } });
        if (!conv)
            return res.status(404).json({ success: false, message: "Conversation not found" });
        if (conv.userA !== userId && conv.userB !== userId && !req.user?.role?.includes("admin")) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }
        let mutedUntil = null;
        const now = new Date();
        if (duration === "8_hours") {
            mutedUntil = new Date(now.getTime() + 8 * 3600 * 1000);
        }
        else if (duration === "1_week") {
            mutedUntil = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
        }
        await prisma.conversationState.upsert({
            where: { userId_conversationId: { userId, conversationId: id } },
            update: { isMuted: true },
            create: { userId, conversationId: id, isMuted: true }
        });
        try {
            const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
            let currentPrefs = {};
            try {
                if (pref?.preferences)
                    currentPrefs = JSON.parse(pref.preferences);
            }
            catch (e) { }
            if (!currentPrefs.mutedConversations)
                currentPrefs.mutedConversations = {};
            currentPrefs.mutedConversations[id] = {
                mutedUntil: mutedUntil ? mutedUntil.toISOString() : null,
                duration,
                updatedAt: now.toISOString()
            };
            await prisma.notificationPreference.upsert({
                where: { userId },
                update: { preferences: JSON.stringify(currentPrefs) },
                create: { userId, preferences: JSON.stringify(currentPrefs) }
            });
        }
        catch (e) { }
        res.json({
            success: true,
            message: "Conversation muted successfully",
            isMuted: true,
            mutedUntil,
            duration
        });
    }
    catch (err) {
        next(err);
    }
};
export const unmuteConversation = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await prisma.conversationState.upsert({
            where: { userId_conversationId: { userId, conversationId: id } },
            update: { isMuted: false },
            create: { userId, conversationId: id, isMuted: false }
        });
        try {
            const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
            if (pref?.preferences) {
                const currentPrefs = JSON.parse(pref.preferences);
                if (currentPrefs.mutedConversations && currentPrefs.mutedConversations[id]) {
                    delete currentPrefs.mutedConversations[id];
                    await prisma.notificationPreference.update({
                        where: { userId },
                        data: { preferences: JSON.stringify(currentPrefs) }
                    });
                }
            }
        }
        catch (e) { }
        res.json({ success: true, message: "Conversation unmuted", isMuted: false });
    }
    catch (err) {
        next(err);
    }
};
export const bulkDeleteMessages = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { messageIds, deleteForEveryone = false } = req.body;
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ success: false, message: "messageIds array is required" });
        }
        const messages = await prisma.message.findMany({
            where: { id: { in: messageIds } },
            include: { conversation: true }
        });
        const deletedIds = [];
        const io = getIo();
        for (const msg of messages) {
            if (msg.conversation.userA !== userId && msg.conversation.userB !== userId && !req.user?.role?.includes("admin")) {
                continue;
            }
            if (deleteForEveryone) {
                if (msg.senderId === userId || req.user?.role?.includes("admin")) {
                    await prisma.message.update({
                        where: { id: msg.id },
                        data: {
                            deletedAt: new Date(),
                            text: "This message was deleted",
                            attachmentUrl: null
                        }
                    });
                    deletedIds.push(msg.id);
                    if (io) {
                        io.to(`conversation:${msg.conversationId}`).emit("message:deleted", {
                            messageId: msg.id,
                            conversationId: msg.conversationId,
                            deletedForEveryone: true
                        });
                    }
                }
            }
            else {
                await prisma.messageReaction.upsert({
                    where: {
                        messageId_userId_reaction: {
                            messageId: msg.id,
                            userId,
                            reaction: "DELETED_FOR_ME"
                        }
                    },
                    update: {},
                    create: {
                        messageId: msg.id,
                        userId,
                        reaction: "DELETED_FOR_ME"
                    }
                });
                deletedIds.push(msg.id);
            }
        }
        res.json({
            success: true,
            message: `${deletedIds.length} messages deleted`,
            deletedIds,
            deleteForEveryone
        });
    }
    catch (err) {
        next(err);
    }
};
export const forwardMessages = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { messageIds, targetConversationIds } = req.body;
        if (!Array.isArray(messageIds) || messageIds.length === 0 || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
            return res.status(400).json({ success: false, message: "messageIds and targetConversationIds arrays are required" });
        }
        const sourceMessages = await prisma.message.findMany({
            where: { id: { in: messageIds } },
            orderBy: { createdAt: "asc" }
        });
        const targetConversations = await prisma.conversation.findMany({
            where: {
                id: { in: targetConversationIds },
                OR: [{ userA: userId }, { userB: userId }]
            }
        });
        const io = getIo();
        let totalForwarded = 0;
        for (const conv of targetConversations) {
            const recipientId = conv.userA === userId ? conv.userB : conv.userA;
            if (recipientId) {
                const isBlocked = await prisma.blockedUser.findFirst({
                    where: {
                        OR: [
                            { blockerId: userId, blockedId: recipientId },
                            { blockerId: recipientId, blockedId: userId }
                        ]
                    }
                });
                if (isBlocked)
                    continue;
            }
            for (const src of sourceMessages) {
                const newMsg = await prisma.message.create({
                    data: {
                        conversationId: conv.id,
                        senderId: userId,
                        from: userId,
                        text: src.text,
                        attachmentUrl: src.attachmentUrl,
                        time: new Date().toISOString(),
                    }
                });
                await prisma.conversation.update({
                    where: { id: conv.id },
                    data: {
                        msg: src.text || "Forwarded an attachment",
                        updatedAt: new Date(),
                        unread: { increment: 1 }
                    }
                });
                if (recipientId) {
                    await prisma.conversationState.updateMany({
                        where: { conversationId: conv.id, isArchived: true },
                        data: { isArchived: false }
                    });
                }
                if (io) {
                    const payload = {
                        id: newMsg.id,
                        conversationId: conv.id,
                        from: "them",
                        senderId: userId,
                        text: newMsg.text,
                        attachmentUrl: newMsg.attachmentUrl,
                        time: newMsg.time,
                        createdAt: newMsg.createdAt,
                        read: false,
                        deliveryStatus: newMsg.deliveryStatus
                    };
                    io.to(`conversation:${conv.id}`).emit("message:new", payload);
                    if (recipientId)
                        io.to(recipientId).emit("message:new", payload);
                }
                totalForwarded++;
            }
        }
        res.json({
            success: true,
            message: "Successfully forwarded messages",
            forwardedCount: totalForwarded
        });
    }
    catch (err) {
        next(err);
    }
};
export const starMessage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await prisma.messageReaction.upsert({
            where: {
                messageId_userId_reaction: {
                    messageId: id,
                    userId,
                    reaction: "STAR"
                }
            },
            update: {},
            create: {
                messageId: id,
                userId,
                reaction: "STAR"
            }
        });
        res.json({ success: true, message: "Message starred", isStarred: true });
    }
    catch (err) {
        next(err);
    }
};
export const unstarMessage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await prisma.messageReaction.deleteMany({
            where: {
                messageId: id,
                userId,
                reaction: "STAR"
            }
        });
        res.json({ success: true, message: "Message unstarred", isStarred: false });
    }
    catch (err) {
        next(err);
    }
};
export const pinMessage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await prisma.messageReaction.upsert({
            where: {
                messageId_userId_reaction: {
                    messageId: id,
                    userId,
                    reaction: "PIN"
                }
            },
            update: {},
            create: {
                messageId: id,
                userId,
                reaction: "PIN"
            }
        });
        res.json({ success: true, message: "Message pinned", isPinned: true });
    }
    catch (err) {
        next(err);
    }
};
export const unpinMessage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await prisma.messageReaction.deleteMany({
            where: {
                messageId: id,
                reaction: "PIN"
            }
        });
        res.json({ success: true, message: "Message unpinned", isPinned: false });
    }
    catch (err) {
        next(err);
    }
};
export const getMessageInfo = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        const message = await prisma.message.findUnique({
            where: { id },
            include: {
                conversation: true
            }
        });
        if (!message)
            return res.status(404).json({ success: false, message: "Message not found" });
        if (message.conversation.userA !== userId && message.conversation.userB !== userId && !req.user?.role?.includes("admin")) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }
        const sender = message.senderId ? await prisma.user.findUnique({
            where: { id: message.senderId },
            select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
        }) : null;
        res.json({
            success: true,
            info: {
                id: message.id,
                text: message.text,
                senderId: message.senderId,
                senderName: sender?.fullName || sender?.email || "Unknown",
                senderAvatar: sender?.avatarUrl || null,
                senderRole: sender?.role || "user",
                createdAt: message.createdAt,
                readAt: message.readAt,
                deliveryStatus: message.deliveryStatus,
                attachmentUrl: message.attachmentUrl,
                clientMessageId: message.clientMessageId
            }
        });
    }
    catch (err) {
        next(err);
    }
};
