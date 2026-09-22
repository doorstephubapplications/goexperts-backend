import { Router } from 'express';
import { AboutController } from '../../controllers/about.controller.js';
import { authMiddleware } from '../../middlewares/auth.middleware.js';

const router = Router();
const controller = new AboutController();

router.get('/about', authMiddleware, controller.getAdminAbout.bind(controller));
router.put('/about/sections/:sectionId', authMiddleware, controller.updateSection.bind(controller));
router.put('/about/seo', authMiddleware, controller.updateSeo.bind(controller));

// Publish requires SUPER_ADMIN or specific publish permission
router.post('/about/publish', authMiddleware, controller.publishDraft.bind(controller));

router.get('/about/revisions', authMiddleware, controller.listRevisions.bind(controller));
router.post('/about/revisions/:id/restore', authMiddleware, controller.restoreRevision.bind(controller));

export default router;
