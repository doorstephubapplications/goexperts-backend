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
        let recurringCredited = 0;
        for (const rw of rewards) {
            const amt = Number(rw.amount || 0);
            if (rw.rewardCategory === "RECURRING_CASHBACK") {
                recurringCredited += amt;
            }
            else {
                oneTimeEarned += amt;
            }
        }
        // 3. Fetch recurring schedules and calculate continuous accruals
        let recurringSchedules = [];
        const scheduleByReferralId = new Map();
        let totalAccruedAcrossSchedules = 0;
        let totalCreditedAcrossSchedules = 0;
        let totalPendingAcrossSchedules = 0;
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
                const startMs = new Date(s.eligibleStartAt).getTime();
                const endMs = new Date(s.eligibleEndAt).getTime();
                const totalDurationMs = Math.max(1, endMs - startMs);
                const elapsedMs = Math.max(0, Math.min(now.getTime(), endMs) - startMs);
                const elapsedRatio = Math.min(1, Math.max(0, elapsedMs / totalDurationMs));
                const totalAllocated = Number(s.totalAllocatedAmount || 0);
                const credited = Number(s.totalCreditedAmount || 0);
                const accrued = Number((totalAllocated * elapsedRatio).toFixed(2));
                const pending = Number(Math.max(0, accrued - credited).toFixed(2));
                const remainingFuture = Number(Math.max(0, totalAllocated - accrued).toFixed(2));
                totalAccruedAcrossSchedules += accrued;
                totalCreditedAcrossSchedules += credited;
                totalPendingAcrossSchedules += pending;
                scheduleByReferralId.set(s.referralId, {
                    id: s.id,
                    subscriptionId: s.subscriptionId,
                    eligibleStartAt: s.eligibleStartAt,
                    eligibleEndAt: s.eligibleEndAt,
                    baseSubscriptionAmount: Number(s.baseSubscriptionAmount || 0),
                    rewardBasisAmount: Number(s.rewardBasisAmount || 0),
                    totalAllocatedAmount: totalAllocated,
                    totalCreditedAmount: credited,
                    status: s.status,
                    nextSettlementAt: s.nextSettlementAt,
                    accrued,
                    credited,
                    pending,
                    remainingFuture,
                    elapsedDays: Number((elapsedMs / (1000 * 86400)).toFixed(1)),
                    totalDurationDays: Number((totalDurationMs / (1000 * 86400)).toFixed(1)),
                });
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
        // 5. User wallet balance & referral wallet transactions
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        const walletBalance = Number(wallet?.balance || 0);
        const walletTransactions = wallet
            ? await prisma.walletTransaction.findMany({
                where: {
                    walletId: wallet.id,
                    type: { in: ["referral_cashback", "referral_one_time"] },
                },
                orderBy: { createdAt: "desc" },
                take: 50,
            })
            : [];
        const effectiveRecurringCredited = totalCreditedAcrossSchedules > 0 ? totalCreditedAcrossSchedules : recurringCredited;
        const effectiveRecurringAccrued = Number(totalAccruedAcrossSchedules.toFixed(2));
        const effectivePendingSettlement = Number(totalPendingAcrossSchedules.toFixed(2));
        const totalReferralWalletCredits = Number((oneTimeEarned + effectiveRecurringCredited).toFixed(2));
        // Format referral history records with full accrual breakdown
        const history = referrals.map(r => {
            const rRewards = r.rewards || [];
            const isQualified = String(r.status || "").toUpperCase() === "QUALIFIED";
            const oneTimeReward = rRewards.find(rw => rw.rewardCategory === "ONE_TIME_CASHBACK" || rw.amount === policy.oneTimeRewardAmount);
            const hasOneTime = Boolean(oneTimeReward);
            const schedule = scheduleByReferralId.get(r.id);
            return {
                id: r.id,
                refereeId: r.refereeId,
                refereeName: r.referee?.fullName || "Invited User",
                refereeEmail: r.referee?.email,
                refereeRole: r.referee?.role,
                registeredAt: r.createdAt,
                status: isQualified ? "QUALIFIED" : (r.status || "PENDING").toUpperCase(),
                profileCompletionPercentage: r.referee?.completionPercentage || (isQualified ? 100 : 0),
                profileCompletedAt: r.profileCompletedAt || (isQualified ? r.qualifiedAt : null),
                qualifiedAt: r.qualifiedAt,
                oneTimeRewardStatus: hasOneTime ? "CREDITED" : isQualified ? "PENDING" : "LOCKED",
                oneTimeRewardCredited: hasOneTime,
                oneTimeCreditedDate: oneTimeReward?.creditedAt || null,
                oneTimeRewardAmount: hasOneTime ? policy.oneTimeRewardAmount : 0,
                recurringEligible: Boolean(schedule),
                rewardAllocation: schedule ? schedule.totalAllocatedAmount : 0,
                amountAccrued: schedule ? schedule.accrued : 0,
                amountCredited: schedule ? schedule.credited : 0,
                pendingSettlement: schedule ? schedule.pending : 0,
                nextSettlementDate: schedule ? schedule.nextSettlementAt : null,
                subscriptionPeriod: schedule ? `${new Date(schedule.eligibleStartAt).toLocaleDateString("en-IN")} – ${new Date(schedule.eligibleEndAt).toLocaleDateString("en-IN")}` : "—",
                accrualBreakdown: schedule ? {
                    subscriptionPriceInclGst: planPrice,
                    basePriceExcludingGst: schedule.baseSubscriptionAmount,
                    cashbackPercent: Math.round(policy.recurringRate * 100),
                    fullPeriodRewardBasis: schedule.rewardBasisAmount,
                    totalDurationDays: schedule.totalDurationDays,
                    eligibleAccrualStart: schedule.eligibleStartAt,
                    eligibleAccrualEnd: schedule.eligibleEndAt,
                    elapsedDays: schedule.elapsedDays,
                    accruedToDate: schedule.accrued,
                    settledCashback: schedule.credited,
                    remainingAllocated: schedule.remainingFuture,
                    nextSettlementDate: schedule.nextSettlementAt,
                } : null,
            };
        });
        const formattedWalletCredits = walletTransactions.map(tx => ({
            id: tx.id,
            type: tx.type === "referral_one_time" ? "ONE_TIME_REWARD" : "RECURRING_CASHBACK",
            typeLabel: tx.type === "referral_one_time" ? "₹25 One-Time Referral Credit" : "5% Recurring Cashback Credit",
            amount: Number(tx.amount),
            creditDate: tx.createdAt,
            reference: tx.id,
            status: (tx.status || "completed").toUpperCase(),
            description: tx.description,
            balanceAfter: Number(tx.balanceAfter || 0),
        }));
        res.json({
            success: true,
            data: {
                referralCode: user.referralCode,
                referralLink,
                summary: {
                    totalDirectReferrals: totalReferrals,
                    qualifiedReferrals,
                    pendingProfileCompletion: pendingReferrals,
                    oneTimeEarned: Number(oneTimeEarned.toFixed(2)),
                    recurringAccrued: effectiveRecurringAccrued,
                    recurringCredited: effectiveRecurringCredited,
                    pendingSettlement: effectivePendingSettlement,
                    totalWalletCredits: totalReferralWalletCredits,
                },
                // Backward compatibility properties
                totalReferrals,
                qualifiedReferrals,
                pendingReferrals,
                oneTimeEarned: Number(oneTimeEarned.toFixed(2)),
                recurringEarned: effectiveRecurringCredited,
                recurringAccrued: effectiveRecurringAccrued,
                totalEarned: totalReferralWalletCredits,
                pendingCashback: effectivePendingSettlement,
                walletBalance: Number(walletBalance.toFixed(2)),
                currentSubscription: {
                    hasSubscription: Boolean(activeSub),
                    planName: activeSub?.plan?.name || "Freedom (Free)",
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
                    totalAccrued: effectiveRecurringAccrued,
                    totalCredited: effectiveRecurringCredited,
                    nextSettlementDate: activeSub?.endDate || null,
                    message: isPaidPlan
                        ? "Earn ₹25 once for each successful direct referral, plus recurring cashback calculated at 5% of your own eligible paid subscription price excluding GST, prorated for your eligible subscription period."
                        : "Earn ₹25 for every successful direct referral. Upgrade to an eligible paid plan to unlock recurring 5% cashback.",
                },
                history,
                walletCredits: formattedWalletCredits,
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
