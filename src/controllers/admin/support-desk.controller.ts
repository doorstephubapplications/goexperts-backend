import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { getIo } from "../../socket/index.js";
import { sendEmail, shell } from "../../services/mobile/email.service.js";
import { emitNotification } from "../../services/notifications/notification-events.service.js";

// Helper to attach requester info to tickets
async function attachRequesters(tickets: any[]) {
  const requesterIds = [...new Set(tickets.map(t => t.requesterId).filter(Boolean))] as string[];
  if (requesterIds.length === 0) return tickets;
  const users = await prisma.user.findMany({
    where: { id: { in: requesterIds } },
    select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
  });
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  return tickets.map(t => ({ ...t, requester: userMap[t.requesterId] || null }));
}

// 1. List All Tickets (Admin)
export const listAdminTickets = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { status, priority, categoryId, search, page = "1", pageSize = "20" } = req.query;
    
    const where: any = {};
    if (status) where.status = String(status).toUpperCase();
    if (priority) where.priority = String(priority);
    if (categoryId) where.categoryId = String(categoryId);
    
    if (search) {
      const q = String(search);
      where.OR = [
        { ticketNumber: { contains: q } },
        { subject: { contains: q } },
        { requesterId: { contains: q } }
      ];
    }

    const skip = (Number(page) - 1) * Number(pageSize);
    const take = Number(pageSize);

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" } } }
      }),
      prisma.supportTicket.count({ where })
    ]);

    const ticketsWithRequesters = await attachRequesters(tickets);

    res.json({
      success: true,
      data: ticketsWithRequesters,
      items: ticketsWithRequesters,
      total,
      page: Number(page),
      pageSize: take
    });
  } catch (err) {
    next(err);
  }
};

// 2. Get Single Ticket Details
export const getAdminTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" } }
      }
    });

    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });

    // Attach requester info manually
    let requester = null;
    if (ticket.requesterId) {
      requester = await prisma.user.findUnique({
        where: { id: ticket.requesterId },
        select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
      });
    }

    const ticketWithRequester = { ...ticket, requester };
    res.json({ success: true, ticket: ticketWithRequester, data: ticketWithRequester });
  } catch (err) {
    next(err);
  }
};

// 3. Update Ticket (Status/Priority)
export const updateAdminTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, priority } = req.body;

    const data: any = {};
    if (status) {
      data.status = status;
      if (status === "RESOLVED") data.resolvedAt = new Date();
      if (status === "CLOSED") data.closedAt = new Date();
    }
    if (priority) data.priority = priority;

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data
    });

    if ((status === "RESOLVED" || status === "CLOSED") && ticket.requesterId) {
      const u = await prisma.user.findUnique({ where: { id: ticket.requesterId } });
      if (u) {
        await emitNotification({
          userId: u.id,
          role: ticket.requesterRole || u.role,
          type: "TICKET_RESOLVED",
          title: `Support Ticket ${status}`,
          message: `Your support ticket #${ticket.ticketNumber?.slice(-8) || 'ticket'} has been ${status.toLowerCase()}.`,
          actionUrl: "/dashboard/support"
        }).catch(console.error);

        if (u.email) {
          const body = `
            <p>Hi ${u.fullName || 'there'},</p>
            <p>Your support ticket <b>#${ticket.ticketNumber?.slice(-8) || 'ticket'}</b> regarding "${ticket.subject}" has been marked as <b>${status}</b>.</p>
            <p>If you have any further questions or if this issue was not fully resolved, you can reopen it by replying to the ticket in your dashboard.</p>
            <a href="https://goexperts.com/dashboard/support" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;margin-top:15px;">View Ticket</a>
          `;
          await sendEmail(u.email, `Support Ticket ${status} - Go Experts`, shell(`Support Ticket #${ticket.ticketNumber?.slice(-8) || 'ticket'} ${status}`, body)).catch(console.error);
        }
      }
    }

    // Notify user via socket
    const io = getIo();
    if (io) {
      io.to(`support-ticket:${id}`).emit("support:ticket:updated", ticket);
    }

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

// 4. Assign Ticket
export const assignAdminTicket = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: { assignedToId }
    });

    res.json({ success: true, ticket });
  } catch (err) {
    next(err);
  }
};

// 5. Add Message (Public reply or Internal Note)
export const addAdminTicketMessage = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { message, isInternal } = req.body;

    if (!message) return res.status(400).json({ success: false, message: "Message is required" });

    const newMessage = await prisma.supportTicketMessage.create({
      data: {
        ticketId: id,
        senderId: adminId,
        senderRole: "admin",
        message,
        isInternal: Boolean(isInternal)
      }
    });

    // If it's a public reply, update ticket status
    if (!isInternal) {
      await prisma.supportTicket.update({
        where: { id },
        data: { 
          status: "WAITING_FOR_USER",
          firstResponseAt: new Date()
        }
      });
    }

    // Emit to user's socket room in real-time
    const io = getIo();
    if (io && !isInternal) {
      io.to(`support-ticket:${id}`).emit("support:message:new", newMessage);
    }

    res.json({ success: true, message: newMessage });
  } catch (err) {
    next(err);
  }
};

