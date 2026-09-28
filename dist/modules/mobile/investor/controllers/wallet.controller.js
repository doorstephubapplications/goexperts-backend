import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const getWallet = async (req, res, next) => {
    try {
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
        return res.json(successResponse('Wallet retrieved', wallet || { balance: 0, currency: 'USD' }));
    }
    catch (error) {
        next(error);
    }
};
export const getTransactions = async (req, res, next) => {
    try {
        const wallet = await prisma.wallet.findUnique({ where: { userId: req.user.id } });
        if (!wallet)
            return res.json(successResponse('Transactions', []));
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        let transactions = [];
        let total = 0;
        try {
            [transactions, total] = await Promise.all([
                prisma.walletTransaction.findMany({
                    where: { walletId: wallet.id },
                    skip,
                    take: limit,
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        walletId: true,
                        type: true,
                        amount: true,
                        direction: true,
                        description: true,
                        balanceAfter: true,
                        createdAt: true,
                    },
                }),
                prisma.walletTransaction.count({ where: { walletId: wallet.id } }),
            ]);
        }
        catch {
            transactions = [];
            total = 0;
        }
        const data = transactions.map((t) => ({
            ...t,
            status: t.status || 'completed',
        }));
        return res.json(successResponse('Transactions retrieved', data, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }));
    }
    catch (error) {
        next(error);
    }
};
