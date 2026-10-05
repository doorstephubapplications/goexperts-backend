import { prisma } from "../../config/database.js";
import { generateInvoicePdf } from "../invoice/invoice.service.js";
import { sendSubscriptionPurchasedEmail, sendFreePlanActivatedEmail } from "../mobile/email.service.js";
import { calculateInclusiveGst } from "../../utils/financial.util.js";

export type RoleName = "freelancer" | "client" | "founder" | "investor";

export class ActionGateError extends Error {
  public code: string;
  public action: string;
  public details: Record<string, any>;

  constructor(action: string, code: string, details: Record<string, any> = {}) {
    const message = details.message || `Action restricted: ${action} requires an active subscription or quota.`;
    super(message);
    this.name = "ActionGateError";
    this.code = code;
    this.action = action;
    this.details = details;
  }
}

export type RoleEntitlementResult = {
  isEntitled: boolean;
  role: string;
  planType: "trial" | "single_role" | "add_on" | "all_access" | "none";
  planName: string | null;
  subscriptionId: string | null;
  isTrial: boolean;
  isUnlimited: boolean;
  quotaLimit: number;
  quotaUsed: number;
  quotaRemaining: number;
  expiresAt: Date | null;
  gateReason: "NO_SUBSCRIPTION" | "SUBSCRIPTION_EXPIRED" | "QUOTA_EXHAUSTED" | "ROLE_NOT_ENTITLED" | null;
};

export type UserSubscriptionSummary = {
  userId: string;
  isTrialActive: boolean;
  trialEndsAt: Date | null;
  trialDaysRemaining: number;
  hasAllAccess: boolean;
  entitledRoles: string[];
  activeSubscriptions: Array<{
    id: string;
    role: string | null;
    planType: string | null;
    planName: string;
    amount: number;
    duration: string;
    startDate: Date;
    endDate: Date;
    status: string;
  }>;
};

/**
 * Normalizes role string to canonical format.
 */
export function normalizeRoleKey(role?: string | null): RoleName {
  const r = String(role || "freelancer").toLowerCase().trim();
  if (r.includes("client") || r.includes("business") || r.includes("employer")) return "client";
  if (r.includes("founder") || r.includes("startup")) return "founder";
  if (r.includes("investor")) return "investor";
  return "freelancer";
}

/**
 * Computes end date based on duration.
 * Uses calendar-month arithmetic for 6-Month Free Trial and Monthly/Annual periods.
 */
