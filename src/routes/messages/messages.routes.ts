import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { requireOnboarding } from "../../middlewares/onboarding.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
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
  rejectConnection,
  deleteConversation,
  bulkDeleteConversations,
  getConversationAttachments,
  sendConversationMessage,
  getBlockStatus,
  muteConversation,
  unmuteConversation,
  bulkDeleteMessages,
  forwardMessages,
  starMessage,
  unstarMessage,
  pinMessage,
  unpinMessage,
  getMessageInfo
} from "../../controllers/messages/messages.controller.js";

const router = Router();

// All message routes require authentication and valid workspace
router.use(authMiddleware);
router.use(portalRoleMiddleware(["freelancer", "client", "founder", "investor"]));

// File upload route for chat attachments
router.post("/upload", upload.single("file"), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({
    success: true,
    url: fileUrl,
    filename: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// Static conversation routes (must precede /:id)
router.get("/conversations", listConversations as any);
router.post("/conversations", createOrFindConversation as any);
router.post("/conversations/bulk-delete", bulkDeleteConversations as any);

// Message-level static routes (must precede /messages/:id)
router.post("/messages/bulk-delete", bulkDeleteMessages as any);
router.post("/messages/forward", forwardMessages as any);

// Message-level dynamic routes
router.get("/messages/:id/info", getMessageInfo as any);
router.post("/messages/:id/star", starMessage as any);
router.delete("/messages/:id/star", unstarMessage as any);
router.post("/messages/:id/pin", pinMessage as any);
router.delete("/messages/:id/pin", unpinMessage as any);

// Dynamic conversation routes
router.get("/conversations/:id/messages", getConversationMessages as any);
router.post("/conversations/:id/messages", sendConversationMessage as any);
router.get("/conversations/:id/attachments", getConversationAttachments as any);
router.patch("/conversations/:id/mute", muteConversation as any);
router.delete("/conversations/:id/mute", unmuteConversation as any);
router.delete("/conversations/:id", deleteConversation as any);
router.patch("/conversations/:id/status", updateConversationStatus as any);
router.post("/conversations/:id/admin-note", addAdminNote as any);
router.put("/conversations/:id/state", updateConversationState as any);

router.get("/users/:id/block-status", getBlockStatus as any);
router.post("/users/:id/block", blockUser as any);
router.post("/users/:id/unblock", unblockUser as any);

router.post("/invitations/:invitationId/accept", acceptConnection as any);
router.post("/invitations/:invitationId/reject", rejectConnection as any);

export default router;


