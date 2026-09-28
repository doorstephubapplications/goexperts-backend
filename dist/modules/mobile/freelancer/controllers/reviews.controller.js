import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const getReceivedReviews = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const targetId = req.query.targetId || req.user?.id;
        if (!targetId) {
            return res.status(400).json({ success: false, message: 'targetId is required' });
        }
        const [reviews, total] = await Promise.all([
            prisma.review.findMany({
                where: { revieweeId: targetId },
                include: {
                    reviewer: { select: { id: true, fullName: true, avatarUrl: true } },
                    project: { select: { id: true, title: true } },
                },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.review.count({ where: { revieweeId: targetId } })
        ]);
        return res.json(successResponse('Reviews retrieved', reviews, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getAverageRating = async (req, res, next) => {
    try {
        const targetId = req.query.targetId || req.user?.id;
        if (!targetId) {
            return res.json(successResponse('Average rating retrieved', { averageRating: 0, totalReviews: 0 }));
        }
        const reviews = await prisma.review.findMany({ where: { revieweeId: targetId } });
        const avg = reviews.length ? Math.round((reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) * 10) / 10 : 0;
        return res.json(successResponse('Average rating retrieved', { averageRating: avg, totalReviews: reviews.length }));
    }
    catch (error) {
        next(error);
    }
};
export const getRatingBreakdown = async (req, res, next) => {
    try {
        const targetId = req.query.targetId || req.user?.id;
        if (!targetId) {
            return res.json(successResponse('Rating breakdown retrieved', { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }));
        }
        const reviews = await prisma.review.findMany({ where: { revieweeId: targetId }, select: { rating: true } });
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        reviews.forEach(r => {
            const rounded = Math.round(r.rating);
            if (rounded >= 1 && rounded <= 5) {
                breakdown[rounded] = (breakdown[rounded] || 0) + 1;
            }
        });
        return res.json(successResponse('Rating breakdown retrieved', breakdown));
    }
    catch (error) {
        next(error);
    }
};
export const replyToReview = async (req, res, next) => {
    try {
        return res.json(successResponse('Review reply submitted'));
    }
    catch (error) {
        next(error);
    }
};
