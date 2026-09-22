import { prisma } from '../../config/database.js';
import { AboutStatsService } from './about.stats.service.js';

export class AboutPublicService {
  private statsService: AboutStatsService;

  constructor() {
    this.statsService = new AboutStatsService();
  }

  public async getPublishedAbout() {
    // Guard: aboutPage model may not exist in a stale Prisma client if generate hasn't run yet
    if (!(prisma as any).aboutPage) {
      console.error('[AboutPublicService] prisma.aboutPage is undefined — run `npx prisma generate` and restart the server.');
      return null;
    }

    const page = await prisma.aboutPage.findUnique({
      where: { slug: '/about' },
    });

    if (!page || !page.publishedVersion) {
      return null;
    }

    // Fetch the published revision to guarantee we only show published content
    const revision = await prisma.aboutRevision.findUnique({
      where: {
        pageId_versionNumber: {
          pageId: page.id,
          versionNumber: page.publishedVersion,
        },
      },
    });

    if (!revision) {
      return null;
    }

    const sections = revision.contentSnapshot as any[];
    const seo = revision.seoSnapshot as any;

    const dynamicStats = await this.statsService.getDynamicStats();

    // Map dynamic stats if the stats section is enabled
    const processedSections = sections.map((section: any) => {
      if (section.sectionType === 'STATS' && section.content.stats) {
        section.content.stats = section.content.stats.map((stat: any) => {
          if (stat.source === 'DYNAMIC') {
            const dynamicValue = dynamicStats.find((s) => s.key === stat.key);
            if (dynamicValue) {
              return { ...stat, displayValue: dynamicValue.displayValue, value: dynamicValue.value };
            }
          }
          return { ...stat, displayValue: stat.manualValue };
        });
      }
      return section;
    });

    return {
      page: {
        slug: page.slug,
        updatedAt: page.updatedAt,
        publishedAt: page.publishedAt,
      },
      seo: {
        title: seo?.title,
        description: seo?.description,
        canonicalUrl: seo?.canonicalUrl,
        ogImage: seo?.ogImageId,
      },
      sections: processedSections.filter((s) => s.enabled).sort((a, b) => a.sortOrder - b.sortOrder),
      statistics: dynamicStats,
      structuredData: this.generateStructuredData(seo),
    };
  }

  private generateStructuredData(seo: any) {
    return [
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Go Experts",
        "url": seo?.canonicalUrl || "https://goexperts.com",
        "logo": "https://goexperts.com/logo.png"
      },
      {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": seo?.title,
        "description": seo?.description
      }
    ];
  }
}
