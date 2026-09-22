import { PrismaClient, FAQRole } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { name: 'Getting Started', slug: 'general-getting-started', role: FAQRole.GENERAL },
  { name: 'Account & Profile', slug: 'general-account', role: FAQRole.GENERAL },
  { name: 'Platform Features', slug: 'general-features', role: FAQRole.GENERAL },
  { name: 'Trust & Safety', slug: 'general-trust-safety', role: FAQRole.GENERAL },
  { name: 'Payments & Subscriptions', slug: 'general-payments', role: FAQRole.GENERAL },

  { name: 'Getting Started', slug: 'freelancer-getting-started', role: FAQRole.FREELANCER },
  { name: 'Profile & Verification', slug: 'freelancer-profile', role: FAQRole.FREELANCER },
  { name: 'Finding Opportunities', slug: 'freelancer-opportunities', role: FAQRole.FREELANCER },
  { name: 'Proposals', slug: 'freelancer-proposals', role: FAQRole.FREELANCER },
  { name: 'Work & Contracts', slug: 'freelancer-work', role: FAQRole.FREELANCER },
  { name: 'Payments & Withdrawals', slug: 'freelancer-payments', role: FAQRole.FREELANCER },

  { name: 'Getting Started', slug: 'client-getting-started', role: FAQRole.CLIENT },
  { name: 'Business Profile', slug: 'client-profile', role: FAQRole.CLIENT },
  { name: 'Finding Talent', slug: 'client-talent', role: FAQRole.CLIENT },
  { name: 'Projects', slug: 'client-projects', role: FAQRole.CLIENT },
  { name: 'Hiring', slug: 'client-hiring', role: FAQRole.CLIENT },
  { name: 'Payments', slug: 'client-payments', role: FAQRole.CLIENT },

  { name: 'Getting Started', slug: 'investor-getting-started', role: FAQRole.INVESTOR },
  { name: 'Investor Profile', slug: 'investor-profile', role: FAQRole.INVESTOR },
  { name: 'Startup Discovery', slug: 'investor-discovery', role: FAQRole.INVESTOR },
  { name: 'Opportunities', slug: 'investor-opportunities', role: FAQRole.INVESTOR },
  { name: 'Verification', slug: 'investor-verification', role: FAQRole.INVESTOR },

  { name: 'Getting Started', slug: 'founder-getting-started', role: FAQRole.FOUNDER },
  { name: 'Startup Profile', slug: 'founder-profile', role: FAQRole.FOUNDER },
  { name: 'Fundraising', slug: 'founder-fundraising', role: FAQRole.FOUNDER },
  { name: 'Investor Connections', slug: 'founder-connections', role: FAQRole.FOUNDER },
  { name: 'Documents', slug: 'founder-documents', role: FAQRole.FOUNDER },
  { name: 'Verification', slug: 'founder-verification', role: FAQRole.FOUNDER },
];

