import { prisma } from "../../config/database.js";
import { generateInvoicePdf } from "../invoice/invoice.service.js";
import { sendSubscriptionPurchasedEmail, sendFreePlanActivatedEmail } from "../mobile/email.service.js";
import { calculateInclusiveGst } from "../../utils/financial.util.js";
import {
  computeSubscriptionExpiry,
  computeQuotaResetDate,
  computeCurrentQuotaWindow,
  parseDurationString,
  addCalendarMonths,
  formatValidityLabel,
  ValidityUnit,
  isSubscriptionActiveAt,
  normalizeQuotaResetPolicy,
} from "../../utils/date-arithmetic.util.js";
import {
  CANONICAL_PLANS,
  hydratePlanFromDb,
  CanonicalPlanDefinition,
} from "../../constants/plan-catalog.constants.js";

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
  nextResetDate: Date | null;
  gateReason: "NO_SUBSCRIPTION" | "SUBSCRIPTION_EXPIRED" | "QUOTA_EXHAUSTED" | "ROLE_NOT_ENTITLED" | "ROLE_NOT_ACTIVATED" | null;
};

export type UserSubscriptionSummary = {
  userId: string;
  primaryRole: RoleName;
  activatedWorkspaces: RoleName[];
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
    validityLabel: string;
    startDate: Date;
    endDate: Date;
    status: string;
    nextResetDate?: Date | null;
  }>;
  roleQuotas: Record<
    RoleName,
    {
      actionKey: string;
      label: string;
      used: number;
      limit: number;
      remaining: number;
      isUnlimited: boolean;
      resetDate: Date | null;
    }
  >;
  eligibleAddOns: Array<{
    targetRole: RoleName;
    roleTitle: string;
    isActivated: boolean;
    hasActiveAddOn: boolean;
    monthlyPrice: number;
    annualPrice: number;
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
 * Resolves feature key from action name for quota tracking.
 */
export function resolveFeatureKeyForAction(action: string): string {
  switch (action) {
    case "submitProposal":
      return "proposals_submitted";
    case "publishProject":
      return "projects_published";
    case "saveFreelancer":
      return "client_freelancers_saved";
    case "saveProject":
      return "freelancer_projects_saved";
    case "sendInvitation":
      return "client_direct_invitations_sent";
    case "expressInterest":
      return "investor_interests_expressed"; // Full form: Expressions of Interest
    case "saveStartup":
      return "investor_startups_saved";
    case "contactFounder":
      return "founder_intro_requests_sent";
    case "publishStartup":
      return "active_startups_published";
    case "contactInvestor":
      return "investor_contacts_sent";
    default:
      return action;
  }
}

/**
 * Computes end date based on duration using calendar date arithmetic.
 */
export function computePlanEndDate(duration: string, startDate: Date = new Date()): Date {
  const { validityValue, validityUnit } = parseDurationString(duration);
  return computeSubscriptionExpiry(startDate, validityValue, validityUnit);
}

/**
 * Extracts immutable purchased plan snapshot from subscription history metadata if present.
 * Protects active subscribers against retroactive Admin catalog mutations without schema migrations.
 */
export function extractPlanSnapshot(planId: string, subscriptionHistories?: any[]): any | null {
  if (!subscriptionHistories || subscriptionHistories.length === 0) return null;
  const match = subscriptionHistories.find((h) => h.planId === planId && h.metadata);
  if (!match) return null;
  try {
    const meta = typeof match.metadata === "string" ? JSON.parse(match.metadata) : match.metadata;
    return meta?.planSnapshot || null;
  } catch {
    return null;
  }
}

/**
 * Resolves full subscription summary for an account across all 4 roles.
 * ZERO-FALLBACK ROLE SECURITY: Only entitles explicitly activated workspaces!
 */
export async function resolveUserSubscriptionSummary(userId: string): Promise<UserSubscriptionSummary> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      trialEndsAt: true,
      userRoles: {
        where: { status: "active" },
        select: { role: true },
      },
      subscriptions: {
        where: { status: "active" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      },
      subscriptionHistories: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  const primaryRole: RoleName = normalizeRoleKey(user?.role);
  const activatedWorkspacesSet = new Set<RoleName>([primaryRole]);
  if (user?.userRoles) {
    for (const ur of user.userRoles) {
      activatedWorkspacesSet.add(normalizeRoleKey(ur.role));
    }
  }
  const activatedWorkspaces = Array.from(activatedWorkspacesSet);

  if (!user) {
    return {
      userId,
      primaryRole: "freelancer",
      activatedWorkspaces: ["freelancer"],
      isTrialActive: false,
      trialEndsAt: null,
      trialDaysRemaining: 0,
      hasAllAccess: false,
      entitledRoles: [],
      activeSubscriptions: [],
      roleQuotas: {} as any,
      eligibleAddOns: [],
    };
  }

  const now = new Date();
  const trialEndsAt = user.trialEndsAt;
  // Start-inclusive, end-exclusive trial boundary: expired at now >= trialEndsAt
  const isTrialActive = Boolean(trialEndsAt && now.getTime() < trialEndsAt.getTime());
  const trialDaysRemaining = isTrialActive && trialEndsAt
    ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Start-inclusive, end-exclusive subscription interval check
  const validActiveSubs = (user.subscriptions || []).filter(
    (sub) => isSubscriptionActiveAt(sub.startDate, sub.endDate, now)
  );

  let hasAllAccess = false;
  const entitledRolesSet = new Set<string>();

  // ZERO-FALLBACK: Free Intro only entitles the primary workspace (or active secondary in user_roles)
  if (isTrialActive) {
    entitledRolesSet.add(primaryRole);
    for (const ur of activatedWorkspaces) {
      entitledRolesSet.add(ur);
    }
  }

  for (const s of validActiveSubs) {
    const plan = s.plan;
    const planType = (s as any).planType || plan?.planType || (plan?.role === "all" ? "all_access" : "single_role");
    const subRole = (s as any).role || plan?.role;

    if (planType === "all_access" || subRole === "all" || plan?.name?.toLowerCase().includes("all access")) {
      hasAllAccess = true;
      // All Access provides commercial entitlement only across ACTIVATED workspaces!
      for (const ur of activatedWorkspaces) {
        entitledRolesSet.add(ur);
      }
    } else if (subRole) {
      const normalizedSubRole = normalizeRoleKey(subRole);
      if (activatedWorkspacesSet.has(normalizedSubRole)) {
        entitledRolesSet.add(normalizedSubRole);
      }
    }
  }

  // Calculate per-role quotas
  const roleQuotas: Record<RoleName, any> = {
    freelancer: {
      actionKey: "proposals_submitted",
      label: "Proposals",
      used: 0,
      limit: 3,
      remaining: 3,
      isUnlimited: false,
      resetDate: null,
    },
    client: {
      actionKey: "projects_published",
      label: "Project Posts",
      used: 0,
      limit: 3,
      remaining: 3,
      isUnlimited: false,
      resetDate: null,
    },
    investor: {
      actionKey: "investor_interests_expressed",
      label: "Expressions of Interest",
      used: 0,
      limit: 5,
      remaining: 5,
      isUnlimited: false,
      resetDate: null,
    },
    founder: {
      actionKey: "investor_contacts_sent",
      label: "Investor Contacts",
      used: 0,
      limit: 5,
      remaining: 5,
      isUnlimited: false,
      resetDate: null,
    },
  };

  // Fetch usage for active subscriptions
  for (const s of validActiveSubs) {
    const sRole = normalizeRoleKey((s as any).role || s.plan?.role);
    const snapshot = extractPlanSnapshot(s.planId || s.plan?.id, user.subscriptionHistories);
    const baseHydrated = hydratePlanFromDb(s.plan);
    const hydrated = snapshot
      ? {
          ...baseHydrated,
          quotas: { ...baseHydrated.quotas, ...snapshot.quotas },
          quotaResetPolicy: normalizeQuotaResetPolicy(snapshot.quotaResetPolicy || baseHydrated.quotaResetPolicy),
          quotaResetValue: snapshot.quotaResetValue ?? baseHydrated.quotaResetValue,
          quotaResetUnit: snapshot.quotaResetUnit || baseHydrated.quotaResetUnit,
          validityValue: snapshot.validityValue ?? baseHydrated.validityValue,
          validityUnit: snapshot.validityUnit || baseHydrated.validityUnit,
        }
      : baseHydrated;
    const usages = await prisma.subscriptionUsage.findMany({
      where: { subscriptionId: s.id },
    });

    const { windowStart } = computeCurrentQuotaWindow(
      s.startDate,
      hydrated.quotaResetPolicy,
      hydrated.quotaResetValue,
      hydrated.quotaResetUnit,
      s.endDate
    );

    const getCycleUsage = (featureKey: string) => {
      const u = usages.find((row) => row.featureKey === featureKey);
      if (!u) return 0;
      if (u.lastUsedAt && u.lastUsedAt.getTime() < windowStart.getTime()) {
        return 0; // Rolled over into a new cycle
      }
      return u.used || 0;
    };

    if (sRole === "freelancer") {
      const used = getCycleUsage("proposals_submitted");
      const limit = hydrated.quotas.proposals ?? 3;
      roleQuotas.freelancer = {
        actionKey: "proposals_submitted",
        label: "Proposals",
        used,
        limit,
        remaining: limit === -1 ? 999999 : Math.max(0, limit - used),
        isUnlimited: limit === -1,
        resetDate: computeQuotaResetDate(s.startDate, hydrated.quotaResetPolicy, hydrated.quotaResetValue, hydrated.quotaResetUnit, s.endDate),
      };
    } else if (sRole === "client") {
      const used = getCycleUsage("projects_published");
      const limit = hydrated.quotas.projectPosts ?? 3;
      roleQuotas.client = {
        actionKey: "projects_published",
        label: "Project Posts",
        used,
        limit,
        remaining: limit === -1 ? 999999 : Math.max(0, limit - used),
        isUnlimited: limit === -1,
        resetDate: computeQuotaResetDate(s.startDate, hydrated.quotaResetPolicy, hydrated.quotaResetValue, hydrated.quotaResetUnit, s.endDate),
      };
    } else if (sRole === "investor") {
      const used = getCycleUsage("investor_interests_expressed");
      const limit = hydrated.quotas.expressionsOfInterest ?? 5;
      roleQuotas.investor = {
        actionKey: "investor_interests_expressed",
        label: "Expressions of Interest",
        used,
        limit,
        remaining: limit === -1 ? 999999 : Math.max(0, limit - used),
        isUnlimited: limit === -1,
        resetDate: computeQuotaResetDate(s.startDate, hydrated.quotaResetPolicy, hydrated.quotaResetValue, hydrated.quotaResetUnit, s.endDate),
      };
    } else if (sRole === "founder") {
      const used = getCycleUsage("investor_contacts_sent");
      const limit = hydrated.quotas.investorContactRequests ?? 5;
      roleQuotas.founder = {
        actionKey: "investor_contacts_sent",
        label: "Investor Contacts",
        used,
        limit,
        remaining: limit === -1 ? 999999 : Math.max(0, limit - used),
        isUnlimited: limit === -1,
        resetDate: computeQuotaResetDate(s.startDate, hydrated.quotaResetPolicy, hydrated.quotaResetValue, hydrated.quotaResetUnit, s.endDate),
      };
    }
  }

  // Eligible Add-ons: support active workspace add-ons and secondary roles
  const allRoles: RoleName[] = ["freelancer", "client", "investor", "founder"];
  const eligibleAddOns = allRoles.map((r) => {
    const isPrimary = r === primaryRole;
    const isActivated = isPrimary || activatedWorkspacesSet.has(r);
    const hasActiveAddOn = validActiveSubs.some(
      (s) => normalizeRoleKey((s as any).role || s.plan?.role) === r && (s as any).planType === "add_on"
    );
    const roleTitles: Record<RoleName, string> = {
      freelancer: "Freelancer / Expert",
      client: "Client / Business",
      investor: "Investor",
      founder: "Founder / Startup",
    };
    return {
      targetRole: r,
      roleTitle: roleTitles[r],
      isPrimary,
      isActivated,
      hasActiveAddOn,
      monthlyPrice: 149,
      annualPrice: 1499,
    };
  });

  return {
    userId,
    primaryRole,
    activatedWorkspaces,
    isTrialActive,
    trialEndsAt,
    trialDaysRemaining,
    hasAllAccess,
    entitledRoles: Array.from(entitledRolesSet),
    activeSubscriptions: validActiveSubs.map((s) => {
      const { validityValue, validityUnit } = parseDurationString(s.plan?.duration);
      return {
        id: s.id,
        role: (s as any).role || s.plan?.role || null,
        planType: (s as any).planType || s.plan?.planType || "single_role",
        planName: s.plan?.name || "Active Subscription",
        amount: s.plan?.amount || 0,
        duration: s.plan?.duration || "monthly",
        validityLabel: formatValidityLabel(validityValue, validityUnit),
        startDate: s.startDate,
        endDate: s.endDate,
        status: s.status,
      };
    }),
    roleQuotas,
    eligibleAddOns,
  };
}

/**
 * Resolves entitlement and quota for a specific role and action.
 * ZERO-FALLBACK ROLE SECURITY: Strict verification of primary and UserRole membership.
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
      role: true,
      trialEndsAt: true,
      userRoles: {
        where: { status: "active" },
        select: { role: true },
      },
      subscriptions: {
        where: { status: "active" },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      },
      subscriptionHistories: {
        orderBy: { createdAt: "desc" },
        take: 20,
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
      nextResetDate: null,
      gateReason: "NO_SUBSCRIPTION",
    };
  }

  // 1. Strict Workspace Membership Validation (Zero-Fallback)
  const isPrimary = normalizeRoleKey(user.role) === normalizedRole;
  const isSecondaryActive = Array.isArray(user.userRoles) && user.userRoles.some((ur: any) => normalizeRoleKey(ur.role) === normalizedRole);
  if (!isPrimary && !isSecondaryActive) {
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
      nextResetDate: null,
      gateReason: "ROLE_NOT_ACTIVATED",
    };
  }

  // 2. Check 6-Month Free Trial (Start-inclusive, end-exclusive boundary: now < trialEndsAt)
  if (user.trialEndsAt && now.getTime() < user.trialEndsAt.getTime()) {
    const trialSub = user.subscriptions.find(
      (s) => s.plan?.planType === "trial" || s.plan?.duration === "180_days" || s.plan?.duration === "6_months" || s.plan?.amount === 0
    );

    let quotaUsed = 0;
    const quotaLimit = 36; // 36 proposals or 36 project posts

    if (trialSub && action) {
      const featureKey = resolveFeatureKeyForAction(action);
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

    if (quotaLimit > 0 && quotaUsed >= quotaLimit) {
      return {
        isEntitled: false,
        role: normalizedRole,
        planType: "trial",
        planName: trialSub?.plan?.name || "6-Month Free Intro",
        subscriptionId: trialSub?.id || null,
        isTrial: true,
        isUnlimited: false,
        quotaLimit,
        quotaUsed,
        quotaRemaining: 0,
        expiresAt: user.trialEndsAt,
        nextResetDate: user.trialEndsAt,
        gateReason: "QUOTA_EXHAUSTED",
      };
    }

    return {
      isEntitled: true,
      role: normalizedRole,
      planType: "trial",
      planName: trialSub?.plan?.name || "6-Month Free Intro",
      subscriptionId: trialSub?.id || null,
      isTrial: true,
      isUnlimited: false,
      quotaLimit,
      quotaUsed,
      quotaRemaining,
      expiresAt: user.trialEndsAt,
      nextResetDate: user.trialEndsAt,
      gateReason: null,
    };
  }

  // 3. Check Paid Subscriptions (Start-inclusive, end-exclusive interval check)
  const activeSubs = (user.subscriptions || []).filter(
    (sub) => isSubscriptionActiveAt(sub.startDate, sub.endDate, now)
  );

  // 3a. All Access Check (Model A: defined quotas, never unlimited without policy)
  const allAccessSub = activeSubs.find(
    (s) =>
      (s as any).planType === "all_access" ||
      s.plan?.planType === "all_access" ||
      (s as any).role === "all" ||
      s.plan?.role === "all" ||
      s.plan?.name?.toLowerCase().includes("all access")
  );

  if (allAccessSub) {
    const allAccessSnapshot = extractPlanSnapshot(allAccessSub.planId || allAccessSub.plan?.id, user.subscriptionHistories);
    const baseAllAccess = hydratePlanFromDb(allAccessSub.plan);
    const hydrated = allAccessSnapshot
      ? {
          ...baseAllAccess,
          quotas: { ...baseAllAccess.quotas, ...allAccessSnapshot.quotas },
          quotaResetPolicy: normalizeQuotaResetPolicy(allAccessSnapshot.quotaResetPolicy || baseAllAccess.quotaResetPolicy),
          quotaResetValue: allAccessSnapshot.quotaResetValue ?? baseAllAccess.quotaResetValue,
          quotaResetUnit: allAccessSnapshot.quotaResetUnit || baseAllAccess.quotaResetUnit,
        }
      : baseAllAccess;
    let quotaLimit = 6; // default Model A proposals
    if (normalizedRole === "client") quotaLimit = hydrated.quotas.projectPosts ?? 5;
    else if (normalizedRole === "investor") quotaLimit = hydrated.quotas.expressionsOfInterest ?? 3;
    else if (normalizedRole === "founder") quotaLimit = hydrated.quotas.investorContactRequests ?? 5;
    else quotaLimit = hydrated.quotas.proposals ?? 6;

    let quotaUsed = 0;
    if (action) {
      const featureKey = resolveFeatureKeyForAction(action);
      const usage = await prisma.subscriptionUsage.findUnique({
        where: {
          subscriptionId_featureKey: {
            subscriptionId: allAccessSub.id,
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
        planType: "all_access",
        planName: allAccessSub.plan?.name || "Go Experts All Access",
        subscriptionId: allAccessSub.id,
        isTrial: false,
        isUnlimited: false,
        quotaLimit,
        quotaUsed,
        quotaRemaining: 0,
        expiresAt: allAccessSub.endDate,
        nextResetDate: computeQuotaResetDate(allAccessSub.startDate, hydrated.quotaResetPolicy, hydrated.quotaResetValue, hydrated.quotaResetUnit, allAccessSub.endDate),
        gateReason: "QUOTA_EXHAUSTED",
      };
    }

    return {
      isEntitled: true,
      role: normalizedRole,
      planType: "all_access",
      planName: allAccessSub.plan?.name || "Go Experts All Access",
      subscriptionId: allAccessSub.id,
      isTrial: false,
      isUnlimited: false,
      quotaLimit,
      quotaUsed,
      quotaRemaining,
      expiresAt: allAccessSub.endDate,
      nextResetDate: computeQuotaResetDate(allAccessSub.startDate, hydrated.quotaResetPolicy, hydrated.quotaResetValue, hydrated.quotaResetUnit, allAccessSub.endDate),
      gateReason: null,
    };
  }

  // 3b. Role-Specific or Add-on Check with Immutable Plan Snapshot Prioritization
  const roleSub = activeSubs.find((s) => {
    const subRole = (s as any).role || s.plan?.role;
    return subRole && normalizeRoleKey(subRole) === normalizedRole;
  });

  if (roleSub) {
    const snapshot = extractPlanSnapshot(roleSub.planId || roleSub.plan?.id, user.subscriptionHistories);
    const baseHydrated = hydratePlanFromDb(roleSub.plan);
    const hydrated = snapshot
      ? {
          ...baseHydrated,
          quotas: { ...baseHydrated.quotas, ...snapshot.quotas },
          quotaResetPolicy: normalizeQuotaResetPolicy(snapshot.quotaResetPolicy || baseHydrated.quotaResetPolicy),
          quotaResetValue: snapshot.quotaResetValue ?? baseHydrated.quotaResetValue,
          quotaResetUnit: snapshot.quotaResetUnit || baseHydrated.quotaResetUnit,
          validityValue: snapshot.validityValue ?? baseHydrated.validityValue,
          validityUnit: snapshot.validityUnit || baseHydrated.validityUnit,
        }
      : baseHydrated;
    let quotaLimit = -1;

    if (normalizedRole === "freelancer") {
      quotaLimit = hydrated.quotas.proposals ?? (snapshot?.proposalsLimit || roleSub.plan?.proposalsLimit || 3);
    } else if (normalizedRole === "client") {
      quotaLimit = hydrated.quotas.projectPosts ?? (snapshot?.projectsLimit || roleSub.plan?.projectsLimit || 3);
    } else if (normalizedRole === "investor") {
      if (action === "saveStartup") quotaLimit = hydrated.quotas.savedStartups ?? 20;
      else if (action === "contactFounder") quotaLimit = hydrated.quotas.founderIntroRequests ?? 5;
      else quotaLimit = hydrated.quotas.expressionsOfInterest ?? 5; // Expressions of Interest
    } else if (normalizedRole === "founder") {
      if (action === "publishStartup") quotaLimit = hydrated.quotas.activePublishedStartups ?? 1;
      else quotaLimit = hydrated.quotas.investorContactRequests ?? 5;
    }

    let quotaUsed = 0;
    if (action) {
      const featureKey = resolveFeatureKeyForAction(action);
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

    const quotaRemaining = quotaLimit === -1 ? 999999 : Math.max(0, quotaLimit - quotaUsed);

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
        nextResetDate: computeQuotaResetDate(roleSub.startDate, hydrated.quotaResetPolicy, hydrated.quotaResetValue, hydrated.quotaResetUnit, roleSub.endDate),
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
      nextResetDate: computeQuotaResetDate(roleSub.startDate, hydrated.quotaResetPolicy, hydrated.quotaResetValue, hydrated.quotaResetUnit, roleSub.endDate),
      gateReason: null,
    };
  }

  // 4. User has other subscriptions, but none for this role
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
      nextResetDate: null,
      gateReason: "ROLE_NOT_ENTITLED",
    };
  }

  // 5. No active subscription
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
    nextResetDate: null,
    gateReason: "NO_SUBSCRIPTION",
  };
}

/**
 * Asserts action entitlement. Throws ActionGateError if restricted.
 */
export async function assertActionEntitlement(
  userId: string,
  role: string,
  action: string
): Promise<RoleEntitlementResult> {
  const entitlement = await resolveRoleEntitlement(userId, role, action);

  if (!entitlement.isEntitled) {
    if (entitlement.gateReason === "ROLE_NOT_ACTIVATED") {
      throw new ActionGateError(action, "ROLE_NOT_ACTIVATED", {
        role,
        message: `Forbidden: The ${role.toUpperCase()} workspace has not been activated. Activate it under your profile or purchase an Additional Role Add-on.`,
      });
    }

    if (entitlement.gateReason === "QUOTA_EXHAUSTED") {
      let unitLabel = "action";
      if (action === "submitProposal") unitLabel = "proposal";
      else if (action === "publishProject") unitLabel = "project post";
      else if (action === "expressInterest") unitLabel = "Expression of Interest"; // Full form!
      else if (action === "contactInvestor") unitLabel = "investor contact request";
      else if (action === "publishStartup") unitLabel = "active published startup";

      throw new ActionGateError(action, "QUOTA_EXHAUSTED", {
        role,
        limit: entitlement.quotaLimit,
        used: entitlement.quotaUsed,
        planName: entitlement.planName,
        message: `Your ${unitLabel} quota for this billing cycle has been reached (${entitlement.quotaUsed}/${entitlement.quotaLimit}). Upgrade your plan or renew to continue.`,
        subscriptionDashboardRoute: '/dashboard/subscriptions'
      });
    }

    if (entitlement.gateReason === "ROLE_NOT_ENTITLED") {
      throw new ActionGateError(action, "ROLE_NOT_ENTITLED", {
        role,
        message: `Your active plan does not include the ${role.toUpperCase()} workspace. Add this role for ₹149/mo to unlock it.`,
        subscriptionDashboardRoute: '/dashboard/subscriptions'
      });
    }

    let defaultMsg = `An active subscription or 6-Month Free Intro is required to perform this action. Choose a plan to continue.`;
    if (action === "publishStartup") {
      defaultMsg = `An active Founder subscription or 6-Month Free Intro is required to publish your startup publicly to investors.`;
    } else if (action === "contactInvestor") {
      defaultMsg = `An active Founder subscription or 6-Month Free Intro is required to connect with investors.`;
    } else if (action === "expressInterest") {
      defaultMsg = `An active Investor subscription or 6-Month Free Intro is required to submit an Expression of Interest.`;
    } else if (action === "contactFounder") {
      defaultMsg = `An active Investor subscription or 6-Month Free Intro is required to schedule meetings or contact founders.`;
    }

    throw new ActionGateError(action, "SUBSCRIPTION_REQUIRED", {
      role,
      message: defaultMsg,
      subscriptionDashboardRoute: '/dashboard/subscriptions'
    });
  }

  return entitlement;
}

/**
 * Atomically increments quota usage for any counted action across all 4 roles.
 */
export async function recordActionUsage(
  subscriptionId: string | null,
  action: string,
  tx?: any
): Promise<number> {
  if (!subscriptionId) return 0;
  const db = tx || prisma;
  const featureKey = resolveFeatureKeyForAction(action);

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
 * Concurrency-safe atomic check-and-consume helper for all roles.
 * Prevents race conditions when multiple requests arrive concurrently.
 * Handles boundary races, cycle rollovers, retries, and non-negative rollback.
 */
export async function assertAndConsumeActionQuota(
  userId: string,
  role: string,
  action: string,
  idempotencyToken?: string
): Promise<{ entitlement: RoleEntitlementResult; quotaUsed: number }> {
  // 1. Initial entitlement assertion
  const entitlement = await assertActionEntitlement(userId, role, action);
  if (!entitlement.subscriptionId) {
    return { entitlement, quotaUsed: 0 };
  }

  // 2. If unlimited (-1), record usage without limit constraint
  if (entitlement.quotaLimit === -1) {
    const used = await recordActionUsage(entitlement.subscriptionId, action);
    return { entitlement, quotaUsed: used };
  }

  // 3. Atomically increment usage with cycle-boundary reset
  const featureKey = resolveFeatureKeyForAction(action);
  const now = new Date();

  // Check if existing usage was recorded in an earlier cycle
  const existingUsage = await prisma.subscriptionUsage.findUnique({
    where: {
      subscriptionId_featureKey: {
        subscriptionId: entitlement.subscriptionId,
        featureKey,
      },
    },
  });

  let updatedUsage;
  // If lastUsedAt was before current window start, reset count to 1 for new cycle
  if (
    existingUsage &&
    existingUsage.lastUsedAt &&
    entitlement.nextResetDate &&
    now.getTime() >= existingUsage.lastUsedAt.getTime()
  ) {
    // Check if a reset boundary was crossed since lastUsedAt
    const nextResetAfterLastUsed = computeQuotaResetDate(
      existingUsage.lastUsedAt,
      "CALENDAR_MONTHLY",
      1,
      "MONTHS",
      entitlement.expiresAt || undefined,
      existingUsage.lastUsedAt
    );
    if (nextResetAfterLastUsed && now.getTime() >= nextResetAfterLastUsed.getTime()) {
      // New billing cycle has begun: reset counter to 1
      updatedUsage = await prisma.subscriptionUsage.update({
        where: { id: existingUsage.id },
        data: {
          used: 1,
          lastUsedAt: now,
        },
      }).catch(() => null);
    }
  }

  if (!updatedUsage) {
    updatedUsage = await prisma.subscriptionUsage.upsert({
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
        lastUsedAt: now,
      },
      update: {
        used: { increment: 1 },
        lastUsedAt: now,
      },
    });
  }

  // 4. Concurrency check: rollback if increment breached limit
  if (updatedUsage.used > entitlement.quotaLimit) {
    // Atomic rollback with lower-bound protection
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

    let unitLabel = "action";
    if (action === "submitProposal") unitLabel = "proposal";
    else if (action === "publishProject") unitLabel = "project post";
    else if (action === "expressInterest") unitLabel = "Expression of Interest"; // Full form!
    else if (action === "contactInvestor") unitLabel = "investor contact request";
    else if (action === "publishStartup") unitLabel = "active published startup";

    throw new ActionGateError(action, "QUOTA_EXHAUSTED", {
      role,
      limit: entitlement.quotaLimit,
      used: entitlement.quotaLimit,
      planName: entitlement.planName,
      message: `Your ${unitLabel} quota for this billing cycle has been reached (${entitlement.quotaLimit}/${entitlement.quotaLimit}). Upgrade your plan or renew to continue.`,
    });
  }

  return { entitlement, quotaUsed: updatedUsage.used };
}

/**
 * Authoritative alias for assertAndConsumeActionQuota.
 */
export const assertAndIncrementActionUsage = assertAndConsumeActionQuota;

/**
 * Rollback/refund action usage if downstream operation fails.
 * Concurrency-safe: never decrements below zero or decrements another action's usage.
 */
export async function rollbackActionUsage(
  subscriptionId: string | null,
  action: string,
  tx?: any
): Promise<void> {
  if (!subscriptionId) return;
  const db = tx || prisma;
  const featureKey = resolveFeatureKeyForAction(action);
  const existing = await db.subscriptionUsage.findUnique({
    where: {
      subscriptionId_featureKey: {
        subscriptionId,
        featureKey,
      },
    },
  }).catch(() => null);

  if (existing && existing.used > 0) {
    await db.subscriptionUsage.update({
      where: {
        id: existing.id,
      },
      data: {
        used: { decrement: 1 },
      },
    }).catch(() => null);
  }
}

/**
 * Activates the canonical 6-Month Free Intro for a user.
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
  const endDate = addCalendarMonths(startDate, 6); // Exactly 6 calendar months (no 180-day approximation!)

  let plan = await prisma.subscriptionPlan.findFirst({
    where: {
      OR: [
        { name: "6-Month Free Intro" },
        { name: "6-Month Free Access" },
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
        name: "6-Month Free Intro",
        role: "all",
        planType: "trial",
        amount: 0,
        currency: "INR",
        duration: "6_months",
        proposalsLimit: 36,
        projectsLimit: 36,
        sortOrder: 0,
        visibility: "public",
        status: "active",
        limits: JSON.stringify({
          validityValue: 6,
          validityUnit: "MONTHS",
          quotaResetPolicy: "FULL_TERM",
          proposals: 36,
          projectPosts: 36,
        }),
      },
    });
  }

  const existingTrial = user.subscriptions.find(
    (s) => s.planId === plan.id || s.endDate.getTime() > startDate.getTime()
  );

  if (existingTrial) {
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
        role: user.role || "freelancer", // Primary role, never auto-activate all 4!
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
        status: "active",
      },
    });

    const freeTrialSnapshot = {
      id: plan.id,
      name: plan.name,
      role: user.role || "freelancer",
      planType: "trial",
      amount: 0,
      currency: "INR",
      duration: "6_months",
      validityValue: 6,
      validityUnit: "MONTHS",
      quotaResetPolicy: "FULL_TERM",
      quotaResetValue: 1,
      quotaResetUnit: "MONTHS",
      quotas: {
        proposals: 36,
        projectPosts: 36,
      },
      capabilities: [],
      proposalsLimit: 36,
      projectsLimit: 36,
    };

    await tx.subscriptionHistory.create({
      data: {
        userId: user.id,
        planId: plan.id,
        action: "6_MONTH_FREE_INTRO_ACTIVATED",
        metadata: JSON.stringify({
          planSnapshot: freeTrialSnapshot,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          duration: "6_months",
          validityValue: 6,
          validityUnit: "MONTHS",
          proposalsLimit: 36,
          projectsLimit: 36,
        }),
      },
    });

    return sub;
  });

  if (user.email) {
    try {
      await sendFreePlanActivatedEmail(user.email, user.fullName || "User", user.role || "freelancer", plan.name, endDate);
    } catch (e) {
      console.warn("[EntitlementEngine] Free intro email failed:", e);
    }
  }

  return { success: true, expiresAt: endDate, subscriptionId: createdSub.id };
}

/**
 * Activates or upgrades a paid subscription.
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

  const hydrated = hydratePlanFromDb(plan);
  const planType = (plan as any).planType || (plan.role === "all" ? "all_access" : "single_role");
  const targetRole = assignedRole ? normalizeRoleKey(assignedRole) : (plan.role === "all" ? "all" : normalizeRoleKey(plan.role));
  const startDate = new Date();
  const endDate = computeSubscriptionExpiry(startDate, hydrated.validityValue, hydrated.validityUnit);

  const result = await prisma.$transaction(async (tx) => {
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

    const subscription = await tx.subscription.create({
      data: {
        userId,
        planId: plan.id,
        role: targetRole,
        planType,
        startDate,
        endDate,
        status: "active",
        autoRenew: false, // Manual renewal model! No unauthorized card auto-debit!
      },
      include: { plan: true },
    });

    await tx.user.update({
      where: { id: userId },
      data: { status: "active" },
    });

    const planSnapshot = {
      id: plan.id,
      name: plan.name,
      role: plan.role,
      planType,
      amount: plan.amount,
      currency: plan.currency,
      duration: plan.duration,
      validityValue: hydrated.validityValue,
      validityUnit: hydrated.validityUnit,
      quotaResetPolicy: hydrated.quotaResetPolicy,
      quotaResetValue: hydrated.quotaResetValue,
      quotaResetUnit: hydrated.quotaResetUnit,
      quotas: hydrated.quotas,
      capabilities: (hydrated as any).capabilities ?? hydrated.benefits,
      proposalsLimit: plan.proposalsLimit,
      projectsLimit: plan.projectsLimit,
    };

    await tx.subscriptionHistory.create({
      data: {
        userId,
        planId: plan.id,
        action: planType === "all_access" ? "all_access_activated" : `role_${targetRole}_subscription_activated`,
        metadata: JSON.stringify({
          planSnapshot,
          planName: plan.name,
          amount: plan.amount,
          duration: plan.duration,
          validityValue: hydrated.validityValue,
          validityUnit: hydrated.validityUnit,
          targetRole,
          planType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        }),
      },
    });

    if (plan.amount > 0) {
      const { subtotal, gst, total } = calculateInclusiveGst(plan.amount);
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await tx.invoice.create({
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

  if (plan.amount > 0 && user.email) {
    try {
      const { dispatchSubscriptionLifecycleEmail } = await import("./email.dispatcher.js");
      await dispatchSubscriptionLifecycleEmail({
        eventType: 'ACTIVATED',
        userId: user.id,
        subscriptionId: result.id
      });
    } catch (e) {
      console.warn("[EntitlementEngine] Invoice email failed:", e);
    }
  }

  return result;
}
