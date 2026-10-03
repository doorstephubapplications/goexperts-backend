import { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import { prisma } from "../../config/database.js";
import { UPLOADS_DIR } from "../../config/uploads.js";
import { NotificationService } from "../../modules/notifications/notification.service.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { requireCapability, ActionRequirementsError } from "../../services/mobile/profile-readiness.service.js";
import { assertActionEntitlement, recordActionUsage, assertAndConsumeActionQuota, ActionGateError } from "../../services/subscription/entitlement.service.js";
import { assertProjectParticipant } from "../../services/projects/project-authorization.service.js";

function toAuditString(val: any, maxLen = 3000): string | null {
  if (val == null) return null;
  try {
    const text = typeof val === "string" ? val : JSON.stringify(val);
    if (text.length <= maxLen) return text;
    return JSON.stringify({
      truncated: true,
      originalLength: text.length,
      preview: text.slice(0, maxLen - 60),
    });
  } catch {
    return null;
  }
}

// Helper for notifications & activity/audit logs
async function logWorkflowAction(params: {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}) {
  const { userId, action, entity, entityId, description, oldValue, newValue } = params;

  // 1. Create activity log
  // Since activityLog maps to adminUserId, if userId is not an adminUserId, we find an admin or use system default
  const defaultAdmin = await prisma.adminUser.findFirst().catch(() => null);
  const adminUserId = defaultAdmin?.id || (userId !== "system" ? userId : null);

  if (adminUserId) {
    try {
      await prisma.activityLog.create({
        data: {
          adminUserId,
          action: `${action}_${entity}`,
          description,
        },
      });
    } catch (err) {
      console.error("Non-fatal: ActivityLog creation failed:", err);
    }
  }

  // 2. Create audit log safely
  try {
    await prisma.auditLog.create({
      data: {
        actorId: adminUserId || null,
        action,
        entity,
        entityId,
        oldValue: toAuditString(oldValue),
        newValue: toAuditString(newValue),
        diff: oldValue && newValue ? toAuditString({ from: oldValue, to: newValue }) : null,
        ipAddress: "127.0.0.1",
      },
    });
  } catch (err) {
    console.error("Non-fatal: AuditLog creation failed:", err);
  }

  // 3. Queue notification asynchronously
  try {
    let templateCode: string | undefined;
    const variables: Record<string, any> = {
      userName: "User",
      projectTitle: "Project Title Placeholder",
      amount: "0",
      subscriptionPlan: "Plan Tier",
      meetingDate: new Date().toLocaleDateString(),
      supportTicketId: entityId,
    };

    if (entity === "Project" && action === "approve") templateCode = "PROJECT_APPROVED";
    if (entity === "Project" && action === "reject") templateCode = "PROJECT_REJECTED";
    if (entity === "Proposal" && action === "shortlist") templateCode = "PROPOSAL_SHORTLISTED";
    if (entity === "Contract" && action === "create") templateCode = "CONTRACT_CREATED";
    if (entity === "Task" && action === "assign") templateCode = "TASK_ASSIGNED";
    if (entity === "SupportTicket" && action === "create") templateCode = "SUPPORT_TICKET_CREATED";

    await NotificationService.enqueue({
      userId,
      type: entity.toLowerCase(),
      templateCode,
      title: `Workflow: ${action} on ${entity}`,
      message: description,
      channel: "omnichannel", // Enqueues for email, push, in_app
      priority: "normal",
      variables,
    });
  } catch (err) {
    console.error("Failed to enqueue workflow notification:", err);
  }
}

// ─── 1. PROJECT LIFECYCLE ──────────────────────────────────────────────────
export const approveProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const updated = await prisma.project.update({
      where: { id },
      data: { status: "approved" },
    });

    // Notify/Log
    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "approve",
      entity: "Project",
      entityId: id,
      description: `Project "${project.title}" has been approved by admin.`,
      oldValue: project,
      newValue: updated,
    });

    res.json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
};

export const rejectProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    const updated = await prisma.project.update({
      where: { id },
      data: { status: "rejected" },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "reject",
      entity: "Project",
      entityId: id,
      description: `Project "${project.title}" has been rejected.`,
      oldValue: project,
      newValue: updated,
    });

    res.json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
};

