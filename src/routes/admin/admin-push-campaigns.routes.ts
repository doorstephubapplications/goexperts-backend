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
  appLogoDarkUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80",
  themeMode: "auto", // "auto" | "light" | "dark"
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
adminPushCampaignsRouter.get("/history/stats", async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLogs, todayLogs, aggregates] = await Promise.all([
      prisma.pushCampaignHistory.count(),
      prisma.pushCampaignHistory.count({
        where: { sentAt: { gte: today } }
      }),
      prisma.pushCampaignHistory.aggregate({
        _sum: {
          recipientsCount: true,
          deliveredCount: true
        }
      })
    ]);

    res.json({
      success: true,
      stats: {
        totalLogs,
        todayLogs,
        totalRecipients: aggregates._sum.recipientsCount || 0,
        totalDelivered: aggregates._sum.deliveredCount || 0
      }
    });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, page = "1", limit = "50", search = "" } = req.query;

    const where: any = {};
    if (role && role !== "ALL") {
      where.targetRole = String(role).toUpperCase();
    }
    if (search && String(search).trim()) {
      where.campaignTitle = { contains: String(search).trim() };
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

adminPushCampaignsRouter.post("/history/delete", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "Provide an array of ids to delete" });
    }
    const result = await prisma.pushCampaignHistory.deleteMany({
      where: { id: { in: ids } }
    });
    res.json({ success: true, message: `Deleted ${result.count} history logs` });
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
// 5A. GET ALL CATEGORIES (must be before /:id)
// ==========================================
adminPushCampaignsRouter.get("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await getCategories();
    // Count campaigns per category (case-insensitive)
    const allCounts = await prisma.pushCampaign.groupBy({
      by: ["category"],
      where: { deletedAt: null },
      _count: { id: true }
    });
    // Build map with lowercase keys for case-insensitive lookup
    const countMap: Record<string, number> = {};
    allCounts.forEach((c: any) => {
      const key = (c.category || "").toLowerCase().trim();
      countMap[key] = (countMap[key] || 0) + c._count.id;
    });
    const withCounts = categories.map((cat: any) => ({
      ...cat,
      campaignCount: countMap[(cat.name || "").toLowerCase().trim()] || 0
    }));
    res.json({ success: true, data: withCounts });
  } catch (err) { next(err); }
});

// ==========================================
// 5B. GET CAMPAIGNS BY CATEGORY (must be before /:id)
// ==========================================
adminPushCampaignsRouter.get("/categories/:name/campaigns", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryName = decodeURIComponent(req.params.name);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [campaigns, total] = await Promise.all([
      prisma.pushCampaign.findMany({
        where: {
          deletedAt: null,
          category: categoryName
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          description: true,
          imageUrl: true,
          targetRole: true,
          category: true,
          status: true,
          scheduleSlot: true,
          sendCount: true,
          clickCount: true,
          lastSentAt: true,
          createdAt: true,
        }
      }),
      prisma.pushCampaign.count({
        where: {
          deletedAt: null,
          category: categoryName
        }
      })
    ]);

    res.json({
      success: true,
      data: campaigns,
      meta: { total, page, limit, pages: Math.ceil(total / limit) }
    });
  } catch (err) { next(err); }
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
    const { title, description, imageUrl, targetRole, category, offer, deepLink, status = "ACTIVE", scheduleSlot = "SLOT_1", customScheduleAt } = req.body;

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
        scheduleSlot,
        customScheduleAt: customScheduleAt ? new Date(customScheduleAt) : null
      }
    });

    res.status(201).json({ success: true, message: "Campaign created successfully", data: campaign });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6B. UPDATE CATEGORY (must be before /:id)
// ==========================================
adminPushCampaignsRouter.put("/categories/:name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const originalName = decodeURIComponent(req.params.name);
    const { name, color, icon, description } = req.body;
    const categories = await getCategories();
    const idx = categories.findIndex((c: any) => c.name === originalName);
    if (idx === -1) return res.status(404).json({ success: false, message: "Category not found" });
    const updated = { ...categories[idx], ...(name && { name: String(name).trim() }), ...(color && { color }), ...(icon && { icon }), ...(description !== undefined && { description }) };
    categories[idx] = updated;
    await saveCategories(categories);
    if (name && name !== originalName) {
      await prisma.pushCampaign.updateMany({ where: { category: originalName, deletedAt: null }, data: { category: updated.name } });
    }
    res.json({ success: true, message: "Category updated successfully", data: updated });
  } catch (err) { next(err); }
});

// ==========================================
// 6C. DELETE CATEGORY (must be before /:id)
// ==========================================
adminPushCampaignsRouter.delete("/categories/:name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryName = decodeURIComponent(req.params.name);
    const categories = await getCategories();
    const idx = categories.findIndex((c: any) => c.name === categoryName);
    if (idx === -1) return res.status(404).json({ success: false, message: "Category not found" });
    const inUseCount = await prisma.pushCampaign.count({ where: { category: categoryName, deletedAt: null } });
    if (inUseCount > 0) {
      return res.status(409).json({ success: false, message: `Cannot delete — ${inUseCount} campaign(s) use this category. Reassign them first.` });
    }
    categories.splice(idx, 1);
    await saveCategories(categories);
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (err) { next(err); }
});

