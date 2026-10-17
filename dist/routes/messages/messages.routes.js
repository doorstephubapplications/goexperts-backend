import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { portalRoleMiddleware } from "../../middlewares/role.middleware.js";
import { upload } from "../../middlewares/upload.middleware.js";
import { listConversations, getConversationMessages, createOrFindConversation, updateConversationStatus, addAdminNote, updateConversationState, blockUser, unblockUser, acceptConnection, rejectConnection, deleteConversation, bulkDeleteConversations, getConversationAttachments, sendConversationMessage, getBlockStatus, muteConversation, unmuteConversation, bulkDeleteMessages, forwardMessages, starMessage, unstarMessage, pinMessage, unpinMessage, getMessageInfo } from "../../controllers/messages/messages.controller.js";
const router = Router();
// All message routes require authentication and valid workspace
router.use(authMiddleware);
router.use(portalRoleMiddleware(["freelancer", "client", "founder", "investor"]));
// File upload route for chat attachments
router.post("/upload", upload.single("file"), (req, res) => {
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
router.get("/conversations", listConversations);
router.post("/conversations", createOrFindConversation);
router.post("/conversations/bulk-delete", bulkDeleteConversations);
// Message-level static routes (must precede /messages/:id)
router.post("/messages/bulk-delete", bulkDeleteMessages);
router.post("/bulk-delete", bulkDeleteMessages);
router.post("/messages/forward", forwardMessages);
router.post("/forward", forwardMessages);
// Message-level dynamic routes (support both /messages/:id/* and /:id/*)
router.get("/messages/:id/info", getMessageInfo);
router.get("/:id/info", getMessageInfo);
router.post("/messages/:id/star", starMessage);
router.post("/:id/star", starMessage);
router.delete("/messages/:id/star", unstarMessage);
router.delete("/:id/star", unstarMessage);
router.post("/messages/:id/pin", pinMessage);
router.post("/:id/pin", pinMessage);
router.delete("/messages/:id/pin", unpinMessage);
router.delete("/:id/pin", unpinMessage);
router.patch("/messages/:id/read", (req, res) => res.json({ success: true, message: "Marked as read" }));
router.patch("/:id/read", (req, res) => res.json({ success: true, message: "Marked as read" }));
// Dynamic conversation routes
router.get("/conversations/:id/messages", getConversationMessages);
router.post("/conversations/:id/messages", sendConversationMessage);
router.get("/conversations/:id/attachments", getConversationAttachments);
router.get("/:id/attachments", getConversationAttachments);
router.patch("/conversations/:id/mute", muteConversation);
router.delete("/conversations/:id/mute", unmuteConversation);
router.delete("/conversations/:id", deleteConversation);
router.patch("/conversations/:id/status", updateConversationStatus);
router.post("/conversations/:id/admin-note", addAdminNote);
router.put("/conversations/:id/state", updateConversationState);
router.get("/users/:id/block-status", getBlockStatus);
router.post("/users/:id/block", blockUser);
router.post("/users/:id/unblock", unblockUser);
router.post("/invitations/:invitationId/accept", acceptConnection);
router.post("/invitations/:invitationId/reject", rejectConnection);
export default router;
