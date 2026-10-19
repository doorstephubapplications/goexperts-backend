import { prisma } from "../../config/database.js";
import { NotificationEngine } from "../mobile/notification.engine.js";
import { resolveProfileCompletion } from "../mobile/profile-completion.service.js";
export const DEFAULT_REFERRAL_POLICY = {
    oneTimeRewardAmount: 25.0,
    recurringRate: 0.05,
    gstRate: 0.18,
    payoutFrequency: "ON_EXPIRY_OR_MONTHLY",
    freePlanOneTimeEligible: true,
    freePlanRecurringEligible: false,
    paidPlanRecurringEligible: true,
    policyVersion: "v1.0",
};
/**
 * Fetch the active referral policy from the database, or return defaults.
 */
export async function getActiveReferralPolicy() {
    try {
        const policy = await prisma.referralPolicy.findFirst({
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
        });
        if (policy) {
            return {
                oneTimeRewardAmount: Number(policy.oneTimeRewardAmount ?? DEFAULT_REFERRAL_POLICY.oneTimeRewardAmount),
                recurringRate: Number(policy.recurringRate ?? DEFAULT_REFERRAL_POLICY.recurringRate),
                gstRate: Number(policy.gstRate ?? DEFAULT_REFERRAL_POLICY.gstRate),
                payoutFrequency: policy.payoutFrequency || DEFAULT_REFERRAL_POLICY.payoutFrequency,
                freePlanOneTimeEligible: Boolean(policy.freePlanOneTimeEligible ?? true),
                freePlanRecurringEligible: Boolean(policy.freePlanRecurringEligible ?? false),
                paidPlanRecurringEligible: Boolean(policy.paidPlanRecurringEligible ?? true),
                policyVersion: policy.policyVersion || "v1.0",
            };
        }
    }
    catch (err) {
        // If table doesn't exist yet, fall back gracefully
    }
    // Check app_settings fallback
    try {
        const setting = await prisma.setting.findUnique({ where: { key: "app_settings" } });
        if (setting?.value) {
            const parsed = JSON.parse(setting.value);
            return {
                ...DEFAULT_REFERRAL_POLICY,
                oneTimeRewardAmount: Number(parsed.referral_reward_amount ?? DEFAULT_REFERRAL_POLICY.oneTimeRewardAmount),
                recurringRate: Number(parsed.referralCashbackPercent ? parsed.referralCashbackPercent / 100 : DEFAULT_REFERRAL_POLICY.recurringRate),
            };
        }
    }
    catch { }
    return DEFAULT_REFERRAL_POLICY;
}
/**
 * Calculate base plan price excluding GST.
 * Formula: Base Subscription Price = Actual Eligible Paid Amount / (1 + GST Rate)
 */
export function calculateBasePriceExcludingGst(paidAmount, gstRate = 0.18) {
    const amount = Number(paidAmount || 0);
    if (!Number.isFinite(amount) || amount <= 0)
        return 0;
    return Number((amount / (1 + gstRate)).toFixed(4));
}
/**
 * Calculate prorated recurring reward for remaining duration.
 * Formula:
 * Recurring Reward Basis = Base Subscription Price × 5%
 * Eligible Cashback = Subscription Period Reward Basis × (Eligible Remaining Duration / Total Subscription Duration)
 */
export function calculateProratedRecurringReward(basePrice, recurringRate, subscriptionStartDate, subscriptionEndDate, eligibleStartDate) {
    const startMs = subscriptionStartDate.getTime();
    const endMs = subscriptionEndDate.getTime();
    const eligibleStartMs = Math.max(startMs, eligibleStartDate.getTime());
    const totalDurationMs = Math.max(1, endMs - startMs);
    const remainingMs = Math.max(0, endMs - eligibleStartMs);
    const totalDays = Number((totalDurationMs / (1000 * 86400)).toFixed(2));
    const remainingDays = Number((remainingMs / (1000 * 86400)).toFixed(2));
    const fullRewardBasis = Number((basePrice * recurringRate).toFixed(4));
    const proratedAmount = Number(((fullRewardBasis * remainingMs) / totalDurationMs).toFixed(2));
    return {
        basePrice: Number(basePrice.toFixed(2)),
        fullRewardBasis: Number(fullRewardBasis.toFixed(2)),
        totalDays,
        remainingDays,
        proratedAmount,
    };
}
/**
 * Evaluates whether a user's profile is 100% complete and triggers direct referral qualification.
 * Strict Single-Level: A refers B -> A earns. B refers C -> B earns. A earns 0 from C.
 */
