import { Router } from 'express';
import { FaqController } from '../../controllers/faq.controller.js';
import { getPublicUserFaqs } from '../../controllers/user-faqs.controller.js';
const router = Router();
const faqController = new FaqController();
router.get('/', faqController.getPublicFaqs);
router.get('/user/:userId', getPublicUserFaqs);
export const faqPublicRouter = router;
