import { Response, NextFunction } from 'express';
import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { AuthRequest } from '../../../../middlewares/auth.js';
import { getKycApprovedCurrentSubscription } from '../../../../services/mobile/subscription.service.js';

export const getCurrentPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sub = await getKycApprovedCurrentSubscription(req.user.id, (req.user as any).activeWorkspace);
    return res.json(successResponse('Current plan retrieved', sub));
  } catch (error) { next(error); }
};

import { formatMobilePlanRecord, normalizeDuration } from '../../subscriptions/subscriptions.controller.js';

export const getAvailablePlans = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const role = (req.query.role as string) || req.user.role;
    const rawDuration = (req.query.duration || req.query.billingCycle || req.query.billing_cycle || req.query.cycle || req.query.period || req.query.interval) as string | undefined;
    const normalizedDuration = normalizeDuration(rawDuration);

    const where: any = {
      status: 'active',
      OR: [
        { role },
        { role: 'all' },
        { planType: { in: ['addon', 'all_access', 'additional_role'] } }
      ],
      amount: { gt: 0 },
    };

    if (normalizedDuration) {
      where.duration = normalizedDuration;
    } else {
      where.duration = { not: '90_days' };
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { amount: 'asc' }]
    });

    const formattedPlans = (plans || []).map(formatMobilePlanRecord);
    const monthlyPlans = formattedPlans.filter((p: any) => p.duration === 'monthly');
    const yearlyPlans = formattedPlans.filter((p: any) => p.duration === 'yearly');
    const addonPlans = formattedPlans.filter((p: any) => p.planType === 'addon');
    const monthlyAddons = addonPlans.filter((p: any) => p.duration === 'monthly');
    const yearlyAddons = addonPlans.filter((p: any) => p.duration === 'yearly');

    return res.json({
      success: true,
      message: 'Available plans retrieved',
      rows: formattedPlans,
      data: formattedPlans,
      total: formattedPlans.length,
      monthly: monthlyPlans,
      yearly: yearlyPlans,
      addons: addonPlans,
      monthlyAddons,
      yearlyAddons,
      timestamp: new Date().toISOString(),
    });
  } catch (error) { next(error); }
};

export const upgradePlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Upgrade initiated. Please complete payment.'));
  } catch (error) { next(error); }
};

export const renewPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Renewal initiated. Please complete payment.'));
  } catch (error) { next(error); }
};

export const cancelPlan = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return res.json(successResponse('Plan cancelled'));
  } catch (error) { next(error); }
};

export const getUsage = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Usage retrieved', { proposalsLeft: 10 }));
export const getBenefits = async (req: AuthRequest, res: Response, next: NextFunction) => res.json(successResponse('Benefits retrieved', []));

