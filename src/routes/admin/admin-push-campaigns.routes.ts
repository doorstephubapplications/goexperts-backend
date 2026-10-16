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
    const {
      role,
      status,
      category,
      search,
      page = "1",
      sortBy = "createdAt",
      sortOrder = "desc",
      startDate,
      endDate
    } = req.query;
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
        { id: { contains: q } },
        { title: { contains: q } },
        { description: { contains: q } },
        { category: { contains: q } },
        { offer: { contains: q } }
      ];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }

    const take = Math.min(Math.max(1, parseInt(String(pageSizeParam), 10) || 10), 200);
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const skip = (pageNum - 1) * take;

    // Supported sort columns
    const allowedSortColumns: Record<string, string> = {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
      title: "title",
      status: "status",
      lastSentAt: "lastSentAt",
      customScheduleAt: "customScheduleAt"
    };
    const orderColumn = allowedSortColumns[String(sortBy)] || "createdAt";
    const orderDirection = String(sortOrder).toLowerCase() === "asc" ? "asc" : "desc";

    const [rows, total, statsActive, statsPaused, statsScheduled, statsSent, statsDraft, allCounts] = await Promise.all([
      prisma.pushCampaign.findMany({
        where,
        orderBy: [
          { [orderColumn]: orderDirection },
          { id: "desc" }
        ],
        skip,
        take
      }),
      prisma.pushCampaign.count({ where }),
      prisma.pushCampaign.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      prisma.pushCampaign.count({ where: { deletedAt: null, status: "PAUSED" } }),
      prisma.pushCampaign.count({
        where: {
          deletedAt: null,
          OR: [{ status: "SCHEDULED" }, { customScheduleAt: { not: null } }]
        }
      }),
      prisma.pushCampaign.count({
        where: {
          deletedAt: null,
          OR: [{ status: "SENT" }, { status: "COMPLETED" }, { lastSentAt: { not: null } }]
        }
      }),
      prisma.pushCampaign.count({ where: { deletedAt: null, status: "DRAFT" } }),
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
    const totalPages = Math.max(1, Math.ceil(total / take));

    const statsObj = {
      total: totalCampaigns,
      active: statsActive,
      paused: statsPaused,
      scheduled: statsScheduled,
      sent: statsSent,
      draft: statsDraft,
      roleCounts
    };

    res.json({
      success: true,
      data: {
        items: rows,
        pagination: {
          page: pageNum,
          pageSize: take,
          totalItems: total,
          totalPages,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        },
        stats: statsObj
      },
      rows,
      total,
      page: pageNum,
      pageSize: take,
      totalPages,
      stats: statsObj
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
// 2B. NOTIFICATION CATEGORY SETTINGS (SUPER ADMIN DYNAMIC CONFIG)
// ==========================================
export const DEFAULT_NOTIFICATION_CATEGORIES = {
  CONNECTION_REQUEST: {
    key: "CONNECTION_REQUEST",
    label: "Connection Request Alert",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "New Connection Request",
    bodyTemplate: "{{senderName}} wants to connect with you on Go Experts.",
    deepLink: "/dashboard/network",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 20 },
    retryRules: { maxRetries: 3, backoffMinutes: 15 }
  },
  CONNECTION_ACCEPTED: {
    key: "CONNECTION_ACCEPTED",
    label: "Connection Accepted Alert",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Connection Accepted",
    bodyTemplate: "{{recipientName}} accepted your connection request.",
    deepLink: "/dashboard/network",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 50 },
    retryRules: { maxRetries: 3, backoffMinutes: 15 }
  },
  INVITATION_PENDING_REMINDER: {
    key: "INVITATION_PENDING_REMINDER",
    label: "Pending Invitation Reminder",
    enabled: true,
    channels: { push: true, inApp: true, email: false },
    titleTemplate: "Pending Connection Invitation",
    bodyTemplate: "You have a pending connection request from {{senderName}} awaiting your response.",
    deepLink: "/dashboard/network",
    reminderTiming: "48h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
    retryRules: { maxRetries: 2, backoffMinutes: 60 }
  },
  INVITATION_EXPIRY_REMINDER: {
    key: "INVITATION_EXPIRY_REMINDER",
    label: "Invitation Expiry Warning",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Invitation Expiring Soon",
    bodyTemplate: "Your connection invitation with {{senderName}} is expiring soon.",
    deepLink: "/dashboard/network",
    reminderTiming: "120h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
    retryRules: { maxRetries: 1, backoffMinutes: 120 }
  },
  NEW_CONNECTION_MESSAGE: {
    key: "NEW_CONNECTION_MESSAGE",
    label: "New Connection Direct Message",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "New Message from {{senderName}}",
    bodyTemplate: "{{senderName}}: {{messagePreview}}",
    deepLink: "/messages",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 100 },
    retryRules: { maxRetries: 3, backoffMinutes: 10 }
  },
  UNREAD_MESSAGE_REMINDER: {
    key: "UNREAD_MESSAGE_REMINDER",
    label: "Unread Conversation Reminder",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "You Have Unread Messages",
    bodyTemplate: "You have {{unreadCount}} unread message(s) waiting on Go Experts.",
    deepLink: "/messages",
    reminderTiming: "24h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
    retryRules: { maxRetries: 2, backoffMinutes: 60 }
  },
  PROFILE_COMPLETION_REMINDER: {
    key: "PROFILE_COMPLETION_REMINDER",
    label: "Profile Completion Reminder",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Complete Your Professional Profile",
    bodyTemplate: "Profiles with full experience receive 5x more connection requests and gigs.",
    deepLink: "/dashboard/profile",
    reminderTiming: "72h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
    retryRules: { maxRetries: 2, backoffMinutes: 120 }
  },
  KYC_REMINDER: {
    key: "KYC_REMINDER",
    label: "KYC Verification Reminder",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Verify Your Identity on Go Experts",
    bodyTemplate: "Complete your quick verification to unlock full networking and payments.",
    deepLink: "/dashboard/verification",
    reminderTiming: "48h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
    retryRules: { maxRetries: 3, backoffMinutes: 60 }
  }
};

adminPushCampaignsRouter.get("/category-settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" }
    });

    let categories = DEFAULT_NOTIFICATION_CATEGORIES;
    if (setting?.value) {
      try {
        categories = { ...DEFAULT_NOTIFICATION_CATEGORIES, ...JSON.parse(setting.value) };
      } catch (e) {
        categories = DEFAULT_NOTIFICATION_CATEGORIES;
      }
    }

    res.json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.put("/category-settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const newSettings = req.body;
    if (!newSettings || typeof newSettings !== "object") {
      return res.status(400).json({ success: false, message: "Invalid category settings payload" });
    }

    const currentSetting = await prisma.setting.findUnique({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" }
    });
    let existing = DEFAULT_NOTIFICATION_CATEGORIES;
    if (currentSetting?.value) {
      try { existing = JSON.parse(currentSetting.value); } catch {}
    }

    const merged = { ...existing, ...newSettings };

    await prisma.setting.upsert({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" },
      update: {
        value: JSON.stringify(merged),
        category: "notification_categories"
      },
      create: {
        key: "PUSH_NOTIFICATION_CATEGORIES",
        value: JSON.stringify(merged),
        category: "notification_categories"
      }
    });

    res.json({
      success: true,
      message: "Notification category configuration updated successfully.",
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
// 9B. DUPLICATE CAMPAIGN AS DRAFT
// ==========================================
adminPushCampaignsRouter.post("/:id/duplicate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const source = await prisma.pushCampaign.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });
    if (!source) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }
    const duplicate = await prisma.pushCampaign.create({
      data: {
        title: `${source.title} (Draft Copy)`,
        description: source.description,
        imageUrl: source.imageUrl,
        targetRole: source.targetRole,
        category: source.category,
        offer: source.offer,
        deepLink: source.deepLink,
        status: "DRAFT",
        scheduleSlot: source.scheduleSlot,
        customScheduleAt: null,
        sendCount: 0,
        clickCount: 0
      }
    });
    res.status(201).json({ success: true, message: "Campaign duplicated as draft", data: duplicate });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 9C. SEND TEST NOTIFICATION
// ==========================================
adminPushCampaignsRouter.post("/:id/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const campaign = await prisma.pushCampaign.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });
    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }
    const { testEmail, testUserId } = req.body;
    let targetUser: any = null;
    if (testUserId) {
      targetUser = await prisma.user.findUnique({ where: { id: testUserId } });
    } else if (testEmail) {
      targetUser = await prisma.user.findFirst({ where: { email: testEmail } });
    } else if ((req as any).user?.id) {
      targetUser = await prisma.user.findUnique({ where: { id: (req as any).user.id } });
    }

    if (targetUser) {
      try {
        const { sendPushNotification } = await import("../../services/mobile/push.service.js");
        await sendPushNotification(
          targetUser.id,
          `[TEST] ${campaign.title}`,
          campaign.description,
          {
            campaignId: campaign.id,
            deepLink: campaign.deepLink || "/dashboard",
            isTest: "true"
          }
        );
      } catch (e) {}
    }

    res.json({
      success: true,
      message: `Test push sent successfully to ${targetUser?.email || "admin device"}`
    });
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
