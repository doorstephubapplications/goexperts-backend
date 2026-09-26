import { Router } from 'express';
import { FooterAdminService } from '../../modules/footer/footer.service.js';

const router = Router();
const service = new FooterAdminService();

// GET /api/admin/content/footer — get current draft
router.get('/', async (req, res) => {
  try {
    const draft = await service.getDraft();
    const published = await service.getPublished();
    res.json({ success: true, data: { draft, published } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load footer config' });
  }
});

// PUT /api/admin/content/footer/:id — update draft
router.put('/:id', async (req, res) => {
  try {
    const updated = await service.updateDraft(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/admin/content/footer/:id/publish — atomic publish
router.post('/:id/publish', async (req, res) => {
  try {
    const adminId = (req as any).admin?.id || 'system';
    const result = await service.publish(req.params.id, adminId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Column routes
router.post('/:id/columns', async (req, res) => {
  try {
    const col = await service.addColumn(req.params.id, req.body);
    res.json({ success: true, data: col });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/columns/:colId', async (req, res) => {
  try {
    const col = await service.updateColumn(req.params.colId, req.body);
    res.json({ success: true, data: col });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/columns/:colId', async (req, res) => {
  try {
    await service.deleteColumn(req.params.colId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Link routes
router.post('/columns/:colId/links', async (req, res) => {
  try {
    const link = await service.addLink(req.params.colId, req.body);
    res.json({ success: true, data: link });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.put('/links/:linkId', async (req, res) => {
  try {
    const link = await service.updateLink(req.params.linkId, req.body);
    res.json({ success: true, data: link });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.delete('/links/:linkId', async (req, res) => {
  try {
    await service.deleteLink(req.params.linkId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Social links — replace all at once
router.put('/:id/social', async (req, res) => {
  try {
    await service.upsertSocialLinks(req.params.id, req.body.links || []);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Legal links — replace all at once
router.put('/:id/legal', async (req, res) => {
  try {
    await service.upsertLegalLinks(req.params.id, req.body.links || []);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Legal links — replace all at once
router.put('/:id/legal', async (req, res) => {
  try {
    await service.upsertLegalLinks(req.params.id, req.body.links || []);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
