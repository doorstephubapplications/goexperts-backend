import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { requireOnboarding } from "../../middlewares/onboarding.middleware.js";
import {
  listConversations,
  getConversationMessages,
  createOrFindConversation,
  updateConversationStatus,
  addAdminNote,
  updateConversationState,
  blockUser,
  unblockUser,
  acceptConnection,
  rejectConnection
} from "../../controllers/messages/messages.controller.js";

const router = Router();

// All message routes require authentication
router.use(authMiddleware);

router.get("/conversations", listConversations as any);
router.post("/conversations", createOrFindConversation as any);
router.get("/conversations/:id/messages", getConversationMessages as any);
router.patch("/conversations/:id/status", updateConversationStatus as any);
router.post("/conversations/:id/admin-note", addAdminNote as any);
router.put("/conversations/:id/state", updateConversationState as any);

router.post("/users/:id/block", blockUser as any);
router.post("/users/:id/unblock", unblockUser as any);

router.post("/invitations/:invitationId/accept", acceptConnection as any);
router.post("/invitations/:invitationId/reject", rejectConnection as any);

export default router;

