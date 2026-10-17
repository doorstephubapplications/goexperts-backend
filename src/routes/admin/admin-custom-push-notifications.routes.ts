import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";

export const adminCustomPushNotificationsRouter = Router();

// =========================================================================
// DEFAULT USER-RELATED EVENT PUSH NOTIFICATION TEMPLATES
// Note: Email channel removed per specification. Only Push & In-App channels.
// =========================================================================
export const DEFAULT_CUSTOM_PUSH_TEMPLATES: Record<string, {
  key: string;
  label: string;
  categoryGroup: string;
  enabled: boolean;
  channels: { push: boolean; inApp: boolean };
  titleTemplate: string;
  bodyTemplate: string;
  deepLink: string;
  logoUrl: string;
  imageUrl: string;
  quietHours: { enabled: boolean; start: string; end: string };
  frequencyCap: { maxPerDay: number };
  reminderTiming?: string;
  isCustom?: boolean;
}> = {
  CONNECTION_REQUEST: {
    key: "CONNECTION_REQUEST",
    label: "Connection Request Alert",
    categoryGroup: "Connections",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "{{senderName}} wants to connect",
    bodyTemplate: "{{senderName}} invited you to connect on Go Experts. Open app to accept or decline.",
    deepLink: "/dashboard/network",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 25 },
  },
  CONNECTION_ACCEPTED: {
    key: "CONNECTION_ACCEPTED",
    label: "Connection Request Accepted",
    categoryGroup: "Connections",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Connection Request Accepted!",
    bodyTemplate: "{{receiverName}} accepted your connection request. Start a conversation now!",
    deepLink: "/dashboard/messages",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 50 },
  },
  CONNECTION_REJECTED: {
    key: "CONNECTION_REJECTED",
    label: "Connection Request Declined",
    categoryGroup: "Connections",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Connection Invitation Update",
    bodyTemplate: "Your connection invitation to {{receiverName}} was declined.",
    deepLink: "/dashboard/network",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 10 },
  },
  NEW_CONNECTION_MESSAGE: {
    key: "NEW_CONNECTION_MESSAGE",
    label: "Messaging & Conversation Chat",
    categoryGroup: "Messaging",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "New Message from {{senderName}}",
    bodyTemplate: "{{senderName}}: {{messagePreview}}",
    deepLink: "/messages",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 150 },
  },
  PROFILE_REMINDER: {
    key: "PROFILE_REMINDER",
    label: "Profile Completion Reminder",
    categoryGroup: "Profile",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Complete Your Professional Profile",
    bodyTemplate: "Profiles with full experience receive 5x more gig offers and connection requests.",
    deepLink: "/dashboard/profile",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    reminderTiming: "72h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
  },
  PROFILE_VIEWED: {
    key: "PROFILE_VIEWED",
    label: "Profile Viewed Notification",
    categoryGroup: "Profile",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Someone viewed your profile",
    bodyTemplate: "{{viewerName}} viewed your freelancer profile on Go Experts.",
    deepLink: "/dashboard/profile",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 10 },
  },
  REGISTER_REMINDER: {
    key: "REGISTER_REMINDER",
    label: "Registration / Draft Reminder",
    categoryGroup: "Onboarding",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Finish Your Go Experts Registration",
    bodyTemplate: "You are just one step away from joining top experts. Complete your profile today!",
    deepLink: "/auth/onboarding",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    reminderTiming: "24h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
  },
  KYC_REMINDER: {
    key: "KYC_REMINDER",
    label: "KYC Verification Reminder",
    categoryGroup: "Verification",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Verify Your Identity on Go Experts",
    bodyTemplate: "Complete quick KYC verification to unlock full networking, proposals, and payouts.",
    deepLink: "/dashboard/verification",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    reminderTiming: "48h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
  },
  PROPOSAL_ACCEPTED: {
    key: "PROPOSAL_ACCEPTED",
    label: "Proposal Accepted Alert",
    categoryGroup: "Proposals",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Proposal Accepted for {{projectTitle}}!",
    bodyTemplate: "Congratulations! {{clientName}} accepted your proposal. Review project milestones now.",
    deepLink: "/dashboard/proposals",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 20 },
  },
  PROPOSAL_REJECTED: {
    key: "PROPOSAL_REJECTED",
    label: "Proposal Status Update",
    categoryGroup: "Proposals",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Proposal Status Update",
    bodyTemplate: "Your proposal for {{projectTitle}} was not selected this time. Explore other gigs!",
    deepLink: "/dashboard/projects",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 20 },
  },
  PROJECT_POSTED: {
    key: "PROJECT_POSTED",
    label: "New Project Posted Alert",
    categoryGroup: "Projects",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "New Project Matching Your Skills!",
    bodyTemplate: "A new project \"{{projectTitle}}\" was posted in {{category}}. Submit your proposal now!",
    deepLink: "/dashboard/projects",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 15 },
  },
  CONVERSATION_MESSAGE: {
    key: "CONVERSATION_MESSAGE",
    label: "Conversation Chat Push Notification",
    categoryGroup: "Messaging",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "{{senderName}} sent you a message",
    bodyTemplate: "{{senderName}}: {{messagePreview}}",
    deepLink: "/messages",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 150 },
  },
  PROFILE_COMPLETION_REMINDER: {
    key: "PROFILE_COMPLETION_REMINDER",
    label: "Profile Completion Reminder",
    categoryGroup: "Profile Reminders",
    enabled: true,
    channels: { push: true, inApp: true },
    titleTemplate: "Complete Your Professional Profile",
    bodyTemplate: "Profiles with full experience receive 5x more gig offers and connection requests.",
    deepLink: "/dashboard/profile",
    logoUrl: "https://goexperts.in/logo.png",
    imageUrl: "",
    reminderTiming: "72h",
    quietHours: { enabled: true, start: "22:00", end: "08:00" },
    frequencyCap: { maxPerDay: 1 },
  },
};