export const publishProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return res.status(404).json({ success: false, message: "Project not found" });

    // Idempotency: If already published/open, do not re-consume quota
    const currentStatus = String(project.status || "").toLowerCase();
    if (currentStatus === "published" || currentStatus === "open") {
      return res.json({ success: true, message: "Project is already published", project });
    }

    // Ensure capability and subscription entitlement are met before publishing
    try {
      await requireCapability({ userId, action: "publishProject" });
      await assertAndConsumeActionQuota(userId, "client", "publishProject");
    } catch (err: any) {
      if (err instanceof ActionRequirementsError) {
        return res.status(403).json({
          success: false,
          code: err.code,
          action: err.action,
          message: err.message,
          missing: err.missing,
        });
      }
      if (err instanceof ActionGateError) {
        return res.status(403).json({
          success: false,
          code: err.code,
          action: err.action,
          message: err.message,
          details: err.details,
        });
      }
      throw err;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { status: "published" },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "publish",
      entity: "Project",
      entityId: id,
      description: `Project "${project.title}" is now published and open for bids.`,
      oldValue: project,
      newValue: updated,
    });

    res.json({ success: true, project: updated });
  } catch (err) {
    next(err);
  }
};

export const completeProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        contracts: { where: { deletedAt: null } },
        milestones: true,
      },
    });

    if (!project || project.deletedAt) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, role: true, clientProfile: { select: { company: true } } },
    });
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });

    const clientNeedles = [user.fullName, user.email, user.clientProfile?.company]
      .map((v) => String(v || "").trim()).filter(Boolean);
    const isOwner = project.client === user.id || clientNeedles.some((n) => project.client?.includes(n));
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: "Only the project owner or administrator can mark a project as completed" });
    }

    if (project.status === "completed") {
      return res.status(409).json({ success: false, message: "Project is already completed" });
    }

    if (project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cancelled projects cannot be completed" });
    }

    // Check for milestones awaiting client review
    const pendingReviewMilestone = project.milestones.find((m) => m.status === "Submitted");
    if (pendingReviewMilestone) {
      return res.status(400).json({
        success: false,
        message: `Milestone "${pendingReviewMilestone.title}" is currently submitted for review. Please review all submitted milestones before completing the project.`,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedProject = await tx.project.update({
        where: { id },
        data: { status: "completed" },
      });

      const updatedContracts = await tx.contract.updateMany({
        where: {
          projectId: id,
          deletedAt: null,
          status: { in: ["active", "pending_acceptance", "draft"] },
        },
        data: { status: "completed" },
      });

      return { updatedProject, updatedContracts };
    });

    await logWorkflowAction({
      userId,
      action: "complete",
      entity: "Project",
      entityId: id,
      description: `Project "${project.title}" completed by client ${user.fullName}.`,
      oldValue: { status: project.status },
      newValue: { status: "completed" },
    });

    // Notify the contracted freelancer(s)
    const activeContract = project.contracts.find((c) => c.status === "active" || c.status === "pending_acceptance") || project.contracts[0];
    if (activeContract?.freelancerId && activeContract.freelancerId !== userId) {
      await NotificationService.enqueue({
        userId: activeContract.freelancerId,
        type: "project",
        title: "Project Completed & Signed Off",
        message: `Project "${project.title}" has been signed off and marked completed by the client. You can now leave a review.`,
        priority: "normal",
        channel: "omnichannel",
        variables: {
          projectTitle: project.title,
          clientName: user.fullName,
        },
        metadata: {
          projectId: project.id,
          contractId: activeContract.id,
          actionUrl: `/dashboard/projects/${project.id}?tab=overview`,
        },
      }).catch((err) => console.error("Failed to enqueue completion notification:", err));
    }

    res.json({
      success: true,
      message: "Project and contracts completed successfully",
      project: result.updatedProject,
    });
  } catch (err) {
    next(err);
  }
};

