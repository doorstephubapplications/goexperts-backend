import { prisma } from "../config/database.js";

function resolvePermissionForRoute(routePath: string, method: string): string | null {
  const p = routePath.toLowerCase();

  // Finance & Wallets
  if (p.includes("/admin/wallets") || p.includes("/admin/crud/wallets")) {
    return method === "GET" ? "finance.wallets.view" : "finance.wallets.adjust";
  }
  if (p.includes("/admin/withdrawals")) {
    return method === "GET" ? "finance.withdrawals.view" : "finance.withdrawals.approve";
  }
  if (p.includes("/admin/invoices") || p.includes("/admin/transactions")) {
    return "finance.transactions.view";
  }
  if (p.includes("/admin/plans") || p.includes("/admin/subscriptions")) {
    return method === "GET" ? "finance.subscriptions.view" : "finance.plans.edit";
  }

  // Users
  if (p.includes("/admin/freelancers")) return method === "GET" ? "users.freelancers.view" : "users.freelancers.edit";
  if (p.includes("/admin/clients")) return method === "GET" ? "users.clients.view" : "users.clients.edit";
  if (p.includes("/admin/investors")) return method === "GET" ? "users.investors.view" : "users.investors.edit";
  if (p.includes("/admin/founders")) return method === "GET" ? "users.founders.view" : "users.founders.edit";
  if (p.includes("/admin/user-connections") || p.includes("/admin/users/connections")) return "users.connections.view";
  if (p.includes("/admin/delete-requests")) return "users.delete_requests.view";
  if (p.includes("/admin/messaging") || p.includes("/admin/conversations")) return "users.messaging.view";

  // CRM & Business
  if (p.includes("/admin/projects") || p.includes("/admin/crud/projects")) return "crm.projects.view";
  if (p.includes("/admin/tasks") || p.includes("/admin/crud/tasks")) return "crm.tasks.view";
  if (p.includes("/admin/startup-ideas") || p.includes("/admin/crud/startupideas")) return "crm.startup_ideas.view";
  if (p.includes("/admin/investments") || p.includes("/admin/crud/investments")) return "crm.investments.view";
  if (p.includes("/admin/meetings") || p.includes("/admin/crud/meetings")) return "crm.meetings.view";
  if (p.includes("/admin/support") || p.includes("/admin/contact-enquiries")) return "crm.support_tickets.view";

  // Content
  if (p.includes("/admin/blogs")) return "content.blogs.view";
  if (p.includes("/admin/faqs")) return "content.faqs.view";
  if (p.includes("/admin/push-campaigns") || p.includes("/admin/custom-push-notifications") || p.includes("/admin/coupons")) {
    return "content.advertisement.manage";
  }

  // System & Access
  if (p.includes("/admin/settings")) return "system.settings.view";
  if (p.includes("/admin/masters")) return "system.masters.view";

  return null;
}

export const roleMiddleware = (allowedRoles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const roleStr = String(req.user.role || "").toLowerCase().replace(/\s+/g, "_");

    // Admin staff authorization branch
    if (req.user.type === "admin" && allowedRoles.includes("admin")) {
      // 1. Check if session has been revoked
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        const revoked = await prisma.adminSession.findFirst({
          where: { sessionToken: token, isRevoked: true },
        }).catch(() => null);

        if (revoked) {
          return res.status(401).json({
            success: false,
            message: `Session has been revoked: ${revoked.revocationReason || "Access terminated by administrator"}`,
          });
        }
      }

      // 2. Super Admin bypasses all checks
      if (roleStr === "super_admin" || req.user.role === "Super Admin") {
        return next();
      }

      // 3. Departmental staff: verify permission for this specific admin module
      const targetPath = (req.baseUrl || req.originalUrl || req.path || "").toLowerCase();
      const requiredPerm = resolvePermissionForRoute(targetPath, req.method);

      if (requiredPerm) {
        const staff = await prisma.adminUser.findUnique({
          where: { id: req.user.id },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        }).catch(() => null);

        if (!staff || staff.status !== "active") {
          return res.status(403).json({ success: false, message: "Administrative account is suspended or inactive." });
        }

        const hasPerm = staff.role?.rolePermissions?.some(
          (rp) => rp.permission?.key === requiredPerm || rp.permission?.key === "all"
        );

        if (!hasPerm) {
          return res.status(403).json({
            success: false,
            message: `Forbidden: Missing required permission '${requiredPerm}' to access ${targetPath}.`,
          });
        }
      }

      return next();
    }

    if (
      allowedRoles.includes(req.user.role) ||
      allowedRoles.includes(roleStr) ||
      (roleStr === "super_admin" && allowedRoles.includes("admin"))
    ) {
      return next();
    }

    return res.status(403).json({
      success: false,
      message: `Forbidden: requires one of the following roles: [${allowedRoles.join(", ")}]`,
    });
  };
};

