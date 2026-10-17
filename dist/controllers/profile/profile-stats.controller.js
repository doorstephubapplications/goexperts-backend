import { resolveProfileStats } from "../../services/profile/profile-stats.service.js";
/**
 * GET /api/profile/stats/me
 * Query params: role (optional - defaults to user.role)
 * Returns live calculated database metrics for the authenticated profile.
 */
export async function getProfileStats(req, res) {
    try {
        const userId = req.user?.id || req.user?.userId || req.user?.sub;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const requestedRole = req.query.role || req.user?.role || "freelancer";
        const result = await resolveProfileStats(userId, requestedRole);
        return res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error("[ProfileStatsController] getProfileStats error:", error);
        return res.status(500).json({
            success: false,
            message: error?.message || "Failed to resolve profile statistics",
        });
    }
}
