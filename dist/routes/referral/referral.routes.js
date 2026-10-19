import { Router } from "express";
import { trackClick, getReferralDetails, getReferralWalletHistory, } from "../../controllers/referral/referral.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
const router = Router();
router.get("/track", trackClick);
router.get("/me", authMiddleware, getReferralDetails);
router.get("/", authMiddleware, getReferralDetails);
router.get("/wallet-history", authMiddleware, getReferralWalletHistory);
export default router;
