import { Router } from "express";
import { prisma } from "../../config/database.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getActiveReferralPolicy, settleRecurringCashback, } from "../../services/referral/direct-referral.service.js";
const router = Router();
router.use(authMiddleware);
/**
 * 1. Referral Overview KPI Summary
 */
router.get("/referrals/overview", async (req, res) => {
    try {
        const [totalReferrals, qualifiedReferrals, pendingReferrals, allRewards, activePaidReferrersCount,] = await Promise.all([
            prisma.referral.count(),
            prisma.referral.count({ where: { status: "QUALIFIED" } }),
            prisma.referral.count({ where: { status: "PENDING" } }),
            prisma.referralReward.findMany({ select: { amount: true, rewardCategory: true, status: true } }),
            prisma.subscription.count({
                where: {
                    status: "active",
                    endDate: { gt: new Date() },
                    plan: { amount: { gt: 0 } },
                    user: { referralsGiven: { some: { status: "QUALIFIED" } } },
                },
            }),
        ]);
        let oneTimeCredited = 0;
        let recurringCredited = 0;
        for (const r of allRewards) {
            const amt = Number(r.amount || 0);
            if (r.rewardCategory === "RECURRING_CASHBACK") {
                recurringCredited += amt;
            }
            else {
                oneTimeCredited += amt;
            }
        }
        let recurringAccrued = 0;
        let pendingSettlements = 0;
        try {
            const schedules = await prisma.recurringRewardSchedule.findMany({
                where: { status: "ACCRUING" },
                select: { totalAllocatedAmount: true, totalCreditedAmount: true },
            });
            pendingSettlements = schedules.length;
            for (const s of schedules) {
                recurringAccrued += Number(s.totalAllocatedAmount || 0) - Number(s.totalCreditedAmount || 0);
            }
        }
        catch { }
        res.json({
            success: true,
            data: {
                totalReferrals,
                qualifiedReferrals,
                pendingReferrals,
                oneTimeCredited: Number(oneTimeCredited.toFixed(2)),
                recurringAccrued: Number(recurringAccrued.toFixed(2)),
                recurringCredited: Number(recurringCredited.toFixed(2)),
                totalCashbackCredited: Number((oneTimeCredited + recurringCredited).toFixed(2)),
                pendingSettlements,
                activePaidReferrers: activePaidReferrersCount,
            },
        });
    }
    catch (error) {
        console.error("[Admin Referral Overview Error]:", error);
        res.status(500).json({ success: false, message: "Error fetching referral overview" });
    }
});
/**
 * 2. Server-Paginated Referral Records
 */
