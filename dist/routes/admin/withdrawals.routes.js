import { Router } from "express";
import { authMiddleware as authenticate } from "../../middlewares/auth.middleware.js";
import { listWithdrawals, approveWithdrawal, rejectWithdrawal, creditWallet } from "../../controllers/admin/withdrawals.controller.js";
import { prisma } from "../../config/database.js";
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
// Single delete withdrawal transaction
router.delete("/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        await prisma.walletTransaction.delete({
            where: { id },
        });
        res.json({ success: true, message: "Withdrawal deleted successfully." });
    }
    catch (err) {
        next(err);
    }
});
// Bulk delete withdrawal transactions
router.post("/bulk-delete", async (req, res, next) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "Array of ids is required" });
        }
        const result = await prisma.walletTransaction.deleteMany({
            where: { id: { in: ids } },
        });
        res.json({ success: true, count: result.count, message: `${result.count} withdrawals deleted successfully.` });
    }
    catch (err) {
        next(err);
    }
});
export default router;
