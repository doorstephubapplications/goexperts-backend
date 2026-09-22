import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function publishAboutPage() {
  const page = await prisma.aboutPage.findUnique({
    where: { slug: '/about' },
    include: {
      sections: { orderBy: { sortOrder: 'asc' } },
      seo: true,
    },
  });

  if (!page) {
    console.error('❌ About page not found. Run seed_about_page.ts first.');
    process.exit(1);
  }

  if (page.publishedVersion) {
    console.log(`ℹ️  About page already published at version v${page.publishedVersion}. Republishing draft v${page.draftVersion}...`);
  }

  const versionNumber = page.draftVersion;

  await prisma.$transaction([
    prisma.aboutRevision.upsert({
      where: {
        pageId_versionNumber: {
          pageId: page.id,
          versionNumber,
        },
      },
      create: {
        pageId: page.id,
        versionNumber,
        contentSnapshot: page.sections as any,
        seoSnapshot: (page.seo || {}) as any,
        createdBy: 'system:initial-publish',
        changeSummary: `Initial publish of About page v${versionNumber}`,
      },
      update: {
        contentSnapshot: page.sections as any,
        seoSnapshot: (page.seo || {}) as any,
      },
    }),
    prisma.aboutPage.update({
      where: { id: page.id },
      data: {
        publishedVersion: versionNumber,
        publishedAt: new Date(),
        status: 'published',
      },
    }),
  ]);

  console.log(`✅ About page published successfully at version v${versionNumber}`);
  console.log(`📡 GET /api/public/about should now return content.`);
}

publishAboutPage()
  .catch((e) => {
    console.error('❌ Publish failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
