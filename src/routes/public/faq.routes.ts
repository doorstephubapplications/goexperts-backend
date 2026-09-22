import { Router } from 'express';
import { FaqController } from '../../controllers/faq.controller.js';

const router = Router();
const faqController = new FaqController();

router.get('/', faqController.getPublicFaqs);

export const faqPublicRouter = router;
