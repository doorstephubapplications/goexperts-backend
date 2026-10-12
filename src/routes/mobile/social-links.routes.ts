import { Router } from 'express';
import {
  getSocialLinks,
  getPlatformSocialLinks,
  getUserSocialLinks,
  addSocialLink,
  updateSocialLink,
  deleteSocialLink,
} from '../../controllers/mobile/social-links.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// GET /api/mobile/social-links/platform -> Official Go Experts channels ONLY
router.get('/platform', getPlatformSocialLinks as any);

// GET /api/mobile/social-links/user/:userId -> Specific User's social links ONLY (no Go Experts links)
router.get('/user/:userId', ((req, res) => {
  (req.query as any).userId = req.params.userId;
  return getUserSocialLinks(req as any, res);
}) as any);

// GET /api/mobile/social-links/user -> Authenticated User's social links ONLY
router.get('/user', authenticate as any, getUserSocialLinks as any);

// GET /api/mobile/social-links:
// - If ?userId=... passed -> returns USER social links only
// - If no query passed -> returns Go Experts platform links
router.get('/', getSocialLinks as any);

// Mutation operations require authentication
router.use(authenticate);

router.post('/', addSocialLink);
router.put('/:id', updateSocialLink);
router.delete('/:id', deleteSocialLink);

export default router;
