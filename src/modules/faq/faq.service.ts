import { prisma } from '../../config/database.js';
import { FAQRole } from '@prisma/client';

export class FaqService {
  // ==========================================
  // PUBLIC API
  // ==========================================

  public async getPublicFaqs(params: { role?: FAQRole; search?: string; category?: string; featured?: boolean }) {
    const { role, search, category, featured } = params;

    // Build role filter: Always include GENERAL. If specific role provided, include that too.
    const roles: FAQRole[] = ['GENERAL'];
    if (role && role !== 'GENERAL') {
      roles.push(role);
    }

    const where: any = {
      isPublished: true,
      role: { in: roles },
    };

    if (category) {
      where.category = { slug: category };
    }

    if (featured !== undefined) {
      where.isFeatured = featured;
    }

    if (search) {
      where.OR = [
        { question: { contains: search } },
        { answer: { contains: search } },
        { category: { name: { contains: search } } }
      ];
    }

    const faqs = await prisma.fAQ.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            icon: true,
            sortOrder: true
          }
        }
      }
    });

    // Also fetch the active categories for the given roles
    const categories = await prisma.fAQCategory.findMany({
      where: {
        isActive: true,
        OR: [
          { role: null },
          { role: { in: roles } }
        ]
      },
      orderBy: { sortOrder: 'asc' }
    });
    
    // Fetch SEO metadata
    const seo = await prisma.fAQPageSeo.findUnique({
      where: { slug: 'faqs' }
    });

    return { faqs, categories, seo };
  }

  // ==========================================
  // ADMIN API - FAQS
  // ==========================================

  public async getAdminFaqs(params: { role?: FAQRole; categoryId?: string; search?: string; status?: string; featured?: boolean }) {
    const { role, categoryId, search, status, featured } = params;
    
    const where: any = {};
    if (role) where.role = role;
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (featured !== undefined) where.isFeatured = featured;
    if (search) {
      where.OR = [
        { question: { contains: search } },
        { answer: { contains: search } }
      ];
    }

    return prisma.fAQ.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, role: true } }
      }
    });
  }
  
  public async getAdminFaqById(id: string) {
    return prisma.fAQ.findUnique({
      where: { id },
      include: { category: true }
    });
  }

  public async createFaq(data: any) {
    return prisma.fAQ.create({
      data: {
        ...data,
        isPublished: data.status === 'PUBLISHED',
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null
      }
    });
  }

  public async updateFaq(id: string, data: any) {
    return prisma.fAQ.update({
      where: { id },
      data: {
        ...data,
        isPublished: data.status === 'PUBLISHED',
        ...(data.status === 'PUBLISHED' && { publishedAt: new Date() })
      }
    });
  }

  public async publishFaq(id: string) {
    return prisma.fAQ.update({
      where: { id },
      data: { status: 'PUBLISHED', isPublished: true, publishedAt: new Date() }
    });
  }

  public async unpublishFaq(id: string) {
    return prisma.fAQ.update({
      where: { id },
      data: { status: 'UNPUBLISHED', isPublished: false }
    });
  }
  
  public async archiveFaq(id: string) {
    return prisma.fAQ.update({
      where: { id },
      data: { status: 'ARCHIVED', isPublished: false }
    });
  }

  public async duplicateFaq(id: string) {
    const existing = await prisma.fAQ.findUnique({ where: { id } });
    if (!existing) throw new Error("FAQ not found");
    
    const { id: _, slug, createdAt, updatedAt, publishedAt, isPublished, status, ...data } = existing;
    
    return prisma.fAQ.create({
      data: {
        ...data,
        slug: `${slug}-copy-${Date.now()}`,
        status: 'DRAFT',
        isPublished: false
      }
    });
  }

  // ==========================================
  // ADMIN API - CATEGORIES
  // ==========================================

  public async getAdminCategories() {
    return prisma.fAQCategory.findMany({
      orderBy: { sortOrder: 'asc' }
    });
  }

  public async createCategory(data: any) {
    return prisma.fAQCategory.create({ data });
  }

  public async updateCategory(id: string, data: any) {
    return prisma.fAQCategory.update({
      where: { id },
      data
    });
  }

  public async deleteCategory(id: string) {
    // Check if it has FAQs
    const count = await prisma.fAQ.count({ where: { categoryId: id } });
    if (count > 0) throw new Error("Cannot delete category with existing FAQs");
    
    return prisma.fAQCategory.delete({ where: { id } });
  }

  // ==========================================
  // ADMIN API - SEO
  // ==========================================

  public async getSeo() {
    return prisma.fAQPageSeo.findUnique({ where: { slug: 'faqs' } });
  }

  public async upsertSeo(data: any) {
    return prisma.fAQPageSeo.upsert({
      where: { slug: 'faqs' },
      update: data,
      create: { ...data, slug: 'faqs' }
    });
  }
}
