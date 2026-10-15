import { prisma } from "../../config/database.js";
import { resolveProfileCompletion } from "../mobile/profile-completion.service.js";
import { getVerificationStats } from "../../common/helpers/verification.js";

export interface EvaluatedRoleReadiness {
  userId: string;
  role: string;
  email: string;
  fullName: string;
  profileCompletion: number;
  profileLevel: string;
  operationalReady: boolean;
  missingCoreKeys: string[];
  missingCoreLabels: string[];
  actionableTargetRoute: string;
  isProfileEligible: boolean;
  kycStatus: string;
  kycSubmitted: boolean;
  kycVerified: boolean;
  isKycActionRequired: boolean;
  kycTargetRoute: string;
  createdAt: Date;
}

export function resolveRoleRoute(role: string): string {
  const norm = (role || "").toLowerCase().trim();
  if (norm === "client" || norm === "business") return "/business/profile";
  if (norm === "founder" || norm === "startup") return "/founder/profile";
  if (norm === "investor") return "/investor/profile";
  return "/dashboard/profile";
}

export function resolveKycRoute(role: string): string {
  const norm = (role || "").toLowerCase().trim();
  if (norm === "client" || norm === "business") return "/business/verification";
  if (norm === "founder" || norm === "startup") return "/founder/verification";
  if (norm === "investor") return "/investor/verification";
  return "/dashboard/verification";
}

/**
 * Centrally evaluates a user's role workspace for automated reminders.
 * Strictly enforces:
 * 1. Profile reminders trigger ONLY if actionable core requirements are missing.
 * 2. KYC reminders trigger ONLY if documents are unsubmitted or rejected (NEVER when under review).
 * 3. Evaluates roles independently.
 */
export async function evaluateUserRoleEligibility(userId: string, role: string): Promise<EvaluatedRoleReadiness | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      freelancerProfile: true,
      clientProfile: true,
      investorProfile: true,
      founderProfile: true,
      userRoles: true,
    },
  });

  if (!user || user.status === "SUSPENDED" || user.status === "BLOCKED" || user.status === "DELETED") {
    return null;
  }

  const completion = await resolveProfileCompletion(userId, role);
  const kycStats = getVerificationStats(user);

  const missingCore = completion.requirements?.core?.missing || [];
  const missingCoreKeys = missingCore.map((m: any) => m.key);
  const missingCoreLabels = missingCore.map((m: any) => m.label);

  const actionableTargetRoute = missingCore.length > 0 && (missingCore[0] as any).route
    ? (missingCore[0] as any).route
    : resolveRoleRoute(role);

  // Profile reminder eligibility: true only if actionable core requirements remain incomplete
  const isProfileEligible = missingCore.length > 0;

  // KYC status evaluation
  const kycStatus = String(kycStats.kycStatus || "MISSING").toUpperCase();
  const kycSubmitted = kycStats.missingCount === 0;
  const kycVerified = kycStats.kycApproved === true;

  // KYC action required: true if required documents are missing or rejected
  // If all documents are submitted and under review (PENDING/SUBMITTED), user action is NOT required!
  const isKycActionRequired = !kycVerified && !kycSubmitted;

  return {
    userId: user.id,
    role: role.toLowerCase(),
    email: user.email || "",
    fullName: user.fullName || "User",
    profileCompletion: completion.profileCompletion,
    profileLevel: completion.profileLevel,
    operationalReady: completion.operationalReady,
    missingCoreKeys,
    missingCoreLabels,
    actionableTargetRoute,
    isProfileEligible,
    kycStatus,
    kycSubmitted,
    kycVerified,
    isKycActionRequired,
    kycTargetRoute: resolveKycRoute(role),
    createdAt: user.createdAt,
  };
}
