import { describe, it, expect } from "vitest";

// Canonical Role Resolver logic matching frontend & backend implementations
export type WorkspaceRole = "freelancer" | "client" | "founder" | "investor";

export function getActivatedRoles(user: {
  role?: string;
  activatedRoles?: string[];
  activeProfiles?: {
    freelancer?: boolean;
    client?: boolean;
    founder?: boolean;
    investor?: boolean;
  };
  freelancerProfile?: unknown;
  clientProfile?: unknown;
  founderProfile?: unknown;
  investorProfile?: unknown;
}): WorkspaceRole[] {
  const activated: WorkspaceRole[] = [];

  const hasFreelancer = Boolean(user.activeProfiles?.freelancer ?? user.freelancerProfile);
  const hasClient = Boolean(user.activeProfiles?.client ?? user.clientProfile);
  const hasFounder = Boolean(user.activeProfiles?.founder ?? user.founderProfile);
  const hasInvestor = Boolean(user.activeProfiles?.investor ?? user.investorProfile);

  if (hasFreelancer) activated.push("freelancer");
  if (hasClient) activated.push("client");
  if (hasFounder) activated.push("founder");
  if (hasInvestor) activated.push("investor");

  // Legacy fallback: ensure primary role is always activated
  const primary = (user.role?.toLowerCase() === "business" ? "client" : user.role?.toLowerCase()) as WorkspaceRole;
  if (primary && !activated.includes(primary) && ["freelancer", "client", "founder", "investor"].includes(primary)) {
    activated.unshift(primary);
  }

  return activated;
}

export function isRoleActivated(user: any, role: string): boolean {
  const norm = role === "business" ? "client" : role.toLowerCase();
  return getActivatedRoles(user).includes(norm as WorkspaceRole);
}

export function validateSavedActiveWorkspace(user: any, savedRole: string | null): WorkspaceRole {
  if (savedRole) {
    const norm = savedRole === "business" ? "client" : savedRole.toLowerCase();
    if (isRoleActivated(user, norm)) {
      return norm as WorkspaceRole;
    }
  }
  const activated = getActivatedRoles(user);
  return activated[0] || "freelancer";
}

// Backend portalRoleMiddleware verification logic
export function verifyPortalAccess(
  portalRole: "client" | "founder" | "investor" | "freelancer",
  user: {
    id: string;
    role: string;
    isOwner?: boolean;
    accountType?: string;
    freelancerProfile?: unknown;
    clientProfile?: unknown;
    founderProfile?: unknown;
    investorProfile?: unknown;
  },
  reqPath: string
): { allowed: boolean; status?: number; error?: string } {
  // 1. Admin bypass
  if (user.role === "admin" || user.role === "super_admin" || user.role === "superadmin") {
    return { allowed: true };
  }

  // 2. Profile setup route allowance
  const isProfileSetup =
    reqPath.includes("/profile") ||
    reqPath.includes("/verification") ||
    reqPath.includes("/settings") ||
    reqPath.includes("/setup");

  if (isProfileSetup) {
    return { allowed: true };
  }

  // 3. Profile existence check
  let hasProfile = false;
  if (portalRole === "client") hasProfile = Boolean(user.clientProfile);
  else if (portalRole === "founder") hasProfile = Boolean(user.founderProfile);
  else if (portalRole === "investor") hasProfile = Boolean(user.investorProfile);
  else if (portalRole === "freelancer") hasProfile = Boolean(user.freelancerProfile || user.role === "freelancer");

  if (hasProfile) {
    return { allowed: true };
  }

  return {
    allowed: false,
    status: 403,
    error: `Access denied. You do not have an activated ${portalRole} profile.`,
  };
}

