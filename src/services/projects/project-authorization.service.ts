import { prisma } from "../../config/database.js";

export interface ProjectParticipantCheck {
  userId: string;
  projectId: string;
  requiredCapability?: string;
}

export interface ProjectParticipantResult {
  isParticipant: boolean;
  project: any | null;
  role: "client" | "freelancer" | "team_member" | "admin" | null;
}

/**
 * Centralized, canonical authorization helper for project participation.
 * Validates whether a user is:
 * 1. Super Admin or Admin (system authority)
 * 2. The project-owning Client
 * 3. An active team member under the project-owning Client
 * 4. The assigned/hired Freelancer (or active contract holder)
 */
export async function assertProjectParticipant({
  userId,
  projectId,
}: ProjectParticipantCheck): Promise<ProjectParticipantResult> {
  if (!userId || !projectId) {
    return { isParticipant: false, project: null, role: null };
  }

  // 1. Fetch requesting user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      clientProfile: { select: { company: true } },
    },
  });

  if (!user) {
    return { isParticipant: false, project: null, role: null };
  }

  // 2. Admin authority
  const userRole = (user.role || "").toLowerCase();
  if (userRole === "admin" || userRole === "super_admin" || userRole === "superadmin") {
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });
    return { isParticipant: true, project, role: "admin" };
  }

  // 3. Fetch project
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
  });

  if (!project) {
    return { isParticipant: false, project: null, role: null };
  }

  // 4. Client owner check
  const clientNeedles = [user.id, user.fullName, user.email, user.clientProfile?.company]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);

  const projClient = String(project.client || "").trim().toLowerCase();
  if (projClient && clientNeedles.some((needle) => projClient === needle || projClient.includes(needle))) {
    return { isParticipant: true, project, role: "client" };
  }

  // 5. Client team member check
  if (project.client) {
    try {
      const teamMember = await prisma.clientTeamMember.findFirst({
        where: {
          clientId: project.client,
          OR: [{ userId: user.id }, { email: user.email }],
          status: { in: ["Active", "active", "Accepted", "accepted"] },
        },
      });
      if (teamMember) {
        return { isParticipant: true, project, role: "team_member" };
      }
    } catch {
      // ignore table query failure if clientTeamMember unavailable
    }
  }

  // 6. Assigned Freelancer check
  const projFreelancer = String(project.freelancer || "").trim().toLowerCase();
  if (projFreelancer && (projFreelancer === user.id.toLowerCase() || (user.fullName && projFreelancer.includes(user.fullName.toLowerCase())))) {
    return { isParticipant: true, project, role: "freelancer" };
  }

  // 7. Active contract check
  const contract = await prisma.contract.findFirst({
    where: {
      projectId: project.id,
      freelancerId: user.id,
      deletedAt: null,
      status: { notIn: ["cancelled", "terminated"] },
    },
  });

  if (contract) {
    return { isParticipant: true, project, role: "freelancer" };
  }

  return { isParticipant: false, project, role: null };
}

/**
 * Asserts whether a user has read/download/preview access to a MediaFile.
 * Resolves ownership through:
 * 1. Admin authority
 * 2. Uploader identity (uploadedBy === userId)
 * 3. Linked project attachments (user is project participant)
 * 4. Linked task attachments (user is task's project participant)
 */
export async function assertMediaFileAccess(
  userId: string,
  mediaFileId: string
): Promise<{ allowed: boolean; media: any | null; reason: string }> {
  if (!userId || !mediaFileId) {
    return { allowed: false, media: null, reason: "missing_credentials" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!user) {
    return { allowed: false, media: null, reason: "user_not_found" };
  }

  const media = await prisma.mediaFile.findUnique({
    where: { id: mediaFileId },
  });
  if (!media || media.deletedAt) {
    return { allowed: false, media: null, reason: "not_found" };
  }

  // 1. Admin authority
  const userRole = (user.role || "").toLowerCase();
  if (userRole === "admin" || userRole === "super_admin" || userRole === "superadmin") {
    return { allowed: true, media, reason: "admin" };
  }

  // 2. Direct uploader
  if (media.uploadedBy === userId) {
    return { allowed: true, media, reason: "uploader" };
  }

  // 3. Check if file is associated with any TaskAttachment
  const taskAttachment = await prisma.taskAttachment.findFirst({
    where: {
      OR: [
        { filepath: media.filepath },
        { filename: media.filename },
      ],
    },
    include: { task: true },
  });

  if (taskAttachment && taskAttachment.task?.projectId) {
    const { isParticipant } = await assertProjectParticipant({
      userId,
      projectId: taskAttachment.task.projectId,
    });
    if (isParticipant) {
      return { allowed: true, media, reason: "task_participant" };
    }
  }

  // 4. Check if file is associated with any Project attachments
  const projects = await prisma.project.findMany({
    where: {
      attachments: {
        contains: media.filename,
      },
      deletedAt: null,
    },
    select: { id: true, client: true, freelancer: true },
  });

  for (const proj of projects) {
    const { isParticipant } = await assertProjectParticipant({
      userId,
      projectId: proj.id,
    });
    if (isParticipant) {
      return { allowed: true, media, reason: "project_participant" };
    }
  }

  return { allowed: false, media, reason: "unauthorized" };
}

/**
 * Asserts whether a user has permission to delete a MediaFile.
 * Stricter than read access: only uploader or admin.
 */
export async function assertMediaFileDelete(
  userId: string,
  mediaFileId: string
): Promise<{ allowed: boolean; media: any | null; reason: string }> {
  if (!userId || !mediaFileId) {
    return { allowed: false, media: null, reason: "missing_credentials" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) {
    return { allowed: false, media: null, reason: "user_not_found" };
  }

  const media = await prisma.mediaFile.findUnique({
    where: { id: mediaFileId },
  });
  if (!media || media.deletedAt) {
    return { allowed: false, media: null, reason: "not_found" };
  }

  const userRole = (user.role || "").toLowerCase();
  if (userRole === "admin" || userRole === "super_admin" || userRole === "superadmin") {
    return { allowed: true, media, reason: "admin" };
  }

  if (media.uploadedBy === userId) {
    return { allowed: true, media, reason: "uploader" };
  }

  return { allowed: false, media, reason: "forbidden" };
}
