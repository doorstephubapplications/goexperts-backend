import { Router } from 'express';
import { AboutController } from '../../controllers/about.controller.js';

// Assume standard auth/rbac middleware
import { protect, requireRole } from '../../middleware/auth.js'; // Replace with actual path if different

const router = Router();
const controller = new AboutController();

router.get('/about', protect, requireRole(['SUPER_ADMIN', 'CONTENT_MANAGER']), controller.getAdminAbout.bind(controller));
router.put('/about/sections/:sectionId', protect, requireRole(['SUPER_ADMIN', 'CONTENT_MANAGER']), controller.updateSection.bind(controller));
router.put('/about/seo', protect, requireRole(['SUPER_ADMIN', 'CONTENT_MANAGER']), controller.updateSeo.bind(controller));

// Publish requires SUPER_ADMIN or specific publish permission
router.post('/about/publish', protect, requireRole(['SUPER_ADMIN']), controller.publishDraft.bind(controller));

router.get('/about/revisions', protect, requireRole(['SUPER_ADMIN', 'CONTENT_MANAGER']), controller.listRevisions.bind(controller));
router.post('/about/revisions/:id/restore', protect, requireRole(['SUPER_ADMIN']), controller.restoreRevision.bind(controller));

export default router;
