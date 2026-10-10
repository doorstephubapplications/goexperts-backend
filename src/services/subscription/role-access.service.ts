import { prisma } from "../../config/database.js";
import { resolveRoleEntitlement } from "./entitlement.service.js";
import { buildKycReadiness } from "../../controllers/auth/auth.controller.js";
import { resolveProfileCompletion } from "../mobile/profile-completion.service.js";

export type RoleWorkspaceAccessResult =
  | "DASHBOARD_ALLOWED"
  | "PROFILE_SETUP_REQUIRED"
  | "KYC_REQUIRED"
  | "VERIFICATION_PENDING"
  | "SUBSCRIPTION_REQUIRED"
  | "ROLE_NOT_ACTIVE"
  | "ROLE_NOT_AUTHORIZED";

/**
 * Validates if a user is authorized to access a specific role's workspace.
 */
export const resolveRoleWorkspaceAccess = async (
  userId: string,
  targetRole: string
): Promise<{ status: RoleWorkspaceAccessResult; message?: string }> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: true,
      freelancerProfile: true,
      clientProfile: true,
      investorProfile: true,
      founderProfile: true,
    },
  });

  if (!user) {
    return { status: "ROLE_NOT_AUTHORIZED" };
  }

  // 1. Check Role Membership
  const isPrimary = user.role === targetRole;
  if (!isPrimary) {
    const secondaryRole = user.userRoles.find((ur) => ur.role === targetRole);
    if (!secondaryRole) {
      return { status: "ROLE_NOT_AUTHORIZED", message: "Role membership not found." };
    }
    if (secondaryRole.status !== "active") {
      return { status: "ROLE_NOT_ACTIVE", message: "Secondary role is not active." };
    }
  }

  // 2. Check Profile Completion
  const completion = await resolveProfileCompletion(userId);
  // Ideally, profile completion logic would be split per role, but for now we follow global
  // In a full implementation, you'd check `user.clientProfile` if targetRole is 'client', etc.
  if (!completion.isProfileComplete) {
    return { status: "PROFILE_SETUP_REQUIRED", message: "Profile setup is incomplete." };
  }

  // 3. Check KYC
  const kyc = buildKycReadiness(user);
  if (!kyc.verified) {
    if (kyc.submitted) {
      return { status: "VERIFICATION_PENDING", message: "KYC verification is pending." };
    }
    return { status: "KYC_REQUIRED", message: "KYC verification is required." };
  }

  // 4. Check Subscription
  const entitlement = await resolveRoleEntitlement(userId, targetRole);
  if (!entitlement.isEntitled) {
    return { status: "SUBSCRIPTION_REQUIRED", message: "A paid plan is required to access this role. Please choose a subscription package to continue." };
  }

  return { status: "DASHBOARD_ALLOWED" };
};
