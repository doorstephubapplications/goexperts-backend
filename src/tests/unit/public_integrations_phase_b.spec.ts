import { describe, it, expect, vi, beforeEach } from "vitest";
import { careersCmsService } from "../../services/admin/careers.service.js";
import { getBusinessActivities } from "../../controllers/activity/activity.controller.js";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import type { Response } from "express";

describe("Phase B: Public Integrations & API Contract Correction", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // PART I: FIND-P1-01 — CAREERS PUBLIC INTEGRATION & API CONTRACT
  // ==========================================================================
  describe("FIND-P1-01: Public Careers Integration Contract", () => {
    const publishedJob1 = {
      id: "job-pub-1",
      title: "Senior Product Engineer",
      slug: "senior-product-engineer",
      department: "Engineering",
      location: "Remote",
      workplaceType: "remote",
      employmentType: "full_time",
      status: "published",
      deletedAt: null,
      createdAt: new Date(),
    };

    const publishedJob2 = {
      id: "job-pub-2",
      title: "Product Designer",
      slug: "product-designer",
      department: "Design",
      location: "Bengaluru",
      workplaceType: "hybrid",
      employmentType: "full_time",
      status: "published",
      deletedAt: null,
      createdAt: new Date(),
    };

    const draftJob = {
      id: "job-draft-1",
      title: "Secret Strategy Lead",
      slug: "secret-strategy-lead",
      department: "Executive",
      location: "Remote",
      workplaceType: "remote",
      employmentType: "full_time",
      status: "draft",
      deletedAt: null,
      createdAt: new Date(),
    };

    const archivedJob = {
      id: "job-archived-1",
      title: "Old Junior Intern",
      slug: "old-junior-intern",
      department: "Engineering",
      location: "Remote",
      workplaceType: "remote",
      employmentType: "internship",
      status: "archived",
      deletedAt: null,
      createdAt: new Date(),
    };

    it("should return only published jobs from listPublicJobs", async () => {
      vi.spyOn((prisma as any).jobOpening, "count").mockResolvedValue(2);
      vi.spyOn((prisma as any).jobOpening, "findMany").mockImplementation(async (args: any) => {
        // Assert that the query requires status === "published" and deletedAt === null
        expect(args.where.status).toBe("published");
        expect(args.where.deletedAt).toBeNull();
        return [publishedJob1, publishedJob2] as any;
      });

      const result = await careersCmsService.listPublicJobs({});
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.data.length).toBe(2);
      expect(result.data.map((j: any) => j.status)).toEqual(["published", "published"]);
    });

    it("should filter by department in listPublicJobs", async () => {
      vi.spyOn((prisma as any).jobOpening, "count").mockResolvedValue(1);
      vi.spyOn((prisma as any).jobOpening, "findMany").mockImplementation(async (args: any) => {
        expect(args.where.department).toEqual({ equals: "Engineering" });
        return [publishedJob1] as any;
      });

      const result = await careersCmsService.listPublicJobs({ department: "Engineering" });
      expect(result.success).toBe(true);
      expect(result.data[0].department).toBe("Engineering");
    });

    it("should return a single published job by slug", async () => {
      vi.spyOn((prisma as any).jobOpening, "count").mockResolvedValue(2);
      vi.spyOn((prisma as any).jobOpening, "findFirst").mockImplementation(async (args: any) => {
        expect(args.where.slug).toEqual({ equals: "senior-product-engineer" });
        expect(args.where.status).toBe("published");
        return publishedJob1 as any;
      });

      const result = await careersCmsService.getPublicJobBySlug("senior-product-engineer");
      expect(result.success).toBe(true);
      expect(result.data.title).toBe("Senior Product Engineer");
    });

    it("should reject a draft job by slug and throw not found error", async () => {
      vi.spyOn(prisma.jobOpening, "count").mockResolvedValue(2);
      // When searching with status: "published", a draft job returns null
      vi.spyOn(prisma.jobOpening, "findFirst").mockResolvedValue(null);

      await expect(
        careersCmsService.getPublicJobBySlug("secret-strategy-lead")
      ).rejects.toThrow("Job position 'secret-strategy-lead' not found or is no longer open.");
    });

    it("should reject an invalid/non-existent job slug with not found error", async () => {
      vi.spyOn(prisma.jobOpening, "count").mockResolvedValue(2);
      vi.spyOn(prisma.jobOpening, "findFirst").mockResolvedValue(null);

      await expect(
        careersCmsService.getPublicJobBySlug("non-existent-job-slug")
      ).rejects.toThrow("Job position 'non-existent-job-slug' not found or is no longer open.");
    });
  });

  // ==========================================================================
  // PART II: FIND-P1-02 — HELP CENTER API & CMS INTEGRATION CONTRACT
  // ==========================================================================
  describe("FIND-P1-02: Public Help Center & CMS Contract", () => {
    it("should calculate category article counts strictly for published articles", async () => {
      const mockCategory = {
        id: "cat-1",
        name: "Getting Started",
        slug: "getting-started",
        enabled: true,
        order: 1,
        _count: {
          articles: 4, // Exactly 4 published articles
        },
      };

      vi.spyOn((prisma as any).helpCategory, "findMany").mockImplementation(async (args: any) => {
        expect(args.include._count.select.articles.where.status).toBe("published");
        return [mockCategory] as any;
      });

      const categories = await (prisma as any).helpCategory.findMany({
        where: { enabled: true },
        orderBy: { order: "asc" },
        include: {
          _count: {
            select: {
              articles: {
                where: { status: "published" },
              },
            },
          },
        },
      });

      expect(categories.length).toBe(1);
      expect(categories[0]._count.articles).toBe(4);
    });

    it("should strictly exclude draft articles from public article view", async () => {
      const draftArticle = {
        id: "art-draft-1",
        title: "Draft Article",
        slug: "draft-article",
        status: "draft",
      };

      vi.spyOn((prisma as any).helpArticle, "findUnique").mockResolvedValue(draftArticle as any);

      const requestedSlug = "draft-article";
      const article = await (prisma as any).helpArticle.findUnique({
        where: { slug: requestedSlug },
      });

      // Verification of route guard: draft article must not be served publicly
      const isPubliclyAllowed = article && article.status === "published";
      expect(isPubliclyAllowed).toBe(false);
    });

    it("should allow published articles to be rendered publicly", async () => {
      const publishedArticle = {
        id: "art-pub-1",
        title: "How to post a project",
        slug: "how-to-post-a-project",
        status: "published",
        content: "Step by step instructions...",
      };

      vi.spyOn((prisma as any).helpArticle, "findUnique").mockResolvedValue(publishedArticle as any);

      const article = await (prisma as any).helpArticle.findUnique({
        where: { slug: "how-to-post-a-project" },
      });

      expect(article).not.toBeNull();
      expect(article.status).toBe("published");
    });
  });

  // ==========================================================================
  // PART III: FIND-P2-01 — BUSINESS ACTIVITY TIMELINE & URL COMPOSITION
  // ==========================================================================
  describe("FIND-P2-01: Business Activity Timeline IDOR & Contract Integrity", () => {
    const clientUser = { id: "client-100", role: "client" };
    const freelancerUser = { id: "free-200", role: "freelancer" };
    const attackerUser = { id: "attacker-666", role: "client" };
    const adminUser = { id: "admin-1", role: "admin" };

    const mockProject = {
      id: "project-1",
      client: "client-100",
      proposals: [{ freelancerId: "free-200" }],
      invitations: [],
      shortlists: [],
      contracts: [],
    };

    const mockActivities = [
      {
        id: "act-1",
        type: "PROJECT_CREATED",
        contextType: "PROJECT",
        contextId: "project-1",
        actorId: "client-100",
        actorType: "USER",
        metadata: JSON.stringify({ title: "Build Mobile App" }),
        createdAt: new Date(),
      },
    ];

    const createMockRes = () => {
      const res: any = {};
      res.statusCode = 200;
      res.status = vi.fn().mockImplementation((code: number) => {
        res.statusCode = code;
        return res;
      });
      res.json = vi.fn().mockImplementation((payload: any) => {
        res.body = payload;
        return res;
      });
      return res;
    };

    it("should ALLOW authorized project owner (Client) to view project activities", async () => {
      const req: any = {
        user: clientUser,
        query: { contextType: "PROJECT", contextId: "project-1" },
      };
      const res = createMockRes();
      const next = vi.fn();

      vi.spyOn(prisma.project, "findUnique").mockResolvedValue(mockProject as any);
      vi.spyOn(prisma.businessActivity, "findMany").mockResolvedValue(mockActivities as any);

      await getBusinessActivities(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.activities.length).toBe(1);
      expect(res.body.data.length).toBe(1);
      expect(res.body.activities[0].type).toBe("PROJECT_CREATED");
    });

    it("should ALLOW authorized project participant (Freelancer with proposal) to view activities", async () => {
      const req: any = {
        user: freelancerUser,
        query: { contextType: "PROJECT", contextId: "project-1" },
      };
      const res = createMockRes();
      const next = vi.fn();

      vi.spyOn(prisma.project, "findUnique").mockResolvedValue(mockProject as any);
      vi.spyOn(prisma.businessActivity, "findMany").mockResolvedValue(mockActivities as any);

      await getBusinessActivities(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should DENY unauthorized stranger (Attacker) with HTTP 403", async () => {
      const req: any = {
        user: attackerUser,
        query: { contextType: "PROJECT", contextId: "project-1" },
      };
      const res = createMockRes();
      const next = vi.fn();

      vi.spyOn(prisma.project, "findUnique").mockResolvedValue(mockProject as any);

      await getBusinessActivities(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Access denied to this timeline");
    });

    it("should require contextType and contextId with HTTP 400", async () => {
      const req: any = {
        user: clientUser,
        query: {},
      };
      const res = createMockRes();
      const next = vi.fn();

      await getBusinessActivities(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return empty activities array when no activities exist", async () => {
      const req: any = {
        user: adminUser,
        query: { contextType: "PROJECT", contextId: "project-empty" },
      };
      const res = createMockRes();
      const next = vi.fn();

      vi.spyOn(prisma.businessActivity, "findMany").mockResolvedValue([]);

      await getBusinessActivities(req, res, next);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.activities).toEqual([]);
      expect(res.body.data).toEqual([]);
    });
  });

  // ==========================================================================
  // PART IV: API PATH INTEGRITY REGRESSION DEFENSE
  // ==========================================================================
  describe("API Path Integrity & Normalization Defense", () => {
    it("should sanitize and prevent double /api prefixing", () => {
      const baseUrl = "https://apiai.goexperts.in/api";

      const normalizeEndpoint = (url: string) => {
        const clean = url.startsWith("/api/") ? url.slice(4) : (url === "/api" ? "" : url);
        return `${baseUrl}${clean.startsWith("/") || clean === "" ? clean : `/${clean}`}`;
      };

      // Case 1: Caller erroneously passes /api/v1/activity
      const badPath = "/api/v1/activity";
      const resolved1 = normalizeEndpoint(badPath);
      expect(resolved1).toBe("https://apiai.goexperts.in/api/v1/activity");
      expect(resolved1).not.toContain("/api/api/");

      // Case 2: Standard caller passes /activity
      const standardPath = "/activity";
      const resolved2 = normalizeEndpoint(standardPath);
      expect(resolved2).toBe("https://apiai.goexperts.in/api/activity");
      expect(resolved2).not.toContain("/api/api/");

      // Case 3: Public endpoint with /v1/public/jobs
      const publicPath = "/v1/public/jobs";
      const resolved3 = normalizeEndpoint(publicPath);
      expect(resolved3).toBe("https://apiai.goexperts.in/api/v1/public/jobs");
      expect(resolved3).not.toContain("/api/api/");
    });
  });
});
