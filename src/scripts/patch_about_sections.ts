import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function patchStatsSection() {
  const page = await prisma.aboutPage.findUnique({
    where: { slug: '/about' },
    include: { sections: true },
  });

  if (!page) {
    console.error('❌ About page not found. Run seed_about_page.ts first.');
    process.exit(1);
  }

  // Update the STATS section content to match the reference design
  await prisma.aboutSection.updateMany({
    where: { pageId: page.id, sectionType: 'STATS' },
    data: {
      content: {
        eyebrow: 'Our Impact',
        title: 'Numbers that show our progress.',
        description: "We're just getting started, and already making a difference for millions.",
        stats: [
          {
            key: 'professionals',
            label: 'Active Users',
            description: 'Growing every day',
            icon: 'users',
            color: 'blue',
            source: 'DYNAMIC',
          },
          {
            key: 'projects',
            label: 'Projects Completed',
            description: 'Across all categories',
            icon: 'briefcase',
            color: 'green',
            source: 'DYNAMIC',
          },
          {
            key: 'funding',
            label: 'Funding Facilitated',
            description: 'For innovative startups',
            icon: 'trending-up',
            color: 'orange',
            manualValue: '$250M+',
            source: 'MANUAL',
          },
          {
            key: 'satisfaction',
            label: 'User Satisfaction',
            description: 'Based on verified reviews',
            icon: 'star',
            color: 'purple',
            manualValue: '4.8/5',
            source: 'MANUAL',
          },
        ],
      } as any,
    },
  });

  // Also update the HERO section to have the correct heading field name
  await prisma.aboutSection.updateMany({
    where: { pageId: page.id, sectionType: 'HERO' },
    data: {
      content: {
        eyebrow: 'About Go Experts',
        heading: 'Empowering People, Projects and Possibilities.',
        highlightText: 'Possibilities.',
        description: 'Go Experts is a next-generation platform that connects freelancers, investors, founders and clients — all in one place. We make it simple to find the right talent, opportunities and funding to turn ideas into success.',
      } as any,
    },
  });

  // Update the ROLES section with proper icon/color fields
  await prisma.aboutSection.updateMany({
    where: { pageId: page.id, sectionType: 'ROLES' },
    data: {
      content: {
        roles: [
          {
            title: 'Freelancers',
            description: 'Showcase your skills.\nGet hired.',
            icon: 'user',
            color: 'blue',
            cta: { label: 'Find Work', url: '/find-work' },
          },
          {
            title: 'Clients',
            description: 'Find the best talent.\nBuild your team.',
            icon: 'briefcase',
            color: 'green',
            cta: { label: 'Post a Project', url: '/post-project' },
          },
          {
            title: 'Founders',
            description: 'Pitch your vision.\nGet funded.',
            icon: 'lightbulb',
            color: 'orange',
            cta: { label: 'Create Profile', url: '/founders' },
          },
          {
            title: 'Investors',
            description: 'Discover startups.\nGrow your portfolio.',
            icon: 'rocket',
            color: 'purple',
            cta: { label: 'Explore Startups', url: '/investors' },
          },
        ],
      } as any,
    },
  });

  // Update STORY section
  await prisma.aboutSection.updateMany({
    where: { pageId: page.id, sectionType: 'STORY' },
    data: {
      content: {
        eyebrow: 'Our Story',
        title: 'Built for a stronger\nprofessional tomorrow.',
        body: '<p>Go Experts was created with a simple belief — that great people, ideas and capital can change the world.</p><p>We saw the need for a trusted, all-in-one platform where freelancers can find meaningful work, clients can hire the best talent, founders can attract investors, and investors can discover high-potential startups.</p>',
        cta: { label: 'Our Mission', url: '/about#mission' },
      } as any,
    },
  });

  // Add MISSION_VISION and WHY_CHOOSE sections (upsert)
  const existingMV = page.sections.find((s: any) => s.sectionType === 'MISSION_VISION');
  if (!existingMV) {
    await prisma.aboutSection.create({
      data: {
        pageId: page.id,
        sectionKey: 'mission-vision',
        sectionType: 'MISSION_VISION',
        sortOrder: 5,
        enabled: true,
        content: {
          missionTitle: 'Our Mission',
          missionDescription: 'To create a trusted, transparent and inclusive platform that connects talent, opportunity and capital — helping people and businesses grow.',
          visionTitle: 'Our Vision',
          visionDescription: 'To become the world\'s most trusted platform for freelance work, startup funding and business growth.',
          valuesTitle: 'Our Values',
          valuesDescription: 'Trust • Opportunity • Innovation\nCommunity • Long-term Impact',
        } as any,
      },
    });
    console.log('✅ Created MISSION_VISION section');
  }

  const existingWhyChoose = page.sections.find((s: any) => s.sectionType === 'WHY_CHOOSE');
  if (!existingWhyChoose) {
    await prisma.aboutSection.create({
      data: {
        pageId: page.id,
        sectionKey: 'why-choose',
        sectionType: 'WHY_CHOOSE',
        sortOrder: 7,
        enabled: true,
        content: {
          eyebrow: 'Why Choose Go Experts',
          title: 'More than a platform.\nA growth partner.',
          description: 'We combine technology, trust and human support to give you the best experience — whether you\'re looking for work, hiring talent, raising funds or investing in the next big idea.',
          features: [
            { title: 'Verified Users', description: 'Safe & secure', icon: 'shield', color: 'blue' },
            { title: 'Secure Payments', description: 'Hassle-free transactions', icon: 'card', color: 'purple' },
            { title: 'Flexible Plans', description: 'For every stage', icon: 'calendar', color: 'green' },
            { title: 'Expert Support', description: 'Whenever you need us', icon: 'headset', color: 'orange' },
          ],
        } as any,
      },
    });
    console.log('✅ Created WHY_CHOOSE section');
  }

  // Now republish with the updated content snapshot
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
        createdBy: 'system:patch-sections',
        changeSummary: `Patched all sections with correct icon/color/content fields v${newVersion}`,
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

patchStatsSection()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
