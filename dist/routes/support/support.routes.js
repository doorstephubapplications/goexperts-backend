import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { createReport, listReports, updateReportStatus } from "../../controllers/support/support.controller.js";
import { createTicket, listUserTickets, getTicket, addTicketMessage, updateTicketStatus } from "../../controllers/support/support-ticket.controller.js";
const router = Router();
router.use(authMiddleware);
// User endpoints
router.post("/reports", createReport);
// Help & Support Ticket Endpoints (User Side)
router.post("/tickets", createTicket);
router.get("/tickets", listUserTickets);
router.get("/tickets/:id", getTicket);
router.post("/tickets/:id/messages", addTicketMessage);
router.patch("/tickets/:id/status", updateTicketStatus);
// Admin endpoints
router.get("/reports", listReports);
router.patch("/reports/:id/status", updateReportStatus);
export default router;
