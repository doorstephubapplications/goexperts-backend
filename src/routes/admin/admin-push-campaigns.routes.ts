import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import {
  dispatchCampaign,
  executeScheduledSlot,
  calculateEligibleAudience,
  DEFAULT_WEEKLY_SCHEDULES
} from "../../services/notifications/push-campaign-engine.service.js";
import { seedPushCampaigns } from "../../services/notifications/seed-push-campaigns.js";
import {
  getFestivalOccasions,
  saveFestivalOccasions,
  createFestivalOccasion,
  updateFestivalOccasion,
  deleteFestivalOccasion,
  seedFestivalCalendar,
  findActiveOccasionsForDate
} from "../../services/notifications/festival-campaign.service.js";
import {
  normalizeTargetRole,
  normalizeCampaignType,
  validateDeepLink,
  validateCampaignPayload,
  buildNotificationPreview
} from "../../services/notifications/push-campaign-validator.js";

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
      campaignType,
      type,
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
      const normalized = normalizeTargetRole(String(role));
      if (normalized !== "ALL") {
        where.targetRole = normalized;
      }
    }

    if (status && status !== "ALL") {
      const s = String(status).toUpperCase();
      where.status = s === "INACTIVE" ? "PAUSED" : s;
    }

    if (category && category !== "ALL") {
      where.category = String(category);
    }

    const resolvedType = campaignType || type;
    if (resolvedType && resolvedType !== "ALL") {
      const cleanType = normalizeCampaignType(String(resolvedType));
      if (cleanType === "FESTIVAL") {
        where.category = { contains: "Festival" };
      } else if (cleanType === "ANNOUNCEMENT") {
        where.category = { contains: "Announcement" };
      }
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

    const enrichedRows = rows.map((r: any) => ({
      ...r,
      name: r.name || r.title,
      campaignType: r.campaignType || (r.category === "Festival / Observance" ? "FESTIVAL" : r.category === "Announcement" ? "ANNOUNCEMENT" : "WEEKLY_SCHEDULED")
    }));

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
        items: enrichedRows,
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
      rows: enrichedRows,
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
// 1B. AUDIENCE CALCULATION ENDPOINT
// ==========================================
adminPushCampaignsRouter.get("/audience/calculate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.query;
    const audience = await calculateEligibleAudience(role as string);
    res.json({ success: true, data: audience });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 1C. NOTIFICATION PREVIEW ENDPOINT
// ==========================================
adminPushCampaignsRouter.post("/preview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, message, imageUrl, deepLink, targetRole, role, category, offer } = req.body;
    const preview = buildNotificationPreview({
      title: title || "Notification Title Preview",
      description: description || message || "Notification message content preview...",
      imageUrl,
      deepLink,
      targetRole: targetRole || role,
      category,
      offer
    });
    res.json({ success: true, data: preview });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 1D. FESTIVAL & OBSERVANCE CAMPAIGN CALENDAR
// ==========================================
adminPushCampaignsRouter.get("/festivals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search } = req.query;
    let list = await getFestivalOccasions();

    if (category && category !== "ALL") {
      list = list.filter((o) => o.category === String(category));
    }
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      list = list.filter((o) => o.name.toLowerCase().includes(q) || o.title.toLowerCase().includes(q));
    }

    const todayActive = await findActiveOccasionsForDate();
    const todayIds = new Set(todayActive.map((o) => o.id));

    const enriched = list.map((occ) => ({
      ...occ,
      isToday: todayIds.has(occ.id)
    }));

    res.json({ success: true, data: enriched, total: enriched.length });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.post("/festivals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const created = await createFestivalOccasion(req.body);
    res.status(201).json({ success: true, message: "Festival occasion created successfully", data: created });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || "Failed to create festival occasion" });
  }
});

adminPushCampaignsRouter.post("/festivals/seed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { overwrite = false } = req.body;
    const result = await seedFestivalCalendar(Boolean(overwrite));
    res.json({ success: true, message: `Festival calendar seeded with ${result.count} approved occasions.`, data: result });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.get("/festivals/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getFestivalOccasions();
    const item = list.find((o) => o.id === req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Festival occasion not found" });
    }
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.put("/festivals/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await updateFestivalOccasion(req.params.id, req.body);
    res.json({ success: true, message: "Festival occasion updated successfully", data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message || "Failed to update festival occasion" });
  }
});