// ─── 2. PROPOSAL ENGINE ────────────────────────────────────────────────────
export const submitProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    let freelancerEntitlement: any = null;
    // Ensure capability and subscription entitlement are met before submitting proposal
    try {
      await requireCapability({ userId: req.user!.id, action: "submitProposal" });
      freelancerEntitlement = await assertActionEntitlement(req.user!.id, "freelancer", "submitProposal");
    } catch (err: any) {
      if (err instanceof ActionRequirementsError) {
        return res.status(403).json({
          success: false,
          code: err.code,
          action: err.action,
          message: err.message,
          missing: err.missing,
        });
      }
      if (err instanceof ActionGateError) {
        return res.status(403).json({
          success: false,
          code: err.code,
          action: err.action,
          message: err.message,
          details: err.details,
        });
      }
      throw err;
    }

    const { projectId, freelancerId, bidAmount, coverLetter } = req.body;
    if (!projectId || !freelancerId || !bidAmount) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const proposal = await prisma.proposal.create({
      data: {
        projectId,
        freelancerId,
        bidAmount: parseFloat(bidAmount),
        coverLetter,
        status: "pending",
      },
    });

    // Record action quota usage
    if (freelancerEntitlement?.subscriptionId) {
      await recordActionUsage(freelancerEntitlement.subscriptionId, "submitProposal").catch(() => null);
    }

    await logWorkflowAction({
      userId: freelancerId,
      action: "submit",
      entity: "Proposal",
      entityId: proposal.id,
      description: `Freelancer submitted a proposal with bid $${bidAmount}`,
      newValue: proposal,
    });

    res.status(201).json({ success: true, proposal });
  } catch (err) {
    next(err);
  }
};

export const editProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { bidAmount, coverLetter } = req.body;

    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });
    if (existing.status !== "pending") {
      return res.status(400).json({ success: false, message: "Proposal can only be edited before shortlist" });
    }

    const updated = await prisma.proposal.update({
      where: { id },
      data: {
        bidAmount: bidAmount ? parseFloat(bidAmount) : existing.bidAmount,
        coverLetter: coverLetter ?? existing.coverLetter,
      },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "edit",
      entity: "Proposal",
      entityId: id,
      description: `Proposal edited. New bid: $${updated.bidAmount}`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

export const shortlistProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "shortlisted" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "shortlist",
      entity: "Proposal",
      entityId: id,
      description: `Proposal was shortlisted.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

export const rejectProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "rejected" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "reject",
      entity: "Proposal",
      entityId: id,
      description: `Proposal was rejected.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

export const interviewProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "interview" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "interview",
      entity: "Proposal",
      entityId: id,
      description: `Proposal status moved to interview scheduled.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

export const offerProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "offer" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "offer",
      entity: "Proposal",
      entityId: id,
      description: `Client sent an offer for this proposal.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

// Database Transaction #1: Proposal Accept → Contract Created → Project updates status
export const acceptProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });
    const freelancer = await prisma.user.findUnique({
      where: { id: proposal.freelancerId },
      select: { fullName: true },
    });
    if (!freelancer) {
      return res.status(400).json({ success: false, message: "Proposal freelancer no longer exists" });
    }

    const contractNumber = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Accept proposal
      const updatedProposal = await tx.proposal.update({
        where: { id },
        data: { status: "accepted" },
      });

      // 2. Reject all other proposals for this project
      await tx.proposal.updateMany({
        where: { projectId: proposal.projectId, id: { not: id } },
        data: { status: "rejected" },
      });

      // Find client user ID
      // If project has client name, look up user, or use system fallback
      const clientId = proposal.project.client;

      // 3. Create active/pending contract
      const contract = await tx.contract.create({
        data: {
          contractNumber,
          projectId: proposal.projectId,
          clientId,
          freelancerId: proposal.freelancerId,
          proposalId: id,
          status: "pending_acceptance",
        },
      });

      // 4. Update project status to active and link freelancer
      const updatedProject = await tx.project.update({
        where: { id: proposal.projectId },
        data: {
          status: "in_progress",
          freelancer: freelancer.fullName,
        },
      });

      // 5. Generate default milestones
      const milestone1 = await tx.milestone.create({
        data: {
          projectId: proposal.projectId,
          title: "Milestone 1: Project Kickoff & Setup",
          status: "Pending",
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      });

      const milestone2 = await tx.milestone.create({
        data: {
          projectId: proposal.projectId,
          title: "Milestone 2: Final Project Delivery",
          status: "Pending",
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      });

      // 6. Generate default tasks from milestones
      await tx.task.create({
        data: {
          projectId: proposal.projectId,
          title: "Setup codebase & initialize git repository",
          priority: "High",
          status: "assigned",
          assignedTo: freelancer.fullName,
        },
      });

      await tx.task.create({
        data: {
          projectId: proposal.projectId,
          title: "Implement final integration and deployment",
          priority: "Medium",
          status: "draft",
          assignedTo: freelancer.fullName,
        },
      });

      return { updatedProposal, contract, updatedProject, milestones: [milestone1, milestone2] };
    });

    await logWorkflowAction({
      userId: proposal.freelancerId,
      action: "accept",
      entity: "Proposal",
      entityId: id,
      description: `Proposal accepted. Contract ${contractNumber} created and project moved to active.`,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const withdrawProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const existing = await prisma.proposal.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Proposal not found" });

    const updated = await prisma.proposal.update({
      where: { id },
      data: { status: "withdrawn" },
    });

    await logWorkflowAction({
      userId: existing.freelancerId,
      action: "withdraw",
      entity: "Proposal",
      entityId: id,
      description: `Freelancer withdrew their proposal.`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, proposal: updated });
  } catch (err) {
    next(err);
  }
};