// Helper: load stored templates or fallback to defaults
async function getStoredTemplates(): Promise<Record<string, any>> {
  let setting = await prisma.setting.findUnique({
    where: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES" },
  });

  if (!setting?.value) {
    // Check fallback setting
    setting = await prisma.setting.findUnique({
      where: { key: "PUSH_NOTIFICATION_CATEGORIES" },
    });
  }

  let templates: Record<string, any> = { ...DEFAULT_CUSTOM_PUSH_TEMPLATES };
  if (setting?.value) {
    try {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item?.key) templates[item.key] = item;
        });
      } else if (typeof parsed === "object" && parsed !== null) {
        templates = { ...DEFAULT_CUSTOM_PUSH_TEMPLATES, ...parsed };
      }
    } catch (e) {
      templates = { ...DEFAULT_CUSTOM_PUSH_TEMPLATES };
    }
  }

  // Normalize every template to ensure consistent schema without email channel
  const normalized: Record<string, any> = {};
  for (const [key, t] of Object.entries(templates)) {
    if (!t || typeof t !== "object") continue;
    const finalKey = t.key || key;
    normalized[finalKey] = {
      key: finalKey,
      label: t.label || t.name || t.title || finalKey,
      categoryGroup: t.categoryGroup || t.category || "Connections",
      titleTemplate: t.titleTemplate || t.title || `${t.label || finalKey} Alert`,
      bodyTemplate: t.bodyTemplate || t.body || t.description || "You have a new update on Go Experts.",
      deepLink: t.deepLink || "/dashboard",
      logoUrl: t.logoUrl || "https://goexperts.in/logo.png",
      imageUrl: t.imageUrl || "",
      enabled: t.enabled !== false,
      channels: {
        push: t.channels?.push !== false,
        inApp: t.channels?.inApp !== false,
      },
      quietHours: t.quietHours || { enabled: false, start: "22:00", end: "08:00" },
      frequencyCap: t.frequencyCap || { maxPerDay: 25 },
      reminderTiming: t.reminderTiming || "",
      isCustom: !!t.isCustom,
    };
  }

  return normalized;
}