const faqs = [
  // GENERAL FAQS
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-getting-started',
    question: 'What is Go Experts?',
    answer: 'Go Experts is a professional platform that brings freelancers, clients, startup founders and investors together in one ecosystem. Members can create professional profiles, discover relevant opportunities and connect with people based on their goals.',
    slug: 'what-is-go-experts',
    isFeatured: true
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-getting-started',
    question: 'Who can join Go Experts?',
    answer: 'Go Experts supports freelancers, clients and businesses, investors, and startup founders. You can create the role profile that matches how you want to use the platform.',
    slug: 'who-can-join-go-experts',
    isFeatured: true
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-getting-started',
    question: 'Can I use more than one role?',
    answer: 'Your available roles depend on the account and platform configuration. If multiple roles are supported for your account, you can complete the relevant profile information for each role.',
    slug: 'can-i-use-more-than-one-role',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-getting-started',
    question: 'Is Go Experts available on mobile?',
    answer: 'Go Experts provides mobile experiences for supported platform features. Use the official Go Experts application or website to access the services available for your account.',
    slug: 'is-go-experts-available-on-mobile',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-account',
    question: 'How do I create a Go Experts account?',
    answer: 'Create an account using the available registration options and select the role that best matches your primary objective. You can then complete your profile and access the platform.',
    slug: 'how-do-i-create-a-go-experts-account',
    isFeatured: true
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-account',
    question: 'Can I update my profile after registration?',
    answer: 'Yes. Your profile can be updated as your professional information, services, experience or business details change. Some actions may require additional profile information or verification.',
    slug: 'can-i-update-my-profile-after-registration',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-account',
    question: 'Why does Go Experts ask me to complete my profile?',
    answer: 'A complete profile helps other members understand your experience, services, goals or business information. Certain platform actions may also require specific profile or verification information.',
    slug: 'why-does-go-experts-ask-me-to-complete-my-profile',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-trust-safety',
    question: 'Is profile completion the same as verification?',
    answer: 'No. Profile completion describes how much relevant profile information you have provided. Verification is a separate trust and compliance process that may be required for specific actions.',
    slug: 'is-profile-completion-the-same-as-verification',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-trust-safety',
    question: 'How does Go Experts protect my information?',
    answer: 'Go Experts applies platform security and access controls to help protect account and platform information. Always use secure credentials and follow the platform\'s privacy and security guidance.',
    slug: 'how-does-go-experts-protect-my-information',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-getting-started',
    question: 'Where can I get help if I have a problem?',
    answer: 'Use the Help & Support area available through the Go Experts platform to find relevant guidance and available support options.',
    slug: 'where-can-i-get-help',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-payments',
    question: 'How does the Go Experts subscription model work?',
    answer: 'Go Experts provides subscription-based access to platform features according to the applicable plan. Available features, pricing and terms are shown during the relevant subscription flow and may change over time.',
    slug: 'how-does-subscription-model-work',
    isFeatured: true
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-payments',
    question: 'Does Go Experts charge a commission on my work?',
    answer: 'Go Experts operates on its platform subscription model rather than taking a commission from completed freelance work, subject to the plan and terms applicable to your account.',
    slug: 'does-go-experts-charge-commission',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-trust-safety',
    question: 'Why does Go Experts use verification?',
    answer: 'Verification helps establish trust across the platform. Confirming the identity and credentials of our users ensures a professional and safe environment for all interactions.',
    slug: 'why-does-go-experts-use-verification',
    isFeatured: true
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-trust-safety',
    question: 'What information may be required for verification?',
    answer: 'Depending on your account type and region, you may be asked to provide government-issued ID, business registration documents, or professional certifications.',
    slug: 'what-information-required-verification',
  },
  {
    role: FAQRole.GENERAL,
    categorySlug: 'general-trust-safety',
    question: 'Why can some actions require additional verification?',
    answer: 'High-trust actions like processing large payments or listing certain investment opportunities require additional compliance and identity checks to maintain platform integrity.',
    slug: 'why-actions-require-additional-verification',
  },

  // FREELANCER FAQS
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-profile',
    question: 'How do I create a freelancer profile?',
    answer: 'Navigate to your account settings and select the Freelancer profile type. Fill in your professional summary, skills, and experience to activate your profile.',
    slug: 'how-do-i-create-a-freelancer-profile',
    isFeatured: true
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-profile',
    question: 'What information should I include in my freelancer profile?',
    answer: 'Include a clear professional headline, an overview of your expertise, relevant work history, and a portfolio of past projects to attract clients.',
    slug: 'what-information-should-i-include-in-freelancer-profile',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-opportunities',
    question: 'How can clients discover my freelancer profile?',
    answer: 'Clients discover your profile through the talent search directory. Ensure your profile contains accurate skills and keywords relevant to the services you offer.',
    slug: 'how-can-clients-discover-freelancer-profile',
    isFeatured: true
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-profile',
    question: 'Can I showcase my skills and experience?',
    answer: 'Yes, the platform provides dedicated sections for skills and employment history where you can detail your expertise.',
    slug: 'can-i-showcase-skills-and-experience',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-profile',
    question: 'Can I add portfolio projects to my profile?',
    answer: 'Yes, adding portfolio items is highly recommended. You can upload project descriptions, images, and links to demonstrate your capabilities.',
    slug: 'can-i-add-portfolio-projects',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-opportunities',
    question: 'How do I find projects that match my skills?',
    answer: 'Use the project search and filter by category, skill requirements, or budget to find opportunities that align with your expertise.',
    slug: 'how-do-i-find-projects-matching-skills',
    isFeatured: true
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-proposals',
    question: 'Can I submit a proposal for a project?',
    answer: 'Yes. When you find a project you are interested in, you can submit a proposal detailing your approach, timeline, and requested terms.',
    slug: 'can-i-submit-proposal-for-project',
    isFeatured: true
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-proposals',
    question: 'Why might I be asked to complete additional profile information before submitting a proposal?',
    answer: 'Certain projects have specific prerequisites set by the client or platform. You may need to verify your identity or complete your profile to meet these standards.',
    slug: 'why-additional-profile-info-before-proposal',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-opportunities',
    question: 'Can I save or manage projects I am interested in?',
    answer: 'Yes, you can bookmark or save projects to review them later from your saved projects dashboard.',
    slug: 'can-i-save-or-manage-projects',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-proposals',
    question: 'How can I update my proposal information?',
    answer: 'If the client has not yet accepted or rejected your proposal, you may have the option to withdraw or revise your submission depending on project settings.',
    slug: 'how-can-i-update-proposal-info',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-opportunities',
    question: 'How do I know whether a project is relevant to me?',
    answer: 'Review the project description, required skills, and the client\'s expectations carefully before applying to ensure it aligns with your capabilities.',
    slug: 'how-do-i-know-project-relevant',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-payments',
    question: 'How are freelancer payments handled?',
    answer: 'Payments are processed according to the milestones or terms agreed upon in the contract. Funds are securely managed through the platform\'s payment system.',
    slug: 'how-are-freelancer-payments-handled',
    isFeatured: true
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-payments',
    question: 'When can I withdraw my earnings?',
    answer: 'Earnings become available for withdrawal after a standard security clearance period following client approval of the work.',
    slug: 'when-can-i-withdraw-earnings',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-payments',
    question: 'Why might payment or withdrawal verification be required?',
    answer: 'To comply with financial regulations and protect against fraud, you must complete identity and bank verification before withdrawing funds.',
    slug: 'why-payment-withdrawal-verification-required',
  },
  {
    role: FAQRole.FREELANCER,
    categorySlug: 'freelancer-profile',
    question: 'Can I update my professional profile after becoming active?',
    answer: 'Yes, you can continuously update your profile, skills, and portfolio as you gain more experience and complete more projects.',
    slug: 'can-update-professional-profile',
  },

  // CLIENT / BUSINESS FAQS
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-getting-started',
    question: 'How do I create a client or business profile?',
    answer: 'Sign up and select the Client profile option. You can then fill in your personal or business details to start posting projects or hiring talent.',
    slug: 'how-do-i-create-client-profile',
    isFeatured: true
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-talent',
    question: 'How do I find freelancers on Go Experts?',
    answer: 'You can browse the talent directory, use advanced search filters, or simply post a project and let qualified freelancers come to you.',
    slug: 'how-do-i-find-freelancers',
    isFeatured: true
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-talent',
    question: 'How can I compare freelancer profiles?',
    answer: 'You can review their work history, skills, portfolio, and ratings from previous clients on their public profiles.',
    slug: 'how-compare-freelancer-profiles',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-projects',
    question: 'How do I create a project?',
    answer: 'Navigate to your dashboard and select "Post a Project." Follow the prompts to detail your requirements, budget, and timeline.',
    slug: 'how-do-i-create-a-project',
    isFeatured: true
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-projects',
    question: 'Can I save a project as a draft?',
    answer: 'Yes, you can start drafting a project and save it to complete and publish later.',
    slug: 'can-save-project-as-draft',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-projects',
    question: 'What information should I include when creating a project?',
    answer: 'Provide a clear title, a detailed description of the deliverables, required skills, and an estimated budget or timeline for the best results.',
    slug: 'what-information-when-creating-project',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-projects',
    question: 'When can I publish a project?',
    answer: 'Once you have filled out all the required fields and verified your account details if necessary, you can publish the project immediately.',
    slug: 'when-can-i-publish-project',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-projects',
    question: 'Why might I need to complete additional information before publishing a project?',
    answer: 'For the safety of our freelancers, we may require clients to complete business verification or set up a valid payment method before posting.',
    slug: 'why-additional-info-before-publishing-project',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-hiring',
    question: 'How can freelancers respond to my project?',
    answer: 'Once published, eligible freelancers can view your project and submit proposals directly to your dashboard.',
    slug: 'how-freelancers-respond-to-project',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-hiring',
    question: 'How do I review freelancer proposals?',
    answer: 'You can view all submitted proposals from your project dashboard, review their cover letters, proposed terms, and profiles.',
    slug: 'how-do-i-review-proposals',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-hiring',
    question: 'How do I hire a freelancer?',
    answer: 'After reviewing proposals, you can communicate with candidates, finalize the terms, and click "Hire" to initiate the contract workflow.',
    slug: 'how-do-i-hire-freelancer',
    isFeatured: true
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-projects',
    question: 'Can I manage multiple projects?',
    answer: 'Yes, your client dashboard allows you to oversee multiple active, draft, and completed projects simultaneously.',
    slug: 'can-i-manage-multiple-projects',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-payments',
    question: 'How are payments handled?',
    answer: 'Payments are securely processed through the platform based on the agreed milestones or hourly terms of your contract.',
    slug: 'how-are-client-payments-handled',
    isFeatured: true
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-profile',
    question: 'Can businesses use Go Experts?',
    answer: 'Absolutely. You can set up a business profile, add company details, and manage hiring for your entire organization.',
    slug: 'can-businesses-use-go-experts',
  },
  {
    role: FAQRole.CLIENT,
    categorySlug: 'client-profile',
    question: 'Can I update my business information later?',
    answer: 'Yes, your business profile and payment details can be updated at any time from your account settings.',
    slug: 'can-i-update-business-information',
  },

  // INVESTOR FAQS
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-profile',
    question: 'How do I create an investor profile?',
    answer: 'Select the Investor role during signup or add it to your existing account. You will need to provide information about your investment thesis and background.',
    slug: 'how-do-i-create-investor-profile',
    isFeatured: true
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-profile',
    question: 'What information should I include in my investor profile?',
    answer: 'Include your preferred industries, typical investment stages, past investments, and a brief overview of what you look for in a startup.',
    slug: 'what-info-in-investor-profile',
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-discovery',
    question: 'How can I discover startups on Go Experts?',
    answer: 'You can browse the startup directory, filter by industry, funding stage, and location to find relevant opportunities.',
    slug: 'how-discover-startups',
    isFeatured: true
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-discovery',
    question: 'Can I browse startup profiles before expressing interest?',
    answer: 'Yes, you can view public details of a startup before initiating contact or requesting access to their detailed pitch deck.',
    slug: 'can-browse-startup-profiles',
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-opportunities',
    question: 'How do I express interest in a startup opportunity?',
    answer: 'Depending on the startup\'s settings, you can send a connection request or message the founder directly through the platform.',
    slug: 'how-express-interest-startup',
    isFeatured: true
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-opportunities',
    question: 'Why might I need additional profile information before expressing interest?',
    answer: 'Founders often prefer to engage with verified investors. Completing your profile and verification steps helps build trust.',
    slug: 'why-additional-info-before-expressing-interest',
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-profile',
    question: 'Can I update my investment preferences?',
    answer: 'Yes, you can continuously refine your investment preferences from your profile settings.',
    slug: 'can-update-investment-preferences',
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-profile',
    question: 'Can I indicate the types of startups I am interested in?',
    answer: 'Yes, tagging your profile with specific industries and stages helps relevant startups find you organically.',
    slug: 'can-indicate-types-of-startups',
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-verification',
    question: 'Why might identity or verification information be required?',
    answer: 'To maintain a high-quality ecosystem, we verify investor profiles to ensure compliance and protect founders.',
    slug: 'why-identity-verification-required-investor',
  },
  {
    role: FAQRole.INVESTOR,
    categorySlug: 'investor-opportunities',
    question: 'Can I communicate with startup founders through Go Experts?',
    answer: 'Yes, the platform includes secure messaging to facilitate initial conversations and due diligence.',
    slug: 'can-communicate-with-founders',
    isFeatured: true
  },

  // FOUNDER FAQS
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-profile',
    question: 'How do I create a startup founder profile?',
    answer: 'Select the Founder role and complete your personal profile to represent yourself before setting up your company profile.',
    slug: 'how-create-startup-founder-profile',
    isFeatured: true
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-profile',
    question: 'How do I create a startup profile?',
    answer: 'Once your founder account is active, you can create a dedicated Startup Profile detailing your company, traction, and goals.',
    slug: 'how-create-startup-profile',
    isFeatured: true
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-profile',
    question: 'What information should I include about my startup?',
    answer: 'Provide a clear elevator pitch, information about the problem you are solving, your solution, market size, and current traction.',
    slug: 'what-info-include-about-startup',
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-profile',
    question: 'Can I showcase my startup idea before raising funding?',
    answer: 'Yes, you can create a profile to build early traction, receive feedback, or find co-founders even if you are not actively fundraising.',
    slug: 'can-showcase-startup-before-funding',
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-documents',
    question: 'Can I add startup documents or supporting information?',
    answer: 'Yes, you can upload pitch decks, one-pagers, and supporting documents to share securely with interested investors.',
    slug: 'can-add-startup-documents',
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-connections',
    question: 'How can I discover investors?',
    answer: 'Use the investor directory to find individuals or firms whose investment thesis aligns with your industry and stage.',
    slug: 'how-discover-investors',
    isFeatured: true
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-connections',
    question: 'How do I contact an investor?',
    answer: 'You can request to connect or send a brief introductory message through the platform, subject to their contact preferences.',
    slug: 'how-contact-investor',
    isFeatured: true
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-connections',
    question: 'Why might I need additional information before contacting an investor?',
    answer: 'Many investors require a complete startup profile and basic traction metrics before accepting connection requests.',
    slug: 'why-additional-info-before-contacting-investor',
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-profile',
    question: 'Can I update my startup information?',
    answer: 'Yes, you should regularly update your metrics, milestones, and team information as your company grows.',
    slug: 'can-update-startup-info',
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-fundraising',
    question: 'Can I update my fundraising information?',
    answer: 'Yes, you can easily open or close funding rounds and update your target amounts on your profile.',
    slug: 'can-update-fundraising-info',
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-connections',
    question: 'Can I manage my investor conversations?',
    answer: 'Yes, all communications with interested investors are managed in your secure inbox.',
    slug: 'can-manage-investor-conversations',
  },
  {
    role: FAQRole.FOUNDER,
    categorySlug: 'founder-fundraising',
    question: 'Does Go Experts guarantee funding for startups?',
    answer: 'No. Go Experts provides a platform for founders and investors to discover and connect with opportunities. Funding decisions are made independently by the relevant parties.',
    slug: 'does-go-experts-guarantee-funding',
  },
];

