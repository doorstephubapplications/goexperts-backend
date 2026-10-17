import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getProfileCompletion,
  finalizeProfileCompletion,
} from "../../controllers/profile/profile-completion.controller.js";
import { getProfileStats } from "../../controllers/profile/profile-stats.controller.js";

const router = Router();

router.get("/me", authMiddleware as any, getProfileCompletion as any);
router.get("/stats/me", authMiddleware as any, getProfileStats as any);
router.post("/finalize", authMiddleware as any, finalizeProfileCompletion as any);

export default router;