adminPushCampaignsRouter.delete("/festivals/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await deleteFestivalOccasion(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Festival occasion not found" });
    }
    res.json({ success: true, message: "Festival occasion deleted successfully" });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.post("/festivals/:id/trigger", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const list = await getFestivalOccasions();
    const item = list.find((o) => o.id === req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Festival occasion not found" });
    }

    const { dispatchDirectCampaign } = await import("../../services/notifications/push-campaign-engine.service.js");
    const result = await dispatchDirectCampaign({
      campaignName: `[Manual Trigger] ${item.name}`,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      targetRole: item.targetRole,
      category: "Festival / Observance",
      offer: item.offer || null,
      deepLink: item.deepLink || "/dashboard",
      slotName: `MANUAL_FESTIVAL_${item.id}`,
      isFestival: true
    });

    res.json({ success: true, message: `Festival campaign '${item.name}' dispatched successfully`, result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || "Failed to dispatch festival occasion" });
  }
});

// ==========================================
// 2. SCHEDULE SETTINGS (AUTOMATED WEEKLY ENGINE)
// ==========================================
adminPushCampaignsRouter.get("/schedules", async (req: Request, res: Response, next: NextFunction) => {
  try {
    let schedules = await prisma.pushScheduleSetting.findMany({
      orderBy: { slotKey: "asc" }
    });

    if (schedules.length === 0) {
      // Seed default weekly schedules if empty in DB
      const seeded: any[] = [];
      for (const s of DEFAULT_WEEKLY_SCHEDULES) {
        const item = await prisma.pushScheduleSetting.upsert({
          where: { slotKey: s.slotKey },
          update: {},
          create: {
            slotKey: s.slotKey,
            label: s.label,
            time: s.time,
            isEnabled: s.isEnabled,
            targetRole: s.targetRole
          }
        }).catch(() => s);
        seeded.push(item);
      }
      schedules = seeded;
    }

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
          time: item.time || "09:00",
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
    const result = await executeScheduledSlot(slotKey, true); // force dispatch
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
    titleTemplate: "{{senderName}} wants to connect",
    bodyTemplate: "{{senderName}} invited you to connect on Go Experts. Tap to accept or decline.",
    deepLink: "/dashboard/network",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 20 },
    retryRules: { maxRetries: 3, backoffMinutes: 15 }
  },
  CONNECTION_ACCEPTED: {
    key: "CONNECTION_ACCEPTED",
    label: "Connection Accepted Alert",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Connection Request Accepted!",
    bodyTemplate: "{{receiverName}} is now in your professional network. Start a conversation!",
    deepLink: "/dashboard/messages",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 50 },
    retryRules: { maxRetries: 3, backoffMinutes: 15 }
  },
  CONNECTION_REJECTED: {
    key: "CONNECTION_REJECTED",
    label: "Connection Request Declined",
    enabled: true,
    channels: { push: true, inApp: true, email: false },
    titleTemplate: "Invitation Update",
    bodyTemplate: "Your connection invitation with {{receiverName}} was declined.",
    deepLink: "/dashboard/network",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 10 },
    retryRules: { maxRetries: 2, backoffMinutes: 30 }
  },
  PROFILE_VIEWED: {
    key: "PROFILE_VIEWED",
    label: "Profile Viewed Notification",
    enabled: true,
    channels: { push: true, inApp: true, email: false },
    titleTemplate: "Someone viewed your profile",
    bodyTemplate: "{{viewerName}} viewed your freelancer profile on Go Experts.",
    deepLink: "/dashboard/profile",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 10 },
    retryRules: { maxRetries: 2, backoffMinutes: 30 }
  },
  PROFILE_COMPLETION_REMINDER: {
    key: "PROFILE_COMPLETION_REMINDER",
    label: "Profile Completion Reminder",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Complete Your Professional Profile",
    bodyTemplate: "Profiles with 100% completion receive 5x more project offers and connection requests.",
    deepLink: "/dashboard/profile",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
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
    bodyTemplate: "Complete your quick KYC identity verification to unlock full networking and payments.",
    deepLink: "/dashboard/verification",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    reminderTiming: "48h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
    retryRules: { maxRetries: 3, backoffMinutes: 60 }
  },
  REGISTER_REMINDER: {
    key: "REGISTER_REMINDER",
    label: "Registration / Draft Reminder",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Complete Your Go Experts Registration",
    bodyTemplate: "You are just one step away from joining top experts. Finish your profile today!",
    deepLink: "/auth/onboarding",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    reminderTiming: "24h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
    retryRules: { maxRetries: 3, backoffMinutes: 60 }
  },
  PROPOSAL_ACCEPTED: {
    key: "PROPOSAL_ACCEPTED",
    label: "Proposal Accepted Alert",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Proposal Accepted for {{projectTitle}}!",
    bodyTemplate: "Congratulations! {{clientName}} accepted your proposal. Review project milestones now.",
    deepLink: "/dashboard/proposals",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 20 },
    retryRules: { maxRetries: 3, backoffMinutes: 15 }
  },
  PROPOSAL_REJECTED: {
    key: "PROPOSAL_REJECTED",
    label: "Proposal Status Update",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "Proposal Status Update",
    bodyTemplate: "Your proposal for {{projectTitle}} was not selected this time. Explore more opportunities!",
    deepLink: "/dashboard/projects",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 20 },
    retryRules: { maxRetries: 2, backoffMinutes: 30 }
  },
  PROJECT_POSTED: {
    key: "PROJECT_POSTED",
    label: "New Project Posted Alert",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "New Project Matching Your Skills!",
    bodyTemplate: "A new project \"{{projectTitle}}\" was posted in {{category}}. Submit your proposal now!",
    deepLink: "/dashboard/projects",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 15 },
    retryRules: { maxRetries: 2, backoffMinutes: 30 }
  },
  NEW_CONNECTION_MESSAGE: {
    key: "NEW_CONNECTION_MESSAGE",
    label: "New Chat / Direct Message",
    enabled: true,
    channels: { push: true, inApp: true, email: true },
    titleTemplate: "New Message from {{senderName}}",
    bodyTemplate: "{{senderName}}: {{messagePreview}}",
    deepLink: "/messages",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 100 },
    retryRules: { maxRetries: 3, backoffMinutes: 10 }
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

