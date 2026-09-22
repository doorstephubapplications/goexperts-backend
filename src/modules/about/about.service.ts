import { prisma } from '../../config/database.js';

export class AboutService {
  /**
   * Gets the complete state of the About Page for the Admin UI.
   */
  public async getAdminAbout() {
    if (!(prisma as any).aboutPage) return this.getEmptyAdminAbout();
    const page = await prisma.aboutPage.findUnique({
      where: { slug: '/about' },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
        },
        seo: true,
      },
    });

    if (!page) {
      return this.getEmptyAdminAbout();
    }

    return {
      draft: {
        sections: page.sections,
        seo: page.seo,
      },
      published: null, // Depending on if we want to fetch the latest published revision, but for now we keep it simple
      meta: {
        draftVersion: page.draftVersion,
        publishedVersion: page.publishedVersion,
        hasChanges: page.draftVersion !== page.publishedVersion,
      },
    };
  }

  private getEmptyAdminAbout() {
    return {
      draft: { sections: [], seo: null },
      published: null,
      meta: {
        draftVersion: 1,
        publishedVersion: null,
        hasChanges: true,
      },
    };
  }

  public async updateSection(
    sectionId: string,
    data: { content?: any; sortOrder?: number; enabled?: boolean; updatedBy: string },
    currentVersion: number
  ) {
    const page = await this.getPageForUpdate(currentVersion);

    const section = await prisma.aboutSection.update({
      where: { id: sectionId },
      data: {
        ...data,
      },
    });

    await this.incrementDraftVersion(page.id, page.draftVersion);
    return section;
  }

  public async updateSeo(
    data: any,
    currentVersion: number
  ) {
    const page = await this.getPageForUpdate(currentVersion);

    const seo = await prisma.aboutSeo.upsert({
      where: { pageId: page.id },
      update: data,
      create: { ...data, pageId: page.id },
    });

    await this.incrementDraftVersion(page.id, page.draftVersion);
    return seo;
  }

  private async getPageForUpdate(currentVersion: number) {
    const page = await prisma.aboutPage.findUnique({ where: { slug: '/about' } });
    if (!page) throw new Error('About page not initialized');
    
    if (page.draftVersion !== currentVersion) {
      throw new Error('CONTENT_VERSION_CONFLICT: This content was updated by another administrator. Refresh to review the latest version before saving.');
    }
    
    return page;
  }

  private async incrementDraftVersion(pageId: string, currentDraftVersion: number) {
    await prisma.aboutPage.update({
      where: { id: pageId },
      data: { draftVersion: currentDraftVersion + 1 },
    });
  }
}
