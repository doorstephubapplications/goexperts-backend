import { Request, Response } from 'express';
import { FaqService } from '../modules/faq/faq.service.js';
import { faqSchema, faqCategorySchema, faqSeoSchema, FAQRoleEnum } from '../modules/faq/faq.schemas.js';

const faqService = new FaqService();

export class FaqController {
  // ==========================================
  // PUBLIC API
  // ==========================================
  
  public async getPublicFaqs(req: Request, res: Response) {
    try {
      const { role, search, category, featured } = req.query;
      
      let parsedRole = undefined;
      if (role && typeof role === 'string') {
        const parsed = FAQRoleEnum.safeParse(role);
        if (parsed.success) parsedRole = parsed.data;
      }
      
      const data = await faqService.getPublicFaqs({
        role: parsedRole as any,
        search: search ? String(search) : undefined,
        category: category ? String(category) : undefined,
        featured: featured === 'true' ? true : featured === 'false' ? false : undefined
      });
      
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Error fetching public FAQs:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ==========================================
  // ADMIN API - FAQS
  // ==========================================

  public async getAdminFaqs(req: Request, res: Response) {
    try {
      const { role, categoryId, search, status, featured } = req.query;
      
      const data = await faqService.getAdminFaqs({
        role: role as any,
        categoryId: categoryId as string,
        search: search as string,
        status: status as string,
        featured: featured === 'true' ? true : featured === 'false' ? false : undefined
      });
      
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
  
  public async getAdminFaqById(req: Request, res: Response) {
    try {
      const data = await faqService.getAdminFaqById(req.params.id);
      if (!data) return res.status(404).json({ success: false, error: 'FAQ not found' });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async createFaq(req: Request, res: Response) {
    try {
      const parsed = faqSchema.parse(req.body);
      const data = await faqService.createFaq(parsed);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.errors || error.message });
    }
  }

  public async updateFaq(req: Request, res: Response) {
    try {
      const parsed = faqSchema.parse(req.body);
      const data = await faqService.updateFaq(req.params.id, parsed);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.errors || error.message });
    }
  }

  public async publishFaq(req: Request, res: Response) {
    try {
      const data = await faqService.publishFaq(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  public async unpublishFaq(req: Request, res: Response) {
    try {
      const data = await faqService.unpublishFaq(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
  
  public async archiveFaq(req: Request, res: Response) {
    try {
      const data = await faqService.archiveFaq(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  public async duplicateFaq(req: Request, res: Response) {
    try {
      const data = await faqService.duplicateFaq(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // ==========================================
  // ADMIN API - CATEGORIES
  // ==========================================

  public async getAdminCategories(req: Request, res: Response) {
    try {
      const data = await faqService.getAdminCategories();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async createCategory(req: Request, res: Response) {
    try {
      const parsed = faqCategorySchema.parse(req.body);
      const data = await faqService.createCategory(parsed);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.errors || error.message });
    }
  }

  public async updateCategory(req: Request, res: Response) {
    try {
      const parsed = faqCategorySchema.parse(req.body);
      const data = await faqService.updateCategory(req.params.id, parsed);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.errors || error.message });
    }
  }

  public async deleteCategory(req: Request, res: Response) {
    try {
      const data = await faqService.deleteCategory(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  // ==========================================
  // ADMIN API - SEO
  // ==========================================

  public async getSeo(req: Request, res: Response) {
    try {
      const data = await faqService.getSeo();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  public async upsertSeo(req: Request, res: Response) {
    try {
      const parsed = faqSeoSchema.parse(req.body);
      const data = await faqService.upsertSeo(parsed);
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.errors || error.message });
    }
  }
}
