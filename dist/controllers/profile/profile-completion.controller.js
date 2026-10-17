import { resolveProfileCompletion, finalizeProfileCompletionStatus, } from "../../services/mobile/profile-completion.service.js";
function normalizeRole(role) {
    const r = (role || "").toLowerCase().trim();
    if (r === "business")
        return "client";
    return r || "freelancer";
}
/**
 * GET /api/profile-completion/me
 * Query params: role (optional - defaults to user.role)
 * Returns full profile completion diagnostics, steps, points, and missing fields.
 */
export async function getProfileCompletion(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId || req.user?.sub;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const requestedRole = req.query.role;
        const activeRole = normalizeRole(requestedRole || req.user?.role || "freelancer");
        const result = await resolveProfileCompletion(userId, activeRole);
        return res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error("[ProfileCompletionController] getProfileCompletion error:", error);
        return res.status(500).json({
            success: false,
            message: error?.message || "Failed to resolve profile completion",
        });
    }
}
/**
 * POST /api/profile-completion/finalize
 * Body: { role?: string }
 * Validates saved data on backend. If 100% complete, records onboardingStatus: COMPLETED.
 */
export async function finalizeProfileCompletion(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId || req.user?.sub;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const requestedRole = (req.body?.role || req.query?.role);
        const activeRole = normalizeRole(requestedRole || req.user?.role || "freelancer");
        const result = await finalizeProfileCompletionStatus(userId, activeRole);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.message,
                data: result,
            });
        }
        return res.status(200).json({
            success: true,
            message: result.message,
            data: result.data,
        });
    }
    catch (error) {
        console.error("[ProfileCompletionController] finalizeProfileCompletion error:", error);
        return res.status(500).json({
            success: false,
            message: error?.message || "Failed to finalize profile completion",
        });
    }
}