// 1. GET ALL CUSTOM PUSH NOTIFICATION TEMPLATES (Server-Side Pagination, Filter & Search)
adminCustomPushNotificationsRouter.get("/templates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawTemplates = await getStoredTemplates();
    const allList = Object.values(rawTemplates);

    // Global stats across all templates
    const totalCount = allList.length;
    const activeCount = allList.filter((t) => t.enabled).length;
    const pushCount = allList.filter((t) => t.channels?.push).length;
    const inAppCount = allList.filter((t) => t.channels?.inApp).length;

    // Unique category groups
    const categoriesSet = new Set<string>();
    allList.forEach((t) => {
      if (t.categoryGroup) categoriesSet.add(t.categoryGroup);
    });

    // Query filters
    const {
      page = "1",
      limit = "10",
      search,
      status,
      categoryGroup,
      channel,
    } = req.query;

    let filtered = allList;

    // Filter by Status (ACTIVE | SUPPRESSED | ALL)
    if (status && status !== "ALL" && status !== "all") {
      const s = String(status).toUpperCase();
      if (s === "ACTIVE") filtered = filtered.filter((t) => t.enabled);
      if (s === "SUPPRESSED") filtered = filtered.filter((t) => !t.enabled);
    }

    // Filter by Category Group
    if (categoryGroup && categoryGroup !== "ALL" && categoryGroup !== "all") {
      filtered = filtered.filter((t) => t.categoryGroup === categoryGroup);
    }

    // Filter by Channel (PUSH | INAPP | ALL)
    if (channel && channel !== "ALL" && channel !== "all") {
      const ch = String(channel).toUpperCase();
      if (ch === "PUSH") filtered = filtered.filter((t) => t.channels?.push);
      if (ch === "INAPP") filtered = filtered.filter((t) => t.channels?.inApp);
    }

    // Filter by Search Query
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      filtered = filtered.filter((t) => {
        return (
          t.key.toLowerCase().includes(q) ||
          t.label.toLowerCase().includes(q) ||
          (t.titleTemplate && t.titleTemplate.toLowerCase().includes(q)) ||
          (t.bodyTemplate && t.bodyTemplate.toLowerCase().includes(q)) ||
          (t.categoryGroup && t.categoryGroup.toLowerCase().includes(q))
        );
      });
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, parseInt(String(limit), 10) || 10);
    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / limitNum));
    const skip = (pageNum - 1) * limitNum;
    const paginatedList = filtered.slice(skip, skip + limitNum);

    const paginatedMap: Record<string, any> = {};
    paginatedList.forEach((t) => {
      paginatedMap[t.key] = t;
    });

    res.json({
      success: true,
      data: paginatedList,
      list: paginatedList,
      map: paginatedMap,
      pagination: {
        total: totalFiltered,
        page: pageNum,
        limit: limitNum,
        pages: totalPages,
      },
      stats: {
        total: totalCount,
        active: activeCount,
        push: pushCount,
        inApp: inAppCount,
      },
      categories: Array.from(categoriesSet),
    });
  } catch (err) {
    next(err);
  }
});

// 2. CREATE A NEW CUSTOM PUSH NOTIFICATION TEMPLATE
adminCustomPushNotificationsRouter.post("/templates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      key,
      label,
      categoryGroup = "General",
      enabled = true,
      channels,
      titleTemplate,
      bodyTemplate,
      deepLink = "/dashboard",
      logoUrl = "https://goexperts.in/logo.png",
      imageUrl = "",
      reminderTiming,
      quietHours,
      frequencyCap,
    } = req.body;

    if (!key || !label) {
      return res.status(400).json({ success: false, message: "Template key and label are required." });
    }

    const cleanKey = String(key).trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const existing = await getStoredTemplates();

    if (existing[cleanKey]) {
      return res.status(400).json({ success: false, message: `Template '${cleanKey}' already exists.` });
    }

    const newTemplate = {
      key: cleanKey,
      label: String(label).trim(),
      categoryGroup: String(categoryGroup).trim(),
      enabled: enabled !== false,
      channels: {
        push: channels?.push !== false,
        inApp: channels?.inApp !== false,
      },
      titleTemplate: titleTemplate || `${String(label).trim()} Alert`,
      bodyTemplate: bodyTemplate || "You have a new update on Go Experts.",
      deepLink,
      logoUrl: logoUrl || "https://goexperts.in/logo.png",
      imageUrl: imageUrl || "",
      reminderTiming: reminderTiming || "24h",
      quietHours: quietHours || { enabled: false, start: "22:00", end: "08:00" },
      frequencyCap: frequencyCap || { maxPerDay: 10 },
      isCustom: true,
      createdAt: new Date().toISOString(),
    };

    const updated = { ...existing, [cleanKey]: newTemplate };

    await prisma.setting.upsert({
      where: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES" },
      update: { value: JSON.stringify(updated), category: "custom_push_notifications" },
      create: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES", value: JSON.stringify(updated), category: "custom_push_notifications" },
    });

    res.status(201).json({
      success: true,
      message: `Custom push template '${newTemplate.label}' created successfully.`,
      data: newTemplate,
    });
  } catch (err) {
    next(err);
  }
});