async function main() {
  console.log('Seeding FAQs and Categories...');

  // 1. Setup SEO
  await prisma.fAQPageSeo.upsert({
    where: { slug: 'faqs' },
    update: {},
    create: {
      slug: 'faqs',
      title: 'Frequently Asked Questions | Go Experts',
      description: 'Find answers about Go Experts accounts, freelancing, projects, hiring, startup opportunities, investing, payments, verification and platform features.',
      ogTitle: 'Go Experts FAQs',
      ogDescription: 'Find quick answers about using Go Experts as a freelancer, client, investor or startup founder.'
    }
  });

  // 2. Insert Categories (Idempotent)
  const categoryIdMap: Record<string, string> = {};
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const saved = await prisma.fAQCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        role: cat.role,
        sortOrder: i * 10
      },
      create: {
        name: cat.name,
        slug: cat.slug,
        role: cat.role,
        sortOrder: i * 10,
        isActive: true
      }
    });
    categoryIdMap[cat.slug] = saved.id;
  }

  // 3. Insert FAQs
  let sortOrders: Record<string, number> = {};
  for (const faq of faqs) {
    if (!sortOrders[faq.categorySlug]) sortOrders[faq.categorySlug] = 0;
    sortOrders[faq.categorySlug] += 10;

    const catId = categoryIdMap[faq.categorySlug];
    if (!catId) continue;

    await prisma.fAQ.upsert({
      where: { slug: faq.slug },
      update: {
        question: faq.question,
        answer: faq.answer,
        role: faq.role,
        categoryId: catId,
        isFeatured: faq.isFeatured || false,
        sortOrder: sortOrders[faq.categorySlug],
        status: 'PUBLISHED',
        isPublished: true,
      },
      create: {
        slug: faq.slug,
        question: faq.question,
        answer: faq.answer,
        role: faq.role,
        categoryId: catId,
        isFeatured: faq.isFeatured || false,
        sortOrder: sortOrders[faq.categorySlug],
        status: 'PUBLISHED',
        isPublished: true,
        publishedAt: new Date(),
      }
    });
  }

  const count = await prisma.fAQ.count();
  console.log(`✅ Seeded ${count} FAQs across ${categories.length} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