// ─── 3. CONTRACT ENGINE ────────────────────────────────────────────────────
export const createContractFromProposal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { proposalId } = req.params;
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: { project: true },
    });
    if (!proposal) return res.status(404).json({ success: false, message: "Proposal not found" });
    const freelancer = await prisma.user.findUnique({
      where: { id: proposal.freelancerId },
      select: { fullName: true },
    });
    if (!freelancer) {
      return res.status(400).json({ success: false, message: "Proposal freelancer no longer exists" });
    }

    const contractNumber = `CON-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const clientId = proposal.project.client;

    const contract = await prisma.$transaction(async (tx) => {
      // Create contract
      const newContract = await tx.contract.create({
        data: {
          contractNumber,
          projectId: proposal.projectId,
          clientId,
          freelancerId: proposal.freelancerId,
          proposalId,
          status: "draft",
        },
      });

      // Generate milestones
      await tx.milestone.create({
        data: {
          projectId: proposal.projectId,
          title: "Contract Milestone: Delivery Phase",
          status: "Pending",
          dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        },
      });

      return newContract;
    });

    await logWorkflowAction({
      userId: clientId,
      action: "create",
      entity: "Contract",
      entityId: contract.id,
      description: `Contract ${contractNumber} created draft from proposal.`,
    });

    res.status(201).json({ success: true, contract });
  } catch (err) {
    next(err);
  }
};

export const patchContractStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status required" });

    const existing = await prisma.contract.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: "Contract not found" });

    const updated = await prisma.contract.update({
      where: { id },
      data: { status },
    });

    await logWorkflowAction({
      userId: req.user?.id || "system",
      action: "status_change",
      entity: "Contract",
      entityId: id,
      description: `Contract status changed to ${status}`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, contract: updated });
  } catch (err) {
    next(err);
  }
};

// ─── 4. MILESTONE ENGINE ───────────────────────────────────────────────────
export const createMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { projectId, title, dueDate } = req.body;
    if (!projectId || !title) {
      return res.status(400).json({ success: false, message: "projectId and title are required" });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.deletedAt) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    if (project.status === "completed" || project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot add milestones to a completed or cancelled project" });
    }

    const milestone = await prisma.milestone.create({
      data: { projectId, title: String(title).trim(), dueDate: dueDate || null, status: "Pending" },
    });

    await logWorkflowAction({
      userId,
      action: "create",
      entity: "Milestone",
      entityId: milestone.id,
      description: `New milestone "${title}" created.`,
      newValue: milestone,
    });

    res.status(201).json({ success: true, milestone });
  } catch (err) {
    next(err);
  }
};

export const approveMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: { project: { include: { contracts: { where: { deletedAt: null } } } } },
    });
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });

    if (milestone.project.status === "completed" || milestone.project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot modify milestones on a completed or cancelled project" });
    }

    const updated = await prisma.milestone.update({
      where: { id },
      data: { status: "Completed" },
    });

    await logWorkflowAction({
      userId,
      action: "approve",
      entity: "Milestone",
      entityId: id,
      description: `Milestone "${milestone.title}" approved by client.`,
      oldValue: milestone,
      newValue: updated,
    });

    // Notify the freelancer
    const activeContract = milestone.project.contracts.find((c) => c.status === "active" || c.status === "pending_acceptance") || milestone.project.contracts[0];
    if (activeContract?.freelancerId && activeContract.freelancerId !== userId) {
      await NotificationService.enqueue({
        userId: activeContract.freelancerId,
        type: "milestone",
        title: "Milestone Approved",
        message: `Milestone "${milestone.title}" has been approved for project "${milestone.project.title}".`,
        priority: "normal",
        channel: "omnichannel",
        metadata: {
          projectId: milestone.projectId,
          milestoneId: milestone.id,
          actionUrl: `/dashboard/projects/${milestone.projectId}?tab=milestones`,
        },
      }).catch(() => {});
    }

    res.json({ success: true, milestone: updated });
  } catch (err) {
    next(err);
  }
};

export const rejectMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: { project: { include: { contracts: { where: { deletedAt: null } } } } },
    });
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });

    if (milestone.project.status === "completed" || milestone.project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot modify milestones on a completed or cancelled project" });
    }

    const updated = await prisma.milestone.update({
      where: { id },
      data: { status: "Rejected" },
    });

    await logWorkflowAction({
      userId,
      action: "reject",
      entity: "Milestone",
      entityId: id,
      description: `Milestone "${milestone.title}" rejected.`,
      oldValue: milestone,
      newValue: updated,
    });

    const activeContract = milestone.project.contracts.find((c) => c.status === "active" || c.status === "pending_acceptance") || milestone.project.contracts[0];
    if (activeContract?.freelancerId && activeContract.freelancerId !== userId) {
      await NotificationService.enqueue({
        userId: activeContract.freelancerId,
        type: "milestone",
        title: "Milestone Rejected",
        message: `Milestone "${milestone.title}" was rejected on project "${milestone.project.title}".`,
        priority: "normal",
        channel: "omnichannel",
        metadata: {
          projectId: milestone.projectId,
          milestoneId: milestone.id,
          actionUrl: `/dashboard/projects/${milestone.projectId}?tab=milestones`,
        },
      }).catch(() => {});
    }

    res.json({ success: true, milestone: updated });
  } catch (err) {
    next(err);
  }
};

export const requestChangesMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: { project: { include: { contracts: { where: { deletedAt: null } } } } },
    });
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });

    if (milestone.project.status === "completed" || milestone.project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot request revisions on a completed or cancelled project" });
    }

    const updated = await prisma.milestone.update({
      where: { id },
      data: { status: "Changes Requested" },
    });

    await logWorkflowAction({
      userId,
      action: "request_changes",
      entity: "Milestone",
      entityId: id,
      description: `Changes requested on milestone "${milestone.title}".`,
      oldValue: milestone,
      newValue: updated,
    });

    const activeContract = milestone.project.contracts.find((c) => c.status === "active" || c.status === "pending_acceptance") || milestone.project.contracts[0];
    if (activeContract?.freelancerId && activeContract.freelancerId !== userId) {
      await NotificationService.enqueue({
        userId: activeContract.freelancerId,
        type: "milestone",
        title: "Revisions Requested on Milestone",
        message: `The client requested changes on milestone "${milestone.title}" for project "${milestone.project.title}".`,
        priority: "normal",
        channel: "omnichannel",
        metadata: {
          projectId: milestone.projectId,
          milestoneId: milestone.id,
          actionUrl: `/dashboard/projects/${milestone.projectId}?tab=milestones`,
        },
      }).catch(() => {});
    }

    res.json({ success: true, milestone: updated });
  } catch (err) {
    next(err);
  }
};

export const submitMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });

    if (milestone.project.status === "completed" || milestone.project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot submit milestones on a completed or cancelled project" });
    }

    const updated = await prisma.milestone.update({
      where: { id },
      data: { status: "Submitted" },
    });

    await logWorkflowAction({
      userId,
      action: "submit",
      entity: "Milestone",
      entityId: id,
      description: `Milestone "${milestone.title}" submitted for client review.`,
      oldValue: milestone,
      newValue: updated,
    });

    // Notify client
    const clientUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: milestone.project.client },
          { fullName: milestone.project.client },
          { email: milestone.project.client },
        ],
      },
    });

    if (clientUser?.id && clientUser.id !== userId) {
      await NotificationService.enqueue({
        userId: clientUser.id,
        type: "milestone",
        title: "Milestone Submitted for Review",
        message: `Freelancer submitted milestone "${milestone.title}" for review on project "${milestone.project.title}".`,
        priority: "normal",
        channel: "omnichannel",
        metadata: {
          projectId: milestone.projectId,
          milestoneId: milestone.id,
          actionUrl: `/business/projects/${milestone.projectId}?tab=milestones`,
        },
      }).catch(() => {});
    }

    res.json({ success: true, milestone: updated });
  } catch (err) {
    next(err);
  }
};

export const deleteMilestone = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!milestone) return res.status(404).json({ success: false, message: "Milestone not found" });

    if (milestone.project.status === "completed" || milestone.project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot delete milestones on a completed or cancelled project" });
    }

    await prisma.milestone.delete({ where: { id } });

    await logWorkflowAction({
      userId,
      action: "delete",
      entity: "Milestone",
      entityId: id,
      description: `Milestone "${milestone.title}" was removed.`,
      oldValue: milestone,
    });

    res.json({ success: true, message: "Milestone removed" });
  } catch (err) {
    next(err);
  }
};

export const escalateMilestoneDispute = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { reason, description, projectId: bodyProjectId } = req.body || {};

    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ success: false, message: "Dispute reason is required" });
    }

    // Milestone ownership: resolve milestone -> canonical project
    const milestone = await prisma.milestone.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            contracts: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!milestone || !milestone.project || milestone.project.deletedAt) {
      return res.status(404).json({ success: false, message: "Milestone not found" });
    }

    // Prevent cross-project mismatch/IDOR if projectId was supplied
    if (bodyProjectId && bodyProjectId !== milestone.projectId) {
      return res.status(403).json({ success: false, message: "Milestone does not belong to specified project" });
    }

    // Project status check
    if (milestone.project.status === "completed" || milestone.project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot escalate milestones on a completed or cancelled project" });
    }

    // Duplicate escalation protection: check if milestone is already Disputed
    if (milestone.status === "Disputed") {
      return res.status(409).json({ success: false, message: "This milestone is already in dispute status" });
    }

    // Completed milestones cannot be escalated
    if (milestone.status === "Completed") {
      return res.status(400).json({ success: false, message: "Completed milestones cannot be escalated" });
    }

    // Centralized project authorization: only project participants can escalate
    const authResult = await assertProjectParticipant({
      userId,
      projectId: milestone.projectId,
    });
    if (!authResult.isParticipant) {
      return res.status(403).json({ success: false, message: "Only project participants can escalate milestone disputes" });
    }

    // 1. Update milestone status
    const updated = await prisma.milestone.update({
      where: { id },
      data: { status: "Disputed" },
    });

    // 2. Reuse SupportTicket architecture for Super Admin dispute visibility
    const cleanReason = reason.trim();
    const cleanDesc = description && typeof description === "string" ? description.trim() : "";
    const ticketSubject = `[Milestone Dispute] ${milestone.title} - Project: ${milestone.project.title}`;

    let createdTicket: any = null;
    try {
      createdTicket = await prisma.supportTicket.create({
        data: {
          requesterId: userId,
          requesterRole: authResult.role || "client",
          subject: ticketSubject,
          categoryId: "milestone_dispute",
          priority: "High",
          status: "OPEN",
          messages: {
            create: {
              senderId: userId,
              senderRole: authResult.role || "user",
              message: cleanDesc ? `${cleanReason}\n\nDetails: ${cleanDesc}` : cleanReason,
            },
          },
        },
      });
    } catch (ticketErr) {
      console.error("[MilestoneDispute] Failed to create support ticket record:", ticketErr);
    }

    // 3. Activity timeline log
    await logWorkflowAction({
      userId,
      action: "dispute",
      entity: "Milestone",
      entityId: id,
      description: `Milestone "${milestone.title}" escalated for mediation: ${cleanReason}`,
      oldValue: milestone,
      newValue: updated,
    });

    // 4. Notify counterpart & notification engine
    const activeContract = milestone.project.contracts.find(
      (c) => c.status === "active" || c.status === "pending_acceptance"
    ) || milestone.project.contracts[0];

    const isClientInitiator = authResult.role === "client";
    const targetUserId = isClientInitiator
      ? activeContract?.freelancerId
      : milestone.project.client;

    if (targetUserId) {
      const recipientUser = await prisma.user.findFirst({
        where: {
          OR: [
            { id: targetUserId },
            { fullName: targetUserId },
            { email: targetUserId },
          ],
        },
      });

      if (recipientUser?.id && recipientUser.id !== userId) {
        await NotificationService.enqueue({
          userId: recipientUser.id,
          type: "milestone",
          title: "Milestone Dispute Escalation",
          message: `Milestone "${milestone.title}" on project "${milestone.project.title}" has been escalated for mediation. Reason: ${cleanReason}`,
          priority: "high",
          channel: "omnichannel",
          metadata: {
            projectId: milestone.projectId,
            milestoneId: milestone.id,
            ticketId: createdTicket?.id || null,
            actionUrl: isClientInitiator
              ? `/dashboard/projects/${milestone.projectId}?tab=milestones`
              : `/business/projects/${milestone.projectId}?tab=milestones`,
          },
        }).catch(() => {});
      }
    }

    res.status(200).json({
      success: true,
      message: "Milestone dispute escalated successfully",
      milestone: updated,
      ticketId: createdTicket?.id || null,
    });
  } catch (err) {
    next(err);
  }
};

// ─── 5. TASK ENGINE ────────────────────────────────────────────────────────
export const patchTaskStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, message: "status is required" });

    const existing = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Task not found" });

    if (existing.project.status === "completed" || existing.project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot modify tasks on a completed or cancelled project" });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: { status },
    });

    await logWorkflowAction({
      userId,
      action: "status_change",
      entity: "Task",
      entityId: id,
      description: `Task status updated to ${status}`,
      oldValue: existing,
      newValue: updated,
    });

    res.json({ success: true, task: updated });
  } catch (err) {
    next(err);
  }
};

export const createTaskComment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { comment, author } = req.body;
    if (!comment) return res.status(400).json({ success: false, message: "comment content required" });

    const authorName = author || req.user?.fullName || req.user?.email || "System User";

    const newComment = await prisma.taskComment.create({
      data: {
        taskId: id,
        authorId: userId,
        author: authorName,
        comment: String(comment).trim(),
      },
    });

    res.status(201).json({ success: true, comment: newComment });
  } catch (err) {
    next(err);
  }
};

export const createTaskAttachment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id } = req.params;
    const { filename, filepath, filesize } = req.body;

    if (!filename || !filepath) {
      return res.status(400).json({ success: false, message: "filename and filepath required" });
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: { project: true },
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // Assert project participation before allowing upload/attachment
    const { isParticipant } = await assertProjectParticipant({
      userId,
      projectId: task.projectId,
    });
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not an authorized participant in this project" });
    }

    if (task.project.status === "completed" || task.project.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot add attachments to a completed or cancelled project" });
    }

    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: id,
        filename: String(filename).trim(),
        filepath: String(filepath).trim(),
        filesize: filesize ? parseInt(filesize) : 0,
      },
    });

    res.status(201).json({ success: true, attachment });
  } catch (err) {
    next(err);
  }
};

export const downloadTaskAttachment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { id, attachmentId } = req.params;

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: { task: true },
    });
    if (!attachment || attachment.taskId !== id) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }

    const { isParticipant } = await assertProjectParticipant({
      userId,
      projectId: attachment.task.projectId,
    });
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not authorized to access attachments in this project" });
    }

    const filename = path.basename(attachment.filepath);
    const absPath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(absPath)) {
      return res.status(410).json({ success: false, message: "File missing from disk" });
    }

    res.setHeader("Content-Disposition", `attachment; filename="${attachment.filename}"`);
    res.sendFile(absPath);
  } catch (err) {
    next(err);
  }
};

export const deleteTaskAttachment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const { id, attachmentId } = req.params;

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id: attachmentId },
      include: { task: true },
    });
    if (!attachment || attachment.taskId !== id) {
      return res.status(404).json({ success: false, message: "Attachment not found" });
    }

    const { isParticipant } = await assertProjectParticipant({
      userId,
      projectId: attachment.task.projectId,
    });
    if (!isParticipant) {
      return res.status(403).json({ success: false, message: "Forbidden: You are not authorized to delete attachments in this project" });
    }

    await prisma.taskAttachment.delete({ where: { id: attachmentId } });
    res.json({ success: true, message: "Attachment deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// ─── 6. REVIEW ENGINE ───────────────────────────────────────────────────────
export const createReview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const reviewerId = req.user?.id;
    if (!reviewerId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { projectId, revieweeId: rawRevieweeId, rating: rawRating, comment } = req.body;
    const rating = parseFloat(rawRating);

    if (!projectId || !Number.isFinite(rating)) {
      return res.status(400).json({ success: false, message: "projectId and valid rating (1-5) are required" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5 stars" });
    }

    if (comment && typeof comment === "string" && comment.length > 2000) {
      return res.status(400).json({ success: false, message: "Comment cannot exceed 2000 characters" });
    }

    // 1. Fetch project and participants
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        contracts: { where: { deletedAt: null } },
      },
    });

    if (!project || project.deletedAt) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    // 2. Validate project completion status
    const hasCompletedContract = project.contracts.some((c) => c.status === "completed");
    if (project.status !== "completed" && !hasCompletedContract) {
      return res.status(400).json({
        success: false,
        message: "Reviews can only be submitted for completed projects with finalized delivery.",
      });
    }

    // 3. Resolve reviewer & reviewee
    const activeContract = project.contracts.find((c) => c.status === "completed" || c.status === "active") || project.contracts[0];
    const clientUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: project.client },
          { fullName: project.client },
          { email: project.client },
        ],
      },
    });

    const clientId = clientUser?.id || project.client;
    const freelancerId = activeContract?.freelancerId;

    let targetRevieweeId = rawRevieweeId;

    // Check relationship
    const isClientReviewing = reviewerId === clientId || reviewerId === project.client;
    const isFreelancerReviewing = reviewerId === freelancerId;

    if (!isClientReviewing && !isFreelancerReviewing && req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You are not an authorized participant on this project and cannot submit a review.",
      });
    }

    if (isClientReviewing) {
      if (!targetRevieweeId && freelancerId) targetRevieweeId = freelancerId;
    } else if (isFreelancerReviewing) {
      if (!targetRevieweeId && clientId) targetRevieweeId = clientId;
    }

    if (!targetRevieweeId) {
      return res.status(400).json({ success: false, message: "revieweeId could not be determined" });
    }

    // Prevent self-review
    if (reviewerId === targetRevieweeId) {
      return res.status(400).json({ success: false, message: "You cannot review yourself" });
    }

    // 4. Check uniqueness (1 review per reviewer + reviewee + project)
    const existingReview = await prisma.review.findFirst({
      where: {
        projectId,
        reviewerId,
        revieweeId: targetRevieweeId,
      },
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already submitted a review for this project.",
        review: existingReview,
      });
    }

    // 5. Transaction: create review and update profile aggregate rating
    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          projectId,
          reviewerId,
          revieweeId: targetRevieweeId,
          rating,
          comment: comment ? String(comment).trim() : null,
        },
      });

      // Update ratings average in freelancer profile if reviewee is freelancer
      const revieweeUser = await tx.user.findUnique({
        where: { id: targetRevieweeId },
        select: { id: true, role: true },
      });

      if (revieweeUser?.role === "freelancer") {
        const allReviews = await tx.review.findMany({
          where: { revieweeId: targetRevieweeId },
          select: { rating: true },
        });
        const totalRating = allReviews.reduce((acc, curr) => acc + curr.rating, 0);
        const avg = allReviews.length > 0 ? Math.round((totalRating / allReviews.length) * 10) / 10 : 5;

        await tx.freelancerProfile.updateMany({
          where: { userId: targetRevieweeId },
          data: { rating: avg },
        });
      }

      return review;
    });

    await logWorkflowAction({
      userId: reviewerId,
      action: "submit",
      entity: "Review",
      entityId: result.id,
      description: `${req.user?.fullName || "User"} submitted a ${rating}-star review for project "${project.title}".`,
      newValue: result,
    });

    // Enqueue notification to reviewee
    await NotificationService.enqueue({
      userId: targetRevieweeId,
      type: "review",
      title: "New Review Received",
      message: `${req.user?.fullName || "A project participant"} left you a ${rating}-star review for "${project.title}".`,
      priority: "normal",
      channel: "omnichannel",
      metadata: {
        projectId: project.id,
        reviewId: result.id,
        actionUrl: isClientReviewing
          ? `/dashboard/projects/${project.id}?tab=overview`
          : `/business/projects/${project.id}?tab=overview`,
      },
    }).catch(() => {});

    res.status(201).json({ success: true, message: "Review submitted successfully", review: result });
  } catch (err) {
    next(err);
  }
};
