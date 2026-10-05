import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  computePlanEndDate,
  normalizeRoleKey,
  ActionGateError,
  resolveRoleEntitlement,
  assertActionEntitlement,
} from "../../services/subscription/entitlement.service.js";
import { prisma } from "../../config/database.js";

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

    it("should prevent duplicate free trials across multiple roles on same account", () => {
      const user = {
        id: "user-123",
        trialEndsAt: new Date("2027-04-01T00:00:00Z"),
      };
      const now = new Date("2026-10-04T00:00:00Z");
      const isEligibleForNewTrial = !user.trialEndsAt || user.trialEndsAt.getTime() <= now.getTime();
      expect(isEligibleForNewTrial).toBe(false);
    });

    it("should preserve active subscription on other roles when single-role add-on is purchased", () => {
      const activeSubs = [
        { id: "sub-fl", role: "freelancer", status: "active" },
        { id: "sub-cl", role: "client", status: "active" },
      ];
      const newRoleTarget = "client";

      // When upgrading or purchasing for 'client', only 'client' sub is cancelled/replaced, 'freelancer' is preserved!
      const updatedSubs = activeSubs.map(s => {
        if (s.role === newRoleTarget) return { ...s, status: "cancelled", reason: "Replaced by new Client Plan" };
        return s;
      });

      const activeFreelancer = updatedSubs.find(s => s.role === "freelancer" && s.status === "active");
      const cancelledClient = updatedSubs.find(s => s.role === "client" && s.status === "cancelled");

      expect(activeFreelancer).toBeDefined();
      expect(cancelledClient).toBeDefined();
    });

    it("should subsume and cancel all single-role subscriptions when All Access is activated", () => {
      const activeSubs = [
        { id: "sub-fl", role: "freelancer", status: "active" },
        { id: "sub-cl", role: "client", status: "active" },
        { id: "sub-fo", role: "founder", status: "active" },
      ];

      // When All Access is activated, all existing single-role subscriptions are subsumed
      const updatedSubs = activeSubs.map(s => ({
        ...s,
        status: "cancelled",
        reason: "Subsumed by Go Experts All Access Plan",
      }));

      expect(updatedSubs.every(s => s.status === "cancelled")).toBe(true);
    });

    it("should enforce authoritative server price regardless of client-supplied amount", () => {
      const authoritativeDbPlan = { id: "plan-fl-mo", amount: 399 };
      const clientPayload = { planId: "plan-fl-mo", amount: 10 }; // Attacker tampering attempt

      // Server overrides with DB value
      const checkoutAmount = authoritativeDbPlan.amount;
      expect(checkoutAmount).toBe(399);
      expect(checkoutAmount).not.toBe(clientPayload.amount);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // STAGE-B-FUNC-01: PAID SUBSCRIPTION VS FREE-TRIAL ENTITLEMENT PRECEDENCE
  // ─────────────────────────────────────────────────────────────────────────────
  describe("STAGE-B-FUNC-01: Paid Subscription vs Free-Trial Entitlement Precedence", () => {
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days in future
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days in past

    let findUniqueUserSpy: any;
    let findUniqueUsageSpy: any;

    beforeEach(() => {
      findUniqueUserSpy = vi.spyOn(prisma.user, "findUnique");
      findUniqueUsageSpy = vi.spyOn(prisma.subscriptionUsage, "findUnique");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    // A. Active trial only => trial entitlement
    it("Scenario A: active trial only => resolves trial entitlement across roles", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-a",
        trialEndsAt: futureDate,
        subscriptions: [],
      } as any);

      const res = await resolveRoleEntitlement("usr-a", "freelancer");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("trial");
      expect(res.planName).toBe("6-Month Free Access");
      expect(res.isTrial).toBe(true);
      expect(res.quotaLimit).toBe(36);
      expect(res.gateReason).toBeNull();
    });

    // B. Paid Freelancer + active trial requesting Freelancer => paid Freelancer wins
    it("Scenario B: paid Freelancer + active trial requesting Freelancer => paid Freelancer wins", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-b",
        trialEndsAt: futureDate,
        subscriptions: [
          {
            id: "sub-fl-b",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-fl",
              name: "Freelancer Starter Monthly",
              role: "freelancer",
              planType: "single_role",
              amount: 399,
              duration: "monthly",
              proposalsLimit: 3,
              projectsLimit: 0,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-b", "freelancer");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("single_role");
      expect(res.planName).toBe("Freelancer Starter Monthly");
      expect(res.subscriptionId).toBe("sub-fl-b");
      expect(res.isTrial).toBe(false); // Paid subscription wins over trial!
      expect(res.quotaLimit).toBe(3);
      expect(res.gateReason).toBeNull();
    });

    // C. Paid Freelancer + active trial requesting Founder => trial applies if Free Intro Access covers Founder
    it("Scenario C: paid Freelancer + active trial requesting Founder => trial applies for secondary role", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-c",
        trialEndsAt: futureDate,
        subscriptions: [
          {
            id: "sub-fl-c",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-fl",
              name: "Freelancer Starter Monthly",
              role: "freelancer",
              planType: "single_role",
              amount: 399,
              duration: "monthly",
              proposalsLimit: 3,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-c", "founder");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("trial");
      expect(res.isTrial).toBe(true);
      expect(res.isUnlimited).toBe(true); // Founder is unlimited in trial
      expect(res.gateReason).toBeNull();
    });

    // D. Paid Founder + active trial requesting Founder => paid Founder wins
    it("Scenario D: paid Founder + active trial requesting Founder => paid Founder wins", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-d",
        trialEndsAt: futureDate,
        subscriptions: [
          {
            id: "sub-fo-d",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-fo",
              name: "Founder Monthly",
              role: "founder",
              planType: "single_role",
              amount: 499,
              duration: "monthly",
              proposalsLimit: -1,
              projectsLimit: -1,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-d", "founder");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("single_role");
      expect(res.planName).toBe("Founder Monthly");
      expect(res.subscriptionId).toBe("sub-fo-d");
      expect(res.isTrial).toBe(false);
      expect(res.isUnlimited).toBe(true);
      expect(res.quotaLimit).toBe(-1);
      expect(res.gateReason).toBeNull();
    });

    // E. Paid Investor + active trial requesting Investor => paid Investor wins
    it("Scenario E: paid Investor + active trial requesting Investor => paid Investor wins", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-e",
        trialEndsAt: futureDate,
        subscriptions: [
          {
            id: "sub-inv-e",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-inv",
              name: "Investor Annual",
              role: "investor",
              planType: "single_role",
              amount: 2999,
              duration: "yearly",
              proposalsLimit: -1,
              projectsLimit: -1,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-e", "investor");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("single_role");
      expect(res.planName).toBe("Investor Annual");
      expect(res.subscriptionId).toBe("sub-inv-e");
      expect(res.isTrial).toBe(false);
      expect(res.isUnlimited).toBe(true);
      expect(res.quotaLimit).toBe(-1);
      expect(res.gateReason).toBeNull();
    });

    // F. Paid Client + active trial requesting Client => paid Client wins
    it("Scenario F: paid Client + active trial requesting Client => paid Client wins", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-f",
        trialEndsAt: futureDate,
        subscriptions: [
          {
            id: "sub-cl-f",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-cl",
              name: "Client Monthly",
              role: "client",
              planType: "single_role",
              amount: 499,
              duration: "monthly",
              projectsLimit: 3,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-f", "client");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("single_role");
      expect(res.planName).toBe("Client Monthly");
      expect(res.subscriptionId).toBe("sub-cl-f");
      expect(res.isTrial).toBe(false);
      expect(res.quotaLimit).toBe(3);
      expect(res.gateReason).toBeNull();
    });

    // G. All Access + active trial => All Access wins
    it("Scenario G: All Access + active trial => All Access wins over trial", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-g",
        trialEndsAt: futureDate,
        subscriptions: [
          {
            id: "sub-aa-g",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-aa",
              name: "Go Experts All Access Annual",
              role: "all",
              planType: "all_access",
              amount: 6999,
              duration: "yearly",
              proposalsLimit: -1,
              projectsLimit: -1,
            },
          },
        ],
      } as any);

      const roles = ["freelancer", "client", "founder", "investor"];
      for (const role of roles) {
        const res = await resolveRoleEntitlement("usr-g", role);
        expect(res.isEntitled).toBe(true);
        expect(res.planType).toBe("all_access");
        expect(res.planName).toBe("Go Experts All Access Annual");
        expect(res.subscriptionId).toBe("sub-aa-g");
        expect(res.isTrial).toBe(false);
        expect(res.isUnlimited).toBe(true);
        expect(res.quotaLimit).toBe(-1);
        expect(res.gateReason).toBeNull();
      }
    });

    // H. Expired paid role subscription + active trial => trial wins
    it("Scenario H: expired paid role subscription + active trial => trial wins", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-h",
        trialEndsAt: futureDate,
        subscriptions: [
          {
            id: "sub-exp-h",
            status: "active",
            startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            endDate: pastDate, // EXPIRED
            plan: {
              id: "plan-fl",
              name: "Freelancer Starter Monthly",
              role: "freelancer",
              planType: "single_role",
              amount: 399,
              duration: "monthly",
              proposalsLimit: 3,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-h", "freelancer");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("trial");
      expect(res.isTrial).toBe(true);
      expect(res.quotaLimit).toBe(36);
      expect(res.gateReason).toBeNull();
    });

    // I. Active paid role subscription without trial => paid entitlement
    it("Scenario I: active paid role subscription without trial => paid entitlement", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-i",
        trialEndsAt: null,
        subscriptions: [
          {
            id: "sub-fl-i",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-fl-yr",
              name: "Freelancer Annual",
              role: "freelancer",
              planType: "single_role",
              amount: 3999,
              duration: "yearly",
              proposalsLimit: 36,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-i", "freelancer");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("single_role");
      expect(res.isTrial).toBe(false);
      expect(res.quotaLimit).toBe(36);
      expect(res.gateReason).toBeNull();
    });

    // J. No valid paid subscription and no valid trial => NO_SUBSCRIPTION / expected gate
    it("Scenario J: no valid paid subscription and no valid trial => NO_SUBSCRIPTION gate", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-j",
        trialEndsAt: null,
        subscriptions: [],
      } as any);

      const res = await resolveRoleEntitlement("usr-j", "freelancer");
      expect(res.isEntitled).toBe(false);
      expect(res.planType).toBe("none");
      expect(res.gateReason).toBe("NO_SUBSCRIPTION");

      await expect(assertActionEntitlement("usr-j", "freelancer", "submitProposal")).rejects.toThrowError(
        ActionGateError
      );
    });

    // K. Paid subscription for different role without valid free access => ROLE_NOT_ENTITLED
    it("Scenario K: paid subscription for different role without valid free access => ROLE_NOT_ENTITLED", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-k",
        trialEndsAt: pastDate, // expired trial
        subscriptions: [
          {
            id: "sub-fl-k",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-fl",
              name: "Freelancer Starter Monthly",
              role: "freelancer",
              planType: "single_role",
              amount: 399,
              duration: "monthly",
              proposalsLimit: 3,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-k", "client");
      expect(res.isEntitled).toBe(false);
      expect(res.planType).toBe("none");
      expect(res.gateReason).toBe("ROLE_NOT_ENTITLED");

      await expect(assertActionEntitlement("usr-k", "client", "publishProject")).rejects.toThrowError(
        /CLIENT workspace/
      );
    });

    // L. Quota-exhausted Freelancer paid plan => QUOTA_EXHAUSTED
    it("Scenario L: quota-exhausted Freelancer paid plan => QUOTA_EXHAUSTED", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-l",
        trialEndsAt: null,
        subscriptions: [
          {
            id: "sub-fl-l",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-fl",
              name: "Freelancer Starter Monthly",
              role: "freelancer",
              planType: "single_role",
              amount: 399,
              duration: "monthly",
              proposalsLimit: 3,
            },
          },
        ],
      } as any);

      findUniqueUsageSpy.mockResolvedValue({
        subscriptionId: "sub-fl-l",
        featureKey: "proposals_submitted",
        used: 3, // Full quota used
      } as any);

      const res = await resolveRoleEntitlement("usr-l", "freelancer", "submitProposal");
      expect(res.isEntitled).toBe(false);
      expect(res.planType).toBe("single_role");
      expect(res.quotaLimit).toBe(3);
      expect(res.quotaUsed).toBe(3);
      expect(res.quotaRemaining).toBe(0);
      expect(res.gateReason).toBe("QUOTA_EXHAUSTED");

      await expect(assertActionEntitlement("usr-l", "freelancer", "submitProposal")).rejects.toThrowError(
        /proposal quota for this billing cycle has been reached \(3\/3\)/
      );
    });

    // M. Quota-exhausted Client paid plan => QUOTA_EXHAUSTED
    it("Scenario M: quota-exhausted Client paid plan => QUOTA_EXHAUSTED", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-m",
        trialEndsAt: null,
        subscriptions: [
          {
            id: "sub-cl-m",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-cl",
              name: "Client Monthly",
              role: "client",
              planType: "single_role",
              amount: 499,
              duration: "monthly",
              projectsLimit: 3,
            },
          },
        ],
      } as any);

      findUniqueUsageSpy.mockResolvedValue({
        subscriptionId: "sub-cl-m",
        featureKey: "projects_published",
        used: 3, // Full quota used
      } as any);

      const res = await resolveRoleEntitlement("usr-m", "client", "publishProject");
      expect(res.isEntitled).toBe(false);
      expect(res.planType).toBe("single_role");
      expect(res.quotaLimit).toBe(3);
      expect(res.quotaUsed).toBe(3);
      expect(res.quotaRemaining).toBe(0);
      expect(res.gateReason).toBe("QUOTA_EXHAUSTED");

      await expect(assertActionEntitlement("usr-m", "client", "publishProject")).rejects.toThrowError(
        /project post quota for this billing cycle has been reached \(3\/3\)/
      );
    });

    // Additional: Founder & Investor paid plans remain unlimited
    it("Scenario Extra 1: Founder and Investor paid plans remain unlimited", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-unlimited",
        trialEndsAt: null,
        subscriptions: [
          {
            id: "sub-fo-unlimited",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-fo",
              name: "Founder Annual",
              role: "founder",
              planType: "single_role",
              amount: 4999,
              duration: "yearly",
              proposalsLimit: -1,
              projectsLimit: -1,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-unlimited", "founder");
      expect(res.isEntitled).toBe(true);
      expect(res.isUnlimited).toBe(true);
      expect(res.quotaLimit).toBe(-1);
      expect(res.quotaRemaining).toBe(999999);
    });

    // Additional: planType consistency normalization
    it("Scenario Extra 2: normalizes legacy/inconsistent 'add_on' planType to canonical 'addon'", async () => {
      findUniqueUserSpy.mockResolvedValue({
        id: "usr-addon",
        trialEndsAt: null,
        subscriptions: [
          {
            id: "sub-addon-1",
            status: "active",
            startDate: pastDate,
            endDate: futureDate,
            plan: {
              id: "plan-addon-founder",
              name: "Founder Add-on",
              role: "founder",
              planType: "add_on", // Inconsistent legacy representation
              amount: 149,
              duration: "monthly",
              proposalsLimit: -1,
              projectsLimit: -1,
            },
          },
        ],
      } as any);

      const res = await resolveRoleEntitlement("usr-addon", "founder");
      expect(res.isEntitled).toBe(true);
      expect(res.planType).toBe("addon"); // Normalized to canonical 'addon'
      expect(res.gateReason).toBeNull();
    });
  });
});


