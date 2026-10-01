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

  public async getAdminFaqs(params: {
    role?: FAQRole;
    categoryId?: string;
    search?: string;
    status?: string;
    featured?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const { role, categoryId, search, status, featured, page, pageSize } = params;
    
    const where: any = {};
    if (role) where.role = role;
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (featured !== undefined) where.isFeatured = featured;
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { question: { contains: q } },
        { answer: { contains: q } }
      ];
    }

    if (page !== undefined && page !== null) {
      const pageNum = Math.max(1, Number(page) || 1);
      const take = Math.max(1, Number(pageSize) || 10);
      const skip = (pageNum - 1) * take;

      const [items, total] = await Promise.all([
        prisma.fAQ.findMany({
          where,
          skip,
          take,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          include: {
            category: { select: { id: true, name: true, role: true } }
          }
        }),
        prisma.fAQ.count({ where })
      ]);

      return {
        items,
        total,
        page: pageNum,
        pageSize: take,
        totalPages: Math.max(1, Math.ceil(total / take))
      };
    }

    return prisma.fAQ.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        category: { select: { id: true, name: true, role: true } }
      }
    });
  }

  public async deleteFaq(id: string) {
    return prisma.fAQ.delete({ where: { id } });
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

  public async getAdminCategories(params?: {
    search?: string;
    role?: FAQRole;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const { search, role, isActive, page, pageSize } = params || {};
    const where: any = {};

    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { name: { contains: q } },
        { slug: { contains: q } }
      ];
    }

    if (page !== undefined && page !== null) {
      const pageNum = Math.max(1, Number(page) || 1);
      const take = Math.max(1, Number(pageSize) || 10);
      const skip = (pageNum - 1) * take;

      const [items, total] = await Promise.all([
        prisma.fAQCategory.findMany({
          where,
          skip,
          take,
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          include: {
            _count: {
              select: { faqs: true }
            }
          }
        }),
        prisma.fAQCategory.count({ where })
      ]);

      return {
        items,
        total,
        page: pageNum,
        pageSize: take,
        totalPages: Math.max(1, Math.ceil(total / take))
      };
    }

    return prisma.fAQCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { faqs: true }
        }
      }
    });
  }

  public async createCategory(data: any) {
    const slug = data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return prisma.fAQCategory.create({
      data: {
        ...data,
        slug: slug || `cat-${Date.now()}`
      }
    });
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