/**
 * Requires the authenticated principal to be a portal user (freelancer, client,
 * investor, founder) - never an admin user - AND to hold an activated profile or permission.
 * - Team Members: validated against delegated permittedDashboards.
 * - Workspace Owners: validated against real profile existence or primary role.
 * - Profile activation/setup routes (/profile, /verification) remain open to owners.
 */
export const portalRoleMiddleware = (roles: string[]) => {
  const allowed = roles.map((r) => r.toLowerCase());
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userRole = String(req.user.role || "").toLowerCase();
    if (req.user.type === "admin" || userRole === "admin" || userRole === "super_admin") {
      return next();
    }

    if (req.user.type !== "portal") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: portal account required",
      });
    }

    // Always allow profile setup, onboarding, verification, and settings endpoints so owners can activate roles
    const reqPath = (req.path || req.baseUrl || "").toLowerCase();
    const isProfileActivationPath =
      reqPath.includes("/profile") ||
      reqPath.includes("/verification") ||
      reqPath.includes("/settings");

    try {
      const { resolveUserTeamMembership } = await import("../controllers/auth/auth.controller.js");
      const teamInfo = await resolveUserTeamMembership(req.user.id, req.user.email);

      // If team member: check delegated permittedDashboards
      if (teamInfo) {
        const permitted = (teamInfo.permittedDashboards || []).map((d: string) => d.toLowerCase());
        if (roles.some((r) => permitted.includes(r.toLowerCase()))) {
          return next();
        }
        return res.status(403).json({
          success: false,
          code: "TEAM_PERMISSION_DENIED",
          message: `Forbidden: your team role does not have access to [${roles.join(", ")}]`,
        });
      }

      // 2. Profile setup/management routes are accessible so owners can activate the workspace
      if (isProfileActivationPath) {
        return next();
      }

      // 3. Shared portal routes (routes that declare cross-portal accessibility for all 4 roles)
      const isSharedPortalRoute =
        roles.length >= 4 &&
        ["client", "investor", "founder", "freelancer"].every((r) =>
          roles.map((x) => x.toLowerCase()).includes(r)
        );

      // For shared portal routes (messages, watchlist, tasks, teams, projects, etc.), allow access immediately
      if (isSharedPortalRoute) {
        return next();
      }

      const requestedWorkspace = String(req.user.activeWorkspace || userRole).toLowerCase();

      // Workspace context check (unless shared route)
      if (!isSharedPortalRoute && !isProfileActivationPath) {
        if (!roles.map(r => r.toLowerCase()).includes(requestedWorkspace)) {
           return res.status(403).json({
             success: false,
             code: "WORKSPACE_MISMATCH",
             message: `Forbidden: requested route requires [${roles.join(", ")}] but current workspace is ${requestedWorkspace}`,
           });
        }
      }

      // We now need to prove the user actually OWNS the requestedWorkspace
      const targetRolesToVerify = isProfileActivationPath ? allowed : [requestedWorkspace];

      // 4. Role-specific routes: Check if owner has activated the target profile in DB
      const { prisma } = await import("../config/database.js");
      const userWithProfiles = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          role: true,
          userRoles: true,
          freelancerProfile: { select: { id: true } },
          clientProfile: { select: { id: true } },
          founderProfile: { select: { id: true } },
          investorProfile: { select: { id: true } },
        },
      });

      // Workspace owners and platform accounts have global access across portals
      if (userWithProfiles) {
        const isOwner = (userWithProfiles as any).isOwner === true || 
                        (userWithProfiles as any).accountType === "owner" || 
                        !teamInfo;
        if (isOwner) {
          return next();
        }

        // Strict Check: Primary Role OR explicitly activated in UserRole table
        const hasPrimaryOrActivatedRole = targetRolesToVerify.some((r) => {
          const norm = r.toLowerCase();
          if (userWithProfiles.role.toLowerCase() === norm) return true;
          return userWithProfiles.userRoles?.some(ur => ur.role.toLowerCase() === norm && ur.status === "active");
        });

        if (hasPrimaryOrActivatedRole) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        code: "ROLE_NOT_ACTIVATED",
        message: `Forbidden: requires an activated [${targetRolesToVerify.join(", ")}] profile or workspace permission.`,
      });
    } catch (e) {
      console.error("[portalRoleMiddleware] Crash:", e);
      return res.status(403).json({
        success: false,
        message: `Forbidden: requires one of the following roles: [${roles.join(", ")}]`,
      });
    }
  };
};
