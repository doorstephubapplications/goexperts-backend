import { prisma } from '../../config/database.js';
import { successResponse, errorResponse } from '../../core/response.js';
async function canAccessProjectTasks(userId, projectId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, fullName: true, email: true, role: true, clientProfile: { select: { company: true } } },
    });
    if (!user)
        return false;
    if (user.role === 'admin')
        return true;
    const project = await prisma.project.findFirst({
        where: { id: projectId, deletedAt: null },
    });
    if (!project)
        return false;
    const clientNeedles = [user.fullName, user.email, user.clientProfile?.company]
        .map(v => String(v || '').trim()).filter(Boolean);
    if (project.client === user.id || clientNeedles.some(n => project.client?.includes(n)))
        return true;
    const contract = await prisma.contract.findFirst({
        where: { projectId: project.id, freelancerId: user.id, deletedAt: null },
    });
    if (contract)
        return true;
    if (project.freelancer === user.id || (user.fullName && project.freelancer?.includes(user.fullName)))
        return true;
    return false;
}
export const listTasks = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized'));
        const { projectId, status, assignedTo } = req.query;
        const where = { deletedAt: null };
        if (projectId) {
            const allowed = await canAccessProjectTasks(userId, String(projectId));
            if (!allowed) {
                return res.status(403).json(errorResponse('Access denied to project tasks'));
            }
            where.projectId = String(projectId);
        }
        else {
            // If no projectId specified, restrict to tasks assigned to this user
            where.OR = [
                { assignedTo: userId },
                ...(req.user?.fullName ? [{ assignedTo: req.user.fullName }] : []),
                ...(req.user?.email ? [{ assignedTo: req.user.email }] : [])
            ];
        }
        if (status)
            where.status = String(status);
        if (assignedTo)
            where.assignedTo = String(assignedTo);
        const tasks = await prisma.task.findMany({
            where,
            include: {
                comments: { orderBy: { createdAt: 'desc' } },
                attachments: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(successResponse('Tasks retrieved successfully', tasks));
    }
    catch (error) {
        next(error);
    }
};
export const getTask = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized'));
        const { id } = req.params;
        const task = await prisma.task.findUnique({
            where: { id },
            include: {
                comments: { orderBy: { createdAt: 'desc' } },
                attachments: true,
            },
        });
        if (!task || task.deletedAt) {
            return res.status(404).json(errorResponse('Task not found'));
        }
        const allowed = await canAccessProjectTasks(userId, task.projectId);
        if (!allowed) {
            return res.status(403).json(errorResponse('Access denied to task'));
        }
        return res.json(successResponse('Task retrieved successfully', task));
    }
    catch (error) {
        next(error);
    }
};
export const createTask = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized'));
        const { projectId, title, assignedTo, priority, status, dueDate, progress } = req.body;
        if (!projectId || !title) {
            return res.status(400).json(errorResponse('Project ID and Title are required'));
        }
        const allowed = await canAccessProjectTasks(userId, projectId);
        if (!allowed) {
            return res.status(403).json(errorResponse('Access denied to project'));
        }
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project || project.deletedAt) {
            return res.status(404).json(errorResponse('Project not found'));
        }
        if (project.status === 'completed' || project.status === 'cancelled') {
            return res.status(409).json(errorResponse('Cannot add tasks to a completed or cancelled project'));
        }
        const task = await prisma.task.create({
            data: {
                projectId,
                title,
                assignedTo: assignedTo || null,
                priority: priority || 'Medium',
                status: status || 'todo',
                dueDate: dueDate || null,
                progress: progress ? Number(progress) : 0,
            }
        });
        return res.status(201).json(successResponse('Task created successfully', task));
    }
    catch (error) {
        next(error);
    }
};
export const updateTask = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized'));
        const { id } = req.params;
        const { title, assignedTo, priority, status, dueDate, progress } = req.body;
        const existing = await prisma.task.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            return res.status(404).json(errorResponse('Task not found'));
        }
        const allowed = await canAccessProjectTasks(userId, existing.projectId);
        if (!allowed) {
            return res.status(403).json(errorResponse('Access denied to update task'));
        }
        const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
        if (project?.status === 'completed' || project?.status === 'cancelled') {
            return res.status(409).json(errorResponse('Cannot modify tasks on a completed or cancelled project'));
        }
        const task = await prisma.task.update({
            where: { id },
            data: {
                title: title !== undefined ? title : existing.title,
                assignedTo: assignedTo !== undefined ? assignedTo : existing.assignedTo,
                priority: priority !== undefined ? priority : existing.priority,
                status: status !== undefined ? status : existing.status,
                dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
                progress: progress !== undefined ? Number(progress) : existing.progress,
            }
        });
        return res.json(successResponse('Task updated successfully', task));
    }
    catch (error) {
        next(error);
    }
};
export const deleteTask = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized'));
        const { id } = req.params;
        const existing = await prisma.task.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            return res.status(404).json(errorResponse('Task not found'));
        }
        const allowed = await canAccessProjectTasks(userId, existing.projectId);
        if (!allowed) {
            return res.status(403).json(errorResponse('Access denied to delete task'));
        }
        const project = await prisma.project.findUnique({ where: { id: existing.projectId } });
        if (project?.status === 'completed' || project?.status === 'cancelled') {
            return res.status(409).json(errorResponse('Cannot delete tasks on a completed or cancelled project'));
        }
        await prisma.task.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        return res.json(successResponse('Task deleted successfully', null));
    }
    catch (error) {
        next(error);
    }
};