router.get("/referrals/records", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 15));
        const search = (req.query.search || "").trim().toLowerCase();
        const status = (req.query.status || "all").toLowerCase();
        const role = (req.query.role || "all").toLowerCase();
        const skip = (page - 1) * limit;
        const where = {};
        if (status !== "all") {
            where.status = status.toUpperCase();
        }
        if (role !== "all") {
            where.OR = [
                { referrer: { role } },
                { referee: { role } },
            ];
        }
        if (search) {
            where.AND = [
                ...(where.AND || []),
                {
                    OR: [
                        { referrer: { fullName: { contains: search, mode: "insensitive" } } },
                        { referrer: { email: { contains: search, mode: "insensitive" } } },
                        { referee: { fullName: { contains: search, mode: "insensitive" } } },
                        { referee: { email: { contains: search, mode: "insensitive" } } },
                        { referrer: { referralCode: { contains: search, mode: "insensitive" } } },
                    ],
                },
            ];
        }
        const [total, records] = await Promise.all([
            prisma.referral.count({ where }),
            prisma.referral.findMany({
                where,
                include: {
                    referrer: { select: { id: true, fullName: true, email: true, role: true, referralCode: true } },
                    referee: { select: { id: true, fullName: true, email: true, role: true, completionPercentage: true, onboardingStatus: true } },
                    rewards: true,
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);
        // Format for display
        const formatted = records.map((r) => {
            const rewards = r.rewards || [];
            const totalEarned = rewards.reduce((s, rw) => s + Number(rw.amount || 0), 0);
            const isQualified = String(r.status || "").toUpperCase() === "QUALIFIED";
            const hasOneTime = rewards.some(rw => rw.rewardCategory === "ONE_TIME_CASHBACK");
            const hasRecurring = rewards.some(rw => rw.rewardCategory === "RECURRING_CASHBACK");
            return {
                id: r.id,
                referrerName: r.referrer?.fullName || "Unknown",
                referrerEmail: r.referrer?.email,
                referrerRole: r.referrer?.role,
                referrerCode: r.referrer?.referralCode,
                refereeName: r.referee?.fullName || "Unknown",
                refereeEmail: r.referee?.email,
                refereeRole: r.referee?.role,
                registeredAt: r.createdAt,
                status: isQualified ? "QUALIFIED" : (r.status || "PENDING").toUpperCase(),
                profileCompletionPercentage: r.referee?.completionPercentage || 0,
                qualifiedAt: r.qualifiedAt,
                oneTimeRewardCredited: hasOneTime,
                recurringRewardEarned: hasRecurring,
                totalCashbackEarned: Number(totalEarned.toFixed(2)),
            };
        });
        res.json({
            success: true,
            data: {
                records: formatted,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("[Admin Referral Records Error]:", error);
        res.status(500).json({ success: false, message: "Error fetching referral records" });
    }
});
/**
 * 3. Referral Details
 */
router.get("/referrals/records/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const referral = await prisma.referral.findUnique({
            where: { id },
            include: {
                referrer: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        referralCode: true,
                        createdAt: true,
                        subscriptions: {
                            include: { plan: true },
                            orderBy: { createdAt: "desc" },
                            take: 3,
                        },
                        wallet: true,
                    },
                },
                referee: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        createdAt: true,
                        completionPercentage: true,
                        onboardingStatus: true,
                        subscriptions: {
                            include: { plan: true },
                            orderBy: { createdAt: "desc" },
                            take: 1,
                        },
                    },
                },
                rewards: true,
                events: { orderBy: { createdAt: "asc" } },
            },
        });
        if (!referral) {
            return res.status(404).json({ success: false, message: "Referral not found" });
        }
        let recurringSchedules = [];
        try {
            recurringSchedules = await prisma.recurringRewardSchedule.findMany({
                where: { referralId: id },
            });
        }
        catch { }
        res.json({
            success: true,
            data: {
                referral,
                recurringSchedules,
            },
        });
    }
    catch (error) {
        console.error("[Admin Referral Details Error]:", error);
        res.status(500).json({ success: false, message: "Error fetching referral details" });
    }
});
/**
 * 4. Recurring Cashback Schedules List
 */
router.get("/referrals/recurring-schedules", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 15));
        const status = (req.query.status || "all").toLowerCase();
        const where = {};
        if (status !== "all") {
            where.status = status.toUpperCase();
        }
        const skip = (page - 1) * limit;
        let schedules = [];
        let total = 0;
        try {
            [total, schedules] = await Promise.all([
                prisma.recurringRewardSchedule.count({ where }),
                prisma.recurringRewardSchedule.findMany({
                    where,
                    include: {
                        referral: {
                            include: {
                                referee: { select: { fullName: true, role: true } },
                                referrer: { select: { fullName: true, role: true } },
                            },
                        },
                    },
                    orderBy: { createdAt: "desc" },
                    skip,
                    take: limit,
                }),
            ]);
        }
        catch (e) {
            // Table may not exist yet
        }
        res.json({
            success: true,
            data: {
                schedules,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("[Admin Recurring Schedules Error]:", error);
        res.status(500).json({ success: false, message: "Error fetching recurring schedules" });
    }
});
/**
 * 5. Manual Settlement Trigger
 */
router.post("/referrals/recurring-schedules/run-settlement", async (req, res) => {
    try {
        const { scheduleId } = req.body || {};
        const result = await settleRecurringCashback(scheduleId);
        res.json({
            success: true,
            message: `Settlement completed. Settled ${result.settledCount} schedules with total ₹${result.totalSettledAmount}`,
            data: result,
        });
    }
    catch (error) {
        console.error("[Admin Run Settlement Error]:", error);
        res.status(500).json({ success: false, message: "Error running cashback settlement" });
    }
});
/**
 * 6. Get & Update Referral Policy
 */