export function computePlanEndDate(duration: string, startDate: Date = new Date()): Date {
  const d = new Date(startDate.getTime());
  const dur = duration.toLowerCase().trim();
  if (dur === "6_months" || dur.includes("6_month") || dur === "180_days" || dur.includes("180")) {
    // Canonical business rule: Exactly 6 calendar months for new trials
    d.setMonth(d.getMonth() + 6);
  } else if (dur === "yearly" || dur.includes("year") || dur.includes("annual")) {
    d.setFullYear(d.getFullYear() + 1);
  } else if (dur === "quarterly" || dur.includes("quarter")) {
    d.setMonth(d.getMonth() + 3);
  } else if (dur === "90_days" || dur.includes("90")) {
    d.setMonth(d.getMonth() + 3);
  } else {
    // Default: 1 calendar month
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Resolves full subscription summary for an account across all 4 roles.
 */
export async function resolveUserSubscriptionSummary(userId: string): Promise<UserSubscriptionSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      trialEndsAt: true,
      subscriptions: {
        where: { status: "active" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return {
      userId,
      isTrialActive: false,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      hasAllAccess: false,
      entitledRoles: [],
      activeSubscriptions: [],
    };
  }

  const now = new Date();
  const trialEndsAt = user.trialEndsAt;
  const isTrialActive = Boolean(trialEndsAt && trialEndsAt.getTime() > now.getTime());
  const trialDaysRemaining = isTrialActive && trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const validActiveSubs = (user.subscriptions || []).filter(
    (sub) => sub.endDate && sub.endDate.getTime() > now.getTime()
  );

  let hasAllAccess = false;
  const entitledRolesSet = new Set<string>();

  if (isTrialActive) {
    // 6-Month Free Trial entitles ALL 4 roles!
    entitledRolesSet.add("freelancer");
    entitledRolesSet.add("client");
    entitledRolesSet.add("founder");
    entitledRolesSet.add("investor");
  }

  for (const s of validActiveSubs) {
    const plan = s.plan;
    const planType = (s as any).planType || plan?.planType || (plan?.role === "all" ? "all_access" : "single_role");
    const subRole = (s as any).role || plan?.role;

    if (planType === "all_access" || subRole === "all" || plan?.name?.toLowerCase().includes("all access")) {
      hasAllAccess = true;
      entitledRolesSet.add("freelancer");
      entitledRolesSet.add("client");
      entitledRolesSet.add("founder");
      entitledRolesSet.add("investor");
    } else if (subRole) {
      entitledRolesSet.add(normalizeRoleKey(subRole));
    }
  }

  return {
    userId,
    isTrialActive,
    trialEndsAt,
    trialDaysRemaining,
    hasAllAccess,
    entitledRoles: Array.from(entitledRolesSet),
    activeSubscriptions: validActiveSubs.map((s) => ({
      id: s.id,
      role: (s as any).role || s.plan?.role || null,
      planType: (s as any).planType || s.plan?.planType || "single_role",
      planName: s.plan?.name || "Active Subscription",
      amount: s.plan?.amount || 0,
      duration: s.plan?.duration || "monthly",
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status,
    })),
  };
}

/**
 * Resolves entitlement and quota for a specific role and action.
 */
export async function resolveRoleEntitlement(
  userId: string,
  targetRole: string,
  action?: string
): Promise<RoleEntitlementResult> {
  const normalizedRole = normalizeRoleKey(targetRole);
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      trialEndsAt: true,
      subscriptions: {
        where: { status: "active" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!user) {
    return {
      isEntitled: false,
      role: normalizedRole,
      planType: "none",
      planName: null,
      subscriptionId: null,
      isTrial: false,
      isUnlimited: false,
      quotaLimit: 0,
      quotaUsed: 0,
      quotaRemaining: 0,
      expiresAt: null,
      gateReason: "NO_SUBSCRIPTION",
    };
  }

  // 1. Check 6-Month Free Trial
  if (user.trialEndsAt && user.trialEndsAt.getTime() > now.getTime()) {
    const trialSub = user.subscriptions.find(
      (s) => s.plan?.planType === "trial" || s.plan?.duration === "180_days" || s.plan?.amount === 0
    );

    let quotaUsed = 0;
    const quotaLimit = trialSub?.plan?.proposalsLimit || 36;

    if (trialSub && action) {
      const featureKey = action === "submitProposal" ? "proposals_submitted" : "projects_published";
      const usage = await prisma.subscriptionUsage.findUnique({
        where: {
          subscriptionId_featureKey: {
            subscriptionId: trialSub.id,
            featureKey,
          },
        },
      });
      quotaUsed = usage?.used || 0;
    }

    const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);

    return {
      isEntitled: true,
      role: normalizedRole,
      planType: "trial",
      planName: trialSub?.plan?.name || "6-Month Free Access",
      subscriptionId: trialSub?.id || null,
      isTrial: true,
      isUnlimited: false,
      quotaLimit,
      quotaUsed,
      quotaRemaining,
      expiresAt: user.trialEndsAt,
      gateReason: null,
    };
  }

  // 2. Check Paid Subscriptions (All Access or Role-Specific)
  const activeSubs = (user.subscriptions || []).filter(
    (sub) => sub.endDate && sub.endDate.getTime() > now.getTime()
  );

  // 2a. All Access Check
  const allAccessSub = activeSubs.find(
    (s) =>
      (s as any).planType === "all_access" ||
      s.plan?.planType === "all_access" ||
      (s as any).role === "all" ||
      s.plan?.role === "all" ||
      s.plan?.name?.toLowerCase().includes("all access")
  );

  if (allAccessSub) {
    return {
      isEntitled: true,
      role: normalizedRole,
      planType: "all_access",
      planName: allAccessSub.plan?.name || "Go Experts All Access",
      subscriptionId: allAccessSub.id,
      isTrial: false,
      isUnlimited: true,
      quotaLimit: -1,
      quotaUsed: 0,
      quotaRemaining: 999999,
      expiresAt: allAccessSub.endDate,
      gateReason: null,
    };
  }

  // 2b. Role-Specific or Add-on Check
  const roleSub = activeSubs.find((s) => {
    const subRole = (s as any).role || s.plan?.role;
    return subRole && normalizeRoleKey(subRole) === normalizedRole;
  });

  if (roleSub) {
    const isAnnual = roleSub.plan?.duration === "yearly";
    const quotaLimit =
      normalizedRole === "freelancer"
        ? (roleSub.plan?.proposalsLimit ?? (isAnnual ? 36 : 3))
        : normalizedRole === "client"
        ? (roleSub.plan?.projectsLimit ?? (isAnnual ? 36 : 3))
        : -1;

    let quotaUsed = 0;
    if (action) {
      const featureKey = action === "submitProposal" ? "proposals_submitted" : "projects_published";
      const usage = await prisma.subscriptionUsage.findUnique({
        where: {
          subscriptionId_featureKey: {
            subscriptionId: roleSub.id,
            featureKey,
          },
        },
      });
      quotaUsed = usage?.used || 0;
    }

    const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);

    if (quotaLimit > 0 && quotaUsed >= quotaLimit) {
      return {
        isEntitled: false,
        role: normalizedRole,
        planType: ((roleSub as any).planType || roleSub.plan?.planType || "single_role") as any,
        planName: roleSub.plan?.name || "Single Role Plan",
        subscriptionId: roleSub.id,
        isTrial: false,
        isUnlimited: false,
        quotaLimit,
        quotaUsed,
        quotaRemaining: 0,
        expiresAt: roleSub.endDate,
        gateReason: "QUOTA_EXHAUSTED",
      };
    }

    return {
      isEntitled: true,
      role: normalizedRole,
      planType: ((roleSub as any).planType || roleSub.plan?.planType || "single_role") as any,
      planName: roleSub.plan?.name || "Single Role Plan",
      subscriptionId: roleSub.id,
      isTrial: false,
      isUnlimited: quotaLimit === -1,
      quotaLimit,
      quotaUsed,
      quotaRemaining,
      expiresAt: roleSub.endDate,
      gateReason: null,
    };
  }

  // 3. User has subscriptions, but not for this role
  if (activeSubs.length > 0) {
    return {
      isEntitled: false,
      role: normalizedRole,
      planType: "none",
      planName: null,
      subscriptionId: null,
      isTrial: false,
      isUnlimited: false,
      quotaLimit: 0,
      quotaUsed: 0,
      quotaRemaining: 0,
      expiresAt: null,
      gateReason: "ROLE_NOT_ENTITLED",
    };
  }

  // 4. No active subscription
  return {
    isEntitled: false,
    role: normalizedRole,
    planType: "none",
    planName: null,
    subscriptionId: null,
    isTrial: false,
    isUnlimited: false,
    quotaLimit: 0,
    quotaUsed: 0,
    quotaRemaining: 0,
    expiresAt: null,
    gateReason: "NO_SUBSCRIPTION",
  };
}

/**
 * Asserts that the user is entitled to perform an action. Throws ActionGateError if not.
 */
export async function assertActionEntitlement(
  userId: string,
  role: string,
  action: "submitProposal" | "publishProject" | "contactInvestor" | "expressInterest" | "publishStartup" | "contactFounder" | string
): Promise<RoleEntitlementResult> {
  const entitlement = await resolveRoleEntitlement(userId, role, action);

  if (!entitlement.isEntitled) {
    if (entitlement.gateReason === "QUOTA_EXHAUSTED") {
      throw new ActionGateError(action, "QUOTA_EXHAUSTED", {
        role,
        limit: entitlement.quotaLimit,
        used: entitlement.quotaUsed,
        planName: entitlement.planName,
        message: `Your ${action === "submitProposal" ? "proposal" : "project post"} quota for this billing cycle has been reached (${entitlement.quotaUsed}/${entitlement.quotaLimit}). Upgrade to All Access or renew your plan to continue.`,
      });
    }

    if (entitlement.gateReason === "ROLE_NOT_ENTITLED") {
      throw new ActionGateError(action, "ROLE_NOT_ENTITLED", {
        role,
        message: `Your active plan does not include the ${role.toUpperCase()} workspace. Add this role for ₹149/mo or upgrade to All Access (₹699/mo) to unlock all roles.`,
      });
    }

    let defaultMsg = `An active subscription or 6-Month Free Trial is required to perform this action. Choose a plan to continue.`;
    if (action === "publishStartup") {
      defaultMsg = `An active Founder subscription or 6-Month Free Trial is required to publish your startup publicly to investors.`;
    } else if (action === "contactInvestor") {
      defaultMsg = `An active Founder subscription or 6-Month Free Trial is required to connect with investors.`;
    } else if (action === "expressInterest") {
      defaultMsg = `An active Investor subscription or 6-Month Free Trial is required to express investment interest or submit offers.`;
    } else if (action === "contactFounder") {
      defaultMsg = `An active Investor subscription or 6-Month Free Trial is required to schedule meetings or contact founders.`;
    }

    throw new ActionGateError(action, "SUBSCRIPTION_REQUIRED", {
      role,
      message: defaultMsg,
    });
  }

  return entitlement;
}

/**
 * Atomically increments quota usage for a proposal or project posting.
 */
export async function recordActionUsage(
  subscriptionId: string | null,
  action: "submitProposal" | "publishProject",
  tx?: any
): Promise<number> {
  if (!subscriptionId) return 0;
  const db = tx || prisma;
  const featureKey = action === "submitProposal" ? "proposals_submitted" : "projects_published";

  const usage = await db.subscriptionUsage.upsert({
    where: {
      subscriptionId_featureKey: {
        subscriptionId,
        featureKey,
      },
    },
    create: {
      subscriptionId,
      featureKey,
      used: 1,
      lastUsedAt: new Date(),
    },
    update: {
      used: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  return usage.used;
}

/**
 * Concurrency-safe atomic check-and-consume helper for project publishing and proposal quota.
 * Prevents race conditions when multiple publish requests arrive concurrently.
 */
export async function assertAndConsumeActionQuota(
  userId: string,
  role: string,
  action: "submitProposal" | "publishProject"
): Promise<{ entitlement: RoleEntitlementResult; quotaUsed: number }> {
  // 1. Initial entitlement assertion (checks subscription validity and current quota)
  const entitlement = await assertActionEntitlement(userId, role, action);
  if (!entitlement.subscriptionId) {
    return { entitlement, quotaUsed: 0 };
  }

  // 2. If unlimited (-1), record usage without limit constraints
  if (entitlement.quotaLimit === -1) {
    const used = await recordActionUsage(entitlement.subscriptionId, action);
    return { entitlement, quotaUsed: used };
  }

  // 3. Atomically increment usage
  const featureKey = action === "submitProposal" ? "proposals_submitted" : "projects_published";
  const updatedUsage = await prisma.subscriptionUsage.upsert({
    where: {
      subscriptionId_featureKey: {
        subscriptionId: entitlement.subscriptionId,
        featureKey,
      },
    },
    create: {
      subscriptionId: entitlement.subscriptionId,
      featureKey,
      used: 1,
      lastUsedAt: new Date(),
    },
    update: {
      used: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });

  // 4. Concurrency check: if increment pushed usage beyond limit, rollback immediately and fail
  if (updatedUsage.used > entitlement.quotaLimit) {
    await prisma.subscriptionUsage.update({
      where: {
        subscriptionId_featureKey: {
          subscriptionId: entitlement.subscriptionId,
          featureKey,
        },
      },
      data: {
        used: { decrement: 1 },
      },
    }).catch(() => null);

    throw new ActionGateError(action, "QUOTA_EXHAUSTED", {
      role,
      limit: entitlement.quotaLimit,
      used: entitlement.quotaLimit,
      planName: entitlement.planName,
      message: `Your ${action === "submitProposal" ? "proposal" : "project post"} quota for this billing cycle has been reached (${entitlement.quotaLimit}/${entitlement.quotaLimit}). Upgrade to All Access or renew your plan to continue.`,
    });
  }

  return { entitlement, quotaUsed: updatedUsage.used };
}

/**
 * Activates the canonical 6-Month Free Trial (180 days) for a user.
 */
export async function activateCanonicalFreeTrial(userId: string): Promise<{ success: boolean; expiresAt: Date; subscriptionId?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      subscriptions: {
        where: { status: "active" },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const startDate = new Date();
  const endDate = computePlanEndDate("6_months", startDate); // Exactly 6 calendar months for new trials

  // Find 6-Month Free Access plan
  let plan = await prisma.subscriptionPlan.findFirst({
    where: {
      OR: [
        { name: "6-Month Free Access" },
        { duration: "180_days" },
        { planType: "trial" },
        { amount: 0 },
      ],
      status: "active",
    },
    orderBy: { amount: "asc" },
  });

  if (!plan) {
    plan = await prisma.subscriptionPlan.create({
      data: {
        name: "6-Month Free Access",
        role: "all",
        planType: "trial",
        amount: 0,
        currency: "INR",
        duration: "180_days",
        proposalsLimit: 36,
        projectsLimit: 36,
        sortOrder: 1,
        visibility: "public",
        status: "active",
      },
    });
  }

  // Check if user already has an active trial subscription
  const existingTrial = user.subscriptions.find(
    (s) => s.planId === plan.id || s.endDate.getTime() > startDate.getTime()
  );

  if (existingTrial) {
    // Keep user's trialEndsAt aligned
    await prisma.user.update({
      where: { id: user.id },
      data: { trialEndsAt: existingTrial.endDate },
    });
    return { success: true, expiresAt: existingTrial.endDate, subscriptionId: existingTrial.id };
  }

  const createdSub = await prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId: user.id,
        planId: plan.id,
        role: "all",
        planType: "trial",
        startDate,
        endDate,
        status: "active",
        autoRenew: false,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: {
        trialEndsAt: endDate,
        status: "active", // Never set to inactive!
      },
    });

    await tx.subscriptionHistory.create({
      data: {
        userId: user.id,
        planId: plan.id,
        action: "6_MONTH_FREE_TRIAL_ACTIVATED",
        metadata: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          duration: "180_days",
          proposalsLimit: 36,
          projectsLimit: 36,
        }),
      },
    });

    return sub;
  });

  if (user.email) {
    try {
      await sendFreePlanActivatedEmail(user.email, user.fullName || "User", "all", plan.name, endDate);
    } catch (e) {
      console.warn("[EntitlementEngine] Free trial activation email failed:", e);
    }
  }

  return { success: true, expiresAt: endDate, subscriptionId: createdSub.id };
}

