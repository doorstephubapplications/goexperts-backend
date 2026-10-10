import { prisma } from "../../config/database.js";
import { resolveRoleEntitlement } from "../../services/subscription/entitlement.service.js";
import { resolveProfileCompletion } from "../../services/mobile/profile-completion.service.js";
import { buildKycReadiness } from "../../controllers/auth/auth.controller.js";

export async function buildAuthenticatedUserRoleDetails(userId: string, activeRoles: string[]) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      freelancerProfile: true,
      clientProfile: true,
      investorProfile: true,
      founderProfile: true,
    }
  });

  if (!user) return {};

  const completion = await resolveProfileCompletion(userId).catch(() => ({ isProfileComplete: false, profileCompletion: 0 }));
  const kycReadiness = buildKycReadiness(user);

  const roleStatuses: any = {};
  for (const role of activeRoles) {
    let roleSub = { status: 'none', isExpired: false, hasAddon: false };
    try {
      const entitlement = await resolveRoleEntitlement(user.id, role);
      roleSub.status = entitlement.isEntitled ? 'active' : (entitlement.gateReason === 'SUBSCRIPTION_EXPIRED' ? 'expired' : 'none');
      roleSub.isExpired = entitlement.gateReason === 'SUBSCRIPTION_EXPIRED';
      roleSub.hasAddon = entitlement.planType === 'add_on';
    } catch (e) {}

    let readiness = { kycVerified: false, profileComplete: false, completionPercentage: 0 };
    if (role === user.role) {
      readiness.kycVerified = kycReadiness.verified;
      readiness.profileComplete = completion.isProfileComplete;
      readiness.completionPercentage = completion.profileCompletion;
    } else {
      readiness.kycVerified = kycReadiness.verified; 
      readiness.profileComplete = true; // Fallback mock for secondary
      readiness.completionPercentage = 100;
    }

    roleStatuses[role] = { subscription: roleSub, readiness };
  }
  return roleStatuses;
}
