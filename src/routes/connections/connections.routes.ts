import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import {
  getConnections,
  getReceivedInvitations,
  getSentInvitations,
  sendInvitation,
  acceptInvitation,
  rejectInvitation,
  ignoreInvitation,
  withdrawInvitation,
  removeConnection,
  blockUser,
  unblockUser,
  reportUser,
  getRelationship,
  getBatchRelationships,
  getMutualConnections,
  getNetworkSummary,
  discoverPeople
} from '../../controllers/connections/connections.controller.js';

const router = Router();

router.use(authMiddleware);

// Network queries & discovery
router.get('/', getConnections as any);
router.get('/connections', getConnections as any);
router.get('/discover', discoverPeople as any);
router.get('/summary', getNetworkSummary as any);

// Invitations
router.get('/invitations', getReceivedInvitations as any);
router.get('/invitations/received', getReceivedInvitations as any);
router.get('/invitations/sent', getSentInvitations as any);
router.post('/invitations', sendInvitation as any);
router.patch('/invitations/:id/accept', acceptInvitation as any);
router.post('/invitations/:id/accept', acceptInvitation as any);
router.patch('/invitations/:id/reject', rejectInvitation as any);
router.post('/invitations/:id/reject', rejectInvitation as any);
router.post('/invitations/:id/ignore', ignoreInvitation as any);
router.post('/invitations/:id/withdraw', withdrawInvitation as any);
router.delete('/invitations/:id', withdrawInvitation as any);

// Connection removal
router.delete('/:id', removeConnection as any);
router.delete('/connections/:id', removeConnection as any);

// User-specific relationships, blocking & reporting
router.post('/relationships/batch', getBatchRelationships as any);
router.get('/relationships/batch', getBatchRelationships as any);
router.get('/batch-status', getBatchRelationships as any);
router.get('/users/:id/relationship', getRelationship as any);
router.get('/users/:id/mutual-connections', getMutualConnections as any);
router.post('/users/:id/block', blockUser as any);
router.delete('/users/:id/block', unblockUser as any);
router.post('/users/:id/report', reportUser as any);

export default router;
