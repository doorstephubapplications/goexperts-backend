import { prisma } from "../../config/database.js";
import { getActiveReferralPolicy, calculateBasePriceExcludingGst, } from "../../services/referral/direct-referral.service.js";
export const trackClick = async (req, res, next) => {
    try {
        const { ref } = req.query;
        if (!ref || typeof ref !== "string") {
            return res.status(400).json({ success: false, message: "Missing referral code" });
        }
        const referrer = await prisma.user.findUnique({ where: { referralCode: ref } });
        if (!referrer) {
            return res.status(404).json({ success: false, message: "Invalid referral code" });
        }
        const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || null;
        const userAgent = req.headers["user-agent"] || null;
        const landingSessionId = req.cookies?.sessionId || null;
        const click = await prisma.referralClick.create({
            data: {
                referralCode: ref,
                referrerId: referrer.id,
                ipAddress,
                userAgent,
                landingSessionId,
            },
        });
        res.json({ success: true, clickId: click.id });
    }
    catch (err) {
        next(err);
    }
};
export const getReferralDetails = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        let user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        if (!user.referralCode) {
            let baseCode = (user.fullName?.split(" ")[0] || "USER").toUpperCase().replace(/[^A-Z]/g, "");
            if (baseCode.length < 3)
                baseCode = "GEX" + baseCode;
            const randStr = Math.random().toString(36).substring(2, 6).toUpperCase();
            const newCode = `GOEXPERTS-${baseCode}${randStr}`;
            user = await prisma.user.update({
                where: { id: userId },
                data: { referralCode: newCode },
            });
        }
        const referralLink = `${process.env.FRONTEND_URL || "https://goexperts.in"}/signup/${user.role || "freelancer"}?ref=${user.referralCode}`;
        const policy = await getActiveReferralPolicy();
        const now = new Date();
        // 1. Fetch direct referrals given by user (Single level: A refers B only)
        const referrals = await prisma.referral.findMany({
            where: { referrerId: userId },
            include: {
                rewards: true,
                referee: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        role: true,
                        createdAt: true,
                        completionPercentage: true,
                        onboardingStatus: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
        const totalReferrals = referrals.length;
        const qualifiedReferrals = referrals.filter(r => String(r.status || "").toUpperCase() === "QUALIFIED").length;
        const pendingReferrals = referrals.filter(r => String(r.status || "").toUpperCase() === "PENDING").length;
        // 2. Fetch all rewards earned by user
        const rewards = await prisma.referralReward.findMany({
            where: {
                OR: [
                    { beneficiaryUserId: userId },
                    { referral: { referrerId: userId } },
                ],
            },
        });
        let oneTimeEarned = 0;
        let recurringEarned = 0;
        for (const rw of rewards) {
            const amt = Number(rw.amount || 0);
            if (rw.rewardCategory === "RECURRING_CASHBACK") {
                recurringEarned += amt;
            }
            else {
                oneTimeEarned += amt;
            }
        }
        // 3. Fetch recurring schedules
        let pendingCashback = 0;
        let recurringSchedules = [];
        try {
            recurringSchedules = await prisma.recurringRewardSchedule.findMany({
                where: { referrerUserId: userId },
                include: {
                    referral: {
                        include: { referee: { select: { fullName: true, role: true } } },
                    },
                },
                orderBy: { createdAt: "desc" },
            });
            for (const s of recurringSchedules) {
                if (s.status === "ACCRUING") {
                    const uncredited = Math.max(0, Number(s.totalAllocatedAmount || 0) - Number(s.totalCreditedAmount || 0));
                    pendingCashback += uncredited;
                }
            }
        }
        catch { }
        // 4. Referrer's current subscription & cashback eligibility
        const activeSub = await prisma.subscription.findFirst({
            where: {
                userId,
                status: "active",
                endDate: { gt: now },
            },
            include: { plan: true },
            orderBy: { endDate: "desc" },
        });
        const isPaidPlan = activeSub && Number(activeSub.plan?.amount || 0) > 0;
        const planPrice = Number(activeSub?.plan?.amount || 0);
        const baseSubscriptionAmount = isPaidPlan ? calculateBasePriceExcludingGst(planPrice, policy.gstRate) : 0;
        const recurringRewardBasis = isPaidPlan ? Number((baseSubscriptionAmount * policy.recurringRate).toFixed(2)) : 0;
        const remainingDurationMs = activeSub ? Math.max(0, activeSub.endDate.getTime() - now.getTime()) : 0;
        const remainingDays = Math.ceil(remainingDurationMs / (1000 * 86400));
        // 5. User wallet balance
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        const walletBalance = Number(wallet?.balance || 0);
        // Format referral history records
        const history = referrals.map(r => {
            const rRewards = r.rewards || [];
            const totalAwarded = rRewards.reduce((s, rw) => s + Number(rw.amount || 0), 0);
            const isQualified = String(r.status || "").toUpperCase() === "QUALIFIED";
            const hasOneTime = rRewards.some(rw => rw.rewardCategory === "ONE_TIME_CASHBACK" || rw.amount === policy.oneTimeRewardAmount);
            return {
                id: r.id,
                refereeId: r.refereeId,
                refereeName: r.referee?.fullName || "Invited User",
                refereeEmail: r.referee?.email,
                refereeRole: r.referee?.role,
                registeredAt: r.createdAt,
                status: isQualified ? "QUALIFIED" : (r.status || "PENDING").toUpperCase(),
                profileCompletionPercentage: r.referee?.completionPercentage || 0,
                profileCompletedAt: r.profileCompletedAt,
                qualifiedAt: r.qualifiedAt,
                oneTimeRewardCredited: hasOneTime,
                oneTimeRewardAmount: hasOneTime ? policy.oneTimeRewardAmount : 0,
                totalEarned: Number(totalAwarded.toFixed(2)),
            };
        });
        res.json({
            success: true,
            data: {
                referralCode: user.referralCode,
                referralLink,
                totalReferrals,
                qualifiedReferrals,
                pendingReferrals,
                oneTimeEarned: Number(oneTimeEarned.toFixed(2)),
                recurringEarned: Number(recurringEarned.toFixed(2)),
                totalEarned: Number((oneTimeEarned + recurringEarned).toFixed(2)),
                pendingCashback: Number(pendingCashback.toFixed(2)),
                walletBalance: Number(walletBalance.toFixed(2)),
                currentSubscription: {
                    hasSubscription: Boolean(activeSub),
                    planName: activeSub?.plan?.name || "Freedom Free",
                    isPaidPlan: Boolean(isPaidPlan),
                    status: activeSub?.status || "free",
                    startDate: activeSub?.startDate || null,
                    endDate: activeSub?.endDate || null,
                    remainingDays,
                    isCashbackEligible: Boolean(isPaidPlan),
                    baseSubscriptionAmount,
                    recurringRewardBasis,
                    recurringRatePercent: Number((policy.recurringRate * 100).toFixed(0)),
                    oneTimeRewardAmount: policy.oneTimeRewardAmount,
                },
                history,
                recurringSchedules: recurringSchedules.map(s => ({
                    id: s.id,
                    refereeName: s.referral?.referee?.fullName || "Direct Referral",
                    subscriptionId: s.subscriptionId,
                    eligibleStartAt: s.eligibleStartAt,
                    eligibleEndAt: s.eligibleEndAt,
                    remainingDays: s.remainingDurationDays,
                    baseSubscriptionAmount: s.baseSubscriptionAmount,
                    rewardBasisAmount: s.rewardBasisAmount,
                    totalAllocatedAmount: s.totalAllocatedAmount,
                    totalCreditedAmount: s.totalCreditedAmount,
                    status: s.status,
                    nextSettlementAt: s.nextSettlementAt,
                })),
                policy: {
                    oneTimeRewardAmount: policy.oneTimeRewardAmount,
                    recurringRatePercent: Number((policy.recurringRate * 100).toFixed(0)),
                    policyVersion: policy.policyVersion,
                },
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const getReferralWalletHistory = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) {
            return res.json({ success: true, data: { transactions: [], total: 0 } });
        }
        const transactions = await prisma.walletTransaction.findMany({
            where: {
                walletId: wallet.id,
                type: { in: ["referral_cashback", "referral_one_time"] },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json({
            success: true,
            data: {
                transactions,
                total: transactions.length,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
