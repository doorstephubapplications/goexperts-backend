import { Request, Response } from 'express';
import { AboutService } from '../modules/about/about.service.js';
import { AboutPublicService } from '../modules/about/about.public.service.js';
import { AboutPublishService } from '../modules/about/about.publish.service.js';
import { AboutRevisionService } from '../modules/about/about.revision.service.js';

const aboutService = new AboutService();
const publicService = new AboutPublicService();
const publishService = new AboutPublishService();
const revisionService = new AboutRevisionService();

export class AboutController {
  // --- Public API ---
  public async getPublicAbout(req: Request, res: Response) {
    try {
      const data = await publicService.getPublishedAbout();
      if (!data) {
        return res.status(404).json({ error: 'About page not found or not published' });
      }
      res.json(data);
    } catch (error) {
      console.error('Error fetching public about page:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // --- Admin API ---
  public async getAdminAbout(req: Request, res: Response) {
    try {
      const data = await aboutService.getAdminAbout();
      res.json(data);
    } catch (error) {
      console.error('Error fetching admin about page:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  public async updateSection(req: Request, res: Response) {
    try {
      const { sectionId } = req.params;
      const { currentVersion, ...data } = req.body;
      const adminId = (req as any).user?.id || 'system';

      const section = await aboutService.updateSection(sectionId, { ...data, updatedBy: adminId }, currentVersion);
      res.json({ success: true, section });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  public async updateSeo(req: Request, res: Response) {
    try {
      const { currentVersion, ...data } = req.body;
      const seo = await aboutService.updateSeo(data, currentVersion);
      res.json({ success: true, seo });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  public async publishDraft(req: Request, res: Response) {
    try {
      const { currentVersion } = req.body;
      const adminId = (req as any).user?.id || 'system';
      
      const result = await publishService.publish(adminId, currentVersion);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  public async listRevisions(req: Request, res: Response) {
    try {
      const revisions = await revisionService.listRevisions();
      res.json({ revisions });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  public async restoreRevision(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const adminId = (req as any).user?.id || 'system';

      const result = await revisionService.restoreRevision(id, adminId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}
