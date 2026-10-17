import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { getConnections, getReceivedInvitations, getSentInvitations, sendInvitation, acceptInvitation, rejectInvitation, ignoreInvitation, withdrawInvitation, removeConnection, blockUser, unblockUser, reportUser, getRelationship, getBatchRelationships, getMutualConnections, getNetworkSummary, discoverPeople } from '../../controllers/connections/connections.controller.js';
const router = Router();
router.use(authMiddleware);
// Network queries & discovery
router.get('/', getConnections);
router.get('/connections', getConnections);
router.get('/discover', discoverPeople);
router.get('/summary', getNetworkSummary);
// Invitations
router.get('/invitations', getReceivedInvitations);
router.get('/invitations/received', getReceivedInvitations);
router.get('/invitations/sent', getSentInvitations);
router.post('/invitations', sendInvitation);
router.patch('/invitations/:id/accept', acceptInvitation);
router.post('/invitations/:id/accept', acceptInvitation);
router.patch('/invitations/:id/reject', rejectInvitation);
router.post('/invitations/:id/reject', rejectInvitation);
router.post('/invitations/:id/ignore', ignoreInvitation);
router.post('/invitations/:id/withdraw', withdrawInvitation);
router.delete('/invitations/:id', withdrawInvitation);
// Connection removal
router.delete('/:id', removeConnection);
router.delete('/connections/:id', removeConnection);
// User-specific relationships, blocking & reporting
router.post('/relationships/batch', getBatchRelationships);
router.get('/relationships/batch', getBatchRelationships);
router.get('/batch-status', getBatchRelationships);
router.get('/users/:id/relationship', getRelationship);
router.get('/users/:id/mutual-connections', getMutualConnections);
router.post('/users/:id/block', blockUser);
router.delete('/users/:id/block', unblockUser);
router.post('/users/:id/report', reportUser);
export default router;
