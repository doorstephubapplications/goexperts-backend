import { PrismaClient } from '@prisma/client';
import { ABOUT_SECTION_TYPES } from '../modules/about/about.constants.js';

const prisma = new PrismaClient();

async function seedAboutPage() {
  console.log('Seeding About Page...');

  // Check if it exists
  const existing = await prisma.aboutPage.findUnique({
    where: { slug: '/about' },
  });

  if (existing) {
    console.log('About page already exists. Skipping seed to prevent duplication.');
    return;
  }

  // Idempotent creation
  const page = await prisma.aboutPage.create({
    data: {
      slug: '/about',
      status: 'draft',
      draftVersion: 1,
      seo: {
        create: {
          title: 'About Go Experts | Connect. Build. Grow.',
          description: 'Go Experts is one platform connecting people, projects, capital and opportunities.',
          canonicalUrl: 'https://goexperts.com/about',
        },
      },
      sections: {
        create: [
          {
            sectionKey: 'hero',
            sectionType: ABOUT_SECTION_TYPES.HERO,
            sortOrder: 1,
            enabled: true,
            content: {
              eyebrow: 'About Go Experts',
              title: 'Empowering People, Projects and Possibilities.',
              description: 'We connect talented professionals with ambitious projects, startups with investors, and ideas with execution.',
              primaryCta: { label: 'Get Started', url: '/register' },
              secondaryCta: { label: 'Explore Platform', url: '/explore' },
            },
          },
          {
            sectionKey: 'roles',
            sectionType: ABOUT_SECTION_TYPES.ROLES,
            sortOrder: 2,
            enabled: true,
            content: {
              title: 'One platform. Four ways to grow.',
              roles: [
                {
                  role: 'Freelancer',
                  title: 'Freelancer',
                  description: 'Find meaningful work, showcase expertise and grow professionally.',
                  cta: { label: 'Find Work', url: '/find-work' },
                },
                {
                  role: 'Client',
                  title: 'Client / Business',
                  description: 'Find skilled professionals and build teams for projects.',
                  cta: { label: 'Post a Project', url: '/post-project' },
                },
                {
                  role: 'Investor',
                  title: 'Investor',
                  description: 'Discover promising businesses and startup opportunities.',
                  cta: { label: 'Explore Startups', url: '/investors' },
                },
                {
                  role: 'Founder',
                  title: 'Startup Founder',
                  description: 'Present ideas, connect with investors and build relationships.',
                  cta: { label: 'Create Profile', url: '/founders' },
                }
              ]
            },
          },
          {
            sectionKey: 'how-it-works',
            sectionType: ABOUT_SECTION_TYPES.HOW_IT_WORKS,
            sortOrder: 3,
            enabled: true,
            content: {
              title: 'How Go Experts connects the ecosystem',
              steps: [
                { title: 'Discover', description: 'Find the right people and opportunities.' },
                { title: 'Connect', description: 'Reach out securely through our platform.' },
                { title: 'Collaborate', description: 'Work together using powerful tools.' },
                { title: 'Grow', description: 'Achieve your goals and scale your success.' },
              ]
            }
          },
          {
            sectionKey: 'stats',
            sectionType: ABOUT_SECTION_TYPES.STATS,
            sortOrder: 4,
            enabled: true,
            content: {
              title: 'Platform Impact',
              stats: [
                { key: 'professionals', label: 'Professionals', source: 'DYNAMIC' },
                { key: 'businesses', label: 'Businesses', source: 'DYNAMIC' },
                { key: 'projects', label: 'Projects', source: 'DYNAMIC' },
              ]
            }
          },
          {
            sectionKey: 'cta',
            sectionType: ABOUT_SECTION_TYPES.CTA,
            sortOrder: 5,
            enabled: true,
            content: {
              title: 'Ready to grow with Go Experts?',
              description: 'Connect with professionals, projects, businesses and opportunities.',
              primaryCta: { label: 'Get Started', url: '/register' },
            }
          }
        ],
      },
    },
  });

  console.log(`Created About page with ID: ${page.id}`);
}

seedAboutPage()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
