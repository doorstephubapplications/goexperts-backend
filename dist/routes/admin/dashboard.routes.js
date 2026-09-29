import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { getExecutiveOverview, getRevenueOverview, getRevenueChart, getEcosystem, getFunding, getPlatformHealth, getModeration, getSecurity, getActivity, getNotifications, getSearch, getOverview } from "../../controllers/admin/dashboard.controller.js";
const router = Router();
router.use(authMiddleware);
router.get("/overview", getOverview);
router.get("/executive", getExecutiveOverview);
router.get("/revenue", getRevenueOverview);
router.get("/revenue-chart", getRevenueChart);
router.get("/ecosystem", getEcosystem);
router.get("/funding", getFunding);
router.get("/platform-health", getPlatformHealth);
router.get("/moderation", getModeration);
router.get("/security", getSecurity);
router.get("/activity", getActivity);
router.get("/notifications", getNotifications);
router.get("/search", getSearch);
router.get("/sidebar-counts", async (req, res, next) => {
    try {
        // Mock sidebar counts to stop 404 errors in frontend
        res.json({
            success: true,
            counts: {
                users: 0,
                projects: 0,
                tasks: 0,
                startups: 0,
                investments: 0,
                meetings: 0,
                support: 0,
                kyc: 0
            }
        });
    }
    catch (err) {
        next(err);
    }
});
export default router;
