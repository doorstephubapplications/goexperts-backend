import { Response, NextFunction } from 'express';
import { prisma } from '../../../config/database.js';
import { successResponse } from '../../../core/response.js';
import { AuthRequest } from '../../../middleware/auth.js';
import {
  getActiveReferralPolicy,
  calculateBasePriceExcludingGst,
} from '../../../services/referral/direct-referral.service.js';

const ensureReferralCode = async (userId: string, existingCode?: string | null) => {
  if (existingCode) return existingCode;

  const baseCode = `GE-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  const owner = await prisma.user.findUnique({ where: { referralCode: baseCode }, select: { id: true } });
  const code = !owner || owner.id === userId
    ? baseCode
    : `${baseCode}-${userId.replace(/-/g, '').slice(-4).toUpperCase()}`;

  await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
  return code;
};

export const getMyReferrals = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const policy = await getActiveReferralPolicy();
    const now = new Date();

    const publicSettings = {
      welcomeBonusEnabled: true,
      welcomeBonusAmount: 99,
      referralRewardAmount: policy.oneTimeRewardAmount,
      commission: Math.round(policy.recurringRate * 100),
    };

    if (!req.user?.id) {
      return res.json(successResponse('Referrals retrieved', {
        ...publicSettings,
        referralCode: null,
        referralLink: null,
        qrCode: null,
        stats: { total: 0, qualified: 0, pending: 0, rewarded: 0, totalReward: 0, oneTimeEarned: 0, recurringEarned: 0 },
        currentSubscription: {
          isPaidPlan: false,
          planName: 'Freedom Free',
          remainingDays: 0,
          recurringRewardBasis: 0,
        },
        history: [],
      }));
    }

    const userId = req.user.id;
    const [referralCode, referrals, rewards, activeSub] = await Promise.all([
      ensureReferralCode(userId, req.user.referralCode),
      prisma.referral.findMany({
        where: { referrerId: userId },
        include: {
          rewards: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.referralReward.findMany({
        where: {
          OR: [
            { beneficiaryUserId: userId },
            { referral: { referrerId: userId } },
          ],
        },
      }),
      prisma.subscription.findFirst({
        where: {
          userId,
          status: 'active',
          endDate: { gt: now },
        },
        include: { plan: true },
        orderBy: { endDate: 'desc' },
      }),
    ]);

    const refereeIds = referrals.map(r => r.refereeId).filter(Boolean);
    const referees = await prisma.user.findMany({
      where: { id: { in: refereeIds } },
      select: { id: true, fullName: true, email: true, avatarUrl: true, role: true, completionPercentage: true },
    });
    const refereeMap = new Map(referees.map(r => [r.id, r]));

    let oneTimeEarned = 0;
    let recurringEarned = 0;
    for (const rw of rewards) {
      const amt = Number(rw.amount || 0);
      if (rw.rewardCategory === 'RECURRING_CASHBACK') {
        recurringEarned += amt;
      } else {
        oneTimeEarned += amt;
      }
    }

    const history = referrals.map((referral) => {
      const referee = refereeMap.get(referral.refereeId);
      const isQualified = String(referral.status || '').toUpperCase() === 'QUALIFIED';
      const status = isQualified ? 'QUALIFIED' : 'PENDING';
      const rewardSum = (referral.rewards || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      return {
        id: referral.id,
        user: referee || { id: referral.refereeId, fullName: 'Unknown User', email: '', avatarUrl: null, role: 'user', completionPercentage: 0 },
        status: isQualified ? 'rewarded' : 'pending',
        rawStatus: status,
        reward: Number(rewardSum.toFixed(2)),
        completionPercentage: referee?.completionPercentage || 0,
        createdAt: referral.createdAt,
        qualifiedAt: (referral as any).qualifiedAt,
      };
    });

    const isPaidPlan = Boolean(activeSub && Number(activeSub.plan?.amount || 0) > 0);
    const planPrice = Number(activeSub?.plan?.amount || 0);
    const baseSubscriptionAmount = isPaidPlan ? calculateBasePriceExcludingGst(planPrice, policy.gstRate) : 0;
    const recurringRewardBasis = isPaidPlan ? Number((baseSubscriptionAmount * policy.recurringRate).toFixed(2)) : 0;
    const remainingDays = activeSub ? Math.max(0, Math.ceil((activeSub.endDate.getTime() - now.getTime()) / (1000 * 86400))) : 0;

    const qualifiedCount = history.filter(r => r.status === 'rewarded').length;
    const pendingCount = history.filter(r => r.status === 'pending').length;
    const totalReward = Number((oneTimeEarned + recurringEarned).toFixed(2));
    const referralLink = `https://goexperts.in/signup?ref=${referralCode}`;

    return res.json(successResponse('Referrals retrieved', {
      ...publicSettings,
      referralCode,
      referralLink,
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(referralLink)}`,
      stats: {
        total: history.length,
        qualified: qualifiedCount,
        pending: pendingCount,
        rewarded: qualifiedCount,
        totalReward,
        oneTimeEarned: Number(oneTimeEarned.toFixed(2)),
        recurringEarned: Number(recurringEarned.toFixed(2)),
      },
      currentSubscription: {
        isPaidPlan,
        planName: activeSub?.plan?.name || 'Freedom Free',
        remainingDays,
        baseSubscriptionAmount,
        recurringRewardBasis,
      },
      history,
    }));
  } catch (error) {
    next(error);
  }
};