adminPushCampaignsRouter.post("/category-settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      key,
      label,
      description,
      enabled = true,
      channels,
      titleTemplate,
      bodyTemplate,
      deepLink,
      reminderTiming,
      quietHours,
      frequencyCap,
    } = req.body;

    if (!key || !label) {
      return res.status(400).json({ success: false, message: "Category key and label are required." });
    }

    const cleanKey = String(key).trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");

    const currentSetting = await prisma.setting.findUnique({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" },
    });
    let existing = DEFAULT_NOTIFICATION_CATEGORIES;
    if (currentSetting?.value) {
      try { existing = JSON.parse(currentSetting.value); } catch {}
    }

    if (existing[cleanKey]) {
      return res.status(400).json({ success: false, message: `Category '${cleanKey}' already exists.` });
    }

    const newCategory = {
      key: cleanKey,
      label: String(label).trim(),
      description: description ? String(description).trim() : "",
      enabled: enabled !== false,
      channels: channels || { push: true, inApp: true, email: false },
      titleTemplate: titleTemplate || `${String(label).trim()} Alert`,
      bodyTemplate: bodyTemplate || "You have a new update on Go Experts.",
      deepLink: deepLink || "/dashboard",
      logoUrl: req.body.logoUrl || "https://goexperts.in/logo.png",
      imageUrl: req.body.imageUrl || "",
      reminderTiming: reminderTiming || "24h",
      quietHours: quietHours || { enabled: false, start: "22:00", end: "08:00" },
      frequencyCap: frequencyCap || { maxPerDay: 5 },
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    const updated = { ...existing, [cleanKey]: newCategory };

    await prisma.setting.upsert({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" },
      update: {
        value: JSON.stringify(updated),
        category: "notification_categories",
      },
      create: {
        key: "PUSH_NOTIFICATION_CATEGORIES",
        value: JSON.stringify(updated),
        category: "notification_categories",
      },
    });

    res.status(201).json({
      success: true,
      message: `Category '${newCategory.label}' created successfully.`,
      data: newCategory,
    });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.put("/category-settings/:key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const catData = req.body;

    const currentSetting = await prisma.setting.findUnique({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" },
    });
    let existing = DEFAULT_NOTIFICATION_CATEGORIES;
    if (currentSetting?.value) {
      try { existing = JSON.parse(currentSetting.value); } catch {}
    }

    if (!existing[key]) {
      return res.status(404).json({ success: false, message: `Category '${key}' not found.` });
    }

    existing[key] = {
      ...existing[key],
      ...catData,
      key, // preserve original key
      updatedAt: new Date().toISOString(),
    };

    await prisma.setting.upsert({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" },
      update: {
        value: JSON.stringify(existing),
        category: "notification_categories",
      },
      create: {
        key: "PUSH_NOTIFICATION_CATEGORIES",
        value: JSON.stringify(existing),
        category: "notification_categories",
      },
    });

    res.json({
      success: true,
      message: `Category '${existing[key].label || key}' updated successfully.`,
      data: existing[key],
    });
  } catch (err) {
    next(err);
  }
});

