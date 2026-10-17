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
    async getPublicAbout(req, res) {
        try {
            const data = await publicService.getPublishedAbout();
            if (!data) {
                return res.status(404).json({ error: 'About page not found or not published' });
            }
            res.json(data);
        }
        catch (error) {
            console.error('Error fetching public about page:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    // --- Admin API ---
    async getAdminAbout(req, res) {
        try {
            const data = await aboutService.getAdminAbout();
            res.json(data);
        }
        catch (error) {
            console.error('Error fetching admin about page:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
    async updateSection(req, res) {
        try {
            const { sectionId } = req.params;
            const { currentVersion, ...data } = req.body;
            const adminId = req.user?.id || 'system';
            const section = await aboutService.updateSection(sectionId, { ...data, updatedBy: adminId }, currentVersion);
            res.json({ success: true, section });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async updateSeo(req, res) {
        try {
            const { currentVersion, ...data } = req.body;
            const seo = await aboutService.updateSeo(data, currentVersion);
            res.json({ success: true, seo });
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async publishDraft(req, res) {
        try {
            const { currentVersion } = req.body;
            const adminId = req.user?.id || 'system';
            const result = await publishService.publish(adminId, currentVersion);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
    async listRevisions(req, res) {
        try {
            const revisions = await revisionService.listRevisions();
            res.json({ revisions });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
    async restoreRevision(req, res) {
        try {
            const { id } = req.params;
            const adminId = req.user?.id || 'system';
            const result = await revisionService.restoreRevision(id, adminId);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ error: error.message });
        }
    }
}
