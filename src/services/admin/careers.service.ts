import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface CareersPageContent {
  hero: {
    eyebrow: string;
    heading: string;
    highlightText?: string;
    description: string;
    ctaLabel?: string;
    ctaAnchor?: string;
    primaryCtaLabel?: string;
    primaryCtaUrl?: string;
    secondaryCtaLabel?: string;
    secondaryCtaUrl?: string;
    image?: string;
    imageAlt?: string;
    enabled: boolean;
  };
  highlights?: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    sortOrder: number;
    enabled: boolean;
  }>;
  whyGoExperts?: {
    title: string;
    subtitle: string;
    image?: string;
    imageAlt?: string;
    items: Array<{
      id: string;
      title: string;
      description: string;
      sortOrder: number;
      enabled: boolean;
    }>;
    enabled: boolean;
  };
  lifeAtGoExperts?: {
    title: string;
    subtitle: string;
    largeImage?: string;
    largeImageAlt?: string;
    smallImage1?: string;
    smallImage1Alt?: string;
    smallImage2?: string;
    smallImage2Alt?: string;
    enabled: boolean;
  };
  howWeWork?: {
    title: string;
    principles: Array<{
      id: string;
      title: string;
      description: string;
      sortOrder: number;
      enabled: boolean;
    }>;
    enabled: boolean;
  };
  culture?: {
    title: string;
    description: string;
    items: Array<{
      id: string;
      number: string;
      title: string;
      description: string;
      sortOrder: number;
      enabled: boolean;
    }>;
    enabled: boolean;
  };
  people?: {
    title: string;
    statement: string;
    image?: string;
    imageAlt?: string;
    testimonials?: Array<{
      id: string;
      quote: string;
      name: string;
      designation: string;
      department: string;
      portrait?: string;
      enabled: boolean;
    }>;
    enabled: boolean;
  };
  benefits?: {
    title: string;
    items: Array<{
      id: string;
      icon: string;
      title: string;
      description: string;
      sortOrder: number;
      enabled: boolean;
    }>;
    enabled: boolean;
  };
  cta?: {
    heading: string;
    highlightText?: string;
    description: string;
    primaryLabel: string;
    primaryUrl: string;
    secondaryLabel?: string;
    secondaryUrl?: string;
    enabled: boolean;
  };
  seo: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl: string;
    ogTitle: string;
    ogDescription: string;
    ogImage?: string;
    robotsIndex?: string;
  };
  // Legacy fields â€” kept for backwards compatibility
  whyJoinUs?: any[];
  hiringProcess?: any[];
  faqs?: any[];
}

const PAGE_NAME = "Careers";
const PAGE_CATEGORY = "Company";

function generateApplicationNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `GE-CAR-${dateStr}-${randomNum}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export class CareersCmsService {
  /**
   * Ensure Careers CMS Page record exists
   */
  private async getOrCreatePage() {
    let page = await prisma.cmsPage.findFirst({
      where: {
        name: { equals: PAGE_NAME },
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!page) {
      const initialPayload: CareersPageContent = {
        hero: {
          eyebrow: "Build What's Next",
          heading: "Join a Team Solving Meaningful Problems Worldwide",
          highlightText: "Meaningful Problems Worldwide",
          description: "We are architecting the future of global borderless work. Discover fast-paced, high-ownership career opportunities across engineering, product, trust & safety, and growth.",
          image: "",
          imageAlt: "Go Experts Careers Team",
          primaryCtaLabel: "View Open Roles",
          primaryCtaUrl: "#open-positions",
          secondaryCtaLabel: "Our Culture",
          secondaryCtaUrl: "#company-culture",
          enabled: true,
        },
        highlights: [
          { id: "h-1", icon: "People", title: "People", description: "Build with talented, curious people who genuinely care.", sortOrder: 1, enabled: true },
          { id: "h-2", icon: "Product", title: "Product", description: "Solve meaningful problems at real scale.", sortOrder: 2, enabled: true },
          { id: "h-3", icon: "Growth", title: "Growth", description: "Learn, experiment and evolve continuously.", sortOrder: 3, enabled: true },
          { id: "h-4", icon: "Impact", title: "Impact", description: "Build something people use and genuinely value.", sortOrder: 4, enabled: true },
        ],
        whyGoExperts: {
          title: "Why Go Experts?",
          subtitle: "Build meaningful products with people who care about what they create.",
          image: "",
          imageAlt: "Team working together",
          items: [
            { id: "w-1", title: "Meaningful Work", description: "Build products designed to create real opportunities for professionals and businesses.", sortOrder: 1, enabled: true },
            { id: "w-2", title: "Ownership", description: "Take responsibility for ideas, decisions and outcomes from the very start.", sortOrder: 2, enabled: true },
            { id: "w-3", title: "Continuous Learning", description: "Grow through experimentation, collaboration and challenging problems every day.", sortOrder: 3, enabled: true },
            { id: "w-4", title: "Build Together", description: "Work across disciplines and perspectives to create better, more thoughtful products.", sortOrder: 4, enabled: true },
          ],
          enabled: true,
        },
        lifeAtGoExperts: {
          title: "Life at Go Experts",
          subtitle: "A place to build, learn, collaborate and grow.",
          largeImage: "",
          largeImageAlt: "Go Experts office",
          smallImage1: "",
          smallImage1Alt: "Team working",
          smallImage2: "",
          smallImage2Alt: "Team brainstorming",
          enabled: true,
        },
        howWeWork: {
          title: "How we work",
          principles: [
            { id: "p-1", title: "Think Customer First", description: "Understand the people who use what we build and make decisions that serve them.", sortOrder: 1, enabled: true },
            { id: "p-2", title: "Move With Purpose", description: "Move quickly while keeping quality and long-term thinking in balance.", sortOrder: 2, enabled: true },
            { id: "p-3", title: "Take Ownership", description: "Own problems end-to-end â€” from idea to outcome, without waiting to be asked.", sortOrder: 3, enabled: true },
            { id: "p-4", title: "Keep Learning", description: "Stay curious, share what you know and continuously improve as a team.", sortOrder: 4, enabled: true },
          ],
          enabled: true,
        },
        culture: {
          title: "Culture is how we work together.",
          description: "We believe great products come from teams that trust each other, challenge assumptions and keep learning.",
          items: [
            { id: "c-1", number: "01", title: "Customer Focus", description: "Every decision starts with the people we serve.", sortOrder: 1, enabled: true },
            { id: "c-2", number: "02", title: "Ownership", description: "We act like owners, not passengers.", sortOrder: 2, enabled: true },
            { id: "c-3", number: "03", title: "Collaboration", description: "The best ideas emerge from honest, open dialogue.", sortOrder: 3, enabled: true },
            { id: "c-4", number: "04", title: "Curiosity", description: "We ask why and keep exploring until we understand deeply.", sortOrder: 4, enabled: true },
            { id: "c-5", number: "05", title: "Long-Term Thinking", description: "We build for durability, not just speed.", sortOrder: 5, enabled: true },
            { id: "c-6", number: "06", title: "Continuous Learning", description: "We stay curious and grow through every experience.", sortOrder: 6, enabled: true },
          ],
          enabled: true,
        },
        people: {
          title: "Meet the people behind Go Experts",
          statement: "We're a team of builders, problem-solvers and people who enjoy turning difficult ideas into useful products.",
          image: "",
          imageAlt: "Go Experts team",
          testimonials: [],
          enabled: true,
        },
        benefits: {
          title: "Grow with Go Experts",
          items: [
            { id: "b-1", icon: "BookOpen", title: "Learning & Development", description: "Budget for courses, conferences, books and certifications to keep growing.", sortOrder: 1, enabled: true },
            { id: "b-2", icon: "TrendingUp", title: "Professional Growth", description: "Clear paths to grow your career with mentorship, feedback and honest conversations.", sortOrder: 2, enabled: true },
            { id: "b-3", icon: "Layers", title: "Flexible Work", description: "Outcome-driven culture with flexibility on where and when you do your best work.", sortOrder: 3, enabled: true },
            { id: "b-4", icon: "Users", title: "Team Collaboration", description: "Work closely with a diverse, talented and genuinely supportive team.", sortOrder: 4, enabled: true },
            { id: "b-5", icon: "Target", title: "Meaningful Ownership", description: "Real responsibility and direct impact on the product from day one.", sortOrder: 5, enabled: true },
            { id: "b-6", icon: "Heart", title: "Team Activities", description: "Regular team moments â€” both remote and in person.", sortOrder: 6, enabled: true },
          ],
          enabled: true,
        },
        cta: {
          heading: "Build something that matters.",
          description: "Explore what we're building and discover where you could contribute to the future of professional work.",
          primaryLabel: "Explore Go Experts",
          primaryUrl: "/",
          secondaryLabel: "Visit Go Experts",
          secondaryUrl: "/about",
          enabled: true,
        },
        seo: {
          metaTitle: "Careers at Go Experts | Build the Future of Work",
          metaDescription: "Explore careers at Go Experts and discover opportunities to build products, solve meaningful problems and shape the future of professional work.",
          canonicalUrl: "https://goexperts.in/careers",
          ogTitle: "Careers at Go Experts | Build the Future of Work",
          ogDescription: "Explore careers at Go Experts and discover opportunities to build products, solve meaningful problems and shape the future of professional work.",
          robotsIndex: "index, follow",
        },
      };

      const payloadStr = JSON.stringify(initialPayload);
      page = await prisma.cmsPage.create({
        data: {
          name: PAGE_NAME,
          category: PAGE_CATEGORY,
          status: "active",
          draftJson: payloadStr,
          publishedJson: payloadStr,
          version: 1,
          publishedAt: new Date(),
          publishedBy: "System",
          content: payloadStr,
        },
      });
    }

    return page;
  }

  /**
   * Public: Get Careers Page Payload
   */
  async getPublicCareersPage() {
    const page = await this.getOrCreatePage();
    let contentStr = page.publishedJson || page.content || page.draftJson || "";
    let parsed: any = null;

    try {
      if (contentStr && contentStr.trim().startsWith("{")) {
        parsed = JSON.parse(contentStr);
      }
    } catch {
      parsed = null;
    }

    if (parsed) {
      return { success: true, data: parsed };
    }

    return {
      success: true,
      data: {
        contentType: "html",
        content: contentStr,
      },
    };
  }

  /**
   * Admin: Get Careers CMS Page
   */
  async getAdminCareersPage() {
    const page = await this.getOrCreatePage();
    let draftData: any = null;
    let publishedData: any = null;

    try {
      if (page.draftJson) draftData = JSON.parse(page.draftJson);
    } catch {}

    try {
      if (page.publishedJson) publishedData = JSON.parse(page.publishedJson);
    } catch {}

    return {
      pageId: page.id,
      name: page.name,
      category: page.category,
      status: page.status,
      version: page.version,
      updatedAt: page.updatedAt,
      publishedAt: page.publishedAt,
      draftContent: draftData,
      publishedContent: publishedData,
    };
  }

  /**
   * Admin: Save Careers Page Draft
   */
  async saveCareersDraft(payload: any) {
    const page = await this.getOrCreatePage();
    const str = JSON.stringify(payload);

    const updated = await prisma.cmsPage.update({
      where: { id: page.id },
      data: { draftJson: str, updated: new Date().toISOString().slice(0, 10) },
    });

    return { success: true, pageId: updated.id, version: updated.version };
  }

  /**
   * Admin: Publish Careers Page
   */
  async publishCareersPage(payload: any, adminName: string = "Admin") {
    const page = await this.getOrCreatePage();
    const str = JSON.stringify(payload);
    const newVersion = (page.version || 1) + 1;

    const updated = await prisma.cmsPage.update({
      where: { id: page.id },
      data: {
        draftJson: str,
        publishedJson: str,
        content: str,
        version: newVersion,
        status: "active",
        publishedAt: new Date(),
        publishedBy: adminName,
        updated: new Date().toISOString().slice(0, 10),
      },
    });

    return { success: true, pageId: updated.id, version: newVersion };
  }

  /* ============================================================ */
  /* ðŸ’¼ JOB OPENINGS METHODS                                      */
  /* ============================================================ */

  /**
   * Helper to seed initial jobs if empty
   */
  private async seedDefaultJobsIfEmpty() {
    const count = await prisma.jobOpening.count({ where: { deletedAt: null } });
    if (count === 0) {
      const defaults = [
        {
          title: "Senior Product Engineer",
          slug: "senior-product-engineer",
          jobCode: "JOB-ENG-001",
          department: "Engineering",
          category: "Software Development",
          location: "Remote (Global)",
          workplaceType: "remote",
          employmentType: "full_time",
          experienceLevel: "senior",
          minExperience: 5,
          maxExperience: 8,
          openings: 2,
          salaryMin: 120000,
          salaryMax: 160000,
          currency: "USD",
          salaryVisibility: true,
          shortSummary: "Lead the full-stack architecture of our core Web & API platforms using React, Node.js, and TypeScript.",
          fullDescription: "We are seeking a Senior Product Engineer to lead the architecture and development of our core web ecosystem...",
          responsibilities: "â€¢ Architect scalable web services\nâ€¢ Collaborate with Product & Design\nâ€¢ Maintain high unit test coverage",
          requirements: "â€¢ 5+ years with React and TypeScript\nâ€¢ Experience building REST/GraphQL APIs\nâ€¢ High autonomy",
          benefits: "â€¢ Top tier salary & equity\nâ€¢ $1,500 annual learning budget\nâ€¢ Flexible remote work",
          status: "published",
          featured: true,
        },
        {
          title: "Product Designer (Design Systems)",
          slug: "product-designer-design-systems",
          jobCode: "JOB-DES-002",
          department: "Design",
          category: "UI/UX Design",
          location: "Bengaluru, India / Hybrid",
          workplaceType: "hybrid",
          employmentType: "full_time",
          experienceLevel: "mid_level",
          minExperience: 3,
          maxExperience: 6,
          openings: 1,
          salaryMin: 40000,
          salaryMax: 65000,
          currency: "USD",
          salaryVisibility: true,
          shortSummary: "Craft intuitive, world-class design systems and component libraries across web and mobile surfaces.",
          fullDescription: "Join our core design team to establish and evolve the Go Experts Design System...",
          responsibilities: "â€¢ Evolve component guidelines in Figma\nâ€¢ Conduct user research & usability testing\nâ€¢ Partner with frontend engineers",
          requirements: "â€¢ 3+ years in SaaS product design\nâ€¢ Mastery of Figma & prototyping\nâ€¢ Portfolio demonstrating systems thinking",
          benefits: "â€¢ Premium health insurance\nâ€¢ Modern hardware of choice",
          status: "published",
          featured: true,
        },
        {
          title: "Trust & Safety Lead",
          slug: "trust-and-safety-lead",
          jobCode: "JOB-TRU-003",
          department: "Trust & Operations",
          category: "Risk & Verification",
          location: "Singapore / Remote",
          workplaceType: "remote",
          employmentType: "full_time",
          experienceLevel: "lead",
          minExperience: 6,
          maxExperience: 10,
          openings: 1,
          salaryMin: 90000,
          salaryMax: 130000,
          currency: "USD",
          salaryVisibility: true,
          shortSummary: "Lead platform risk mitigation, identity verification protocols, and payment dispute resolution.",
          fullDescription: "We are hiring a Trust & Safety Lead to protect our global marketplace...",
          responsibilities: "â€¢ Define KYC/AML verification policies\nâ€¢ Oversee dispute resolution workflows\nâ€¢ Manage risk analytics",
          requirements: "â€¢ 6+ years in marketplace or Fintech risk management\nâ€¢ Strong knowledge of regulatory compliance",
          benefits: "â€¢ Equity options\nâ€¢ Unlimited PTO policy",
          status: "published",
          featured: false,
        },
      ];

      for (const job of defaults) {
        await prisma.jobOpening.create({ data: job });
      }
    }
  }

  /**
   * Public: List Active Published Jobs with filters
   */
  async listPublicJobs(filters: { search?: string; department?: string; location?: string; workplaceType?: string; employmentType?: string }) {
    await this.seedDefaultJobsIfEmpty();

    const where: any = {
      status: "published",
      deletedAt: null,
    };

    if (filters.department && filters.department !== "all") {
      where.department = { equals: filters.department };
    }
    if (filters.location && filters.location !== "all") {
      where.location = { contains: filters.location };
    }
    if (filters.workplaceType && filters.workplaceType !== "all") {
      where.workplaceType = filters.workplaceType;
    }
    if (filters.employmentType && filters.employmentType !== "all") {
      where.employmentType = filters.employmentType;
    }
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { title: { contains: q } },
        { shortSummary: { contains: q } },
        { department: { contains: q } },
      ];
    }

    const jobs = await prisma.jobOpening.findMany({
      where,
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    });

    return { success: true, count: jobs.length, data: jobs };
  }

  /**
   * Public: Get Single Job by Slug
   */
  async getPublicJobBySlug(slug: string) {
    await this.seedDefaultJobsIfEmpty();

    const job = await prisma.jobOpening.findFirst({
      where: {
        slug: { equals: slug },
        deletedAt: null,
      },
    });

    if (!job) {
      throw new Error(`Job position '${slug}' not found or is no longer open.`);
    }

    return { success: true, data: job };
  }

  /**
   * Admin: List Jobs with server-side pagination & stats
   */
  async listAdminJobs(params: { page?: number; pageSize?: number; search?: string; status?: string; department?: string }) {
    await this.seedDefaultJobsIfEmpty();

    const page = Number(params.page || 1);
    const pageSize = Number(params.pageSize || 20);
    const skip = (page - 1) * pageSize;

    const where: any = { deletedAt: null };

    if (params.status && params.status !== "all") {
      where.status = params.status;
    }
    if (params.department && params.department !== "all") {
      where.department = params.department;
    }
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { title: { contains: q } },
        { jobCode: { contains: q } },
        { department: { contains: q } },
      ];
    }

    const [total, rows, activeCount, draftCount, closedCount, totalApps] = await Promise.all([
      prisma.jobOpening.count({ where }),
      prisma.jobOpening.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.jobOpening.count({ where: { deletedAt: null, status: "published" } }),
      prisma.jobOpening.count({ where: { deletedAt: null, status: "draft" } }),
      prisma.jobOpening.count({ where: { deletedAt: null, status: "closed" } }),
      prisma.careerApplication.count({ where: { deletedAt: null } }),
    ]);

    return {
      success: true,
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: {
        active: activeCount,
        draft: draftCount,
        closed: closedCount,
        totalApplications: totalApps,
      },
    };
  }

  /**
   * Admin: Create Job Opening
   */
  async createJob(data: any) {
    if (!data.title || !data.department || !data.location || !data.shortSummary || !data.fullDescription) {
      throw new Error("Job Title, Department, Location, Short Summary, and Full Description are required.");
    }

    const baseSlug = slugify(data.title);
    let uniqueSlug = baseSlug;
    let counter = 1;

    while (await prisma.jobOpening.findFirst({ where: { slug: uniqueSlug } })) {
      uniqueSlug = `${baseSlug}-${counter}`;
      counter++;
    }

    const job = await prisma.jobOpening.create({
      data: {
        title: data.title.trim(),
        slug: uniqueSlug,
        jobCode: data.jobCode?.trim() || `JOB-${Date.now().toString().slice(-4)}`,
        department: data.department.trim(),
        category: data.category?.trim() || null,
        location: data.location.trim(),
        workplaceType: data.workplaceType || "hybrid",
        employmentType: data.employmentType || "full_time",
        experienceLevel: data.experienceLevel || "mid_level",
        minExperience: data.minExperience ? Number(data.minExperience) : null,
        maxExperience: data.maxExperience ? Number(data.maxExperience) : null,
        openings: Number(data.openings || 1),
        salaryMin: data.salaryMin ? Number(data.salaryMin) : null,
        salaryMax: data.salaryMax ? Number(data.salaryMax) : null,
        currency: data.currency || "USD",
        salaryVisibility: Boolean(data.salaryVisibility),
        shortSummary: data.shortSummary.trim(),
        fullDescription: data.fullDescription.trim(),
        responsibilities: data.responsibilities?.trim() || null,
        requirements: data.requirements?.trim() || null,
        preferredQualifications: data.preferredQualifications?.trim() || null,
        benefits: data.benefits?.trim() || null,
        status: data.status || "published",
        featured: Boolean(data.featured),
      },
    });

    return { success: true, data: job };
  }

  /**
   * Admin: Update Job Opening
   */
  async updateJob(id: string, data: any) {
    const existing = await prisma.jobOpening.findUnique({ where: { id } });
    if (!existing) throw new Error("Job opening not found.");

    const updated = await prisma.jobOpening.update({
      where: { id },
      data: {
        title: data.title ? data.title.trim() : existing.title,
        department: data.department ? data.department.trim() : existing.department,
        location: data.location ? data.location.trim() : existing.location,
        workplaceType: data.workplaceType || existing.workplaceType,
        employmentType: data.employmentType || existing.employmentType,
        experienceLevel: data.experienceLevel || existing.experienceLevel,
        minExperience: data.minExperience !== undefined ? Number(data.minExperience) : existing.minExperience,
        maxExperience: data.maxExperience !== undefined ? Number(data.maxExperience) : existing.maxExperience,
        openings: data.openings !== undefined ? Number(data.openings) : existing.openings,
        salaryMin: data.salaryMin !== undefined ? Number(data.salaryMin) : existing.salaryMin,
        salaryMax: data.salaryMax !== undefined ? Number(data.salaryMax) : existing.salaryMax,
        currency: data.currency || existing.currency,
        salaryVisibility: data.salaryVisibility !== undefined ? Boolean(data.salaryVisibility) : existing.salaryVisibility,
        shortSummary: data.shortSummary ? data.shortSummary.trim() : existing.shortSummary,
        fullDescription: data.fullDescription ? data.fullDescription.trim() : existing.fullDescription,
        responsibilities: data.responsibilities !== undefined ? data.responsibilities : existing.responsibilities,
        requirements: data.requirements !== undefined ? data.requirements : existing.requirements,
        benefits: data.benefits !== undefined ? data.benefits : existing.benefits,
        status: data.status || existing.status,
        featured: data.featured !== undefined ? Boolean(data.featured) : existing.featured,
      },
    });

    return { success: true, data: updated };
  }

  /**
   * Admin: Delete Job
   */
  async deleteJob(id: string) {
    await prisma.jobOpening.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });
    return { success: true, message: "Job archived successfully." };
  }

  /* ============================================================ */
  /* ðŸ“„ CAREER APPLICATIONS METHODS                               */
  /* ============================================================ */

  /**
   * Public: Submit Application for a Job
   */
  async submitCareerApplication(input: {
    jobId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    currentLocation?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    experienceYears?: number;
    currentCompany?: string;
    currentDesignation?: string;
    currentCtc?: string;
    expectedCtc?: string;
    noticePeriod?: string;
    preferredLocation?: string;
    coverLetter?: string;
    resumeUrl: string;
    resumeFileName?: string;
  }) {
    const job = await prisma.jobOpening.findUnique({ where: { id: input.jobId } });
    if (!job || job.status !== "published") {
      throw new Error("This job position is no longer accepting applications.");
    }

    // Duplicate check: email + jobId within 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const duplicate = await prisma.careerApplication.findFirst({
      where: {
        jobId: input.jobId,
        email: input.email.trim().toLowerCase(),
        createdAt: { gte: thirtyDaysAgo },
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new Error(`You have already submitted an application for '${job.title}' recently. Reference: ${duplicate.applicationNumber}`);
    }

    const applicationNumber = `GE-${new Date().getFullYear()}-${job.department.substring(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const application = await prisma.careerApplication.create({
      data: {
        applicationNumber,
        jobId: job.id,
        jobTitle: job.title,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        currentLocation: input.currentLocation?.trim() || null,
        linkedinUrl: input.linkedinUrl?.trim() || null,
        portfolioUrl: input.portfolioUrl?.trim() || null,
        experienceYears: input.experienceYears ? Number(input.experienceYears) : null,
        currentCompany: input.currentCompany?.trim() || null,
        currentDesignation: input.currentDesignation?.trim() || null,
        currentCtc: input.currentCtc?.trim() || null,
        expectedCtc: input.expectedCtc?.trim() || null,
        noticePeriod: input.noticePeriod?.trim() || null,
        preferredLocation: input.preferredLocation?.trim() || null,
        coverLetter: input.coverLetter?.trim() || null,
        resumeUrl: input.resumeUrl.trim(),
        resumeFileName: input.resumeFileName || "Resume.pdf",
        status: "new",
        activities: {
          create: {
            action: "Application Submitted",
            createdBy: "system"
          }
        }
      },
      include: {
        activities: true
      }
    });

    // Increment application count on Job
    await prisma.jobOpening.update({
      where: { id: job.id },
      data: { applicationsCount: { increment: 1 } },
    });

    return {
      success: true,
      applicationNumber: application.applicationNumber,
      message: `Application submitted successfully! Your application reference number is ${application.applicationNumber}.`,
    };
  }

  /**
   * Admin: List Career Applications with server-side pagination & filters
   */
  async listCareerApplications(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    jobId?: string;
  }) {
    const page = Number(params.page || 1);
    const pageSize = Number(params.pageSize || 20);
    const skip = (page - 1) * pageSize;

    const where: any = { deletedAt: null };

    if (params.status && params.status !== "all") {
      where.status = params.status;
    }
    if (params.jobId && params.jobId !== "all") {
      where.jobId = params.jobId;
    }
    if (params.search) {
      const q = params.search.trim();
      where.OR = [
        { applicationNumber: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
        { jobTitle: { contains: q } },
      ];
    }

    const [total, rows, newCount, reviewCount, shortlistedCount, hiredCount] = await Promise.all([
      prisma.careerApplication.count({ where }),
      prisma.careerApplication.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.careerApplication.count({ where: { deletedAt: null, status: "new" } }),
      prisma.careerApplication.count({ where: { deletedAt: null, status: "under_review" } }),
      prisma.careerApplication.count({ where: { deletedAt: null, status: "shortlisted" } }),
      prisma.careerApplication.count({ where: { deletedAt: null, status: "hired" } }),
    ]);

    return {
      success: true,
      rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      stats: {
        new: newCount,
        underReview: reviewCount,
        shortlisted: shortlistedCount,
        hired: hiredCount,
      },
    };
  }

  /**
   * Admin: Get Single Career Application Detail
   */
  async getCareerApplicationById(id: string) {
    const app = await prisma.careerApplication.findUnique({
      where: { id },
      include: {
        job: true,
        activities: {
          orderBy: { createdAt: 'desc' }
        },
        emailLogs: {
          orderBy: { sentAt: 'desc' }
        }
      },
    });

    if (!app) throw new Error("Application record not found.");
    return { success: true, data: app };
  }

  /**
   * Admin: Update Career Application (status, rating, recruiter, notes)
   */
  async updateCareerApplication(
    id: string,
    updates: {
      status?: string;
      atsStage?: string;
      rating?: number;
      assignedRecruiterId?: string;
      assignedRecruiter?: string;
      internalNotes?: string;
    }
  ) {
    const dataToUpdate: any = {};
    const include: any = {};

    if (updates.status) dataToUpdate.status = updates.status;
    if (updates.rating !== undefined) dataToUpdate.rating = Number(updates.rating);
    if (updates.assignedRecruiterId !== undefined) dataToUpdate.assignedRecruiterId = updates.assignedRecruiterId;
    if (updates.assignedRecruiter !== undefined) dataToUpdate.assignedRecruiter = updates.assignedRecruiter;
    if (updates.internalNotes !== undefined) dataToUpdate.internalNotes = updates.internalNotes;

    if (updates.atsStage) {
      dataToUpdate.atsStage = updates.atsStage;
      // Log activity when stage changes
      dataToUpdate.activities = {
        create: {
          action: `Moved to ${updates.atsStage}`,
          createdBy: "admin"
        }
      };
      include.activities = true;
    }

    const updated = await prisma.careerApplication.update({
      where: { id },
      data: dataToUpdate,
      include
    });

    return { success: true, data: updated };
  }
}

export const careersCmsService = new CareersCmsService();
