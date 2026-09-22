import { Router } from 'express';
import { AboutController } from '../../controllers/about.controller.js';

const router = Router();
const controller = new AboutController();

// Use caching middleware if available in the project, e.g. cache('1h')
router.get('/about', controller.getPublicAbout.bind(controller));

export default router;
