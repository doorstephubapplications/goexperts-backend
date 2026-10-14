import { Router } from "express";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { 
  listAdminTickets, 
  getAdminTicket, 
  updateAdminTicket, 
  assignAdminTicket, 
  addAdminTicketMessage 
} from "../../controllers/admin/support-desk.controller.js";
import { prisma } from "../../config/database.js";

const router = Router();

// Protect all routes
router.use(authMiddleware as any);
router.use((req: any, res: any, next: any) => {
  if (req.user?.type !== "admin") return res.status(403).json({ success: false, message: "Admin access required" });
  next();
});

router.get("/tickets", listAdminTickets as any);
router.get("/tickets/:id", getAdminTicket as any);
router.patch("/tickets/:id", updateAdminTicket as any);
router.patch("/tickets/:id/assign", assignAdminTicket as any);
router.post("/tickets/:id/messages", addAdminTicketMessage as any);

// Single delete support ticket
router.delete("/tickets/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.supportTicket.delete({
      where: { id },
    });
    res.json({ success: true, message: "Support ticket deleted successfully." });
  } catch (err) {
    next(err);
  }
});

// Bulk delete support tickets
router.post("/tickets/bulk-delete", async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "Array of ids is required" });
    }
    const result = await prisma.supportTicket.deleteMany({
      where: { id: { in: ids } },
    });
    res.json({ success: true, count: result.count, message: `${result.count} tickets deleted successfully.` });
  } catch (err) {
    next(err);
  }
});

export default router;
