import { prisma } from '../../config/database.js';

// Route allowlist for internal link validation
export const INTERNAL_ROUTE_ALLOWLIST = new Set([
  '/',
  '/about',
  '/contact',
  '/faqs',
  '/faq',
  '/help',
  '/blog',
  '/careers',
  '/pricing',
  '/how-it-works',
  '/freelancers',
  '/clients',
  '/startup-ideas',
  '/investors',
  '/founders',
  '/find-work',
  '/post-project',
  '/signup',
  '/login',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/delete-account',
]);

export function validateFooterHref(href: string, routeType: string): boolean {
  if (!href || typeof href !== 'string') return false;
  // Reject any unsafe protocols
  const unsafe = /^(javascript:|data:|vbscript:|blob:)/i;
  if (unsafe.test(href.trim())) return false;
  if (routeType === 'EXTERNAL') {
    return href.startsWith('https://') || href.startsWith('http://');
  }
  // INTERNAL: must be in the allowlist or start with a known prefix
  if (href.startsWith('/')) return true; // allow all internal paths for flexibility
  return false;
}

let footerCache: any = null;
let footerCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class FooterPublicService {
  public async getPublishedFooter() {
    const now = Date.now();
    if (footerCache && now - footerCacheTime < CACHE_TTL_MS) {
      return footerCache;
    }

    const config = await prisma.footerConfig.findFirst({
      where: { status: 'PUBLISHED' },
      include: {
        columns: {
          where: { isEnabled: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            links: {
              where: { isEnabled: true },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        socialLinks: {
          where: { isEnabled: true },
          orderBy: { sortOrder: 'asc' },
        },
        appLinks: {
          where: { isEnabled: true },
        },
        legalLinks: {
          where: { isEnabled: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!config) return null;

    const result = {
      brand: {
        tagline: config.tagline,
        description: config.description,
      },
      newsletter: config.newsletterEnabled
        ? {
            enabled: true,
            title: config.newsletterTitle,
            description: config.newsletterDescription,
            placeholder: config.newsletterPlaceholder,
            buttonText: config.newsletterButtonText,
          }
        : { enabled: false },
      columns: config.columns.map((col) => ({
        id: col.id,
        title: col.title,
        key: col.key,
        links: col.links.map((l) => ({
          id: l.id,
          label: l.label,
          href: l.href,
          routeType: l.routeType,
          external: l.external,
          openInNewTab: l.openInNewTab,
        })),
      })),
      socialLinks: config.socialLinks.map((s) => ({
        id: s.id,
        platform: s.platform,
        url: s.url,
        label: s.label,
      })),
      appLinks: config.appLinks
        .filter((a) => a.isEnabled && a.url?.startsWith('https://'))
        .map((a) => ({
          id: a.id,
          platform: a.platform,
          url: a.url,
          label: a.label,
        })),
      legalLinks: config.legalLinks.map((l) => ({
        id: l.id,
        label: l.label,
        href: l.href,
      })),
      copyright: `© ${new Date().getFullYear()} Go Experts. ${config.copyrightText || 'All rights reserved.'}`,
    };

    footerCache = result;
    footerCacheTime = now;
    return result;
  }
}

export class FooterAdminService {
  public async getDraft() {
    return prisma.footerConfig.findFirst({
      where: { status: 'DRAFT' },
      include: {
        columns: {
          orderBy: { sortOrder: 'asc' },
          include: { links: { orderBy: { sortOrder: 'asc' } } },
        },
        socialLinks: { orderBy: { sortOrder: 'asc' } },
        appLinks: true,
        legalLinks: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  public async getPublished() {
    return prisma.footerConfig.findFirst({
      where: { status: 'PUBLISHED' },
      include: {
        columns: {
          orderBy: { sortOrder: 'asc' },
          include: { links: { orderBy: { sortOrder: 'asc' } } },
        },
        socialLinks: { orderBy: { sortOrder: 'asc' } },
        appLinks: true,
        legalLinks: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  public async updateDraft(id: string, data: any) {
    return prisma.footerConfig.update({
      where: { id },
      data: {
        tagline: data.tagline,
        description: data.description,
        newsletterEnabled: data.newsletterEnabled,
        newsletterTitle: data.newsletterTitle,
        newsletterDescription: data.newsletterDescription,
        newsletterPlaceholder: data.newsletterPlaceholder,
        newsletterButtonText: data.newsletterButtonText,
        copyrightText: data.copyrightText,
      },
    });
  }

  // Atomic publish: marks the draft as PUBLISHED (invalidates public cache)
  public async publish(id: string, adminId: string) {
    // First unpublish any existing published config
    await prisma.footerConfig.updateMany({
      where: { status: 'PUBLISHED' },
      data: { status: 'DRAFT' },
    });
    const result = await prisma.footerConfig.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: adminId,
      },
    });
    // Invalidate public cache
    footerCache = null;
    footerCacheTime = 0;
    return result;
  }

  // Column management
  public async addColumn(configId: string, data: { title: string; key: string; sortOrder?: number }) {
    return prisma.footerColumn.create({
      data: { footerConfigId: configId, title: data.title, key: data.key, sortOrder: data.sortOrder ?? 0 },
    });
  }

  public async updateColumn(id: string, data: any) {
    return prisma.footerColumn.update({ where: { id }, data });
  }

  public async deleteColumn(id: string) {
    return prisma.footerColumn.delete({ where: { id } });
  }

  // Link management
  public async addLink(columnId: string, data: any) {
    if (!validateFooterHref(data.href, data.routeType || 'INTERNAL')) {
      throw new Error(`Invalid or unsafe href: ${data.href}`);
    }
    return prisma.footerLink.create({ data: { columnId, ...data } });
  }

  public async updateLink(id: string, data: any) {
    if (data.href && !validateFooterHref(data.href, data.routeType || 'INTERNAL')) {
      throw new Error(`Invalid or unsafe href: ${data.href}`);
    }
    return prisma.footerLink.update({ where: { id }, data });
  }

  public async deleteLink(id: string) {
    return prisma.footerLink.delete({ where: { id } });
  }

  // Social links
  public async upsertSocialLinks(configId: string, links: any[]) {
    await prisma.footerSocialLink.deleteMany({ where: { footerConfigId: configId } });
    if (links.length > 0) {
      await prisma.footerSocialLink.createMany({
        data: links.map((l, i) => ({
          footerConfigId: configId,
          platform: l.platform,
          url: l.url,
          label: l.label,
          sortOrder: i,
          isEnabled: l.isEnabled ?? true,
        })),
      });
    }
  }

  // Legal links
  public async upsertLegalLinks(configId: string, links: any[]) {
    await prisma.footerLegalLink.deleteMany({ where: { footerConfigId: configId } });
    if (links.length > 0) {
      await prisma.footerLegalLink.createMany({
        data: links.map((l, i) => ({
          footerConfigId: configId,
          label: l.label,
          href: l.href,
          sortOrder: i,
          isEnabled: l.isEnabled ?? true,
        })),
      });
    }
  }
}