export async function checkAndQualifyReferral(refereeUserId) {
    try {
        // 1. Verify profile completion is 100%
        const completion = await resolveProfileCompletion(refereeUserId).catch(() => null);
        if (!completion || completion.completionPercentage < 100) {
            return { qualified: false, reason: "Profile not 100% completed" };
        }
        // 2. Find pending direct referral where refereeId == refereeUserId
        const referral = await prisma.referral.findUnique({
            where: { refereeId: refereeUserId },
            include: {
                referrer: { select: { id: true, fullName: true, email: true, role: true } },
                referee: { select: { id: true, fullName: true, email: true, role: true } },
            },
        });
        if (!referral) {
            return { qualified: false, reason: "No referral record found for referee" };
        }
        // Ensure referral status is PENDING
        const normalizedStatus = String(referral.status || "").toUpperCase();
        if (normalizedStatus !== "PENDING") {
            return { qualified: false, reason: `Referral already in status: ${referral.status}` };
        }
        // Direct referrer fraud check: Prevent self-referral
        if (referral.referrerId === referral.refereeId) {
            await prisma.referral.update({
                where: { id: referral.id },
                data: { status: "REJECTED" },
            });
            return { qualified: false, reason: "Self-referral rejected" };
        }
        const policy = await getActiveReferralPolicy();
        const now = new Date();
        // 3. Execute qualification transaction
        let oneTimeCreditSuccess = false;
        let recurringScheduleCreated = false;
        let oneTimeAmount = policy.oneTimeRewardAmount;
        let recurringProratedAmount = 0;
        await prisma.$transaction(async (tx) => {
            // Re-verify inside transaction to prevent concurrent double-credit
            const freshReferral = await tx.referral.findUnique({
                where: { id: referral.id },
            });
            if (!freshReferral || String(freshReferral.status || "").toUpperCase() !== "PENDING") {
                return; // Already processed concurrently
            }
            // Mark referral as QUALIFIED
            await tx.referral.update({
                where: { id: referral.id },
                data: {
                    status: "QUALIFIED",
                    profileCompletedAt: now,
                    qualifiedAt: now,
                    policyVersion: policy.policyVersion,
                },
            });
            // Log QUALIFIED Event
            await tx.referralEvent.create({
                data: {
                    referralId: referral.id,
                    eventType: "QUALIFIED",
                    metadata: JSON.stringify({
                        refereeId: referral.refereeId,
                        referrerId: referral.referrerId,
                        qualifiedAt: now.toISOString(),
                        policyVersion: policy.policyVersion,
                    }),
                },
            });
            // ── Step A: One-Time ₹25 Cashback Credit to Direct Referrer ──────────
            const idempotencyKey = `REF-ONETIME-${referral.id}`;
            // Check if reward already exists
            const existingReward = await tx.referralReward.findFirst({
                where: {
                    OR: [
                        { referralId: referral.id, rewardCategory: "ONE_TIME_CASHBACK" },
                        { idempotencyKey },
                    ],
                },
            });
            if (!existingReward && policy.freePlanOneTimeEligible) {
                // Find or create referrer wallet
                let wallet = await tx.wallet.findUnique({ where: { userId: referral.referrerId } });
                if (!wallet) {
                    wallet = await tx.wallet.create({
                        data: { userId: referral.referrerId, balance: 0, currency: "INR" },
                    });
                }
                const newBalance = Number((wallet.balance + oneTimeAmount).toFixed(2));
                const updatedWallet = await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: newBalance },
                });
                const walletTxn = await tx.walletTransaction.create({
                    data: {
                        walletId: updatedWallet.id,
                        type: "referral_one_time",
                        amount: oneTimeAmount,
                        direction: "credit",
                        description: `₹${oneTimeAmount} One-Time Referral Cashback for ${referral.referee.fullName}'s profile completion`,
                        balanceAfter: newBalance,
                        status: "completed",
                    },
                });
                await tx.referralReward.create({
                    data: {
                        referralId: referral.id,
                        beneficiaryUserId: referral.referrerId,
                        amount: oneTimeAmount,
                        points: 0,
                        rewardType: "CASH",
                        rewardCategory: "ONE_TIME_CASHBACK",
                        status: "CREDITED",
                        policyVersion: policy.policyVersion,
                        walletTransactionId: walletTxn.id,
                        idempotencyKey,
                        creditedAt: now,
                        metadata: JSON.stringify({
                            refereeName: referral.referee.fullName,
                            refereeEmail: referral.referee.email,
                            type: "ONE_TIME_₹25",
                        }),
                    },
                });
                oneTimeCreditSuccess = true;
            }
            // ── Step B: 5% Recurring Cashback Allocation based on Referrer's Active Paid Plan ──
            // Find active paid subscription of the DIRECT REFERRER
            const referrerActiveSub = await tx.subscription.findFirst({
                where: {
                    userId: referral.referrerId,
                    status: "active",
                    endDate: { gt: now },
                },
                include: { plan: true },
                orderBy: { endDate: "desc" },
            });
            const isPaidSub = referrerActiveSub && Number(referrerActiveSub.plan?.amount || 0) > 0;
            if (isPaidSub && policy.paidPlanRecurringEligible) {
                const sub = referrerActiveSub;
                const planAmount = Number(sub.plan.amount);
                const baseAmount = calculateBasePriceExcludingGst(planAmount, policy.gstRate);
                const calculation = calculateProratedRecurringReward(baseAmount, policy.recurringRate, sub.startDate, sub.endDate, now);
                if (calculation.proratedAmount > 0) {
                    recurringProratedAmount = calculation.proratedAmount;
                    try {
                        await tx.recurringRewardSchedule.create({
                            data: {
                                referralId: referral.id,
                                referrerUserId: referral.referrerId,
                                subscriptionId: sub.id,
                                eligibleStartAt: now,
                                eligibleEndAt: sub.endDate,
                                totalSubscriptionDurationDays: calculation.totalDays,
                                remainingDurationDays: calculation.remainingDays,
                                baseSubscriptionAmount: calculation.basePrice,
                                rewardBasisAmount: calculation.fullRewardBasis,
                                totalAllocatedAmount: calculation.proratedAmount,
                                totalCreditedAmount: 0,
                                status: "ACCRUING",
                                nextSettlementAt: sub.endDate,
                                policyVersion: policy.policyVersion,
                            },
                        });
                        recurringScheduleCreated = true;
                    }
                    catch (e) {
                        console.warn("[Referral] Recurring schedule table may not exist yet:", e);
                    }
                }
            }
        });
        // 4. Send Notifications
        if (oneTimeCreditSuccess) {
            NotificationEngine.queueNotification({
                userId: referral.referrerId,
                type: "referral_cashback",
                title: "₹25 Referral Cashback Credited! 🎉",
                message: `Your direct referral ${referral.referee.fullName} has completed their profile! ₹${oneTimeAmount} has been credited to your Go Experts wallet.`,
                channel: "all",
            }).catch(err => console.error("[Referral Notification Error]:", err));
        }
        return {
            qualified: true,
            referralId: referral.id,
            referrerId: referral.referrerId,
            refereeId: referral.refereeId,
            oneTimeAmount: oneTimeCreditSuccess ? oneTimeAmount : 0,
            recurringProratedAmount,
            recurringScheduleCreated,
        };
    }
    catch (error) {
        console.error("[Referral Engine] Error in checkAndQualifyReferral:", error);
        throw error;
    }
}
/**
 * Hook triggered when a referrer purchases or renews an eligible paid subscription.
 * Existing qualified direct referrals become eligible for a new 5% recurring reward allocation.
 * Never repeats the one-time ₹25 reward.
 */
