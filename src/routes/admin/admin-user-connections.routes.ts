import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";

export const adminUserConnectionsRouter = Router();

// =============================================================================
// 1. GET /api/admin/user-connections/summary
// Platform-wide dynamic networking summary counters
// =============================================================================
adminUserConnectionsRouter.get("/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      acceptedConnections,
      pendingInvitations,
      rejectedInvitations,
      acceptedInvitations,
      totalInvitations,
      freelancerSenders,
      clientSenders,
      founderSenders,
      investorSenders
    ] = await Promise.all([
      prisma.connection.count({ where: { status: "ACTIVE" } }),
      prisma.connectionInvitation.count({ where: { status: "PENDING" } }),
      prisma.connectionInvitation.count({ where: { status: "REJECTED" } }),
      prisma.connectionInvitation.count({ where: { status: "ACCEPTED" } }),
      prisma.connectionInvitation.count(),
      prisma.connectionInvitation.count({ where: { sender: { role: { in: ["freelancer", "Freelancer"] } } } }),
      prisma.connectionInvitation.count({ where: { sender: { role: { in: ["client", "Client", "business", "Business"] } } } }),
      prisma.connectionInvitation.count({ where: { sender: { role: { in: ["founder", "Founder"] } } } }),
      prisma.connectionInvitation.count({ where: { sender: { role: { in: ["investor", "Investor"] } } } }),
    ]);

    // Sent and received are two perspectives on the same invitation record
    const totalSent = totalInvitations;
    const totalReceived = totalInvitations;

    return res.json({
      success: true,
      data: {
        totalAcceptedConnections: acceptedConnections,
        totalPendingInvitations: pendingInvitations,
        totalSentInvitations: totalSent,
        totalReceivedInvitations: totalReceived,
        totalRejectedInvitations: rejectedInvitations,
        totalAcceptedInvitations: acceptedInvitations,
        totalInvitations,
        rolesBreakdown: {
          freelancers: freelancerSenders,
          clients: clientSenders,
          founders: founderSenders,
          investors: investorSenders
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// 2. GET /api/admin/user-connections
// Server-side search, filtering, sorting, and pagination
// =============================================================================
adminUserConnectionsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const search = (req.query.search as string || "").trim();
    const tab = (req.query.tab as string || "all").toLowerCase();
    const recordType = (req.query.recordType as string || "ALL").toUpperCase();
    const statusParam = (req.query.status as string || "ALL").toUpperCase();
    const senderRole = (req.query.senderRole as string || "ALL").toLowerCase();
    const recipientRole = (req.query.recipientRole as string || "ALL").toLowerCase();
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;
    const sortBy = ["createdAt", "updatedAt", "status"].includes(req.query.sortBy as string)
      ? (req.query.sortBy as string)
      : "createdAt";
    const sortOrder = (req.query.sortOrder as string || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    // Build role conditions
    const buildRoleFilter = (roleStr: string) => {
      if (roleStr === "all") return undefined;
      const variations = [roleStr.toLowerCase(), roleStr.toUpperCase(), roleStr.charAt(0).toUpperCase() + roleStr.slice(1).toLowerCase()];
      if (roleStr === "client") variations.push("business", "Business", "BUSINESS");
      return { in: variations };
    };

    // Date range filter
    const createdAtFilter: any = {};
    if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      createdAtFilter.lte = end;
    }
    const hasDateFilter = Boolean(dateFrom || dateTo);

    // Determine query domain based on tab or recordType
    const isConnectionOnly = tab === "accepted" || recordType === "CONNECTION";
    const isInvitationOnly = ["pending", "rejected", "sent", "received", "withdrawn"].includes(tab) || recordType === "INVITATION";

    // Reusable connection where clause
    const connWhere: any = {};
    if (statusParam !== "ALL") connWhere.status = statusParam;
    if (hasDateFilter) connWhere.createdAt = createdAtFilter;

    if (senderRole !== "all" || recipientRole !== "all") {
      const u1Role = buildRoleFilter(senderRole);
      const u2Role = buildRoleFilter(recipientRole);
      if (u1Role && u2Role) {
        connWhere.AND = [
          { userOne: { role: u1Role } },
          { userTwo: { role: u2Role } }
        ];
      } else if (u1Role) {
        connWhere.OR = [
          { userOne: { role: u1Role } },
          { userTwo: { role: u1Role } }
        ];
      } else if (u2Role) {
        connWhere.OR = [
          { userOne: { role: u2Role } },
          { userTwo: { role: u2Role } }
        ];
      }
    }

    if (search) {
      connWhere.OR = [
        { id: { contains: search } },
        { userOneId: { contains: search } },
        { userTwoId: { contains: search } },
        { userOne: { fullName: { contains: search } } },
        { userOne: { email: { contains: search } } },
        { userTwo: { fullName: { contains: search } } },
        { userTwo: { email: { contains: search } } }
      ];
    }

    // Reusable invitation where clause
    const invWhere: any = {};
    if (tab === "pending") invWhere.status = "PENDING";
    else if (tab === "rejected") invWhere.status = "REJECTED";
    else if (statusParam !== "ALL") invWhere.status = statusParam;

    if (senderRole !== "all") {
      const sRole = buildRoleFilter(senderRole);
      if (sRole) invWhere.sender = { role: sRole };
    }
    if (recipientRole !== "all") {
      const rRole = buildRoleFilter(recipientRole);
      if (rRole) invWhere.receiver = { role: rRole };
    }
    if (hasDateFilter) invWhere.createdAt = createdAtFilter;

    if (search) {
      invWhere.OR = [
        { id: { contains: search } },
        { senderId: { contains: search } },
        { receiverId: { contains: search } },
        { sender: { fullName: { contains: search } } },
        { sender: { email: { contains: search } } },
        { receiver: { fullName: { contains: search } } },
        { receiver: { email: { contains: search } } },
        { firstMessage: { contains: search } }
      ];
    }

    // Case 1: Connections Only (Accepted tab or recordType=CONNECTION)
    if (isConnectionOnly) {
      const [total, connections] = await Promise.all([
        prisma.connection.count({ where: connWhere }),
        prisma.connection.findMany({
          where: connWhere,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            userOne: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
            userTwo: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
          }
        })
      ]);

      const records = connections.map(c => ({
        id: c.id,
        recordId: `CN-${c.id.slice(0, 8).toUpperCase()}`,
        recordType: "CONNECTION" as const,
        status: c.status,
        sender: c.userOne,
        recipient: c.userTwo,
        messagePreview: null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));

      return res.json({
        success: true,
        data: {
          records,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1
          }
        }
      });
    }

    // Case 2: Invitations Only (pending, rejected, sent, received tabs or recordType=INVITATION)
    if (isInvitationOnly) {
      const [total, invitations] = await Promise.all([
        prisma.connectionInvitation.count({ where: invWhere }),
        prisma.connectionInvitation.findMany({
          where: invWhere,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            sender: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
            receiver: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } }
          }
        })
      ]);

      const records = invitations.map(inv => ({
        id: inv.id,
        recordId: `INV-${inv.id.slice(0, 8).toUpperCase()}`,
        recordType: "INVITATION" as const,
        status: inv.status,
        sender: inv.sender,
        recipient: inv.receiver,
        messagePreview: inv.firstMessage,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        acceptedAt: inv.acceptedAt,
        rejectedAt: inv.rejectedAt,
      }));

      return res.json({
        success: true,
        data: {
          records,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1
          }
        }
      });
    }

    // Case 3: ALL Records (Interleaved & Globally Sorted pagination across Connection & ConnectionInvitation)
    // To prevent duplicate display of accepted connection relationships, invitations already marked ACCEPTED
    // are represented by their canonical Connection record, while PENDING, REJECTED, and IGNORED represent lifecycle requests.
    const invCombinedWhere = {
      ...invWhere,
      ...(statusParam === "ALL" ? { status: { not: "ACCEPTED" } } : {})
    };

    const candidateLimit = skip + limit;

    const [connTotal, invTotal, connCandidates, invCandidates] = await Promise.all([
      prisma.connection.count({ where: connWhere }),
      prisma.connectionInvitation.count({ where: invCombinedWhere }),
      prisma.connection.findMany({
        where: connWhere,
        take: candidateLimit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          userOne: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
          userTwo: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
        }
      }),
      prisma.connectionInvitation.findMany({
        where: invCombinedWhere,
        take: candidateLimit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          sender: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
          receiver: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } }
        }
      })
    ]);

    const mappedConns = connCandidates.map(c => ({
      id: c.id,
      recordId: `CN-${c.id.slice(0, 8).toUpperCase()}`,
      recordType: "CONNECTION" as const,
      status: c.status,
      sender: c.userOne,
      recipient: c.userTwo,
      messagePreview: null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      acceptedAt: null as Date | null,
      rejectedAt: null as Date | null,
    }));

    const mappedInvs = invCandidates.map(inv => ({
      id: inv.id,
      recordId: `INV-${inv.id.slice(0, 8).toUpperCase()}`,
      recordType: "INVITATION" as const,
      status: inv.status,
      sender: inv.sender,
      recipient: inv.receiver,
      messagePreview: inv.firstMessage,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      acceptedAt: inv.acceptedAt,
      rejectedAt: inv.rejectedAt,
    }));

    // Merge candidates and globally sort by requested column
    const merged = [...mappedConns, ...mappedInvs].sort((a, b) => {
      const aVal = (a as any)[sortBy] instanceof Date ? (a as any)[sortBy].getTime() : (a as any)[sortBy];
      const bVal = (b as any)[sortBy] instanceof Date ? (b as any)[sortBy].getTime() : (b as any)[sortBy];
      if (sortOrder === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      }
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    });

    // Exact slice for current page
    const pageRecords = merged.slice(skip, skip + limit);
    const combinedTotal = connTotal + invTotal;

    return res.json({
      success: true,
      data: {
        records: pageRecords,
        pagination: {
          page,
          limit,
          total: combinedTotal,
          totalPages: Math.ceil(combinedTotal / limit) || 1
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// 3. GET /api/admin/user-connections/:recordType/:id
// Individual record deep inspection
// =============================================================================
adminUserConnectionsRouter.get("/:recordType/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recordType, id } = req.params;
    const typeUpper = recordType.toUpperCase();

    if (typeUpper === "CONNECTION") {
      const conn = await prisma.connection.findUnique({
        where: { id },
        include: {
          userOne: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatarUrl: true,
              status: true,
              createdAt: true
            }
          },
          userTwo: {
            select: {
              id: true,
              fullName: true,
              email: true,
              role: true,
              avatarUrl: true,
              status: true,
              createdAt: true
            }
          }
        }
      });

      if (!conn) {
        return res.status(404).json({ success: false, message: "Connection record not found" });
      }

      // Check linked conversation
      const conversation = await prisma.conversation.findFirst({
        where: {
          OR: [
            { userA: conn.userOneId, userB: conn.userTwoId },
            { userA: conn.userTwoId, userB: conn.userOneId }
          ]
        },
        select: { id: true, status: true, updatedAt: true }
      });

      // Check historical invitation
      const [u1, u2] = [conn.userOneId, conn.userTwoId].sort();
      const invitation = await prisma.connectionInvitation.findFirst({
        where: {
          OR: [
            { senderId: conn.userOneId, receiverId: conn.userTwoId },
            { senderId: conn.userTwoId, receiverId: conn.userOneId }
          ]
        }
      });

      return res.json({
        success: true,
        data: {
          id: conn.id,
          recordId: `CN-${conn.id.slice(0, 8).toUpperCase()}`,
          recordType: "CONNECTION",
          status: conn.status,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt,
          sender: conn.userOne,
          recipient: conn.userTwo,
          invitation: invitation ? {
            id: invitation.id,
            recordId: `INV-${invitation.id.slice(0, 8).toUpperCase()}`,
            firstMessage: invitation.firstMessage,
            status: invitation.status,
            createdAt: invitation.createdAt,
            acceptedAt: invitation.acceptedAt,
            rejectedAt: invitation.rejectedAt
          } : null,
          conversation: conversation ? {
            id: conversation.id,
            status: conversation.status,
            updatedAt: conversation.updatedAt
          } : null
        }
      });
    }

    // Default: INVITATION
    const inv = await prisma.connectionInvitation.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            avatarUrl: true,
            status: true,
            createdAt: true
          }
        },
        receiver: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            avatarUrl: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!inv) {
      return res.status(404).json({ success: false, message: "Invitation record not found" });
    }

    // Check canonical connection if accepted
    const [u1, u2] = [inv.senderId, inv.receiverId].sort();
    const canonicalConnection = await prisma.connection.findUnique({
      where: { userOneId_userTwoId: { userOneId: u1, userTwoId: u2 } }
    });

    const conversation = await prisma.conversation.findFirst({
      where: {
        OR: [
          { userA: inv.senderId, userB: inv.receiverId },
          { userA: inv.receiverId, userB: inv.senderId }
        ]
      },
      select: { id: true, status: true, updatedAt: true }
    });

    return res.json({
      success: true,
      data: {
        id: inv.id,
        recordId: `INV-${inv.id.slice(0, 8).toUpperCase()}`,
        recordType: "INVITATION",
        status: inv.status,
        firstMessage: inv.firstMessage,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
        acceptedAt: inv.acceptedAt,
        rejectedAt: inv.rejectedAt,
        sender: inv.sender,
        recipient: inv.receiver,
        canonicalConnection: canonicalConnection ? {
          id: canonicalConnection.id,
          recordId: `CN-${canonicalConnection.id.slice(0, 8).toUpperCase()}`,
          status: canonicalConnection.status,
          createdAt: canonicalConnection.createdAt,
          updatedAt: canonicalConnection.updatedAt
        } : null,
        conversation: conversation ? {
          id: conversation.id,
          status: conversation.status,
          updatedAt: conversation.updatedAt
        } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// 4. POST /api/admin/user-connections/selection/resolve
// Bulk selection resolution for read-only inspection or reporting
// =============================================================================
adminUserConnectionsRouter.post("/selection/resolve", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { recordIds } = req.body;
    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return res.json({ success: true, data: { selectedCount: 0, items: [] } });
    }

    const cappedIds = recordIds.slice(0, 500);

    const [connections, invitations] = await Promise.all([
      prisma.connection.findMany({
        where: { id: { in: cappedIds } },
        include: {
          userOne: { select: { id: true, fullName: true, email: true, role: true } },
          userTwo: { select: { id: true, fullName: true, email: true, role: true } }
        }
      }),
      prisma.connectionInvitation.findMany({
        where: { id: { in: cappedIds } },
        include: {
          sender: { select: { id: true, fullName: true, email: true, role: true } },
          receiver: { select: { id: true, fullName: true, email: true, role: true } }
        }
      })
    ]);

    const items = [
      ...connections.map(c => ({
        id: c.id,
        recordId: `CN-${c.id.slice(0, 8).toUpperCase()}`,
        recordType: "CONNECTION" as const,
        status: c.status,
        sender: c.userOne,
        recipient: c.userTwo,
        createdAt: c.createdAt
      })),
      ...invitations.map(i => ({
        id: i.id,
        recordId: `INV-${i.id.slice(0, 8).toUpperCase()}`,
        recordType: "INVITATION" as const,
        status: i.status,
        sender: i.sender,
        recipient: i.receiver,
        createdAt: i.createdAt
      }))
    ];

    return res.json({
      success: true,
      data: {
        selectedCount: items.length,
        connectionsCount: connections.length,
        invitationsCount: invitations.length,
        resolvedIds: items.map(it => it.id),
        items
      }
    });
  } catch (error) {
    next(error);
  }
});

export default adminUserConnectionsRouter;
