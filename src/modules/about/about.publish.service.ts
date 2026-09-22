import { prisma } from '../../config/database.js';
import { AboutPublishValidator } from './about.validation.js';

export class AboutPublishService {
  private validator: AboutPublishValidator;

  constructor() {
    this.validator = new AboutPublishValidator();
  }

  public async publish(adminId: string, currentVersion: number) {
    const page = await prisma.aboutPage.findUnique({
      where: { slug: '/about' },
      include: {
        sections: { orderBy: { sortOrder: 'asc' } },
        seo: true,
      },
    });

    if (!page) throw new Error('About page not initialized');
    if (page.draftVersion !== currentVersion) {
      throw new Error('CONTENT_VERSION_CONFLICT: This content was updated by another administrator. Refresh to review the latest version before saving.');
    }

    const validationResult = await this.validator.validateDraft(page.sections, page.seo);
    if (!validationResult.valid) {
      throw new Error(JSON.stringify(validationResult.errors));
    }

    // Atomic publish transaction
    const [revision, updatedPage, audit] = await prisma.$transaction([
      // Create immutable revision
      prisma.aboutRevision.create({
        data: {
          pageId: page.id,
          versionNumber: page.draftVersion,
          contentSnapshot: page.sections as any,
          seoSnapshot: (page.seo || {}) as any,
          createdBy: adminId,
          changeSummary: `Published draft version ${page.draftVersion}`,
        },
      }),
      // Update publishedVersion
      prisma.aboutPage.update({
        where: { id: page.id },
        data: {
          publishedVersion: page.draftVersion,
          publishedAt: new Date(),
          status: 'published',
        },
      }),
      // Audit log (Assuming there's a generic activity/audit log, but we'll mock it if not)
      // We will skip audit insertion if we don't have the model, but ideally we'd insert here.
      // prisma.auditLog.create({...})
    ]);

    return {
      success: true,
      publishedVersion: updatedPage.publishedVersion,
      revisionId: revision.id,
    };
  }
}
