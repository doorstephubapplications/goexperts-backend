import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.middleware.js";

export const roleMiddleware = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const roleStr = String(req.user.role || "").toLowerCase().replace(/\s+/g, "_");
    if (allowedRoles.includes(req.user.role) || allowedRoles.includes(roleStr) || (roleStr === "super_admin" && allowedRoles.includes("admin"))) {
      return next();
    }

    console.error(`[RoleMiddleware] 403 Forbidden. User ID: ${req.user.id}, Role: "${req.user.role}", Normalized Role: "${roleStr}". Expected one of: [${allowedRoles.join(", ")}]`);
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

    if (req.user.type !== "portal") {
      return res.status(403).json({
        success: false,
        message: "Forbidden: portal account required",
      });
    }

    const userRole = String(req.user.role || "").toLowerCase();
    if (userRole === "admin" || userRole === "super_admin") {
      return next();
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
      // For shared routes, we MUST verify the specific requested workspace they are trying to act as.
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

      if (userWithProfiles) {
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
      return res.status(403).json({
        success: false,
        message: `Forbidden: requires one of the following roles: [${roles.join(", ")}]`,
      });
    }
  };
};
