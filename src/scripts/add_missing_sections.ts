import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addMissingSections() {
  const page = await prisma.aboutPage.findUnique({
    where: { slug: '/about' },
    include: { sections: true, seo: true },
  });

  if (!page) { console.error('❌ About page not found.'); process.exit(1); }

  const existingTypes = page.sections.map((s: any) => s.sectionType);
  console.log('Existing section types:', existingTypes);

  // Add STORY if missing
  if (!existingTypes.includes('STORY')) {
    await prisma.aboutSection.create({
      data: {
        pageId: page.id,
        sectionKey: 'story',
        sectionType: 'STORY',
        sortOrder: 3,
        enabled: true,
        content: {
          eyebrow: 'Our Story',
          title: 'Built for a stronger\nprofessional tomorrow.',
          body: '<p>Go Experts was created with a simple belief — that great people, ideas and capital can change the world.</p><p>We saw the need for a trusted, all-in-one platform where freelancers can find meaningful work, clients can hire the best talent, founders can attract investors, and investors can discover high-potential startups.</p>',
          cta: { label: 'Our Mission', url: '/about#mission' },
        } as any,
      },
    });
    console.log('✅ Created STORY section');
  }

  // Fix sort orders so layout matches the screenshot
  // HERO=1, ROLES=2, STORY+MISSION_VISION=3+4, STATS=5, WHY_CHOOSE=6, CTA=7
  const sortMap: Record<string, number> = {
    HERO: 1,
    ROLES: 2,
    STORY: 3,
    MISSION_VISION: 4,
    STATS: 5,
    WHY_CHOOSE: 6,
    CTA: 7,
    HOW_IT_WORKS: 99, // disabled/last
    TIMELINE: 99,
    VALUES: 99,
  };

  const allSections = await prisma.aboutSection.findMany({ where: { pageId: page.id } });

  for (const section of allSections) {
    const newOrder = sortMap[section.sectionType] ?? 10;
    const shouldEnable = newOrder < 90;
    await prisma.aboutSection.update({
      where: { id: section.id },
      data: { sortOrder: newOrder, enabled: shouldEnable },
    });
  }
  console.log('✅ Sort orders fixed');

  // Republish with new snapshot
  const updatedPage = await prisma.aboutPage.findUnique({
    where: { slug: '/about' },
    include: { sections: { orderBy: { sortOrder: 'asc' } }, seo: true },
  });
  if (!updatedPage) return;

  const newVersion = (updatedPage.draftVersion || 1) + 1;
  await prisma.$transaction([
    prisma.aboutRevision.create({
      data: {
        pageId: updatedPage.id,
        versionNumber: newVersion,
        contentSnapshot: updatedPage.sections as any,
        seoSnapshot: (updatedPage.seo || {}) as any,
        createdBy: 'system:add-missing-sections',
        changeSummary: `Added STORY section, fixed sort orders v${newVersion}`,
      },
    }),
    prisma.aboutPage.update({
      where: { id: updatedPage.id },
      data: {
        publishedVersion: newVersion,
        draftVersion: newVersion,
        publishedAt: new Date(),
        status: 'published',
      },
    }),
  ]);

  console.log(`✅ About page re-published at version v${newVersion}`);
}

addMissingSections()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
