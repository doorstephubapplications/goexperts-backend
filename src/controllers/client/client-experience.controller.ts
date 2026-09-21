import { Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

export const getClientExperience = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    const rows = await prisma.freelancerExperience.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

export const putClientExperience = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });
    
    let items = Array.isArray(req.body) ? req.body : (req.body?.items || null);
    if (!items) {
      if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) items = [req.body];
      else return res.status(400).json({ success: false, message: "items array is required" });
    }
    
    await prisma.$transaction([
      prisma.freelancerExperience.deleteMany({ where: { userId } }),
      prisma.freelancerExperience.createMany({
        data: items.map((item: any) => ({
          userId,
          title: String(item.title || item.designation || ""),
          company: String(item.company || ""),
          location: item.location ? String(item.location) : null,
          projects: item.projects ? parseInt(item.projects, 10) : 0,
          workMode: item.workMode ? String(item.workMode) : null,
          country: item.country ? String(item.country) : null,
          city: item.city ? String(item.city) : null,
          industryId: item.industryId ? String(item.industryId) : null,
          startDate: item.startDate ? String(item.startDate) : null,
          endDate: item.endDate ? String(item.endDate) : null,
          isCurrent: Boolean(item.isCurrent),
          description: item.description ? String(item.description) : null,
          skillsUsed: Array.isArray(item.skillsUsed) ? item.skillsUsed.join(", ") : (item.skillsUsed ? String(item.skillsUsed) : null),
        })),
      }),
    ]);
    
    const newRows = await prisma.freelancerExperience.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, message: "Experience updated", data: newRows });
  } catch (err) {
    next(err);
  }
};
