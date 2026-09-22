import { Router } from 'express';
import { AboutController } from '../../controllers/about.controller.js';

import { authMiddleware } from '../../middlewares/auth.middleware.js'; 

const router = Router();
const controller = new AboutController();

// For now, protecting with authMiddleware, adjust roles as needed
router.get('/', authMiddleware as any, controller.getAdminAbout.bind(controller));
router.put('/sections/:sectionId', authMiddleware as any, controller.updateSection.bind(controller));
router.put('/seo', authMiddleware as any, controller.updateSeo.bind(controller));

// Publish
router.post('/publish', authMiddleware as any, controller.publishDraft.bind(controller));

// Revisions
router.get('/revisions', authMiddleware as any, controller.listRevisions.bind(controller));
router.post('/revisions/:id/restore', authMiddleware as any, controller.restoreRevision.bind(controller));

export default router;
