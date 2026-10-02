import { Router } from "express";
import { authMiddleware as authenticate } from "../../middlewares/auth.middleware.js";
import { listWithdrawals, approveWithdrawal, rejectWithdrawal, creditWallet } from "../../controllers/admin/withdrawals.controller.js";
const router = Router();
router.use(authenticate);
router.get("/", listWithdrawals);
router.get("/pending", listWithdrawals);
router.get("/all", listWithdrawals);
router.post("/:id/approve", approveWithdrawal);
router.post("/:id/reject", rejectWithdrawal);
router.post("/credit-wallet", creditWallet);
router.post("/bulk-status", (async (req, res, next) => {
    try {
        const { bulkStatus } = await import("../../controllers/admin/withdrawals.controller.js");
        return bulkStatus(req, res, next);
    }
    catch (err) {
        next(err);
    }
}));
export default router;
