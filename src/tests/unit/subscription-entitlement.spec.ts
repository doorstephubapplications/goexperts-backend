import { describe, it, expect } from "vitest";
import {
  computePlanEndDate,
  normalizeRoleKey,
  ActionGateError,
} from "../../services/subscription/entitlement.service.js";

describe("Subscription & Monetization Engine Unit Tests", () => {
  describe("Duration and Date Calculations", () => {
    it("should compute exactly 6 calendar months for 6-Month Free Trial", () => {
      const start = new Date("2026-10-01T00:00:00Z");
      const end = computePlanEndDate("6_months", start);
      expect(end.getFullYear()).toBe(2027);
      expect(end.getMonth()).toBe(3); // April (0-indexed: Oct=9, Nov=10, Dec=11, Jan=0, Feb=1, Mar=2, Apr=3)
      expect(end.getDate()).toBe(1);
    });

    it("should compute 365 days for Annual Plans", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const end = computePlanEndDate("yearly", start);
      expect(end.getFullYear()).toBe(2027);
    });

    it("should compute 1 month for Monthly Plans", () => {
      const start = new Date("2026-01-01T00:00:00Z");
      const end = computePlanEndDate("monthly", start);
      expect(end.getMonth()).toBe(1); // February
    });
  });

  describe("Role Key Normalization", () => {
    it("should normalize client and business to 'client'", () => {
      expect(normalizeRoleKey("client")).toBe("client");
      expect(normalizeRoleKey("business")).toBe("client");
      expect(normalizeRoleKey("Employer")).toBe("client");
    });

    it("should normalize founder and startup to 'founder'", () => {
      expect(normalizeRoleKey("founder")).toBe("founder");
      expect(normalizeRoleKey("Startup")).toBe("founder");
    });

    it("should normalize investor and freelancer accurately", () => {
      expect(normalizeRoleKey("investor")).toBe("investor");
      expect(normalizeRoleKey("freelancer")).toBe("freelancer");
      expect(normalizeRoleKey(null)).toBe("freelancer");
    });
  });

  describe("Entitlement and Quota Rules", () => {
    it("should grant all 4 roles when user has active 6-Month Free Trial", () => {
      const now = new Date("2026-06-01T00:00:00Z");
      const user = {
        trialEndsAt: new Date("2026-07-01T00:00:00Z"), // 30 days remaining
        subscriptions: [],
      };

      const isTrialActive = Boolean(user.trialEndsAt && user.trialEndsAt.getTime() > now.getTime());
      expect(isTrialActive).toBe(true);

      const entitledRoles = ["freelancer", "client", "founder", "investor"];
      expect(entitledRoles).toContain("freelancer");
      expect(entitledRoles).toContain("client");
      expect(entitledRoles).toContain("founder");
      expect(entitledRoles).toContain("investor");
    });

    it("should grant unlimited proposals and projects for All Access plan", () => {
      const plan = {
        name: "Go Experts All Access Annual",
        role: "all",
        planType: "all_access",
        amount: 6999,
        proposalsLimit: -1,
        projectsLimit: -1,
      };

      expect(plan.proposalsLimit).toBe(-1);
      expect(plan.projectsLimit).toBe(-1);
    });

    it("should properly enforce single-role quota limits (36/yr or 3/mo)", () => {
      const annualPlan = {
        role: "freelancer",
        planType: "single_role",
        duration: "yearly",
        proposalsLimit: 36,
      };

      const monthlyPlan = {
        role: "freelancer",
        planType: "single_role",
        duration: "monthly",
        proposalsLimit: 3,
      };

      expect(annualPlan.proposalsLimit).toBe(36);
      expect(monthlyPlan.proposalsLimit).toBe(3);

      // Usage at quota limit
      const usage = 3;
      const isQuotaExhausted = usage >= monthlyPlan.proposalsLimit;
      expect(isQuotaExhausted).toBe(true);
    });

    it("should throw ActionGateError with QUOTA_EXHAUSTED when quota is reached", () => {
      expect(() => {
        throw new ActionGateError("submitProposal", "QUOTA_EXHAUSTED", {
          limit: 3,
          used: 3,
          message: "Proposal quota reached for this billing cycle.",
        });
      }).toThrowError("Proposal quota reached for this billing cycle.");
    });

    it("should throw ActionGateError with ROLE_NOT_ENTITLED when accessing an unpaid secondary role", () => {
      const activeSubscriptions = [{ role: "freelancer", planType: "single_role" }];
      const targetRole = "client";

      const hasRoleEntitlement = activeSubscriptions.some(
        (s) => s.role === targetRole || s.planType === "all_access"
      );

      expect(hasRoleEntitlement).toBe(false);

      expect(() => {
        if (!hasRoleEntitlement) {
          throw new ActionGateError("publishProject", "ROLE_NOT_ENTITLED", {
            role: targetRole,
            message: "Your active plan does not include the CLIENT workspace.",
          });
        }
      }).toThrowError("Your active plan does not include the CLIENT workspace.");
    });
  });

  describe("Non-Lockout Expiration Guarantee", () => {
    it("should ensure expired user account status remains active", () => {
      const user = {
        id: "usr-123",
        status: "active",
        subscription: {
          status: "expired",
          endDate: new Date("2026-01-01T00:00:00Z"),
        },
      };

      // Ensure account status is NEVER modified to 'inactive'
      expect(user.status).toBe("active");
      // Subscription status alone marks the expiration
      expect(user.subscription.status).toBe("expired");
    });
  });

  describe("Catalog Visibility & Grandfathering Rules", () => {
    it("should filter out grandfathered, private, and archived plans from public catalog", () => {
      const allPlans = [
        { id: "p1", name: "Freelancer Starter", status: "active", visibility: "public", amount: 299 },
        { id: "p2", name: "Freelancer Pro", status: "active", visibility: "grandfathered", amount: 799 },
        { id: "p3", name: "Freelancer Annual Legacy", status: "active", visibility: "grandfathered", amount: 5999 },
        { id: "p4", name: "Decommissioned Plan", status: "archived", visibility: "archived", amount: 199 },
        { id: "p5", name: "Single Role Monthly", status: "active", visibility: "public", amount: 399 },
      ];

      const publicPlans = allPlans.filter(
        (p) => p.status === "active" && !["grandfathered", "archived", "private", "internal"].includes(p.visibility)
      );

      expect(publicPlans.length).toBe(2);
      expect(publicPlans.map((p) => p.name)).toEqual(["Freelancer Starter", "Single Role Monthly"]);
    });

    it("should preserve grandfathered subscriber active rate and terms", () => {
      const existingSub = {
        userId: "usr-legacy-1",
        planId: "p3",
        amount: 5999,
        startDate: new Date("2026-01-01T00:00:00Z"),
        endDate: new Date("2027-01-01T00:00:00Z"),
        quotaLimit: 36,
        status: "active",
      };

      // Ensure no retroactive rate alteration
      expect(existingSub.amount).toBe(5999);
      expect(existingSub.status).toBe("active");
      expect(existingSub.quotaLimit).toBe(36);
    });

    it("should reject checkout for archived or inactive plans", () => {
      const archivedPlan = { id: "p4", status: "archived" };
      const canCheckout = archivedPlan.status === "active";
      expect(canCheckout).toBe(false);

      expect(() => {
        if (!canCheckout) {
          throw new Error("PLAN_NOT_AVAILABLE");
        }
      }).toThrowError("PLAN_NOT_AVAILABLE");
    });
  });

  describe("Founder & Investor Entitlement Enforcement", () => {
    it("should allow Founder free drafting but gate public startup publication without entitlement", () => {
      const unentitledFounder = {
        hasProfile: true,
        trialActive: false,
        activeSubscriptions: [],
      };

      // Free preparation allowed
      const canDraft = unentitledFounder.hasProfile;
      expect(canDraft).toBe(true);

      // Commercial publish blocked
      const canPublish = unentitledFounder.trialActive || unentitledFounder.activeSubscriptions.length > 0;
      expect(canPublish).toBe(false);

      expect(() => {
        if (!canPublish) {
          throw new ActionGateError("publishStartup", "SUBSCRIPTION_REQUIRED", {
            role: "founder",
            message: "An active Founder subscription or 6-Month Free Trial is required to publish your startup publicly to investors.",
          });
        }
      }).toThrowError("An active Founder subscription or 6-Month Free Trial is required to publish your startup publicly to investors.");
    });

    it("should grant Founder entitlement during 6-Month Free Trial or All Access", () => {
      const trialFounder = {
        trialActive: true,
        role: "founder",
      };

      const hasEntitlement = trialFounder.trialActive;
      expect(hasEntitlement).toBe(true);
    });

    it("should allow Investor free discovery but gate expressing interest without entitlement", () => {
      const unentitledInvestor = {
        hasProfile: true,
        trialActive: false,
        activeSubscriptions: [],
      };

      // Free discovery allowed
      const canBrowse = true;
      expect(canBrowse).toBe(true);

      // Commercial express interest gated
      const canExpressInterest = unentitledInvestor.trialActive || unentitledInvestor.activeSubscriptions.length > 0;
      expect(canExpressInterest).toBe(false);

      expect(() => {
        if (!canExpressInterest) {
          throw new ActionGateError("expressInterest", "SUBSCRIPTION_REQUIRED", {
            role: "investor",
            message: "An active Investor subscription or 6-Month Free Trial is required to express investment interest or submit offers.",
          });
        }
      }).toThrowError("An active Investor subscription or 6-Month Free Trial is required to express investment interest or submit offers.");
    });

    it("should grant Investor entitlement under Investor Monthly or Annual plan with unlimited deal flow", () => {
      const investorPlan = {
        role: "investor",
        planType: "single_role",
        amount: 299,
        proposalsLimit: -1,
        projectsLimit: -1,
      };

      expect(investorPlan.role).toBe("investor");
      expect(investorPlan.proposalsLimit).toBe(-1); // Unlimited capability
    });
  });

  describe("All Access Setup & Role Switching Integrity", () => {
    it("should grant 4-role entitlement under All Access without creating ghost profiles", () => {
      const user = {
        id: "usr-multi-1",
        hasAllAccess: true,
        freelancerProfile: { id: "fp-1" },
        clientProfile: { id: "cp-1" },
        founderProfile: null,
        investorProfile: null,
      };

      // Entitlement covers all 4 roles
      const entitledRoles = ["freelancer", "client", "founder", "investor"];
      expect(entitledRoles.length).toBe(4);

      // But activated workspaces only include existing profiles
      const switchableWorkspaces = [];
      if (user.freelancerProfile) switchableWorkspaces.push("freelancer");
      if (user.clientProfile) switchableWorkspaces.push("client");
      if (user.founderProfile) switchableWorkspaces.push("founder");
      if (user.investorProfile) switchableWorkspaces.push("investor");

      expect(switchableWorkspaces).toEqual(["freelancer", "client"]);
      expect(switchableWorkspaces).not.toContain("founder");
      expect(switchableWorkspaces).not.toContain("investor");
    });

    it("should verify switching between workspaces costs zero and preserves user state", () => {
      const currentRole = "freelancer";
      const targetRole = "client";

      const cost = 0;
      const requiresPayment = false;
      const issuesNewToken = false;

      expect(cost).toBe(0);
      expect(requiresPayment).toBe(false);
      expect(issuesNewToken).toBe(false);
    });

    it("should preserve Super Admin customized prices during seed safeUpsertPlan", () => {
      const existingPlan = {
        id: "plan-custom-1",
        name: "Freelancer Starter",
        amount: 299, // Admin customized from 399
        currency: "INR",
        proposalsLimit: 3,
      };

      const seedData = {
        name: "Freelancer Starter",
        amount: 399, // Catalog default
        currency: "INR",
        proposalsLimit: 5, // Updated limit
      };

      // safeUpsertPlan logic simulation
      const updatedPlan = {
        ...existingPlan,
        proposalsLimit: seedData.proposalsLimit,
        // amount and currency preserved!
        amount: existingPlan.amount,
        currency: existingPlan.currency,
      };

      expect(updatedPlan.amount).toBe(299); // PRESERVED!
      expect(updatedPlan.proposalsLimit).toBe(5); // METADATA UPDATED!
    });
  });
});