/**
 * Activates or upgrades a paid subscription (Single Role, Add-on, or All Access).
 * Multi-role safe: Does NOT cancel existing active subscriptions on other roles!
 */
export async function activateUserMonetizationPlan(
  userId: string,
  planId: string,
  billingCycle: "monthly" | "yearly" = "monthly",
  assignedRole?: string
): Promise<any> {
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error("PLAN_NOT_FOUND");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  const planType = (plan as any).planType || (plan.role === "all" ? "all_access" : "single_role");
  const targetRole = assignedRole ? normalizeRoleKey(assignedRole) : (plan.role === "all" ? "all" : normalizeRoleKey(plan.role));
  const startDate = new Date();
  const endDate = computePlanEndDate(plan.duration || (billingCycle === "yearly" ? "yearly" : "monthly"), startDate);

  const result = await prisma.$transaction(async (tx) => {
    // If activating All Access: cancel all previous single-role subscriptions (they are subsumed by All Access)
    if (planType === "all_access" || targetRole === "all") {
      await tx.subscription.updateMany({
        where: { userId, status: "active" },
        data: {
          status: "cancelled",
          cancelledAt: startDate,
          cancellationReason: "Subsumed by Go Experts All Access Plan",
        },
      });
    } else {
      // If activating a Single Role or Add-on: cancel only any previous subscription for THAT specific role
      await tx.subscription.updateMany({
        where: {
          userId,
          status: "active",
          OR: [
            { role: targetRole },
            { plan: { role: targetRole } },
          ],
        },
        data: {
          status: "cancelled",
          cancelledAt: startDate,
          cancellationReason: `Replaced by ${plan.name}`,
        },
      });
    }

    // Create the new subscription record
    const subscription = await tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        role: targetRole,
        planType,
        startDate,
        endDate,
        status: "active",
        autoRenew: plan.amount > 0,
      },
      include: { plan: true },
    });

    // Ensure user remains active
    await tx.user.update({
      where: { id: userId },
      data: { status: "active" },
    });

    // Record history
    await tx.subscriptionHistory.create({
      data: {
        userId,
        planId: plan.id,
        action: planType === "all_access" ? "all_access_activated" : `role_${targetRole}_subscription_activated`,
        metadata: JSON.stringify({
          planName: plan.name,
          amount: plan.amount,
          duration: plan.duration,
          targetRole,
          planType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      },
    });

    // Generate Invoice if paid
    if (plan.amount > 0) {
      const { subtotal, gst, total } = calculateInclusiveGst(plan.amount);
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          userId,
          subscriptionId: subscription.id,
          subtotal,
          gst,
          discount: 0,
          total,
          status: "paid",
          items: {
            create: [
              {
                description: `Subscription: ${plan.name} (${targetRole.toUpperCase()})`,
                amount: plan.amount,
              },
            ],
          },
        },
      });

      // Transaction record
      await tx.subscriptionTransaction.create({
        data: {
          subscriptionId: subscription.id,
          type: "purchase",
          amount: plan.amount,
          currency: plan.currency || "INR",
          gateway: "payment_gateway",
          transactionRef: invoiceNumber,
          status: "success",
        },
      });
    }

    return subscription;
  });

  // Send email receipt asynchronously
  if (plan.amount > 0 && user.email) {
    try {
      await sendSubscriptionPurchasedEmail(user.email, user.fullName || "User", plan.name, plan.amount);
    } catch (e) {
      console.warn("[EntitlementEngine] Invoice email failed:", e);
    }
  }

  return result;
}