export async function onReferrerSubscriptionActivatedOrRenewed(userId, subscriptionId) {
    try {
        const sub = await prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { plan: true },
        });
        if (!sub || sub.userId !== userId || sub.status !== "active")
            return;
        const planPrice = Number(sub.plan?.amount || 0);
        if (planPrice <= 0)
            return; // Free plan, no recurring cashback
        const policy = await getActiveReferralPolicy();
        const baseAmount = calculateBasePriceExcludingGst(planPrice, policy.gstRate);
        const now = new Date();
        // Find all qualified direct referrals for this referrer
        const qualifiedReferrals = await prisma.referral.findMany({
            where: {
                referrerId: userId,
                status: "QUALIFIED",
            },
        });
        for (const ref of qualifiedReferrals) {
            // Check if a schedule already exists for this referral and subscription
            try {
                const existing = await prisma.recurringRewardSchedule.findFirst({
                    where: {
                        referralId: ref.id,
                        subscriptionId: sub.id,
                    },
                });
                if (existing)
                    continue; // Already configured for this subscription period
                const calculation = calculateProratedRecurringReward(baseAmount, policy.recurringRate, sub.startDate, sub.endDate, now);
                if (calculation.proratedAmount > 0) {
                    await prisma.recurringRewardSchedule.create({
                        data: {
                            referralId: ref.id,
                            referrerUserId: userId,
                            subscriptionId: sub.id,
                            eligibleStartAt: now,
                            eligibleEndAt: sub.endDate,
                            totalSubscriptionDurationDays: calculation.totalDays,
                            remainingDurationDays: calculation.remainingDays,
                            baseSubscriptionAmount: calculation.basePrice,
                            rewardBasisAmount: calculation.fullRewardBasis,
                            totalAllocatedAmount: calculation.proratedAmount,
                            totalCreditedAmount: 0,
                            status: "ACCRUING",
                            nextSettlementAt: sub.endDate,
                            policyVersion: policy.policyVersion,
                        },
                    });
                }
            }
            catch (err) {
                console.warn("[Referral] Error scheduling renewal cashback:", err);
            }
        }
    }
    catch (error) {
        console.error("[Referral Engine] Error onReferrerSubscriptionActivatedOrRenewed:", error);
    }
}
/**
 * Scheduled settlement runner: Settles accrued recurring cashback into referrers' wallets atomically.
 */
