import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  assertProjectParticipant,
  assertMediaFileAccess,
  assertMediaFileDelete,
} from "../../services/projects/project-authorization.service.js";
import {
  assertAndConsumeActionQuota,
  ActionGateError,
} from "../../services/subscription/entitlement.service.js";
import { contactRateLimitHandler } from "../../middlewares/contact-limiter.middleware.js";
import { contactCmsService } from "../../services/admin/contact.service.js";
import { prisma } from "../../config/database.js";

describe("Phase A: Security, Authorization & Core Data-Integrity Hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.clientTeamMember, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.subscriptionUsage, "findUnique").mockResolvedValue(null);
  });

  // ==========================================================================
  // PART I: FIND-P1-03 — PROJECT ATTACHMENT IDOR VERIFICATION
  // ==========================================================================
  describe("FIND-P1-03: Project Attachment IDOR Defense & Participant Authorization", () => {
    const clientA = { id: "user-client-a", role: "client", fullName: "Alice Client", email: "alice@clienta.com" };
    const freelancerA = { id: "user-free-a", role: "freelancer", fullName: "Bob Freelancer", email: "bob@freelancera.com" };
    const clientB = { id: "user-client-b", role: "client", fullName: "Charlie Client", email: "charlie@clientb.com" };
    const freelancerB = { id: "user-free-b", role: "freelancer", fullName: "Dana Freelancer", email: "dana@freelancerb.com" };
    const stranger = { id: "user-stranger", role: "client", fullName: "Mallory Attacker", email: "mallory@evil.com" };
    const admin = { id: "user-admin", role: "admin", fullName: "Super Admin", email: "admin@goexperts.in" };

    const projectA = { id: "proj-a", client: "user-client-a", freelancer: "user-free-a", title: "Project Alpha", deletedAt: null };
    const projectB = { id: "proj-b", client: "user-client-b", freelancer: "user-free-b", title: "Project Beta", deletedAt: null };

    const mediaA = {
      id: "media-a",
      filename: "alpha_spec.pdf",
      filepath: "/uploads/alpha_spec.pdf",
      uploadedBy: "user-client-a",
      deletedAt: null,
    };

    it("should ALLOW Client A to access Project A attachments", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(clientA as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectA as any);
      vi.spyOn(prisma.contract, "findFirst").mockResolvedValue(null);

      const result = await assertProjectParticipant({ userId: clientA.id, projectId: projectA.id });
      expect(result.isParticipant).toBe(true);
      expect(result.role).toBe("client");
    });

    it("should ALLOW Freelancer A to access Project A attachments", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(freelancerA as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectA as any);
      vi.spyOn(prisma.contract, "findFirst").mockResolvedValue({ id: "contract-a" } as any);

      const result = await assertProjectParticipant({ userId: freelancerA.id, projectId: projectA.id });
      expect(result.isParticipant).toBe(true);
      expect(result.role).toBe("freelancer");
    });

    it("should DENY Client B from accessing Project A attachments (IDOR blocked)", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(clientB as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectA as any);
      vi.spyOn(prisma.contract, "findFirst").mockResolvedValue(null);

      const result = await assertProjectParticipant({ userId: clientB.id, projectId: projectA.id });
      expect(result.isParticipant).toBe(false);
      expect(result.role).toBeNull();
    });

    it("should DENY Freelancer B from accessing Project A attachments (IDOR blocked)", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(freelancerB as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectA as any);
      vi.spyOn(prisma.contract, "findFirst").mockResolvedValue(null);

      const result = await assertProjectParticipant({ userId: freelancerB.id, projectId: projectA.id });
      expect(result.isParticipant).toBe(false);
      expect(result.role).toBeNull();
    });

    it("should DENY an unrelated authenticated stranger from accessing Project A", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(stranger as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectA as any);
      vi.spyOn(prisma.contract, "findFirst").mockResolvedValue(null);

      const result = await assertProjectParticipant({ userId: stranger.id, projectId: projectA.id });
      expect(result.isParticipant).toBe(false);
      expect(result.role).toBeNull();
    });

    it("should ALLOW Super Admin to access any project attachment via authorized RBAC", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(admin as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectA as any);

      const result = await assertProjectParticipant({ userId: admin.id, projectId: projectA.id });
      expect(result.isParticipant).toBe(true);
      expect(result.role).toBe("admin");
    });

    it("should ALLOW an active Client team member to access Project A", async () => {
      const teamMember = { id: "user-team-a", role: "client", fullName: "Eve Member", email: "eve@clienta.com" };
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(teamMember as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectA as any);
      vi.spyOn(prisma.clientTeamMember, "findFirst").mockResolvedValue({
        id: "tm-1",
        clientId: clientA.id,
        userId: teamMember.id,
        status: "Active",
      } as any);

      const result = await assertProjectParticipant({ userId: teamMember.id, projectId: projectA.id });
      expect(result.isParticipant).toBe(true);
      expect(result.role).toBe("team_member");
    });

    it("should ALLOW Uploader to delete MediaFile A, but DENY other project participants from deleting it", async () => {
      (vi.spyOn(prisma.user, "findUnique") as any).mockImplementation(async (args: any) => {
        if (args.where.id === clientA.id) return clientA as any;
        if (args.where.id === freelancerA.id) return freelancerA as any;
        return stranger as any;
      });
      vi.spyOn(prisma.mediaFile, "findUnique").mockResolvedValue(mediaA as any);

      // Uploader can delete
      const uploaderPerm = await assertMediaFileDelete(clientA.id, mediaA.id);
      expect(uploaderPerm.allowed).toBe(true);

      // Other participant cannot delete
      const participantPerm = await assertMediaFileDelete(freelancerA.id, mediaA.id);
      expect(participantPerm.allowed).toBe(false);
      expect(participantPerm.reason).toBe("forbidden");

      // Stranger cannot delete
      const strangerPerm = await assertMediaFileDelete(stranger.id, mediaA.id);
      expect(strangerPerm.allowed).toBe(false);
      expect(strangerPerm.reason).toBe("forbidden");
    });
  });

  // ==========================================================================
  // PART II: FIND-P1-04 — PROJECT POSTING QUOTA CONSISTENCY & CONCURRENCY
  // ==========================================================================
  describe("FIND-P1-04: Project Posting Quota Consistency & Transactional Concurrency", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const clientUser = {
      id: "client-sub-1",
      email: "subscriber@goexperts.in",
      role: "client",
      trialEndsAt: null,
      subscriptions: [
        {
          id: "sub-active-1",
          status: "active",
          role: "client",
          startDate: new Date(),
          endDate: futureDate,
          isTrial: false,
          plan: {
            id: "plan-client-monthly",
            name: "Client Monthly",
            code: "CLIENT_MONTHLY",
            role: "client",
            duration: "monthly",
            projectsLimit: 3,
            proposalsLimit: 0,
            features: { projects_per_month: 3, proposals_per_month: 0 },
          },
        },
      ],
    };

    it("should allow project publish when quota remains and record exactly 1 usage", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(clientUser as any);
      vi.spyOn(prisma.subscriptionUsage, "findUnique").mockResolvedValue({
        used: 0,
      } as any);
      vi.spyOn(prisma.subscriptionUsage, "upsert").mockResolvedValue({
        id: "usage-1",
        subscriptionId: "sub-active-1",
        featureKey: "projects_published",
        used: 1,
        lastUsedAt: new Date(),
      } as any);

      const res = await assertAndConsumeActionQuota(clientUser.id, "client", "publishProject");
      expect(res.entitlement.isEntitled).toBe(true);
      expect(res.quotaUsed).toBe(1);
    });

    it("should block project publish with QUOTA_EXHAUSTED when quota is reached", async () => {
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(clientUser as any);
      vi.spyOn(prisma.subscriptionUsage, "findUnique").mockResolvedValue({
        used: 3,
      } as any);

      await expect(
        assertAndConsumeActionQuota(clientUser.id, "client", "publishProject")
      ).rejects.toThrowError(ActionGateError);
    });

    it("should handle concurrency: if 1 quota remains and 2 publish requests arrive simultaneously, only 1 succeeds", async () => {
      // 1 remaining post before hit (used = 2, limit = 3)
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(clientUser as any);
      vi.spyOn(prisma.subscriptionUsage, "findUnique").mockResolvedValue({
        used: 2,
      } as any);

      let currentUsage = 2;
      (vi.spyOn(prisma.subscriptionUsage, "upsert") as any).mockImplementation(async () => {
        currentUsage += 1;
        return {
          id: "usage-1",
          subscriptionId: "sub-active-1",
          featureKey: "projects_published",
          used: currentUsage,
          lastUsedAt: new Date(),
        } as any;
      });

      const decrementSpy = (vi.spyOn(prisma.subscriptionUsage, "update") as any).mockImplementation(async () => {
        currentUsage -= 1;
        return {} as any;
      });

      // Fire 2 concurrent publish quota assertions
      const results = await Promise.allSettled([
        assertAndConsumeActionQuota(clientUser.id, "client", "publishProject"),
        assertAndConsumeActionQuota(clientUser.id, "client", "publishProject"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedError = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectedError).toBeInstanceOf(ActionGateError);
      expect(rejectedError.code).toBe("QUOTA_EXHAUSTED");

      // Verify rollback was invoked for the second request
      expect(decrementSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // PART III: FIND-P2-03 — PUBLIC CONTACT FORM RATE LIMITING & VALIDATION
  // ==========================================================================
  describe("FIND-P2-03: Public Contact Form Rate Limiting & Input Validation", () => {
    it("should reject contact message if email format is invalid", async () => {
      await expect(
        contactCmsService.submitPublicEnquiry({
          fullName: "John Doe",
          email: "invalid-email-no-at",
          subject: "Project Inquiry",
          message: "This is a legitimate message exceeding fifteen characters.",
        })
      ).rejects.toThrow("Please enter a valid email address.");
    });

    it("should reject contact message if message body is oversized (> 3000 chars)", async () => {
      const hugeMessage = "A".repeat(3050);
      await expect(
        contactCmsService.submitPublicEnquiry({
          fullName: "John Doe",
          email: "john@example.com",
          subject: "Project Inquiry",
          message: hugeMessage,
        })
      ).rejects.toThrow("Message must be between 15 and 3000 characters.");
    });

    it("should silently drop honeypot botField submissions without creating DB record or sending SMTP", async () => {
      const createSpy = vi.spyOn(prisma.contactEnquiry, "create");

      const res = await contactCmsService.submitPublicEnquiry({
        fullName: "Spam Bot",
        email: "bot@spam.com",
        subject: "Spam Offer",
        message: "Buy cheap backlinks now from our automated crawler.",
        botField: "I am a spam bot filling this hidden field",
        ipAddress: "192.168.1.100",
      });

      expect(res.success).toBe(true);
      expect(createSpy).not.toHaveBeenCalled();
    });

    it("should verify contactRateLimiter returns HTTP 429 when threshold exceeded", () => {
      const req = {
        headers: { "x-forwarded-for": "203.0.113.195" },
        socket: {},
      } as any;

      let statusCode = 200;
      let jsonPayload: any = null;
      const res = {
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        json: (data: any) => {
          jsonPayload = data;
          return res;
        },
      } as any;

      contactRateLimitHandler(req, res);

      expect(statusCode).toBe(429);
      expect(jsonPayload.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(jsonPayload.message).toBe("Too many requests. Please try again later.");
      expect(jsonPayload.retryAfterSeconds).toBe(900);
    });
  });
});
