import { Router } from 'express';
import { FooterPublicService } from '../../modules/footer/footer.service.js';

const router = Router();
const service = new FooterPublicService();

// GET /api/public/footer
router.get('/', async (req, res) => {
  try {
    const footer = await service.getPublishedFooter();
    if (!footer) {
      return res.json({ success: true, data: null }); // fallback handled on frontend
    }
    res.json({ success: true, data: footer });
  } catch (err) {
    console.error('[Footer Public] Error:', err);
    res.status(500).json({ success: false, message: 'Failed to load footer' });
  }
});

export default router;
