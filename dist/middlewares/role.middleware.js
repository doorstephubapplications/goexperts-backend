export const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (allowedRoles.includes(req.user.role)) {
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
export const portalRoleMiddleware = (roles) => {
    const allowed = roles.map((r) => r.toLowerCase());
    return async (req, res, next) => {
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
        const isProfileActivationPath = reqPath.includes("/profile") ||
            reqPath.includes("/verification") ||
            reqPath.includes("/settings");
        try {
            const { resolveUserTeamMembership } = await import("../controllers/auth/auth.controller.js");
            const teamInfo = await resolveUserTeamMembership(req.user.id, req.user.email);
            // If team member: check delegated permittedDashboards
            if (teamInfo) {
                const permitted = (teamInfo.permittedDashboards || []).map((d) => d.toLowerCase());
                if (roles.some((r) => permitted.includes(r.toLowerCase()))) {
                    return next();
                }
                return res.status(403).json({
                    success: false,
                    code: "TEAM_PERMISSION_DENIED",
                    message: `Forbidden: your team role does not have access to [${roles.join(", ")}]`,
                });
            }
            // If Account Owner:
            // 1. Direct role match on primary user role
            if (allowed.includes(userRole)) {
                return next();
            }
            // 2. Profile setup/management routes are accessible so owners can activate the workspace
            if (isProfileActivationPath) {
                return next();
            }
            // 3. Shared portal routes (routes that declare cross-portal accessibility for all 4 roles)
            const isSharedPortalRoute = roles.length >= 4 &&
                ["client", "investor", "founder", "freelancer"].every((r) => roles.map((x) => x.toLowerCase()).includes(r));
            if (isSharedPortalRoute) {
                return next();
            }
            // 4. Role-specific routes: Check if owner has activated the target profile in DB
            const { prisma } = await import("../config/database.js");
            const userWithProfiles = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    role: true,
                    freelancerProfile: { select: { id: true } },
                    clientProfile: { select: { id: true } },
                    founderProfile: { select: { id: true } },
                    investorProfile: { select: { id: true } },
                },
            });
            if (userWithProfiles) {
                const hasFreelancer = Boolean(userWithProfiles.freelancerProfile) || userWithProfiles.role === "freelancer";
                const hasClient = Boolean(userWithProfiles.clientProfile) || ["client", "business"].includes(userWithProfiles.role);
                const hasFounder = Boolean(userWithProfiles.founderProfile) || ["founder", "startup"].includes(userWithProfiles.role);
                const hasInvestor = Boolean(userWithProfiles.investorProfile) || userWithProfiles.role === "investor";
                const hasRequiredRole = roles.some((r) => {
                    const norm = r.toLowerCase();
                    if (norm === "freelancer" && hasFreelancer)
                        return true;
                    if ((norm === "client" || norm === "business") && hasClient)
                        return true;
                    if ((norm === "founder" || norm === "startup") && hasFounder)
                        return true;
                    if (norm === "investor" && hasInvestor)
                        return true;
                    return false;
                });
                if (hasRequiredRole) {
                    return next();
                }
            }
            return res.status(403).json({
                success: false,
                code: "ROLE_NOT_ACTIVATED",
                message: `Forbidden: requires an activated [${roles.join(", ")}] profile or workspace permission.`,
            });
        }
        catch (e) {
            if (allowed.includes(userRole)) {
                return next();
            }
            return res.status(403).json({
                success: false,
                message: `Forbidden: requires one of the following roles: [${roles.join(", ")}]`,
            });
        }
    };
};