adminPushCampaignsRouter.delete("/category-settings/:key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;

    const currentSetting = await prisma.setting.findUnique({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" },
    });
    let existing = DEFAULT_NOTIFICATION_CATEGORIES;
    if (currentSetting?.value) {
      try { existing = JSON.parse(currentSetting.value); } catch {}
    }

    if (!existing[key]) {
      return res.status(404).json({ success: false, message: `Category '${key}' not found.` });
    }

    const removedLabel = existing[key].label || key;
    delete existing[key];

    await prisma.setting.upsert({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" },
      update: {
        value: JSON.stringify(existing),
        category: "notification_categories",
      },
      create: {
        key: "PUSH_NOTIFICATION_CATEGORIES",
        value: JSON.stringify(existing),
        category: "notification_categories",
      },
    });

    res.json({
      success: true,
      message: `Category '${removedLabel}' deleted successfully.`,
      data: { key },
    });
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

    // Attach calculated eligible audience for this campaign's target role
    const audience = await calculateEligibleAudience(campaign.targetRole).catch(() => null);

    const responseData = {
      ...campaign,
      name: (campaign as any).name || campaign.title,
      campaignType: (campaign as any).campaignType || (campaign.category === "Festival / Observance" ? "FESTIVAL" : campaign.category === "Announcement" ? "ANNOUNCEMENT" : "WEEKLY_SCHEDULED"),
      eligibleAudience: audience
    };

    res.json({ success: true, data: responseData });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. CREATE CAMPAIGN
// ==========================================
adminPushCampaignsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validation = validateCampaignPayload(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors[0],
        errors: validation.errors
      });
    }

    const { name, title, description, imageUrl, targetRole, category, offer, deepLink, status, scheduleSlot, customScheduleAt } = validation.sanitized;

    const campaign = await prisma.pushCampaign.create({
      data: {
        title,
        description,
        imageUrl: imageUrl || null,
        targetRole,
        category: category || "General",
        offer: offer || null,
        deepLink: deepLink || "/dashboard",
        status,
        scheduleSlot,
        customScheduleAt: customScheduleAt ? new Date(customScheduleAt) : null
      }
    });

    const responseData = {
      ...campaign,
      name,
      campaignType: validation.sanitized.campaignType
    };

    res.status(201).json({ success: true, message: "Campaign created successfully", data: responseData });
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
    const existing = await prisma.pushCampaign.findFirst({
      where: { id: req.params.id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    const merged = { ...existing, ...req.body };
    const validation = validateCampaignPayload(merged);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: validation.errors[0],
        errors: validation.errors
      });
    }

    const { name, title, description, imageUrl, targetRole, category, offer, deepLink, status, scheduleSlot, customScheduleAt } = validation.sanitized;

    const updated = await prisma.pushCampaign.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        imageUrl: imageUrl !== undefined ? imageUrl : existing.imageUrl,
        targetRole,
        category,
        offer,
        deepLink,
        status,
        scheduleSlot,
        customScheduleAt: customScheduleAt ? new Date(customScheduleAt) : null
      }
    });

    const responseData = {
      ...updated,
      name,
      campaignType: validation.sanitized.campaignType
    };

    res.json({ success: true, message: "Campaign updated successfully", data: responseData });
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

    let newStatus = "ACTIVE";
    if (status) {
      const s = String(status).toUpperCase();
      newStatus = s === "INACTIVE" || s === "PAUSED" ? "PAUSED" : "ACTIVE";
    } else {
      newStatus = existing.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    }

    const updated = await prisma.pushCampaign.update({
      where: { id: req.params.id },
      data: { status: newStatus }
    });

    const message = newStatus === "ACTIVE"
      ? "Campaign activated successfully. It will participate in upcoming future scheduled occurrences (historical missed slots are not sent)."
      : "Campaign deactivated. It has been excluded from future scheduled sends (past delivery history preserved).";

    res.json({ success: true, message, data: updated });
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