router.get("/referrals/policy", async (req, res) => {
    try {
        const policy = await getActiveReferralPolicy();
        res.json({ success: true, data: policy });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Error fetching policy" });
    }
});
router.put("/referrals/policy", async (req, res) => {
    try {
        const { oneTimeRewardAmount, recurringRate, gstRate, payoutFrequency, freePlanOneTimeEligible, freePlanRecurringEligible, paidPlanRecurringEligible, } = req.body;
        const newVersion = `v${Date.now()}`;
        let updatedPolicy;
        try {
            // Mark old policies inactive
            await prisma.referralPolicy.updateMany({
                where: { status: "ACTIVE" },
                data: { status: "SUPERSEDED", effectiveTo: new Date() },
            });
            updatedPolicy = await prisma.referralPolicy.create({
                data: {
                    policyName: `Policy ${newVersion}`,
                    policyVersion: newVersion,
                    oneTimeRewardAmount: Number(oneTimeRewardAmount ?? 25),
                    recurringRate: Number(recurringRate ?? 0.05),
                    gstRate: Number(gstRate ?? 0.18),
                    payoutFrequency: payoutFrequency || "ON_EXPIRY_OR_MONTHLY",
                    freePlanOneTimeEligible: Boolean(freePlanOneTimeEligible ?? true),
                    freePlanRecurringEligible: Boolean(freePlanRecurringEligible ?? false),
                    paidPlanRecurringEligible: Boolean(paidPlanRecurringEligible ?? true),
                    status: "ACTIVE",
                    effectiveFrom: new Date(),
                },
            });
        }
        catch {
            // Fallback update in settings
            await prisma.setting.upsert({
                where: { key: "app_settings" },
                update: {
                    value: JSON.stringify({
                        referral_reward_amount: Number(oneTimeRewardAmount ?? 25),
                        referralCashbackPercent: Number(recurringRate ? recurringRate * 100 : 5),
                    }),
                },
                create: {
                    key: "app_settings",
                    value: JSON.stringify({
                        referral_reward_amount: Number(oneTimeRewardAmount ?? 25),
                        referralCashbackPercent: Number(recurringRate ? recurringRate * 100 : 5),
                    }),
                },
            });
        }
        res.json({
            success: true,
            message: "Referral policy successfully updated",
            data: updatedPolicy || { oneTimeRewardAmount, recurringRate },
        });
    }
    catch (error) {
        console.error("[Admin Update Policy Error]:", error);
        res.status(500).json({ success: false, message: "Error updating policy" });
    }
});
/**
 * 7. Dedicated Referral Wallet Ledger
 */
router.get("/referrals/wallet-ledger", async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(100, parseInt(req.query.limit) || 20));
        const skip = (page - 1) * limit;
        const where = {
            type: { in: ["referral_cashback", "referral_one_time"] },
        };
        const [total, transactions] = await Promise.all([
            prisma.walletTransaction.count({ where }),
            prisma.walletTransaction.findMany({
                where,
                include: {
                    wallet: {
                        include: {
                            user: { select: { id: true, fullName: true, email: true, role: true } },
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit,
            }),
        ]);
        res.json({
            success: true,
            data: {
                transactions,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (error) {
        console.error("[Admin Referral Wallet Ledger Error]:", error);
        res.status(500).json({ success: false, message: "Error fetching wallet ledger" });
    }
});
// Legacy backward-compatibility stats
router.get("/cashback_stats", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const whereClause = { type: { in: ["referral_cashback", "referral_one_time"] } };
        const aggregate = await prisma.walletTransaction.aggregate({
            where: whereClause,
            _sum: { amount: true },
            _count: true,
        });
        const cashbackTxns = await prisma.walletTransaction.findMany({
            where: whereClause,
            include: {
                wallet: {
                    include: { user: { select: { id: true, fullName: true, email: true } } },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        });
        res.json({
            success: true,
            data: {
                totalDebited: parseFloat((aggregate._sum.amount || 0).toFixed(2)),
                count: aggregate._count,
                page,
                limit,
                total: aggregate._count,
                totalPages: Math.ceil(aggregate._count / limit),
                transactions: cashbackTxns.map((t) => ({
                    id: t.id,
                    amount: t.amount,
                    description: t.description,
                    createdAt: t.createdAt,
                    user: t.wallet?.user,
                })),
            },
        });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Error fetching cashback stats" });
    }
});
export default router;
