import { Router } from 'express';
import { AboutController } from '../../controllers/about.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
const router = Router();
const controller = new AboutController();
// For now, protecting with authMiddleware, adjust roles as needed
router.get('/', authMiddleware, controller.getAdminAbout.bind(controller));
router.put('/sections/:sectionId', authMiddleware, controller.updateSection.bind(controller));
router.put('/seo', authMiddleware, controller.updateSeo.bind(controller));
// Publish
router.post('/publish', authMiddleware, controller.publishDraft.bind(controller));
// Revisions
router.get('/revisions', authMiddleware, controller.listRevisions.bind(controller));
router.post('/revisions/:id/restore', authMiddleware, controller.restoreRevision.bind(controller));
export default router;
