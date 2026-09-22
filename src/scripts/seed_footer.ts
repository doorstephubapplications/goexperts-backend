/**
 * Idempotent footer seed script.
 * Run: npx tsx src/scripts/seed_footer.ts
 * Safe to run multiple times — uses upsert/skip-if-exists logic.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Verified routes that exist in go-experts-connect
const COLUMNS = [
  {
    key: 'freelancers',
    title: 'For Freelancers',
    sortOrder: 0,
    links: [
      { label: 'Find Work', href: '/freelancers', routeType: 'INTERNAL', sortOrder: 0 },
      { label: 'Freelancer Signup', href: '/signup', routeType: 'INTERNAL', sortOrder: 1 },
      { label: 'How It Works', href: '/how-it-works', routeType: 'INTERNAL', sortOrder: 2 },
      { label: 'Pricing', href: '/pricing?role=freelancer', routeType: 'INTERNAL', sortOrder: 3 },
    ],
  },
  {
    key: 'clients',
    title: 'For Clients',
    sortOrder: 1,
    links: [
      { label: 'Post a Project', href: '/post-project', routeType: 'INTERNAL', sortOrder: 0 },
      { label: 'Hire Experts', href: '/clients', routeType: 'INTERNAL', sortOrder: 1 },
      { label: 'How It Works', href: '/how-it-works', routeType: 'INTERNAL', sortOrder: 2 },
      { label: 'Pricing', href: '/pricing?role=client', routeType: 'INTERNAL', sortOrder: 3 },
    ],
  },
  {
    key: 'investors',
    title: 'For Investors',
    sortOrder: 2,
    links: [
      { label: 'Discover Startups', href: '/startup-ideas', routeType: 'INTERNAL', sortOrder: 0 },
      { label: 'Investor Page', href: '/investors', routeType: 'INTERNAL', sortOrder: 1 },
      { label: 'Pricing', href: '/pricing?role=investor', routeType: 'INTERNAL', sortOrder: 2 },
    ],
  },
  {
    key: 'founders',
    title: 'For Founders',
    sortOrder: 3,
    links: [
      { label: 'Submit an Idea', href: '/founders', routeType: 'INTERNAL', sortOrder: 0 },
      { label: 'Startup Ideas', href: '/startup-ideas', routeType: 'INTERNAL', sortOrder: 1 },
      { label: 'Pricing', href: '/pricing?role=founder', routeType: 'INTERNAL', sortOrder: 2 },
    ],
  },
  {
    key: 'company',
    title: 'Company',
    sortOrder: 4,
    links: [
      { label: 'About', href: '/about', routeType: 'INTERNAL', sortOrder: 0 },
      { label: 'Careers', href: '/careers', routeType: 'INTERNAL', sortOrder: 1 },
      { label: 'Contact', href: '/contact', routeType: 'INTERNAL', sortOrder: 2 },
      { label: 'FAQ', href: '/faqs', routeType: 'INTERNAL', sortOrder: 3 },
      { label: 'Help Center', href: '/help', routeType: 'INTERNAL', sortOrder: 4 },
      { label: 'Blog', href: '/blog', routeType: 'INTERNAL', sortOrder: 5 },
    ],
  },
];

const LEGAL_LINKS = [
  { label: 'Terms & Conditions', href: '/terms', sortOrder: 0 },
  { label: 'Privacy Policy', href: '/privacy', sortOrder: 1 },
  { label: 'Refund Policy', href: '/refund-policy', sortOrder: 2 },
];

const SOCIAL_LINKS = [
  { platform: 'LINKEDIN', url: 'https://linkedin.com/company/go-experts', label: 'Follow Go Experts on LinkedIn', sortOrder: 0 },
  { platform: 'TWITTER', url: 'https://twitter.com/goexperts', label: 'Follow Go Experts on Twitter', sortOrder: 1 },
  { platform: 'INSTAGRAM', url: 'https://instagram.com/goexperts', label: 'Follow Go Experts on Instagram', sortOrder: 2 },
  { platform: 'YOUTUBE', url: 'https://youtube.com/@goexperts', label: 'Follow Go Experts on YouTube', sortOrder: 3 },
];

async function main() {
  console.log('🌱 Seeding footer configuration...');

  // Check if a published footer already exists — skip to prevent duplication
  const existing = await (prisma as any).footerConfig.findFirst({
    where: { status: 'PUBLISHED' },
  });

  if (existing) {
    console.log('✅ Published footer already exists. Skipping seed to prevent duplication.');
    return;
  }

  // Check if a draft already exists
  let draft = await (prisma as any).footerConfig.findFirst({
    where: { status: 'DRAFT' },
  });

  if (!draft) {
    draft = await (prisma as any).footerConfig.create({
      data: {
        tagline: 'The Future of Freelancing',
        description: 'Connect with skilled professionals, discover opportunities, build businesses and create meaningful professional connections on one trusted platform.',
        newsletterEnabled: false, // Disabled until newsletter backend is configured
        copyrightText: 'All rights reserved.',
        status: 'DRAFT',
      },
    });
    console.log('✅ Created footer draft config:', draft.id);
  } else {
    console.log('ℹ️  Draft already exists:', draft.id);
  }

  const configId = draft.id;

  // Seed columns + links (idempotent: check by key)
  for (const col of COLUMNS) {
    const existingCol = await (prisma as any).footerColumn.findFirst({
      where: { footerConfigId: configId, key: col.key },
    });

    let colId: string;
    if (existingCol) {
      colId = existingCol.id;
      console.log(`  ℹ️  Column "${col.title}" already exists. Skipping.`);
    } else {
      const created = await (prisma as any).footerColumn.create({
        data: {
          footerConfigId: configId,
          title: col.title,
          key: col.key,
          sortOrder: col.sortOrder,
          isEnabled: true,
        },
      });
      colId = created.id;
      console.log(`  ✅ Created column: ${col.title}`);
    }

    // Seed links for this column (idempotent: check by href)
    for (const link of col.links) {
      const existingLink = await (prisma as any).footerLink.findFirst({
        where: { columnId: colId, href: link.href, label: link.label },
      });

      if (!existingLink) {
        await (prisma as any).footerLink.create({
          data: { columnId: colId, ...link, isEnabled: true },
        });
      }
    }
  }

  // Seed legal links (idempotent)
  for (const ll of LEGAL_LINKS) {
    const existing = await (prisma as any).footerLegalLink.findFirst({
      where: { footerConfigId: configId, href: ll.href },
    });
    if (!existing) {
      await (prisma as any).footerLegalLink.create({
        data: { footerConfigId: configId, ...ll, isEnabled: true },
      });
    }
  }

  // Seed social links (idempotent)
  for (const sl of SOCIAL_LINKS) {
    const existing = await (prisma as any).footerSocialLink.findFirst({
      where: { footerConfigId: configId, platform: sl.platform },
    });
    if (!existing) {
      await (prisma as any).footerSocialLink.create({
        data: { footerConfigId: configId, ...sl, isEnabled: true },
      });
    }
  }

  // Auto-publish the seeded draft
  await (prisma as any).footerConfig.update({
    where: { id: configId },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      publishedBy: 'seed-script',
    },
  });

  console.log('✅ Footer seeded and published successfully!');
  console.log(`   Config ID: ${configId}`);
  console.log(`   Columns: ${COLUMNS.length}`);
  console.log(`   Legal links: ${LEGAL_LINKS.length}`);
  console.log(`   Social links: ${SOCIAL_LINKS.length}`);
}

main()
  .catch((e) => {
    console.error('❌ Footer seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
