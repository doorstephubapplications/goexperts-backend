import { FaqService } from '../modules/faq/faq.service.js';
import { faqSchema, faqCategorySchema, faqSeoSchema, FAQRoleEnum } from '../modules/faq/faq.schemas.js';
const faqService = new FaqService();
export class FaqController {
    // ==========================================
    // PUBLIC API
    // ==========================================
    async getPublicFaqs(req, res) {
        try {
            const { role, search, category, featured } = req.query;
            let parsedRole = undefined;
            if (role && typeof role === 'string') {
                const parsed = FAQRoleEnum.safeParse(role);
                if (parsed.success)
                    parsedRole = parsed.data;
            }
            const data = await faqService.getPublicFaqs({
                role: parsedRole,
                search: search ? String(search) : undefined,
                category: category ? String(category) : undefined,
                featured: featured === 'true' ? true : featured === 'false' ? false : undefined
            });
            res.json({ success: true, data });
        }
        catch (error) {
            console.error('Error fetching public FAQs:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    }
    // ==========================================
    // ADMIN API - FAQS
    // ==========================================
    async getAdminFaqs(req, res) {
        try {
            const { role, categoryId, search, status, featured, page, pageSize } = req.query;
            const data = await faqService.getAdminFaqs({
                role: role,
                categoryId: categoryId,
                search: search,
                status: status,
                featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
                page: page !== undefined ? Number(page) : undefined,
                pageSize: pageSize !== undefined ? Number(pageSize) : undefined
            });
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async deleteFaq(req, res) {
        try {
            const data = await faqService.deleteFaq(req.params.id);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async getAdminFaqById(req, res) {
        try {
            const data = await faqService.getAdminFaqById(req.params.id);
            if (!data)
                return res.status(404).json({ success: false, error: 'FAQ not found' });
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async createFaq(req, res) {
        try {
            const parsed = faqSchema.parse(req.body);
            const data = await faqService.createFaq(parsed);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.errors || error.message });
        }
    }
    async updateFaq(req, res) {
        try {
            const parsed = faqSchema.parse(req.body);
            const data = await faqService.updateFaq(req.params.id, parsed);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.errors || error.message });
        }
    }
    async publishFaq(req, res) {
        try {
            const data = await faqService.publishFaq(req.params.id);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async unpublishFaq(req, res) {
        try {
            const data = await faqService.unpublishFaq(req.params.id);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async archiveFaq(req, res) {
        try {
            const data = await faqService.archiveFaq(req.params.id);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    async duplicateFaq(req, res) {
        try {
            const data = await faqService.duplicateFaq(req.params.id);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    // ==========================================
    // ADMIN API - CATEGORIES
    // ==========================================
    async getAdminCategories(req, res) {
        try {
            const { search, role, isActive, page, pageSize } = req.query;
            const data = await faqService.getAdminCategories({
                search: search,
                role: role,
                isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
                page: page !== undefined ? Number(page) : undefined,
                pageSize: pageSize !== undefined ? Number(pageSize) : undefined
            });
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async createCategory(req, res) {
        try {
            const parsed = faqCategorySchema.parse(req.body);
            const data = await faqService.createCategory(parsed);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.errors || error.message });
        }
    }
    async updateCategory(req, res) {
        try {
            const parsed = faqCategorySchema.parse(req.body);
            const data = await faqService.updateCategory(req.params.id, parsed);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.errors || error.message });
        }
    }
    async deleteCategory(req, res) {
        try {
            const data = await faqService.deleteCategory(req.params.id);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    }
    // ==========================================
    // ADMIN API - SEO
    // ==========================================
    async getSeo(req, res) {
        try {
            const data = await faqService.getSeo();
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
    async upsertSeo(req, res) {
        try {
            const parsed = faqSeoSchema.parse(req.body);
            const data = await faqService.upsertSeo(parsed);
            res.json({ success: true, data });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.errors || error.message });
        }
    }
}
