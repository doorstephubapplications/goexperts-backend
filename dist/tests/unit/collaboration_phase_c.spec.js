import { describe, it, expect, vi, beforeEach } from "vitest";
import { escalateMilestoneDispute } from "../../controllers/workflows/workflows.controller.js";
import { putFreelancerResume } from "../../controllers/freelancer/freelancer-extra.controller.js";
import { prisma } from "../../config/database.js";
import { NotificationService } from "../../modules/notifications/notification.service.js";
describe("Phase C: Collaboration, Resume Workspace & Admin Session Completion", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.spyOn(prisma.clientTeamMember, "findFirst").mockResolvedValue(null);
        vi.spyOn(prisma.adminUser, "findFirst").mockResolvedValue({ id: "admin-1" });
        vi.spyOn(prisma.activityLog, "create").mockResolvedValue({});
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
            vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(pendingMilestone);
            vi.spyOn(prisma.user, "findUnique").mockResolvedValue(clientUser);
            vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectActive);
            vi.spyOn(prisma.clientTeamMember, "findFirst").mockResolvedValue(null);
            vi.spyOn(prisma.contract, "findFirst").mockResolvedValue(null);
            const updatedMs = { ...pendingMilestone, status: "Disputed" };
            vi.spyOn(prisma.milestone, "update").mockResolvedValue(updatedMs);
            vi.spyOn(prisma.supportTicket, "create").mockResolvedValue({ id: "ticket-xyz-1" });
            vi.spyOn(prisma.auditLog, "create").mockResolvedValue({});
            vi.spyOn(prisma.user, "findFirst").mockResolvedValue(freelancerUser);
            const notifySpy = vi.spyOn(NotificationService, "enqueue").mockResolvedValue({});
            const req = {
                user: { id: clientUser.id },
                params: { id: "ms-1" },
                body: { reason: "Deliverables do not match contract requirements", description: "Missing responsive mockups" },
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await escalateMilestoneDispute(req, res, next);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                milestone: expect.objectContaining({ status: "Disputed" }),
                ticketId: "ticket-xyz-1",
            }));
            expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
                userId: freelancerUser.id,
                title: "Milestone Dispute Escalation",
            }));
        });
        it("ALLOWS hired Freelancer to escalate a milestone under repeated change requests", async () => {
            const disputedChangeMs = {
                ...pendingMilestone,
                status: "Changes Requested",
            };
            vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(disputedChangeMs);
            vi.spyOn(prisma.user, "findUnique").mockResolvedValue(freelancerUser);
            vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectActive);
            vi.spyOn(prisma.contract, "findFirst").mockResolvedValue({ id: "contract-1" });
            const updatedMs = { ...disputedChangeMs, status: "Disputed" };
            vi.spyOn(prisma.milestone, "update").mockResolvedValue(updatedMs);
            vi.spyOn(prisma.supportTicket, "create").mockResolvedValue({ id: "ticket-xyz-2" });
            vi.spyOn(prisma.auditLog, "create").mockResolvedValue({});
            vi.spyOn(prisma.user, "findFirst").mockResolvedValue(clientUser);
            const notifySpy = vi.spyOn(NotificationService, "enqueue").mockResolvedValue({});
            const req = {
                user: { id: freelancerUser.id },
                params: { id: "ms-1" },
                body: { reason: "Excessive scope revision requests beyond agreed deliverables" },
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await escalateMilestoneDispute(req, res, next);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                milestone: expect.objectContaining({ status: "Disputed" }),
                ticketId: "ticket-xyz-2",
            }));
            expect(notifySpy).toHaveBeenCalledWith(expect.objectContaining({
                userId: clientUser.id,
                title: "Milestone Dispute Escalation",
            }));
        });
        it("DENIES unrelated stranger from escalating milestone (403 Forbidden)", async () => {
            vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(pendingMilestone);
            vi.spyOn(prisma.user, "findUnique").mockResolvedValue(strangerUser);
            vi.spyOn(prisma.project, "findFirst").mockResolvedValue(projectActive);
            vi.spyOn(prisma.clientTeamMember, "findFirst").mockResolvedValue(null);
            vi.spyOn(prisma.contract, "findFirst").mockResolvedValue(null);
            const req = {
                user: { id: strangerUser.id },
                params: { id: "ms-1" },
                body: { reason: "Malicious escalation" },
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await escalateMilestoneDispute(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringContaining("Only project participants"),
            }));
        });
        it("PREVENTS cross-project IDOR when body projectId does not match canonical milestone projectId", async () => {
            vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(pendingMilestone);
            const req = {
                user: { id: clientUser.id },
                params: { id: "ms-1" },
                body: { reason: "IDOR Attempt", projectId: "proj-different-victim" },
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await escalateMilestoneDispute(req, res, next);
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringContaining("does not belong to specified project"),
            }));
        });
        it("REJECTS duplicate escalation when milestone is already Disputed (409 Conflict)", async () => {
            const alreadyDisputedMs = { ...pendingMilestone, status: "Disputed" };
            vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(alreadyDisputedMs);
            const req = {
                user: { id: clientUser.id },
                params: { id: "ms-1" },
                body: { reason: "Clicking button twice" },
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await escalateMilestoneDispute(req, res, next);
            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringContaining("already in dispute status"),
            }));
        });
        it("REJECTS escalation on completed milestone (400 Bad Request)", async () => {
            const completedMs = { ...pendingMilestone, status: "Completed" };
            vi.spyOn(prisma.milestone, "findUnique").mockResolvedValue(completedMs);
            const req = {
                user: { id: clientUser.id },
                params: { id: "ms-1" },
                body: { reason: "Trying to dispute finalized work" },
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await escalateMilestoneDispute(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringContaining("Completed milestones cannot be escalated"),
            }));
        });
        it("REJECTS escalation if reason is empty or missing (400 Bad Request)", async () => {
            const req = {
                user: { id: clientUser.id },
                params: { id: "ms-1" },
                body: { reason: "   " },
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await escalateMilestoneDispute(req, res, next);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: expect.stringContaining("reason is required"),
            }));
        });
        it("RETURNS 401 when request is unauthenticated", async () => {
            const req = {
                user: null,
                params: { id: "ms-1" },
                body: { reason: "Unauthenticated call" },
            };
            const res = {
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
            vi.spyOn(prisma.user, "findUnique").mockResolvedValue(user);
            vi.spyOn(prisma.setting, "findUnique").mockResolvedValue({
                id: "setting-1",
                key: "resume:free-user-1",
                value: JSON.stringify({ configVersion: 2, template: "modern" }),
            });
            const setSettingSpy = vi.spyOn(prisma.setting, "upsert").mockResolvedValue({});
            vi.spyOn(prisma.user, "update").mockResolvedValue(user);
            const req = {
                user: { id: "free-user-1" },
                body: {
                    template: "professional",
                    sections: { experience: true, education: true, skills: true },
                    headline: "Senior Staff Engineer",
                    summary: "Over 10 years of distributed systems engineering.",
                },
            };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await putFreelancerResume(req, res, next);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    configVersion: 3,
                    template: "professional",
                    headline: "Senior Staff Engineer",
                }),
            }));
            expect(setSettingSpy).toHaveBeenCalledWith(expect.objectContaining({
                where: { key: "portal:free-user-1:resume" },
            }));
        });
        it("DENIES unauthenticated caller from updating resume config", async () => {
            const req = { user: null, body: {} };
            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn(),
            };
            const next = vi.fn();
            await putFreelancerResume(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
        });
    });
});
