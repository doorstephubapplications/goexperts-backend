import { Router, Request, Response, NextFunction } from "express";
import { sendActivationOtp, verifyActivationOtp } from "../../controllers/subscription/plan-activation.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import {
  resolveUserSubscriptionSummary,
  resolveRoleEntitlement,
  activateCanonicalFreeTrial,
} from "../../services/subscription/entitlement.service.js";
import { prisma } from "../../config/database.js";
import {
  CANONICAL_PLANS,
  hydratePlanFromDb,
} from "../../constants/plan-catalog.constants.js";
import {
  formatValidityLabel,
  parseDurationString,
  ValidityUnit,
} from "../../utils/date-arithmetic.util.js";

const router = Router();

// OTP activation endpoints
router.post("/send-activation-otp", sendActivationOtp);
router.post("/verify-activation-otp", verifyActivationOtp);

/**
 * Public & Authenticated Plan Catalog
 * Strictly filters by role and excludes Add-on / All Access packages unless explicitly requested.
 */
router.get("/plans", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roleQuery = req.query.role ? String(req.query.role).toLowerCase() : undefined;
    const includeAddOns = req.query.includeAddOns === "true";
    const includeAllAccess = req.query.includeAllAccess === "true";
    const includeDrafts = req.query.includeDrafts === "true";

    const where: any = {};

    // Status filter
    if (!includeDrafts) {
      where.status = { in: ["active", "published"] };
      where.visibility = "public";
    }

    // Role filtering: strictly match role, or "all"
    if (roleQuery && roleQuery !== "all") {
      where.OR = [
        { role: roleQuery },
        // Only include role="all" if add-ons or all-access or trial are allowed
        ...(includeAddOns || includeAllAccess ? [{ role: "all" }] : [{ planType: "trial" }]),
      ];
    }

    let plans = await prisma.subscriptionPlan.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { amount: "asc" }],
    });

    // Fallback: if database has zero plans, use in-memory canonical catalog
    if (plans.length === 0) {
      plans = CANONICAL_PLANS as any[];
    }

    // Hydrate metadata and enforce strict exclusions
    const hydratedPlans = plans
      .map((p) => hydratePlanFromDb(p))
      .filter((p) => {
        // Exclude add-ons if not requested
        if (!includeAddOns && (p.planCategory === "add_on" || p.name.toLowerCase().includes("add-on"))) {
          return false;
        }
        // Exclude All Access if not requested
        if (!includeAllAccess && (p.planCategory === "all_access" || p.name.toLowerCase().includes("all access"))) {
          return false;
        }
        // Exclude trial from standard paid plan lists if role-specific query
        if (roleQuery && roleQuery !== "all" && p.planCategory === "trial" && req.query.includeTrial !== "true") {
          return false;
        }
        // Strict role match
        if (roleQuery && roleQuery !== "all" && p.role !== roleQuery && p.role !== "all") {
          return false;
        }
        return true;
      });

    res.json({ success: true, data: hydratedPlans });
  } catch (err) {
    next(err);
  }
});

/**
 * Authenticated Subscription Summary
 * Returns active workspace subscription, multi-role usage, and eligible secondary add-ons.
 */
router.get("/summary", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await resolveUserSubscriptionSummary(req.user.id);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

/**
 * Authenticated Eligible Add-ons for User Dashboard
 */
router.get("/eligible-addons", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await resolveUserSubscriptionSummary(req.user.id);
    res.json({ success: true, data: summary.eligibleAddOns });
  } catch (err) {
    next(err);
  }
});

/**
 * Authenticated Role Entitlement Check
 */
router.get("/entitlement/:role", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const role = req.params.role;
    const action = req.query.action ? String(req.query.action) : undefined;
    const entitlement = await resolveRoleEntitlement(req.user.id, role, action);
    res.json({ success: true, data: entitlement });
  } catch (err) {
    next(err);
  }
});

/**
 * Authenticated 6-Month Free Trial Activation
 */
router.post("/trial/activate", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await activateCanonicalFreeTrial(req.user.id);
    res.json({ success: true, message: "6-Month Free Intro activated successfully", data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || "Failed to activate free trial" });
  }
});

/**
 * Super Admin: Save or Update Plan with Configurable Numeric Validity
 */