export async function settleRecurringCashback(targetScheduleId) {
    const now = new Date();
    let settledCount = 0;
    let totalSettledAmount = 0;
    try {
        const whereClause = {
            status: "ACCRUING",
        };
        if (targetScheduleId) {
            whereClause.id = targetScheduleId;
        }
        else {
            // Settle schedules that have reached or passed their eligibleEndAt / nextSettlementAt
            whereClause.OR = [
                { eligibleEndAt: { lte: now } },
                { nextSettlementAt: { lte: now } },
            ];
        }
        const schedules = await prisma.recurringRewardSchedule.findMany({
            where: whereClause,
            include: {
                referral: {
                    include: {
                        referee: { select: { fullName: true } },
                    },
                },
            },
            take: 100,
        });
        for (const schedule of schedules) {
            const creditDue = Number((schedule.totalAllocatedAmount - schedule.totalCreditedAmount).toFixed(2));
            if (creditDue <= 0) {
                await prisma.recurringRewardSchedule.update({
                    where: { id: schedule.id },
                    data: { status: "CREDITED", settledAt: now },
                });
                continue;
            }
            const idempotencyKey = `REF-RECURRING-${schedule.id}-${schedule.subscriptionId}`;
            await prisma.$transaction(async (tx) => {
                // Prevent duplicate execution
                const fresh = await tx.recurringRewardSchedule.findUnique({
                    where: { id: schedule.id },
                });
                if (!fresh || fresh.status !== "ACCRUING")
                    return;
                let wallet = await tx.wallet.findUnique({ where: { userId: schedule.referrerUserId } });
                if (!wallet) {
                    wallet = await tx.wallet.create({
                        data: { userId: schedule.referrerUserId, balance: 0, currency: "INR" },
                    });
                }
                const newBalance = Number((wallet.balance + creditDue).toFixed(2));
                const updatedWallet = await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: newBalance },
                });
                const refereeName = schedule.referral?.referee?.fullName || "Referred User";
                const walletTxn = await tx.walletTransaction.create({
                    data: {
                        walletId: updatedWallet.id,
                        type: "referral_cashback",
                        amount: creditDue,
                        direction: "credit",
                        description: `5% Recurring Referral Cashback (₹${creditDue}) for direct referral ${refereeName}`,
                        balanceAfter: newBalance,
                        status: "completed",
                    },
                });
                await tx.referralReward.create({
                    data: {
                        referralId: schedule.referralId,
                        beneficiaryUserId: schedule.referrerUserId,
                        subscriptionId: schedule.subscriptionId,
                        amount: creditDue,
                        points: 0,
                        rewardType: "CASH",
                        rewardCategory: "RECURRING_CASHBACK",
                        status: "CREDITED",
                        policyVersion: schedule.policyVersion,
                        walletTransactionId: walletTxn.id,
                        idempotencyKey,
                        creditedAt: now,
                        periodStart: schedule.eligibleStartAt,
                        periodEnd: schedule.eligibleEndAt,
                        metadata: JSON.stringify({
                            allocated: schedule.totalAllocatedAmount,
                            remainingDays: schedule.remainingDurationDays,
                            baseAmount: schedule.baseSubscriptionAmount,
                        }),
                    },
                });
                await tx.recurringRewardSchedule.update({
                    where: { id: schedule.id },
                    data: {
                        status: "CREDITED",
                        totalCreditedAmount: schedule.totalAllocatedAmount,
                        settledAt: now,
                    },
                });
                settledCount++;
                totalSettledAmount += creditDue;
            });
        }
        return { success: true, settledCount, totalSettledAmount: Number(totalSettledAmount.toFixed(2)) };
    }
    catch (error) {
        console.error("[Referral Engine] Error in settleRecurringCashback:", error);
        return { success: false, error: String(error) };
    }
}
