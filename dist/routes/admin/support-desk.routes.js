import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { listAdminTickets, getAdminTicket, updateAdminTicket, assignAdminTicket, addAdminTicketMessage } from "../../controllers/admin/support-desk.controller.js";
const router = Router();
// Protect all routes
router.use(authMiddleware);
router.use((req, res, next) => {
    if (req.user?.type !== "admin")
        return res.status(403).json({ success: false, message: "Admin access required" });
    next();
});
router.get("/tickets", listAdminTickets);
router.get("/tickets/:id", getAdminTicket);
router.patch("/tickets/:id", updateAdminTicket);
router.patch("/tickets/:id/assign", assignAdminTicket);
router.post("/tickets/:id/messages", addAdminTicketMessage);
export default router;
