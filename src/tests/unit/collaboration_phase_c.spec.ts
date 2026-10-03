import { describe, it, expect, vi, beforeEach } from "vitest";
import { escalateMilestoneDispute } from "../../controllers/workflows/workflows.controller.js";
import { putFreelancerResume, getFreelancerResume } from "../../controllers/freelancer/freelancer-extra.controller.js";
import { prisma } from "../../config/database.js";
import { NotificationService } from "../../modules/notifications/notification.service.js";

describe("Phase C: Collaboration, Resume Workspace & Admin Session Completion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.clientTeamMember, "findFirst").mockResolvedValue(null);
    vi.spyOn(prisma.adminUser, "findFirst").mockResolvedValue({ id: "admin-1" } as any);
    vi.spyOn(prisma.activityLog, "create").mockResolvedValue({} as any);
  });

  // ==========================================================================
  // PART I: MILESTONE DISPUTE / ESCALATION LIFECYCLE & AUTHORIZATION
  // ==========================================================================
  describe("Milestone Dispute / Escalation Engine", () => {
    const clientUser = { id: "user-client-1", role: "client", fullName: "Acme Client", email: "client@acme.com" };
    const freelancerUser = { id: "user-free-1", role: "freelancer", fullName: "Dev Freelancer", email: "dev@expert.com" };
    const strangerUser = { id: "user-stranger-9", role: "freelancer", fullName: "Stranger Danger", email: "stranger@other.com" };

    const projectActive = {
      id: "proj-100",
      title: "FinTech Mobile App",
      client: "user-client-1",
      freelancer: "user-free-1",
      status: "in_progress",
      deletedAt: null,
      contracts: [
        { id: "contract-1", status: "active", freelancerId: "user-free-1", clientId: "user-client-1" },
      ],
    };

    const pendingMilestone = {
      id: "ms-1",
      projectId: "proj-100",
      title: "UI Design Handover",
      status: "Submitted",
      dueDate: "2026-11-01",
      project: projectActive,
    };

    it("ALLOWS project-owning Client to escalate a submitted milestone for dispute mediation", async () => {
      vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(pendingMilestone as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(clientUser as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectActive as any);
      vi.spyOn(prisma.clientTeamMember, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.contract, "findFirst").mockResolvedValue(null);

      const updatedMs = { ...pendingMilestone, status: "Disputed" };
      vi.spyOn(prisma.milestone, "update").mockResolvedValue(updatedMs as any);
      vi.spyOn(prisma.supportTicket, "create").mockResolvedValue({ id: "ticket-xyz-1" } as any);
      vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(freelancerUser as any);
      const notifySpy = vi.spyOn(NotificationService, "enqueue").mockResolvedValue({} as any);

      const req: any = {
        user: { id: clientUser.id },
        params: { id: "ms-1" },
        body: { reason: "Deliverables do not match contract requirements", description: "Missing responsive mockups" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await escalateMilestoneDispute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          milestone: expect.objectContaining({ status: "Disputed" }),
          ticketId: "ticket-xyz-1",
        })
      );
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: freelancerUser.id,
          title: "Milestone Dispute Escalation",
        })
      );
    });

    it("ALLOWS hired Freelancer to escalate a milestone under repeated change requests", async () => {
      const disputedChangeMs = {
        ...pendingMilestone,
        status: "Changes Requested",
      };
      vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(disputedChangeMs as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(freelancerUser as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectActive as any);
      vi.spyOn(prisma.contract, "findFirst").mockResolvedValue({ id: "contract-1" } as any);

      const updatedMs = { ...disputedChangeMs, status: "Disputed" };
      vi.spyOn(prisma.milestone, "update").mockResolvedValue(updatedMs as any);
      vi.spyOn(prisma.supportTicket, "create").mockResolvedValue({ id: "ticket-xyz-2" } as any);
      vi.spyOn(prisma.auditLog, "create").mockResolvedValue({} as any);
      vi.spyOn(prisma.user, "findFirst").mockResolvedValue(clientUser as any);
      const notifySpy = vi.spyOn(NotificationService, "enqueue").mockResolvedValue({} as any);

      const req: any = {
        user: { id: freelancerUser.id },
        params: { id: "ms-1" },
        body: { reason: "Excessive scope revision requests beyond agreed deliverables" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await escalateMilestoneDispute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          milestone: expect.objectContaining({ status: "Disputed" }),
          ticketId: "ticket-xyz-2",
        })
      );
      expect(notifySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: clientUser.id,
          title: "Milestone Dispute Escalation",
        })
      );
    });

    it("DENIES unrelated stranger from escalating milestone (403 Forbidden)", async () => {
      vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(pendingMilestone as any);
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(strangerUser as any);
      vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectActive as any);
      vi.spyOn(prisma.clientTeamMember, "findFirst").mockResolvedValue(null);
      vi.spyOn(prisma.contract, "findFirst").mockResolvedValue(null);

      const req: any = {
        user: { id: strangerUser.id },
        params: { id: "ms-1" },
        body: { reason: "Malicious escalation" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await escalateMilestoneDispute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Only project participants"),
        })
      );
    });

    it("PREVENTS cross-project IDOR when body projectId does not match canonical milestone projectId", async () => {
      vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(pendingMilestone as any);

      const req: any = {
        user: { id: clientUser.id },
        params: { id: "ms-1" },
        body: { reason: "IDOR Attempt", projectId: "proj-different-victim" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await escalateMilestoneDispute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("does not belong to specified project"),
        })
      );
    });

    it("REJECTS duplicate escalation when milestone is already Disputed (409 Conflict)", async () => {
      const alreadyDisputedMs = { ...pendingMilestone, status: "Disputed" };
      vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(alreadyDisputedMs as any);

      const req: any = {
        user: { id: clientUser.id },
        params: { id: "ms-1" },
        body: { reason: "Clicking button twice" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await escalateMilestoneDispute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("already in dispute status"),
        })
      );
    });

    it("REJECTS escalation on completed milestone (400 Bad Request)", async () => {
      const completedMs = { ...pendingMilestone, status: "Completed" };
      vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(completedMs as any);

      const req: any = {
        user: { id: clientUser.id },
        params: { id: "ms-1" },
        body: { reason: "Trying to dispute finalized work" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await escalateMilestoneDispute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("Completed milestones cannot be escalated"),
        })
      );
    });

    it("REJECTS escalation if reason is empty or missing (400 Bad Request)", async () => {
      const req: any = {
        user: { id: clientUser.id },
        params: { id: "ms-1" },
        body: { reason: "   " },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await escalateMilestoneDispute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining("reason is required"),
        })
      );
    });

    it("RETURNS 401 when request is unauthenticated", async () => {
      const req: any = {
        user: null,
        params: { id: "ms-1" },
        body: { reason: "Unauthenticated call" },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await escalateMilestoneDispute(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // ==========================================================================
  // PART II: RESUME BUILDER SERVER PERSISTENCE & VERSIONING
  // ==========================================================================
  describe("Resume Builder Server Persistence", () => {
    it("INCREMENTS configVersion and persists configuration cleanly", async () => {
      const user = { id: "free-user-1", fullName: "John Doe", registrationData: null };
      vi.spyOn(prisma.user, "findUnique").mockResolvedValue(user as any);
      vi.spyOn(prisma.setting, "findUnique").mockResolvedValue({
        id: "setting-1",
        key: "resume:free-user-1",
        value: JSON.stringify({ configVersion: 2, template: "modern" }),
      } as any);
      const setSettingSpy = vi.spyOn(prisma.setting, "upsert").mockResolvedValue({} as any);
      vi.spyOn(prisma.user, "update").mockResolvedValue(user as any);

      const req: any = {
        user: { id: "free-user-1" },
        body: {
          template: "professional",
          sections: { experience: true, education: true, skills: true },
          headline: "Senior Staff Engineer",
          summary: "Over 10 years of distributed systems engineering.",
        },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await putFreelancerResume(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            configVersion: 3,
            template: "professional",
            headline: "Senior Staff Engineer",
          }),
        })
      );
      expect(setSettingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: "portal:free-user-1:resume" },
        })
      );
    });

    it("DENIES unauthenticated caller from updating resume config", async () => {
      const req: any = { user: null, body: {} };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      await putFreelancerResume(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });
});
