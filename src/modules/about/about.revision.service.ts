import { prisma } from '../../config/database.js';

export class AboutRevisionService {
  public async listRevisions() {
    const page = await prisma.aboutPage.findUnique({ where: { slug: '/about' } });
    if (!page) return [];

    return prisma.aboutRevision.findMany({
      where: { pageId: page.id },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        createdBy: true,
        createdAt: true,
        changeSummary: true,
      },
    });
  }

  public async getRevision(revisionId: string) {
    return prisma.aboutRevision.findUnique({
      where: { id: revisionId },
    });
  }

  public async restoreRevision(revisionId: string, adminId: string) {
    const revision = await prisma.aboutRevision.findUnique({
      where: { id: revisionId },
      include: { page: true },
    });

    if (!revision) throw new Error('Revision not found');

    const page = revision.page;
    const newDraftVersion = page.draftVersion + 1;

    // Restore requires updating sections and SEO to match the revision snapshot
    const contentSnapshot = revision.contentSnapshot as any[];
    const seoSnapshot = revision.seoSnapshot as any;

    await prisma.$transaction(async (tx) => {
      // Clear current draft sections
      await tx.aboutSection.deleteMany({
        where: { pageId: page.id },
      });

      // Insert snapshot sections
      if (contentSnapshot && Array.isArray(contentSnapshot)) {
        await tx.aboutSection.createMany({
          data: contentSnapshot.map(s => ({
            pageId: page.id,
            sectionKey: s.sectionKey,
            sectionType: s.sectionType,
            content: s.content,
            sortOrder: s.sortOrder,
            enabled: s.enabled,
            updatedBy: adminId,
          })),
        });
      }

      // Update SEO
      if (seoSnapshot) {
        await tx.aboutSeo.upsert({
          where: { pageId: page.id },
          update: {
            title: seoSnapshot.title,
            description: seoSnapshot.description,
            canonicalUrl: seoSnapshot.canonicalUrl,
            ogTitle: seoSnapshot.ogTitle,
            ogDescription: seoSnapshot.ogDescription,
            ogImageId: seoSnapshot.ogImageId,
            twitterTitle: seoSnapshot.twitterTitle,
            twitterDescription: seoSnapshot.twitterDescription,
            twitterImageId: seoSnapshot.twitterImageId,
          },
          create: {
            pageId: page.id,
            ...seoSnapshot,
          }
        });
      }

      // Increment draft version
      await tx.aboutPage.update({
        where: { id: page.id },
        data: { draftVersion: newDraftVersion },
      });
    });

    return {
      draftVersion: newDraftVersion,
      restoredFromVersion: revision.versionNumber,
      status: 'draft',
    };
  }
}
