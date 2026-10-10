import { prisma } from "../../config/database.js";

export class AddonEligibilityError extends Error {
  public code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
    this.name = "AddonEligibilityError";
  }
}

/**
 * Validates whether a user can purchase/activate an Additional Role Add-on.
 */
export const assertAdditionalRoleAddonEligibility = async (
  userId: string,
  targetRole: string,
  requestedPlanId: string,
  checkPending = true
): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { userRoles: true },
  });

  if (!user) {
    throw new AddonEligibilityError("User not found.", "ADDON_USER_NOT_FOUND");
  }

  // 1. Primary role cannot receive an Add-on
  if (user.role === targetRole) {
    throw new AddonEligibilityError(
      "Cannot purchase an add-on for your primary role.",
      "ADDON_PRIMARY_ROLE_NOT_ELIGIBLE"
    );
  }

  // 2. The secondary role must already be active
  const hasActiveSecondaryRole = user.userRoles?.some(
    (ur) => ur.role === targetRole && ur.status === "active"
  );
  if (!hasActiveSecondaryRole) {
    throw new AddonEligibilityError(
      "You must have an active secondary role to purchase an add-on for it.",
      "ADDON_ROLE_NOT_ACTIVE"
    );
  }

  // 3. Verify the plan is an Add-on for the correct role
  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: requestedPlanId },
  });
  if (!plan) {
    throw new AddonEligibilityError("Plan not found.", "ADDON_PLAN_NOT_FOUND");
  }
  
  const planType = (plan as any).planType || "single_role";
  if (planType !== "additional_role") {
    // If it's not an add-on, it's out of scope for this strict check, allow normal checks
    return true; 
  }
  
  if (plan.role !== targetRole) {
    throw new AddonEligibilityError(
      "Plan role does not match requested role.",
      "ADDON_PLAN_ROLE_MISMATCH"
    );
  }

  // 4. Check for overlapping active add-on subscriptions
  const now = new Date();
  const overlappingSubs = await prisma.subscription.findFirst({
    where: {
      userId,
      role: targetRole,
      planType: "additional_role",
      status: "active",
      endDate: { gt: now },
    },
  });

  if (overlappingSubs) {
    throw new AddonEligibilityError(
      "You already have an active add-on for this role.",
      "ADDON_ALREADY_ACTIVE"
    );
  }

  // 5. Check pending checkouts to prevent duplicate payable sessions
  if (checkPending) {
    const pendingPayment = await prisma.payment.findFirst({
      where: {
        userId,
        status: "pending",
        createdAt: { gt: new Date(Date.now() - 30 * 60 * 1000) }, // last 30 minutes
      },
    });

    if (pendingPayment) {
      // Very basic metadata check; in reality, meta is stored in a separate table/JSON
      throw new AddonEligibilityError(
        "A checkout session is already pending for this add-on.",
        "ADDON_CHECKOUT_ALREADY_PENDING"
      );
    }
  }

  return true;
};