describe("Multi-Role Workspace Architecture Unit Tests", () => {
  describe("1. Activated Role Resolution based on Profile Existence", () => {
    it("ACCOUNT A: Freelancer with only freelancerProfile has ONLY Freelancer activated", () => {
      const user = {
        role: "freelancer",
        freelancerProfile: { id: "fp-1", skills: ["React"] },
        clientProfile: null,
        founderProfile: null,
        investorProfile: null,
      };
      const roles = getActivatedRoles(user);
      expect(roles).toEqual(["freelancer"]);
      expect(isRoleActivated(user, "freelancer")).toBe(true);
      expect(isRoleActivated(user, "client")).toBe(false);
      expect(isRoleActivated(user, "founder")).toBe(false);
      expect(isRoleActivated(user, "investor")).toBe(false);
    });

    it("ACCOUNT B: Freelancer + Client profiles activated", () => {
      const user = {
        role: "freelancer",
        freelancerProfile: { id: "fp-1" },
        clientProfile: { id: "cp-1", companyName: "Acme Corp" },
        founderProfile: null,
        investorProfile: null,
      };
      const roles = getActivatedRoles(user);
      expect(roles).toEqual(["freelancer", "client"]);
      expect(isRoleActivated(user, "freelancer")).toBe(true);
      expect(isRoleActivated(user, "client")).toBe(true);
      expect(isRoleActivated(user, "founder")).toBe(false);
      expect(isRoleActivated(user, "investor")).toBe(false);
    });

    it("ACCOUNT C: Founder primary with Founder + Investor profiles", () => {
      const user = {
        role: "founder",
        freelancerProfile: null,
        clientProfile: null,
        founderProfile: { id: "fnd-1", startupName: "NextGen AI" },
        investorProfile: { id: "inv-1", ticketSize: "$50k-$200k" },
      };
      const roles = getActivatedRoles(user);
      expect(roles).toEqual(["founder", "investor"]);
      expect(isRoleActivated(user, "founder")).toBe(true);
      expect(isRoleActivated(user, "investor")).toBe(true);
      expect(isRoleActivated(user, "freelancer")).toBe(false);
      expect(isRoleActivated(user, "client")).toBe(false);
    });

    it("ACCOUNT D: All four profiles activated", () => {
      const user = {
        role: "freelancer",
        freelancerProfile: { id: "fp-1" },
        clientProfile: { id: "cp-1" },
        founderProfile: { id: "fnd-1" },
        investorProfile: { id: "inv-1" },
      };
      const roles = getActivatedRoles(user);
      expect(roles).toEqual(["freelancer", "client", "founder", "investor"]);
      expect(roles.length).toBe(4);
    });

    it("LEGACY ACCOUNT: primary role 'freelancer' with null profile is safely preserved", () => {
      const user = {
        role: "freelancer",
        freelancerProfile: null,
        clientProfile: null,
        founderProfile: null,
        investorProfile: null,
      };
      const roles = getActivatedRoles(user);
      expect(roles).toEqual(["freelancer"]);
      expect(isRoleActivated(user, "freelancer")).toBe(true);
    });
  });

  describe("2. Active Workspace Persistence & Cross-Account Isolation", () => {
    it("User A switches to Investor, saved role 'investor' is valid for User A", () => {
      const userA = {
        role: "freelancer",
        freelancerProfile: { id: "fp-1" },
        investorProfile: { id: "inv-1" },
      };
      const resolved = validateSavedActiveWorkspace(userA, "investor");
      expect(resolved).toBe("investor");
    });

    it("User B (Client only) logs in on same browser: saved 'investor' role from User A is REJECTED", () => {
      const userB = {
        role: "client",
        freelancerProfile: null,
        clientProfile: { id: "cp-2" },
        founderProfile: null,
        investorProfile: null,
      };
      // Stale sessionStorage from User A
      const staleSaved = "investor";
      const resolved = validateSavedActiveWorkspace(userB, staleSaved);
      // Must NOT return investor!
      expect(resolved).not.toBe("investor");
      expect(resolved).toBe("client");
    });
  });

  describe("3. Owner Permissions vs Product Role Separation (Ghost-Workspace Protection)", () => {
    it("Owner with only Freelancer profile is BLOCKED from accessing protected Investor endpoints", () => {
      const ownerFreelancerOnly = {
        id: "usr-1",
        role: "freelancer",
        isOwner: true,
        accountType: "owner",
        freelancerProfile: { id: "fp-1" },
        investorProfile: null,
      };

      const result = verifyPortalAccess("investor", ownerFreelancerOnly, "/investor/portfolio");
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
    });

    it("Owner with only Freelancer profile IS ALLOWED to access Investor setup/profile endpoints for activation", () => {
      const ownerFreelancerOnly = {
        id: "usr-1",
        role: "freelancer",
        isOwner: true,
        accountType: "owner",
        freelancerProfile: { id: "fp-1" },
        investorProfile: null,
      };

      const result = verifyPortalAccess("investor", ownerFreelancerOnly, "/investor/profile");
      expect(result.allowed).toBe(true);
    });

    it("Owner with activated Founder profile CAN access protected Founder endpoints", () => {
      const ownerWithFounder = {
        id: "usr-2",
        role: "freelancer", // primary role stays freelancer!
        isOwner: true,
        founderProfile: { id: "fnd-2" },
      };

      const result = verifyPortalAccess("founder", ownerWithFounder, "/founder/startup/milestones");
      expect(result.allowed).toBe(true);
    });

    it("Super Admin bypasses portal role profile requirements", () => {
      const admin = {
        id: "admin-1",
        role: "super_admin",
      };
      const result = verifyPortalAccess("investor", admin, "/investor/confidential-deals");
      expect(result.allowed).toBe(true);
    });
  });
});
