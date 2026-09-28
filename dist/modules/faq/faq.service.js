import { prisma } from '../../config/database.js';
export class FaqService {
    // ==========================================
    // PUBLIC API
    // ==========================================
    async getPublicFaqs(params) {
        const { role, search, category, featured } = params;
        // Build role filter: Always include GENERAL. If specific role provided, include that too.
        const roles = ['GENERAL'];
        if (role && role !== 'GENERAL') {
            roles.push(role);
        }
        const where = {
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
    async getAdminFaqs(params) {
        const { role, categoryId, search, status, featured } = params;
        const where = {};
        if (role)
            where.role = role;
        if (categoryId)
            where.categoryId = categoryId;
        if (status)
            where.status = status;
        if (featured !== undefined)
            where.isFeatured = featured;
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
    async getAdminFaqById(id) {
        return prisma.fAQ.findUnique({
            where: { id },
            include: { category: true }
        });
    }
    async createFaq(data) {
        return prisma.fAQ.create({
            data: {
                ...data,
                isPublished: data.status === 'PUBLISHED',
                publishedAt: data.status === 'PUBLISHED' ? new Date() : null
            }
        });
    }
    async updateFaq(id, data) {
        return prisma.fAQ.update({
            where: { id },
            data: {
                ...data,
                isPublished: data.status === 'PUBLISHED',
                ...(data.status === 'PUBLISHED' && { publishedAt: new Date() })
            }
        });
    }
    async publishFaq(id) {
        return prisma.fAQ.update({
            where: { id },
            data: { status: 'PUBLISHED', isPublished: true, publishedAt: new Date() }
        });
    }
    async unpublishFaq(id) {
        return prisma.fAQ.update({
            where: { id },
            data: { status: 'UNPUBLISHED', isPublished: false }
        });
    }
    async archiveFaq(id) {
        return prisma.fAQ.update({
            where: { id },
            data: { status: 'ARCHIVED', isPublished: false }
        });
    }
    async duplicateFaq(id) {
        const existing = await prisma.fAQ.findUnique({ where: { id } });
        if (!existing)
            throw new Error("FAQ not found");
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
    async getAdminCategories() {
        return prisma.fAQCategory.findMany({
            orderBy: { sortOrder: 'asc' }
        });
    }
    async createCategory(data) {
        return prisma.fAQCategory.create({ data });
    }
    async updateCategory(id, data) {
        return prisma.fAQCategory.update({
            where: { id },
            data
        });
    }
    async deleteCategory(id) {
        // Check if it has FAQs
        const count = await prisma.fAQ.count({ where: { categoryId: id } });
        if (count > 0)
            throw new Error("Cannot delete category with existing FAQs");
        return prisma.fAQCategory.delete({ where: { id } });
    }
    // ==========================================
    // ADMIN API - SEO
    // ==========================================
    async getSeo() {
        return prisma.fAQPageSeo.findUnique({ where: { slug: 'faqs' } });
    }
    async upsertSeo(data) {
        return prisma.fAQPageSeo.upsert({
            where: { slug: 'faqs' },
            update: data,
            create: { ...data, slug: 'faqs' }
        });
    }
}
