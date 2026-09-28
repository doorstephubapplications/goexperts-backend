import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { listConversations, getConversationMessages, createOrFindConversation, updateConversationStatus, addAdminNote, updateConversationState, blockUser, unblockUser, acceptConnection, rejectConnection } from "../../controllers/messages/messages.controller.js";
const router = Router();
// All message routes require authentication
router.use(authMiddleware);
router.get("/conversations", listConversations);
router.post("/conversations", createOrFindConversation);
router.get("/conversations/:id/messages", getConversationMessages);
router.patch("/conversations/:id/status", updateConversationStatus);
router.post("/conversations/:id/admin-note", addAdminNote);
router.put("/conversations/:id/state", updateConversationState);
router.post("/users/:id/block", blockUser);
router.post("/users/:id/unblock", unblockUser);
router.post("/invitations/:invitationId/accept", acceptConnection);
router.post("/invitations/:invitationId/reject", rejectConnection);
export default router;
