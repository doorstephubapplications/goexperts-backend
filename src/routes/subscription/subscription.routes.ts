import { Router, Request, Response, NextFunction } from "express";
import { sendActivationOtp, verifyActivationOtp } from "../../controllers/subscription/plan-activation.controller.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import {
  resolveUserSubscriptionSummary,
  resolveRoleEntitlement,
  activateCanonicalFreeTrial,
} from "../../services/subscription/entitlement.service.js";
import { prisma } from "../../config/database.js";

const router = Router();

// OTP activation endpoints
router.post("/send-activation-otp", sendActivationOtp);
router.post("/verify-activation-otp", verifyActivationOtp);

// Public / Authenticated catalog of plans
router.get("/plans", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = req.query.role ? String(req.query.role).toLowerCase() : undefined;
    const where: any = { status: "active", visibility: "public" };
    if (role && role !== "all") {
      where.OR = [{ role: "all" }, { role }];
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { amount: "asc" }],
    });

    res.json({ success: true, data: plans });
  } catch (err) {
    next(err);
  }
});

// Authenticated Subscription Summary
router.get("/summary", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const summary = await resolveUserSubscriptionSummary(req.user.id);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

// Authenticated Role Entitlement Check
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

// Authenticated 6-Month Free Trial Activation
router.post("/trial/activate", authMiddleware as any, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const result = await activateCanonicalFreeTrial(req.user.id);
    res.json({ success: true, message: "6-Month Free Access activated successfully", data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err?.message || "Failed to activate free trial" });
  }
});

export default router;
