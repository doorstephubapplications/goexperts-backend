import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import {
  getExecutiveOverview,
  getRevenueOverview,
  getRevenueChart,
  getEcosystem,
  getFunding,
  getPlatformHealth,
  getModeration,
  getSecurity,
  getActivity,
  getNotifications,
  getSearch,
  getOverview
} from "../../controllers/admin/dashboard.controller.js";

const router = Router();

router.use(authMiddleware as any);

router.get("/overview", getOverview as any);
router.get("/executive", getExecutiveOverview as any);
router.get("/revenue", getRevenueOverview as any);
router.get("/revenue-chart", getRevenueChart as any);
router.get("/ecosystem", getEcosystem as any);
router.get("/funding", getFunding as any);
router.get("/platform-health", getPlatformHealth as any);
router.get("/moderation", getModeration as any);
router.get("/security", getSecurity as any);
router.get("/activity", getActivity as any);
router.get("/notifications", getNotifications as any);
router.get("/search", getSearch as any);

export default router;
