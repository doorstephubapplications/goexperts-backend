import { Router } from 'express';
import {
  getSocialLinks,
  addSocialLink,
  updateSocialLink,
  deleteSocialLink,
} from '../../controllers/mobile/social-links.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// GET /api/mobile/social-links is public so mobile apps can fetch links without logging in
router.get('/', getSocialLinks);

// Mutation operations require authentication
router.use(authenticate);

router.post('/', addSocialLink);
router.put('/:id', updateSocialLink);
router.delete('/:id', deleteSocialLink);

export default router;