// 3. UPDATE A CUSTOM PUSH NOTIFICATION TEMPLATE
adminCustomPushNotificationsRouter.put("/templates/:key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const updateData = req.body;

    const existing = await getStoredTemplates();
    if (!existing[key]) {
      return res.status(404).json({ success: false, message: `Template '${key}' not found.` });
    }

    // Strip email from channels if provided
    let safeChannels = existing[key].channels;
    if (updateData.channels) {
      safeChannels = {
        push: updateData.channels.push !== false,
        inApp: updateData.channels.inApp !== false,
      };
    }

    existing[key] = {
      ...existing[key],
      ...updateData,
      channels: safeChannels,
      key, // lock original key
      updatedAt: new Date().toISOString(),
    };

    await prisma.setting.upsert({
      where: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES" },
      update: { value: JSON.stringify(existing), category: "custom_push_notifications" },
      create: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES", value: JSON.stringify(existing), category: "custom_push_notifications" },
    });

    res.json({
      success: true,
      message: `Custom push template '${existing[key].label || key}' updated successfully.`,
      data: existing[key],
    });
  } catch (err) {
    next(err);
  }
});

// 4. BULK DELETE CUSTOM PUSH NOTIFICATION TEMPLATES
adminCustomPushNotificationsRouter.delete("/templates", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { keys } = req.body || {};
    if (!Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ success: false, message: "Keys array is required for bulk deletion." });
    }

    const existing = await getStoredTemplates();
    let deletedCount = 0;
    const deletedKeys: string[] = [];

    for (const key of keys) {
      if (existing[key]) {
        delete existing[key];
        deletedCount++;
        deletedKeys.push(key);
      }
    }

    await prisma.setting.upsert({
      where: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES" },
      update: { value: JSON.stringify(existing), category: "custom_push_notifications" },
      create: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES", value: JSON.stringify(existing), category: "custom_push_notifications" },
    });

    res.json({
      success: true,
      message: `Successfully deleted ${deletedCount} template(s).`,
      deletedCount,
      deletedKeys,
    });
  } catch (err) {
    next(err);
  }
});

// 5. DELETE A SINGLE CUSTOM PUSH NOTIFICATION TEMPLATE
adminCustomPushNotificationsRouter.delete("/templates/:key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const existing = await getStoredTemplates();

    if (!existing[key]) {
      return res.status(404).json({ success: false, message: `Template '${key}' not found.` });
    }

    const removedLabel = existing[key].label || key;
    delete existing[key];

    await prisma.setting.upsert({
      where: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES" },
      update: { value: JSON.stringify(existing), category: "custom_push_notifications" },
      create: { key: "CUSTOM_PUSH_NOTIFICATION_TEMPLATES", value: JSON.stringify(existing), category: "custom_push_notifications" },
    });

    res.json({
      success: true,
      message: `Template '${removedLabel}' deleted successfully.`,
      data: { key },
    });
  } catch (err) {
    next(err);
  }
});

// 6. GET DELIVERED PUSH NOTIFICATIONS HISTORY (User-related events)
adminCustomPushNotificationsRouter.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = "1", limit = "20", type, status, channel, search } = req.query;
    const where: any = {};

    if (status && status !== "ALL" && status !== "all") where.status = String(status);
    if (channel && channel !== "ALL" && channel !== "all") where.channel = String(channel);
    if (type && type !== "ALL" && type !== "all") where.type = String(type);

    if (search && String(search).trim()) {
      const q = String(search).trim();
      const qUpper = q.toUpperCase();
      where.OR = [
        { title: { contains: q } },
        { message: { contains: q } },
        { type: { contains: q } },
        { type: { contains: qUpper } },
        { user: { fullName: { contains: q } } },
        { user: { email: { contains: q } } },
      ];
    }

    const skip = (parseInt(page as string, 10) - 1) * parseInt(limit as string, 10);
    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: parseInt(limit as string, 10),
        include: { user: { select: { id: true, fullName: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        pages: Math.ceil(total / parseInt(limit as string, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
});

// 7. BULK DELETE HISTORY NOTIFICATIONS
adminCustomPushNotificationsRouter.delete("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "IDs array is required for deletion." });
    }

    const result = await prisma.notification.deleteMany({
      where: { id: { in: ids } },
    });

    res.json({
      success: true,
      message: `Successfully deleted ${result.count} history notification(s).`,
      deletedCount: result.count,
    });
  } catch (err) {
    next(err);
  }
});

// 8. DELETE A SINGLE HISTORY NOTIFICATION
adminCustomPushNotificationsRouter.delete("/history/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.notification.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: "Notification record deleted successfully.",
      data: { id },
    });
  } catch (err) {
    next(err);
  }
});
