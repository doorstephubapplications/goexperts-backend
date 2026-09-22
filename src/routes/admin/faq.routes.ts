import { Router } from 'express';
import { FaqController } from '../../controllers/faq.controller.js';

const router = Router();
const faqController = new FaqController();

// Categories
router.get('/categories', faqController.getAdminCategories);
router.post('/categories', faqController.createCategory);
router.put('/categories/:id', faqController.updateCategory);
router.delete('/categories/:id', faqController.deleteCategory);

// SEO
router.get('/seo', faqController.getSeo);
router.put('/seo', faqController.upsertSeo);

// FAQs
router.get('/', faqController.getAdminFaqs);
router.post('/', faqController.createFaq);
router.get('/:id', faqController.getAdminFaqById);
router.put('/:id', faqController.updateFaq);

// Quick Actions
router.post('/:id/publish', faqController.publishFaq);
router.post('/:id/unpublish', faqController.unpublishFaq);
router.post('/:id/archive', faqController.archiveFaq);
router.post('/:id/duplicate', faqController.duplicateFaq);

export const faqAdminRouter = router;