// ==========================================
// 7. EDIT CAMPAIGN
// ==========================================
adminPushCampaignsRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, imageUrl, targetRole, category, offer, deepLink, status, scheduleSlot, customScheduleAt } = req.body;

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
        ...(scheduleSlot && { scheduleSlot }),
        ...(customScheduleAt !== undefined && { customScheduleAt: customScheduleAt ? new Date(customScheduleAt) : null })
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

// ==========================================
// 13. PUSH CAMPAIGN CATEGORIES CRUD
// Categories are stored as a JSON array in Setting table
// ==========================================

const CATEGORIES_SETTING_KEY = "PUSH_CAMPAIGN_CATEGORIES";

const DEFAULT_CATEGORIES = [
  { name: "Promotional", color: "#E11D48", icon: "🏷️", description: "Sales, offers and discount campaigns" },
  { name: "Job Alert", color: "#2563EB", icon: "💼", description: "New job postings and opportunities" },
  { name: "Project Update", color: "#059669", icon: "📋", description: "Project status and milestone updates" },
  { name: "Investment", color: "#D97706", icon: "💰", description: "Funding rounds and investment opportunities" },
  { name: "Announcement", color: "#7C3AED", icon: "📢", description: "Platform-wide news and announcements" },
  { name: "Reminder", color: "#0891B2", icon: "⏰", description: "Gentle reminders and follow-ups" },
  { name: "Onboarding", color: "#16A34A", icon: "🚀", description: "New user onboarding nudges" },
  { name: "General", color: "#64748B", icon: "📌", description: "Miscellaneous campaigns" },
];

async function getCategories() {
  const setting = await prisma.setting.findUnique({ where: { key: CATEGORIES_SETTING_KEY } });
  if (setting?.value) {
    try { return JSON.parse(setting.value); } catch { return DEFAULT_CATEGORIES; }
  }
  return DEFAULT_CATEGORIES;
}

async function saveCategories(categories: any[]) {
  await prisma.setting.upsert({
    where: { key: CATEGORIES_SETTING_KEY },
    update: { value: JSON.stringify(categories), category: "push_campaigns" },
    create: { key: CATEGORIES_SETTING_KEY, value: JSON.stringify(categories), category: "push_campaigns" }
  });
}

// GET all categories
adminPushCampaignsRouter.get("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await getCategories();
    // Attach campaign counts per category
    const counts = await prisma.pushCampaign.groupBy({
      by: ["category"],
      where: { deletedAt: null },
      _count: { id: true }
    });
    const countMap: Record<string, number> = {};
    counts.forEach((c: any) => { countMap[c.category] = c._count.id; });
    const withCounts = categories.map((cat: any) => ({ ...cat, campaignCount: countMap[cat.name] || 0 }));
    res.json({ success: true, data: withCounts });
  } catch (err) { next(err); }
});

// CREATE category
adminPushCampaignsRouter.post("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, color, icon, description } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }
    const categories = await getCategories();
    if (categories.find((c: any) => c.name.toLowerCase() === String(name).trim().toLowerCase())) {
      return res.status(409).json({ success: false, message: "Category already exists" });
    }
    const newCat = { name: String(name).trim(), color: color || "#64748B", icon: icon || "📌", description: description || "" };
    categories.push(newCat);
    await saveCategories(categories);
    res.status(201).json({ success: true, message: "Category created successfully", data: newCat });
  } catch (err) { next(err); }
});

// UPDATE category
adminPushCampaignsRouter.put("/categories/:name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const originalName = decodeURIComponent(req.params.name);
    const { name, color, icon, description } = req.body;
    let categories = await getCategories();
    const idx = categories.findIndex((c: any) => c.name === originalName);
    if (idx === -1) return res.status(404).json({ success: false, message: "Category not found" });
    const updated = { ...categories[idx], ...(name && { name: String(name).trim() }), ...(color && { color }), ...(icon && { icon }), ...(description !== undefined && { description }) };
    categories[idx] = updated;
    await saveCategories(categories);
    // If name changed, update all campaigns with old category name
    if (name && name !== originalName) {
      await prisma.pushCampaign.updateMany({ where: { category: originalName, deletedAt: null }, data: { category: updated.name } });
    }
    res.json({ success: true, message: "Category updated successfully", data: updated });
  } catch (err) { next(err); }
});

// DELETE category
adminPushCampaignsRouter.delete("/categories/:name", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categoryName = decodeURIComponent(req.params.name);
    let categories = await getCategories();
    const idx = categories.findIndex((c: any) => c.name === categoryName);
    if (idx === -1) return res.status(404).json({ success: false, message: "Category not found" });
    // Check if in use
    const inUseCount = await prisma.pushCampaign.count({ where: { category: categoryName, deletedAt: null } });
    if (inUseCount > 0) {
      return res.status(409).json({ success: false, message: `Cannot delete — ${inUseCount} campaign(s) use this category. Reassign them first.` });
    }
    categories.splice(idx, 1);
    await saveCategories(categories);
    res.json({ success: true, message: "Category deleted successfully" });
  } catch (err) { next(err); }
});
