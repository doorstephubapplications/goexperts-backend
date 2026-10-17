import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getProfileCompletion, finalizeProfileCompletion, } from "../../controllers/profile/profile-completion.controller.js";
import { getProfileStats } from "../../controllers/profile/profile-stats.controller.js";
const router = Router();
router.get("/me", authMiddleware, getProfileCompletion);
router.get("/stats/me", authMiddleware, getProfileStats);
router.post("/finalize", authMiddleware, finalizeProfileCompletion);
export default router;
