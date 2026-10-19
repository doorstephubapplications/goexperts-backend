import { Router } from "express";
import {
  trackClick,
  getReferralDetails,
  getReferralWalletHistory,
} from "../../controllers/referral/referral.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/track", trackClick);
router.get("/me", authMiddleware as any, getReferralDetails as any);
router.get("/", authMiddleware as any, getReferralDetails as any);
router.get("/wallet-history", authMiddleware as any, getReferralWalletHistory as any);

export default router;
