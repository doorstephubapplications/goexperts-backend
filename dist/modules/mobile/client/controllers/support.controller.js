import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
export const listTickets = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const tickets = await prisma.supportTicket.findMany({ where: { requesterId: req.user.id }, skip, take: limit, orderBy: { createdAt: 'desc' } });
        const total = await prisma.supportTicket.count({ where: { requesterId: req.user.id } });
        return res.json(successResponse('Support tickets retrieved', tickets, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const createTicket = async (req, res, next) => {
    try {
        const { subject, category, priority } = req.body;
        const ticket = await prisma.supportTicket.create({ data: { subject, requesterId: req.user.id, requesterRole: req.user.role || 'client', categoryId: category || 'General', priority: priority || 'Normal', status: 'OPEN' } });
        return res.status(201).json(successResponse('Support ticket created', ticket));
    }
    catch (error) {
        next(error);
    }
};
export const getTicket = async (req, res, next) => {
    try {
        const ticket = await prisma.supportTicket.findFirst({
            where: { id: req.params.id, requesterId: req.user.id },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
        });
        return res.json(successResponse('Ticket details', ticket));
    }
    catch (error) {
        next(error);
    }
};
export const replyToTicket = async (req, res, next) => {
    try {
        const { message, reply } = req.body;
        const text = String(message || reply || '').trim();
        if (!text) {
            return res.status(400).json(errorResponse('Reply message is required', 'VALIDATION_ERROR'));
        }
        const ticket = await prisma.supportTicket.findFirst({
            where: { id: req.params.id, requesterId: req.user.id },
        });
        if (!ticket) {
            return res.status(404).json(errorResponse('Ticket not found', 'NOT_FOUND'));
        }
        const newMessage = await prisma.supportTicketMessage.create({
            data: {
                ticketId: ticket.id,
                senderId: req.user.id,
                senderRole: req.user.role || 'client',
                message: text,
                isInternal: false,
            },
        });
        return res.json(successResponse('Reply sent', newMessage));
    }
    catch (error) {
        next(error);
    }
};
export const closeTicket = async (req, res, next) => {
    try {
        await prisma.supportTicket.updateMany({ where: { id: req.params.id, requesterId: req.user.id }, data: { status: 'RESOLVED' } });
        return res.json(successResponse('Ticket closed'));
    }
    catch (error) {
        next(error);
    }
};