router.put("/plans/:id", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const planId = req.params.id;
    const body = req.body || {};

    // Verify admin privileges
    if (req.user.role !== "admin" && req.user.role !== "superadmin" && !(req.user as any).isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access required." });
    }

    const validityValue = Math.max(1, Math.floor(Number(body.validityValue) || 1));
    const validityUnit = (String(body.validityUnit || "MONTHS").toUpperCase() as ValidityUnit);
    const duration = `${validityValue}_${validityUnit.toLowerCase()}`;

    // Pack extended metadata into limits and features JSON
    const limits = JSON.stringify({
      validityValue,
      validityUnit,
      quotaResetPolicy: body.quotaResetPolicy || "CALENDAR_MONTHLY",
      quotaResetValue: Number(body.quotaResetValue) || 1,
      quotaResetUnit: body.quotaResetUnit || "MONTHS",
      shortDescription: body.shortDescription || "",
      detailedDescription: body.detailedDescription || "",
      benefits: body.benefits || [],
      proposals: Number(body.proposalsLimit) || 3,
      projectPosts: Number(body.projectsLimit) || 3,
      expressionsOfInterest: Number(body.expressionsOfInterest) || 0, // Full form!
      savedStartups: Number(body.savedStartups) || 0,
      founderIntroRequests: Number(body.founderIntroRequests) || 0,
      activePublishedStartups: Number(body.activePublishedStartups) || 0,
      investorContactRequests: Number(body.investorContactRequests) || 0,
    });

    const features = JSON.stringify(body.features || []);

    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        name: body.name,
        role: body.role,
        planType: body.planType || "single_role",
        amount: Number(body.amount) || 0,
        originalAmount: body.originalAmount ? Number(body.originalAmount) : null,
        currency: body.currency || "INR",
        duration,
        proposalsLimit: Number(body.proposalsLimit) || 0,
        projectsLimit: Number(body.projectsLimit) || 0,
        sortOrder: Number(body.sortOrder) || 0,
        popular: Boolean(body.popular),
        recommended: Boolean(body.recommended),
        savedBadge: body.savedBadge || null,
        status: body.status || "active",
        visibility: body.visibility || "public",
        limits,
        features,
      },
    });

    res.json({ success: true, message: "Subscription package updated successfully", data: hydratePlanFromDb(updated) });
  } catch (err: any) {
    next(err);
  }
});

/**
 * Super Admin: Safe Archive Plan (Prevents foreign key corruption and new purchases)
 */
router.post("/plans/:id/archive", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin" && !(req.user as any).isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access required." });
    }
    const planId = req.params.id;
    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        status: "archived",
        visibility: "hidden",
      },
    });
    res.json({ success: true, message: "Plan archived safely and hidden from new purchases", data: hydratePlanFromDb(updated) });
  } catch (err: any) {
    next(err);
  }
});

/**
 * Super Admin: Safe Restore Plan
 * Restores an archived plan to DRAFT (never automatically publishes unapproved packages)
 */
router.post("/plans/:id/restore", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin" && !(req.user as any).isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access required." });
    }
    const planId = req.params.id;
    const updated = await prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        status: "draft", // Safe restoration: places into draft so Super Admin can review before publishing
        visibility: "hidden",
      },
    });
    res.json({ success: true, message: "Plan safely restored to Draft status for review", data: hydratePlanFromDb(updated) });
  } catch (err: any) {
    next(err);
  }
});

/**
 * Super Admin: Safe Delete Plan
 * Protects historical subscriptions: archives plan if subscriptions or invoices exist, hard deletes only if zero references exist.
 */
router.delete("/plans/:id", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin" && !(req.user as any).isAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden: Super Admin access required." });
    }
    const planId = req.params.id;
    const subCount = await prisma.subscription.count({ where: { planId } }).catch(() => 0);
    const histCount = await prisma.subscriptionHistory.count({ where: { planId } }).catch(() => 0);

    if (subCount > 0 || histCount > 0) {
      // Historical references exist: execute safe archive rather than hard delete to prevent foreign key errors
      const updated = await prisma.subscriptionPlan.update({
        where: { id: planId },
        data: {
          status: "archived",
          visibility: "hidden",
        },
      });
      return res.json({
        success: true,
        archived: true,
        message: "Plan has active or historical subscriptions and was safely archived to preserve integrity.",
        data: hydratePlanFromDb(updated),
      });
    }

    // Zero references: safe to delete
    await prisma.subscriptionFeature.deleteMany({ where: { planId } }).catch(() => null);
    await prisma.subscriptionPlan.delete({ where: { id: planId } });
    res.json({ success: true, deleted: true, message: "Unreferenced plan successfully deleted." });
  } catch (err: any) {
    next(err);
  }
});

export default router;
