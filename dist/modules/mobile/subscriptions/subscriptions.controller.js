import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../core/response.js';
import { initiatePaymentService } from '../payments/payments.service.js';
import { getKycApprovedCurrentSubscription } from '../../../services/mobile/subscription.service.js';
import { PaymentReadinessError } from '../../../services/mobile/profile-readiness.service.js';
import { formatRecord } from '../../../common/helpers/crud-factory.js';
export const formatMobilePlanRecord = (row) => {
    const formatted = formatRecord(row);
    if (!formatted)
        return formatted;
    const { slug, ...withoutSlug } = formatted;
    return withoutSlug;
};
export const normalizeDuration = (raw) => {
    if (!raw)
        return undefined;
    const lower = String(raw).toLowerCase().trim();
    if (lower.includes('month'))
        return 'monthly';
    if (lower.includes('year') || lower.includes('annual'))
        return 'yearly';
    if (lower.includes('quarter'))
        return 'quarterly';
    if (lower === '180_days' || lower === '180days' || lower === '6months' || lower === '6_months')
        return '180_days';
    if (lower === '90_days' || lower === '90days' || lower === '3months' || lower === '3_months')
        return '90_days';
    if (lower === 'all')
        return undefined;
    return lower;
};
export const getPlans = async (req, res, next) => {
    try {
        const requestedRole = req.query.role || req.user?.role;
        const rawDuration = (req.query.duration || req.query.billingCycle || req.query.billing_cycle || req.query.cycle || req.query.period || req.query.interval);
        const normalizedDuration = normalizeDuration(rawDuration);
        const where = {
            status: 'active',
            visibility: { notIn: ['grandfathered', 'archived', 'private', 'internal'] },
        };
        if (requestedRole && requestedRole !== 'all') {
            where.OR = [
                { role: requestedRole },
                { role: 'all' },
                { planType: { in: ['addon', 'all_access', 'additional_role'] } },
            ];
        }
        if (normalizedDuration) {
            where.duration = normalizedDuration;
        }
        const plans = await prisma.subscriptionPlan.findMany({
            where,
            orderBy: [{ sortOrder: 'asc' }, { amount: 'asc' }],
        });
        const formattedPlans = (plans || []).map(formatMobilePlanRecord);
        const monthlyPlans = formattedPlans.filter((p) => p.duration === 'monthly');
        const yearlyPlans = formattedPlans.filter((p) => p.duration === 'yearly');
        const addonPlans = formattedPlans.filter((p) => p.planType === 'addon');
        const monthlyAddons = addonPlans.filter((p) => p.duration === 'monthly');
        const yearlyAddons = addonPlans.filter((p) => p.duration === 'yearly');
        return res.json({
            success: true,
            message: 'Subscription plans retrieved',
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
export const getCurrent = async (req, res, next) => {
    try {
        const subscription = await getKycApprovedCurrentSubscription(req.user.id, req.user.activeWorkspace);
        return res.json(successResponse('Current subscription retrieved', subscription));
    }
    catch (error) {
        next(error);
    }
};
const startPlanPayment = async (req, res, action) => {
    try {
        const planId = req.body.planId || req.body.id;
        const gateway = req.body.gateway || 'easebuzz';
        if (!planId) {
            return res.status(400).json(errorResponse('planId is required', 'VALIDATION_ERROR'));
        }
        const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        if (!plan) {
            return res.status(404).json(errorResponse('Plan not found', 'NOT_FOUND'));
        }
        const baseAmount = Number(plan.amount ?? 0);
        if (!baseAmount || baseAmount <= 0) {
            return res.status(400).json(errorResponse('Plan has invalid price', 'VALIDATION_ERROR'));
        }
        // const gst = parseFloat((baseAmount * 0.18).toFixed(2));\
        const gst = 0;
        const totalAmount = parseFloat((baseAmount + gst).toFixed(2));
        const result = await initiatePaymentService(req.user.id, gateway, totalAmount, 'INR', {
            planId,
            action,
            type: 'subscription',
            purpose: 'subscription',
        });
        return res.status(201).json(successResponse(`Subscription ${action} payment initiated`, result));
    }
    catch (error) {
        if (error instanceof PaymentReadinessError) {
            return res.status(403).json(errorResponse(error.message, error.code, [{
                    profileCompletion: error.profileCompletion,
                    kycStatus: error.kycStatus,
                    missing: error.missing,
                }]));
        }
        return res.status(400).json(errorResponse(error?.message || 'Payment initiation failed', 'PAYMENT_INITIATION_FAILED'));
    }
};
export const purchase = async (req, res, next) => {
    try {
        return await startPlanPayment(req, res, 'purchase');
    }
    catch (error) {
        next(error);
    }
};
export const renew = async (req, res, next) => {
    try {
        return await startPlanPayment(req, res, 'renew');
    }
    catch (error) {
        next(error);
    }
};
export const upgrade = async (req, res, next) => {
    try {
        return await startPlanPayment(req, res, 'upgrade');
    }
    catch (error) {
        next(error);
    }
};
export const cancel = async (req, res, next) => {
    try {
        await prisma.subscription.updateMany({
            where: { userId: req.user.id, status: 'active' },
            data: { status: 'cancelled', cancelledAt: new Date() },
        });
        return res.json(successResponse('Subscription cancelled'));
    }
    catch (error) {
        next(error);
    }
};
export const getHistory = async (req, res, next) => {
    try {
        const history = await prisma.subscriptionHistory.findMany({ where: { userId: req.user.id, plan: { role: req.user.activeWorkspace } }, include: { plan: true } });
        return res.json(successResponse('Subscription history retrieved', history));
    }
    catch (error) {
        next(error);
    }
};
