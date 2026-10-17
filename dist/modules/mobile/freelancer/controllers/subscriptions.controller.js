import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
import { getKycApprovedCurrentSubscription } from '../../../../services/mobile/subscription.service.js';
export const getCurrentPlan = async (req, res, next) => {
    try {
        const sub = await getKycApprovedCurrentSubscription(req.user.id, req.user.activeWorkspace);
        return res.json(successResponse('Current plan retrieved', sub));
    }
    catch (error) {
        next(error);
    }
};
import { formatMobilePlanRecord, normalizeDuration } from '../../subscriptions/subscriptions.controller.js';
export const getAvailablePlans = async (req, res, next) => {
    try {
        const role = req.query.role || req.user.role;
        const rawDuration = (req.query.duration || req.query.billingCycle || req.query.billing_cycle || req.query.cycle || req.query.period || req.query.interval);
        const normalizedDuration = normalizeDuration(rawDuration);
        const where = {
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
        }
        else {
            where.duration = { not: '90_days' };
        }
        const plans = await prisma.subscriptionPlan.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { amount: 'asc' }]
        });
        const formattedPlans = (plans || []).map(formatMobilePlanRecord);
        const monthlyPlans = formattedPlans.filter((p) => p.duration === 'monthly');
        const yearlyPlans = formattedPlans.filter((p) => p.duration === 'yearly');
        const addonPlans = formattedPlans.filter((p) => p.planType === 'addon');
        const monthlyAddons = addonPlans.filter((p) => p.duration === 'monthly');
        const yearlyAddons = addonPlans.filter((p) => p.duration === 'yearly');
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
    }
    catch (error) {
        next(error);
    }
};
export const upgradePlan = async (req, res, next) => {
    try {
        return res.json(successResponse('Upgrade initiated. Please complete payment.'));
    }
    catch (error) {
        next(error);
    }
};
export const renewPlan = async (req, res, next) => {
    try {
        return res.json(successResponse('Renewal initiated. Please complete payment.'));
    }
    catch (error) {
        next(error);
    }
};
export const cancelPlan = async (req, res, next) => {
    try {
        return res.json(successResponse('Plan cancelled'));
    }
    catch (error) {
        next(error);
    }
};
export const getUsage = async (req, res, next) => res.json(successResponse('Usage retrieved', { proposalsLeft: 10 }));
export const getBenefits = async (req, res, next) => res.json(successResponse('Benefits retrieved', []));
