import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { dispatchCampaign, executeScheduledSlot } from "../../services/notifications/push-campaign-engine.service.js";
import { seedPushCampaigns } from "../../services/notifications/seed-push-campaigns.js";

export const adminPushCampaignsRouter = Router();

// ==========================================
// 1. GET ALL CAMPAIGNS (WITH STATS & FILTERS)
// ==========================================
adminPushCampaignsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, status, category, search, page = "1" } = req.query;
    const pageSizeParam = req.query.pageSize || req.query.limit || "10";

    const where: any = { deletedAt: null };

    if (role && role !== "ALL") {
      where.targetRole = String(role).toUpperCase();
    }

    if (status && status !== "ALL") {
      where.status = String(status).toUpperCase();
    }

    if (category && category !== "ALL") {
      where.category = String(category);
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
        { category: { contains: q } },
        { offer: { contains: q } }
      ];
    }

    const take = Math.min(Math.max(1, parseInt(String(pageSizeParam), 10) || 10), 200);
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const skip = (pageNum - 1) * take;

    const [rows, total, statsActive, statsPaused, allCounts] = await Promise.all([
      prisma.pushCampaign.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      prisma.pushCampaign.count({ where }),
      prisma.pushCampaign.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.pushCampaign.count({ where: { deletedAt: null, status: "PAUSED" } }),
      prisma.pushCampaign.groupBy({
        by: ["targetRole"],
        where: { deletedAt: null },
        _count: { id: true }
      })
    ]);

    const roleCounts: Record<string, number> = {
      FREELANCER: 0,
      CLIENT: 0,
      FOUNDER: 0,
      INVESTOR: 0
    };

    allCounts.forEach((c) => {
      roleCounts[c.targetRole] = c._count.id;
    });

    const totalCampaigns = await prisma.pushCampaign.count({ where: { deletedAt: null } });

    res.json({
      success: true,
      data: rows,
      rows,
      total,
      page: pageNum,
      pageSize: take,
      totalPages: Math.max(1, Math.ceil(total / take)),
      stats: {
        total: totalCampaigns,
        active: statsActive,
        paused: statsPaused,
        roleCounts
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. SCHEDULE SETTINGS (3x DAILY DISPATCH ENGINE)
// ==========================================
adminPushCampaignsRouter.get("/schedules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedules = await prisma.pushScheduleSetting.findMany({
      orderBy: { slotKey: "asc" }
    });
    res.json({ success: true, data: schedules });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.put("/schedules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { schedules } = req.body;

    if (!Array.isArray(schedules)) {
      return res.status(400).json({ success: false, message: "schedules must be an array" });
    }

    const updated: any[] = [];

    for (const item of schedules) {
      if (!item.slotKey) continue;
      const resItem = await prisma.pushScheduleSetting.upsert({
        where: { slotKey: item.slotKey },
        update: {
          time: item.time,
          label: item.label,
          isEnabled: Boolean(item.isEnabled),
          targetRole: item.targetRole || "ALL"
        },
        create: {
          slotKey: item.slotKey,
          time: item.time || "09:30",
          label: item.label || "Daily Dispatch",
          isEnabled: item.isEnabled !== false,
          targetRole: item.targetRole || "ALL"
        }
      });
      updated.push(resItem);
    }

    res.json({ success: true, message: "Schedule settings updated successfully", data: updated });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.post("/schedules/:slotKey/trigger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slotKey } = req.params;
    const result = await executeScheduledSlot(slotKey);
    res.json({ success: true, message: `Slot ${slotKey} triggered successfully`, result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2B. GLOBAL CAMPAIGN LAYOUT MANAGEMENT
// ==========================================
export const DEFAULT_GLOBAL_LAYOUT = {
  appName: "GoExperts",
  appLogoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80",
  brandColor: "#2563EB",
  headerBadgeText: "OFFICIAL",
  layoutStyle: "zomato_punch", // "zomato_punch" | "ios_modern" | "material_rich" | "compact_alert"
  ctaButton1Text: "Explore Now",
  ctaButton2Text: "Dismiss",
  showCtaButtons: true,
  defaultBannerUrl: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80",
  footerSubtext: "DoorstepHub GoExperts • Push Dispatcher",
  soundEnabled: true,
  badgeCount: 1,
  showOfferBadge: true
};

adminPushCampaignsRouter.get("/layout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "PUSH_CAMPAIGN_GLOBAL_LAYOUT" }
    });

    let layout = DEFAULT_GLOBAL_LAYOUT;
    if (setting?.value) {
      try {
        layout = { ...DEFAULT_GLOBAL_LAYOUT, ...JSON.parse(setting.value) };
      } catch (e) {
        layout = DEFAULT_GLOBAL_LAYOUT;
      }
    }

    res.json({ success: true, data: layout });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.put("/layout", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newLayout = req.body;
    if (!newLayout || typeof newLayout !== "object") {
      return res.status(400).json({ success: false, message: "Invalid layout payload" });
    }

    const merged = { ...DEFAULT_GLOBAL_LAYOUT, ...newLayout };

    await prisma.setting.upsert({
      where: { key: "PUSH_CAMPAIGN_GLOBAL_LAYOUT" },
      update: {
        value: JSON.stringify(merged),
        category: "push_campaigns"
      },
      create: {
        key: "PUSH_CAMPAIGN_GLOBAL_LAYOUT",
        value: JSON.stringify(merged),
        category: "push_campaigns"
      }
    });

    res.json({
      success: true,
      message: "Global campaign layout updated successfully. All 120 campaigns now reflect these changes.",
      data: merged
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. CAMPAIGN HISTORY
// ==========================================
adminPushCampaignsRouter.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, page = "1", limit = "50" } = req.query;

    const where: any = {};
    if (role && role !== "ALL") {
      where.targetRole = String(role).toUpperCase();
    }

    const take = Math.min(parseInt(String(limit), 10) || 50, 100);
    const skip = ((parseInt(String(page), 10) || 1) - 1) * take;

    const [rows, total] = await Promise.all([
      prisma.pushCampaignHistory.findMany({
        where,
        orderBy: { sentAt: "desc" },
        skip,
        take
      }),
      prisma.pushCampaignHistory.count({ where })
    ]);

    res.json({ success: true, data: rows, rows, total });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. SEED CAMPAIGNS (120 UNIQUE)
// ==========================================
adminPushCampaignsRouter.post("/seed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await seedPushCampaigns();
    const count = await prisma.pushCampaign.count({ where: { deletedAt: null } });
    res.json({ success: true, message: `Successfully seeded campaigns. Total in DB: ${count}` });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. GET SINGLE CAMPAIGN
// ==========================================
adminPushCampaignsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.pushCampaign.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: {
        history: {
          orderBy: { sentAt: "desc" },
          take: 10
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. CREATE CAMPAIGN
// ==========================================
adminPushCampaignsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, imageUrl, targetRole, category, offer, deepLink, status = "ACTIVE", scheduleSlot = "SLOT_1" } = req.body;

    if (!title || !description || !targetRole) {
      return res.status(400).json({ success: false, message: "title, description, and targetRole are required" });
    }

    const campaign = await prisma.pushCampaign.create({
      data: {
        title,
        description,
        imageUrl: imageUrl || null,
        targetRole: String(targetRole).toUpperCase(),
        category: category || "General",
        offer: offer || null,
        deepLink: deepLink || "/dashboard",
        status: String(status).toUpperCase(),
        scheduleSlot
      }
    });

    res.status(201).json({ success: true, message: "Campaign created successfully", data: campaign });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 7. EDIT CAMPAIGN
// ==========================================
adminPushCampaignsRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, imageUrl, targetRole, category, offer, deepLink, status, scheduleSlot } = req.body;

    const existing = await prisma.pushCampaign.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    const updated = await prisma.pushCampaign.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(targetRole && { targetRole: String(targetRole).toUpperCase() }),
        ...(category && { category }),
        ...(offer !== undefined && { offer }),
        ...(deepLink !== undefined && { deepLink }),
        ...(status && { status: String(status).toUpperCase() }),
        ...(scheduleSlot && { scheduleSlot })
      }
    });

    res.json({ success: true, message: "Campaign updated successfully", data: updated });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 8. TOGGLE CAMPAIGN STATUS (ACTIVE / PAUSED)
// ==========================================
adminPushCampaignsRouter.patch("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;

    const existing = await prisma.pushCampaign.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    const newStatus = status 
      ? String(status).toUpperCase() 
      : existing.status === "ACTIVE" ? "PAUSED" : "ACTIVE";

    const updated = await prisma.pushCampaign.update({
      where: { id: req.params.id },
      data: { status: newStatus }
    });

    res.json({ success: true, message: `Campaign status changed to ${newStatus}`, data: updated });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 9. DISPATCH CAMPAIGN MANUALLY (SEND NOW)
// ==========================================
adminPushCampaignsRouter.post("/:id/dispatch", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await dispatchCampaign(req.params.id, "MANUAL");
    res.json({ success: true, message: "Campaign dispatched successfully", ...result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 10. DELETE CAMPAIGN (SOFT DELETE)
// ==========================================
adminPushCampaignsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.pushCampaign.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    await prisma.pushCampaign.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date(), status: "DELETED" }
    });

    res.json({ success: true, message: "Campaign deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 11. BULK DELETE CAMPAIGNS
// ==========================================
adminPushCampaignsRouter.post("/bulk-delete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "ids array is required" });
    }

    const result = await prisma.pushCampaign.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), status: "DELETED" }
    });

    res.json({ success: true, message: `${result.count} campaigns deleted successfully`, count: result.count });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 12. BULK UPDATE STATUS (ACTIVE / PAUSED)
// ==========================================
adminPushCampaignsRouter.post("/bulk-status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ success: false, message: "ids array and status are required" });
    }

    const newStatus = String(status).toUpperCase();
    const result = await prisma.pushCampaign.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { status: newStatus }
    });

    res.json({ success: true, message: `${result.count} campaigns marked as ${newStatus}`, count: result.count });
  } catch (err) {
    next(err);
  }
});
