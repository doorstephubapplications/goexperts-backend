import { prisma } from '../config/database.js';

const INITIAL_ABOUT_JSON = {
  hero: {
    enabled: true,
    eyebrow: "About Go Experts",
    heading: "Building the future of professional work",
    highlightText: "together.",
    description: "Go Experts is one platform connecting people, projects, capital, and ideas to build meaningful software and companies.",
    primaryCtaLabel: "Join the Platform",
    primaryCtaUrl: "/register",
    secondaryCtaLabel: "View Opportunities",
    secondaryCtaUrl: "/careers",
    image: "",
    imageAlt: "Go Experts platform"
  },
  introduction: {
    enabled: true,
    badge: "Who We Are",
    heading: "More than just a marketplace.",
    summary: "We are a global ecosystem where talented professionals and ambitious companies meet.",
    description: "We started Go Experts because we believed the way people find work and build companies needed to change. Today, we're building the infrastructure that makes collaboration seamless.",
    image: "",
    layout: "image_right"
  },
  missionVision: {
    enabled: true,
    mission: { heading: "Our Mission", description: "To empower professionals and businesses to build incredible products together without borders.", icon: "Target" },
    vision: { heading: "Our Vision", description: "A world where talent and opportunity are perfectly aligned, creating economic growth for everyone.", icon: "Compass" }
  },
  story: {
    enabled: true,
    badge: "Our Story",
    heading: "From an idea to a global platform.",
    content: "It started with a simple observation: finding the right people to build a product is too hard. We built Go Experts to solve our own problem, and it grew into a platform used by thousands.",
    image: ""
  },
  coreValues: [
    { id: "cv1", icon: "Users", title: "Customer First", description: "Everything we do starts with our users." },
    { id: "cv2", icon: "Zap", title: "Move Fast", description: "Speed is a feature. We iterate quickly." }
  ],
  statistics: [
    { id: "st1", label: "Global Users", value: "50K+", icon: "Users" },
    { id: "st2", label: "Projects Completed", value: "10K+", icon: "Briefcase" }
  ],
  whyChooseUs: [
    { id: "wc1", title: "Vetted Talent", description: "Every professional on our platform is verified.", icon: "CheckCircle2" },
    { id: "wc2", title: "Secure Payments", description: "Your money is safe with our milestone-based escrow.", icon: "Shield" }
  ],
  teamMembers: [],
  timeline: [],
  locations: [],
  certifications: [],
  cta: {
    enabled: true,
    heading: "Ready to build something great?",
    subheading: "Join thousands of professionals and companies on Go Experts.",
    primaryCtaLabel: "Create an Account",
    primaryCtaUrl: "/register",
    secondaryCtaLabel: "Contact Sales",
    secondaryCtaUrl: "/contact"
  },
  seo: {
    metaTitle: "About Go Experts | Connect. Build. Grow.",
    metaDescription: "Learn about Go Experts, our mission, vision, and the team building the future of work.",
    ogTitle: "About Go Experts",
    ogDescription: "The platform connecting professionals and businesses.",
    ogImage: "",
    canonicalUrl: "/about"
  },
  publishing: {
    isPublished: true,
    showInNavigation: true,
    allowIndexing: true
  }
};

async function seedAboutDraft() {
  const page = await prisma.cmsPage.findUnique({ where: { name: 'about-page' } });
  
  if (page) {
    await prisma.cmsPage.update({
      where: { id: page.id },
      data: {
        draftJson: JSON.stringify(INITIAL_ABOUT_JSON),
        publishedJson: JSON.stringify(INITIAL_ABOUT_JSON),
        status: 'published',
        publishedAt: new Date(),
        updated: new Date().toLocaleString()
      }
    });
    console.log('✅ About page CmsPage updated with initial data.');
  } else {
    await prisma.cmsPage.create({
      data: {
        name: 'about-page',
        category: 'content',
        status: 'published',
        version: 1,
        draftJson: JSON.stringify(INITIAL_ABOUT_JSON),
        publishedJson: JSON.stringify(INITIAL_ABOUT_JSON),
        publishedAt: new Date(),
        updated: new Date().toLocaleString()
      }
    });
    console.log('✅ About page CmsPage created with initial data.');
  }
}

seedAboutDraft()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
