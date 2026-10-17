import cron from "node-cron";
import { prisma } from "../../config/database.js";
import { sendPushNotification } from "../mobile/push.service.js";
import { normalizeTargetRole } from "./push-campaign-validator.js";
import { checkAndDispatchDailyFestivals, findActiveOccasionsForDate } from "./festival-campaign.service.js";
/**
 * Reusable Default Weekly Schedules
 * Monday to Friday: 9:00 AM (09:00 IST)
 * Saturday and Sunday: 9:00 AM, 2:30 PM (14:30), 9:00 PM (21:00) IST
 */
export const DEFAULT_WEEKLY_SCHEDULES = [
    {
        slotKey: "weekday_morning",
        label: "Weekday Morning Dispatch",
        time: "09:00",
        days: ["MON", "TUE", "WED", "THU", "FRI"],
        isEnabled: true,
        targetRole: "ALL"
    },
    {
        slotKey: "weekend_morning",
        label: "Weekend Morning Dispatch",
        time: "09:00",
        days: ["SAT", "SUN"],
        isEnabled: true,
        targetRole: "ALL"
    },
    {
        slotKey: "weekend_afternoon",
        label: "Weekend Afternoon Dispatch",
        time: "14:30",
        days: ["SAT", "SUN"],
        isEnabled: true,
        targetRole: "ALL"
    },
    {
        slotKey: "weekend_night",
        label: "Weekend Night Dispatch",
        time: "21:00",
        days: ["SAT", "SUN"],
        isEnabled: true,
        targetRole: "ALL"
    }
];
/**
 * Frequency limits & collision settings
 */
export const FREQUENCY_SAFEGUARDS = {
    maxAdPushesPerUserPerDay: 2,
    templateCooldownDays: 7,
    batchChunkSize: 50
};
/**
 * Calculates the actual eligible audience for a target role based on:
 * - User status (active, verified, non-blocked)
 * - User notification preferences (pushEnabled !== false)
 * - Active device tokens registered
 * - Multi-role deduplication
 */
export async function calculateEligibleAudience(targetRoleInput) {
    const targetRole = normalizeTargetRole(targetRoleInput);
    let roleFilter = {};
    if (targetRole !== "ALL") {
        const rLower = targetRole.toLowerCase();
        const rUpper = targetRole.toUpperCase();
        const singular = rUpper.endsWith("S") ? rUpper.slice(0, -1) : rUpper;
        roleFilter = {
            OR: [
                { role: rLower },
                { role: rUpper },
                { role: singular.toLowerCase() },
                { role: singular },
                ...(targetRole === "CLIENT" ? [{ role: "customer" }, { role: "Customer" }, { role: "client" }] : []),
                ...(targetRole === "FOUNDER" ? [{ role: "founder" }, { role: "Founder" }, { role: "startup" }] : [])
            ]
        };
    }
    // 1. Fetch active users matching role criteria
    const activeUsers = await prisma.user.findMany({
        where: {
            ...roleFilter,
            deletedAt: null,
            status: { notIn: ["BLOCKED", "SUSPENDED", "deleted", "inactive"] }
        },
        select: {
            id: true,
            role: true,
            fullName: true
        }
    });
    const totalActiveCount = activeUsers.length;
    if (totalActiveCount === 0) {
        return {
            targetRole,
            totalUsers: 0,
            activeUsers: 0,
            pushEnabledUsers: 0,
            usersWithTokens: 0,
            eligibleRecipientsCount: 0,
            sampleRecipients: []
        };
    }
    const userIds = activeUsers.map((u) => u.id);
    // 2. Filter out users who disabled push notifications in NotificationPreference
    const disabledPrefs = await prisma.notificationPreference.findMany({
        where: {
            userId: { in: userIds },
            pushEnabled: false
        },
        select: { userId: true }
    });
    const disabledUserIds = new Set(disabledPrefs.map((p) => p.userId));
    const pushEnabledUsers = activeUsers.filter((u) => !disabledUserIds.has(u.id));
    // 3. Keep only users who have at least one active FCM device token
    const enabledUserIds = pushEnabledUsers.map((u) => u.id);
    const activeTokens = await prisma.deviceToken.findMany({
        where: {
            userId: { in: enabledUserIds },
            isActive: true
        },
        select: { userId: true }
    });
    const usersWithTokensSet = new Set(activeTokens.map((t) => t.userId));
    const finalEligible = pushEnabledUsers.filter((u) => usersWithTokensSet.has(u.id));
    return {
        targetRole,
        totalUsers: await prisma.user.count({ where: roleFilter }),
        activeUsers: totalActiveCount,
        pushEnabledUsers: pushEnabledUsers.length,
        usersWithTokens: usersWithTokensSet.size,
        eligibleRecipientsCount: finalEligible.length,
        sampleRecipients: finalEligible.slice(0, 5)
    };
}
/**
 * Dispatches an automated campaign or custom push campaign to eligible audience.
 * Enforces:
 * - Multi-role deduplication (1 push per user)
 * - Frequency limits (max 2 ad pushes per day)
 * - Opt-out respect (NotificationPreference.pushEnabled)
 * - Controlled batching (50 users per chunk)
 * - Delivery statistics & suppression tracking
 */
export async function dispatchCampaign(campaignId, slotName = "MANUAL") {
    const campaign = await prisma.pushCampaign.findUnique({
        where: { id: campaignId }
    });
    if (!campaign || campaign.deletedAt) {
        throw new Error("Campaign not found or deleted");
    }
    // Check if campaign is active
    if (campaign.status === "PAUSED" || campaign.status === "INACTIVE") {
        return {
            success: false,
            message: `Campaign '${campaign.title}' is inactive/paused. Dispatch aborted.`,
            recipientsCount: 0,
            deliveredCount: 0,
            failedCount: 0,
            suppressedCount: 0
        };
    }
    return executeAudienceDispatch({
        campaignId: campaign.id,
        campaignName: campaign.title,
        title: campaign.title,
        description: campaign.description,
        imageUrl: campaign.imageUrl,
        targetRole: campaign.targetRole,
        category: campaign.category,
        offer: campaign.offer,
        deepLink: campaign.deepLink,
        slotName
    });
}
/**
 * Dispatches direct content without needing a pre-existing PushCampaign DB record
 * (Used by Automated Festival & Milestone Engines)
 */
export async function dispatchDirectCampaign(params) {
    return executeAudienceDispatch({
        campaignName: params.campaignName,
        title: params.title,
        description: params.description,
        imageUrl: params.imageUrl || null,
        targetRole: params.targetRole || "ALL",
        category: params.category || "Festival / Observance",
        offer: params.offer || null,
        deepLink: params.deepLink || "/dashboard",
        slotName: params.slotName || "FESTIVAL_DISPATCH",
        isFestival: params.isFestival || false
    });
}
/**
 * Core Engine: Audience Resolution, Filtering, Frequency Limiting, and Batched Dispatch
 */
async function executeAudienceDispatch(params) {
    const targetRole = normalizeTargetRole(params.targetRole);
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    // 1. Calculate eligible audience
    let roleFilter = {};
    if (targetRole !== "ALL") {
        const rLower = targetRole.toLowerCase();
        const rUpper = targetRole.toUpperCase();
        const singular = rUpper.endsWith("S") ? rUpper.slice(0, -1) : rUpper;
        roleFilter = {
            OR: [
                { role: rLower },
                { role: rUpper },
                { role: singular.toLowerCase() },
                { role: singular },
                ...(targetRole === "CLIENT" ? [{ role: "customer" }, { role: "Customer" }, { role: "client" }] : []),
                ...(targetRole === "FOUNDER" ? [{ role: "founder" }, { role: "Founder" }, { role: "startup" }] : [])
            ]
        };
    }
    // Load candidate users
    const candidateUsers = await prisma.user.findMany({
        where: {
            ...roleFilter,
            deletedAt: null,
            status: { notIn: ["BLOCKED", "SUSPENDED", "deleted", "inactive"] }
        },
        select: {
            id: true,
            role: true,
            fullName: true
        },
        take: 1000 // Safe upper bound per dispatch run
    });
    if (candidateUsers.length === 0) {
        return logAndReturnHistory({
            params,
            now,
            recipientsCount: 0,
            deliveredCount: 0,
            failedCount: 0,
            suppressedCount: 0,
            suppressionDetails: { emptyAudience: true }
        });
    }
    // Multi-role deduplication: exactly 1 entry per user ID
    const uniqueUsersMap = new Map();
    for (const u of candidateUsers) {
        if (!uniqueUsersMap.has(u.id)) {
            uniqueUsersMap.set(u.id, u);
        }
    }
    const uniqueUserIds = Array.from(uniqueUsersMap.keys());
    // 2. Filter Notification Preferences (Exclude opted-out users)
    const disabledPrefs = await prisma.notificationPreference.findMany({
        where: {
            userId: { in: uniqueUserIds },
            pushEnabled: false
        },
        select: { userId: true }
    });
    const optedOutUserIds = new Set(disabledPrefs.map((p) => p.userId));
    // 3. Frequency Limits: Count pushes sent to each candidate user today
    const recentUserPushes = await prisma.notification.groupBy({
        by: ["userId"],
        where: {
            userId: { in: uniqueUserIds },
            type: "PROMOTIONAL",
            createdAt: { gte: startOfDay }
        },
        _count: { id: true }
    });
    const userDailyPushCounts = new Map();
    recentUserPushes.forEach((p) => {
        if (p.userId)
            userDailyPushCounts.set(p.userId, p._count.id);
    });
    // 4. Fetch Active Device Tokens for Candidate Users
    const activeTokens = await prisma.deviceToken.findMany({
        where: {
            userId: { in: uniqueUserIds },
            isActive: true
        },
        select: {
            userId: true,
            token: true
        }
    });
    const userTokensMap = new Map();
    for (const item of activeTokens) {
        const list = userTokensMap.get(item.userId) || [];
        if (!list.includes(item.token)) {
            list.push(item.token);
        }
        userTokensMap.set(item.userId, list);
    }
    // Load Global Campaign Layout
    let globalLayout = {
        appName: "GoExperts",
        appLogoUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80",
        brandColor: "#2563EB",
        ctaButton1Text: "Explore Now",
        ctaButton2Text: "Dismiss"
    };
    try {
        const layoutSetting = await prisma.setting.findUnique({
            where: { key: "PUSH_CAMPAIGN_GLOBAL_LAYOUT" }
        });
        if (layoutSetting?.value) {
            globalLayout = { ...globalLayout, ...JSON.parse(layoutSetting.value) };
        }
    }
    catch (e) { }
    let deliveredCount = 0;
    let failedCount = 0;
    let suppressedOptedOut = 0;
    let suppressedDailyCap = 0;
    let suppressedNoTokens = 0;
    const validRecipients = [];
    for (const userId of uniqueUserIds) {
        // Check opt-out
        if (optedOutUserIds.has(userId)) {
            suppressedOptedOut++;
            continue;
        }
        // Check frequency limit (Festival greetings can bypass daily cap if urgent)
        const todayCount = userDailyPushCounts.get(userId) || 0;
        if (!params.isFestival && todayCount >= FREQUENCY_SAFEGUARDS.maxAdPushesPerUserPerDay) {
            suppressedDailyCap++;
            continue;
        }
        // Check active tokens
        const tokens = userTokensMap.get(userId) || [];
        if (tokens.length === 0) {
            suppressedNoTokens++;
            continue;
        }
        validRecipients.push({
            user: uniqueUsersMap.get(userId),
            tokens
        });
    }
    // 5. Controlled Batch Delivery
    const chunkSize = FREQUENCY_SAFEGUARDS.batchChunkSize;
    for (let i = 0; i < validRecipients.length; i += chunkSize) {
        const batch = validRecipients.slice(i, i + chunkSize);
        await Promise.allSettled(batch.map(async ({ user, tokens }) => {
            try {
                const title = params.title.replace("{{fullName}}", user.fullName || "Expert");
                const body = params.description.replace("{{fullName}}", user.fullName || "Expert");
                const resolvedImage = params.imageUrl || globalLayout.defaultBannerUrl || null;
                const destinationLink = params.deepLink || "/dashboard";
                // Send via Firebase
                const pushSuccess = await sendPushNotification(user.id, title, body, {
                    campaignId: params.campaignId || params.campaignName,
                    category: params.category || "General",
                    deepLink: destinationLink,
                    imageUrl: resolvedImage,
                    offer: params.offer || undefined,
                    appName: globalLayout.appName,
                    appLogoUrl: globalLayout.appLogoUrl,
                    brandColor: globalLayout.brandColor,
                    cta1: globalLayout.ctaButton1Text,
                    cta2: globalLayout.ctaButton2Text
                });
                if (pushSuccess) {
                    deliveredCount++;
                    // Create In-App Notification log
                    await prisma.notification.create({
                        data: {
                            userId: user.id,
                            role: user.role,
                            type: "PROMOTIONAL",
                            title,
                            message: body,
                            channel: "push",
                            status: "sent",
                            actionUrl: destinationLink,
                            metadata: JSON.stringify({
                                campaignId: params.campaignId,
                                campaignName: params.campaignName,
                                category: params.category,
                                deepLink: destinationLink,
                                imageUrl: resolvedImage,
                                offer: params.offer
                            })
                        }
                    }).catch(() => { });
                }
                else {
                    failedCount++;
                }
            }
            catch (err) {
                failedCount++;
            }
        }));
    }
    // Update send count and lastSentAt if this is a registered PushCampaign
    if (params.campaignId) {
        await prisma.pushCampaign.update({
            where: { id: params.campaignId },
            data: {
                sendCount: { increment: 1 },
                lastSentAt: now
            }
        }).catch(() => { });
    }
    const totalSuppressed = suppressedOptedOut + suppressedDailyCap + suppressedNoTokens;
    return logAndReturnHistory({
        params,
        now,
        recipientsCount: validRecipients.length,
        deliveredCount,
        failedCount,
        suppressedCount: totalSuppressed,
        suppressionDetails: {
            optedOut: suppressedOptedOut,
            dailyCapExceeded: suppressedDailyCap,
            noActiveTokens: suppressedNoTokens
        }
    });
}
/**
 * Persists execution history record and returns response payload
 */
async function logAndReturnHistory(opts) {
    const { params, now, recipientsCount, deliveredCount, failedCount, suppressedCount, suppressionDetails } = opts;
    let finalStatus = "DELIVERED";
    if (failedCount > 0 && deliveredCount === 0) {
        finalStatus = "FAILED";
    }
    else if (failedCount > 0) {
        finalStatus = "PARTIAL";
    }
    else if (recipientsCount === 0) {
        finalStatus = "SUPPRESSED";
    }
    const historyRecord = await prisma.pushCampaignHistory.create({
        data: {
            campaignId: params.campaignId || null,
            campaignTitle: params.title,
            targetRole: params.targetRole || "ALL",
            slotName: params.slotName,
            scheduledTime: now.toISOString(),
            recipientsCount,
            deliveredCount,
            failedCount,
            status: finalStatus,
            payload: JSON.stringify({
                campaignName: params.campaignName,
                title: params.title,
                description: params.description,
                offer: params.offer,
                deepLink: params.deepLink,
                category: params.category,
                imageUrl: params.imageUrl,
                suppressedCount,
                suppressionDetails
            }),
            sentAt: now
        }
    }).catch((err) => {
        console.error("[PushCampaignEngine] Error logging PushCampaignHistory:", err);
        return null;
    });
    return {
        success: true,
        campaignId: params.campaignId,
        campaignTitle: params.title,
        slotName: params.slotName,
        recipientsCount,
        deliveredCount,
        failedCount,
        suppressedCount,
        suppressionDetails,
        history: historyRecord
    };
}
/**
 * Executes an automated scheduled dispatch slot with:
 * - Idempotency key (never fires same slot twice on same day)
 * - Festival collision check (suppresses morning routine push if festival ran today)
 * - Deterministic rotation (picks least recently sent active campaign)
 */
export async function executeScheduledSlot(slotKey, forceDispatch = false, currentDate = new Date()) {
    const now = currentDate;
    const istDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"
    const occurrenceKey = `${istDateStr}_${slotKey.toUpperCase()}`;
    // 1. Idempotency Check: Prevent duplicate dispatch for the same scheduled occurrence
    if (!forceDispatch) {
        const existingRun = await prisma.pushCampaignHistory.findFirst({
            where: {
                slotName: { startsWith: occurrenceKey }
            }
        });
        if (existingRun) {
            console.log(`[PushCampaignScheduler] ⏩ Slot ${slotKey} already executed for occurrence ${occurrenceKey}. Skipping.`);
            return {
                success: false,
                message: `Slot ${slotKey} already executed for ${istDateStr} at ${existingRun.sentAt.toISOString()}`,
                skipped: true
            };
        }
    }
    // 2. Festival Collision Check for morning slots (09:00 IST):
    // "Avoid sending routine weekend notifications and a festival greeting on the same day without applying the configured priority rules."
    if (!forceDispatch && (slotKey === "weekday_morning" || slotKey === "weekend_morning" || slotKey === "slot_1")) {
        const activeFestivals = await findActiveOccasionsForDate(now);
        if (activeFestivals.length > 0) {
            console.log(`[PushCampaignScheduler] 🎆 Festival greeting scheduled for today (${activeFestivals[0].name}). Suppressing routine morning campaign slot.`);
            return {
                success: true,
                message: `Routine morning slot suppressed because today has a festival greeting: ${activeFestivals[0].name}`,
                festivalCollision: true,
                suppressed: true
            };
        }
    }
    // Fetch slot settings (or use DEFAULT_WEEKLY_SCHEDULES)
    const slotSetting = await prisma.pushScheduleSetting.findUnique({
        where: { slotKey }
    }).catch(() => null);
    if (slotSetting && !slotSetting.isEnabled) {
        return { success: false, message: `Slot ${slotKey} is currently disabled in settings.` };
    }
    const targetRole = slotSetting?.targetRole || "ALL";
    const rolesToDispatch = targetRole === "ALL"
        ? ["FREELANCER", "CLIENT", "FOUNDER", "INVESTOR"]
        : [targetRole];
    const results = [];
    for (const role of rolesToDispatch) {
        // Deterministic selection and content rotation:
        // Select active campaign for this role with lowest sendCount and oldest lastSentAt
        const campaign = await prisma.pushCampaign.findFirst({
            where: {
                targetRole: { in: [role, "ALL"] },
                status: "ACTIVE",
                deletedAt: null
            },
            orderBy: [
                { sendCount: "asc" },
                { lastSentAt: "asc" },
                { createdAt: "asc" }
            ]
        });
        if (campaign) {
            try {
                const slotRoleKey = `${occurrenceKey}_${role}`;
                const dispatchRes = await dispatchCampaign(campaign.id, slotRoleKey);
                results.push({ role, campaignId: campaign.id, title: campaign.title, ...dispatchRes });
            }
            catch (err) {
                results.push({ role, campaignId: campaign.id, error: err.message });
            }
        }
        else {
            results.push({ role, message: `No active campaign found for role ${role}` });
        }
    }
    // Update lastRunAt on slot setting if it exists
    if (slotSetting) {
        try {
            await prisma.pushScheduleSetting.update({
                where: { slotKey },
                data: { lastRunAt: now }
            });
        }
        catch (e) { }
    }
    return {
        success: true,
        slotKey,
        occurrenceKey,
        dispatched: results
    };
}
/**
 * Initializes the background cron engine
 * Runs every minute to evaluate:
 * 1. Festival occasions at 09:00 IST
 * 2. Weekday schedules (Mon-Fri at 09:00 IST)
 * 3. Weekend schedules (Sat-Sun at 09:00, 14:30, 21:00 IST)
 * 4. Custom exact time campaigns
 */
export function startPushCampaignCron() {
    console.log("[PushCampaignScheduler] Initializing automated weekly & festival push campaign scheduler...");
    // Runs at second 0 of every minute
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();
            // Current Time and Date in Indian Standard Time (IST)
            const istTime = now.toLocaleTimeString("en-GB", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }); // e.g. "09:00", "14:30", "21:00"
            const istDayOfWeek = new Intl.DateTimeFormat("en-US", {
                timeZone: "Asia/Kolkata",
                weekday: "short"
            }).format(now); // "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
            const isWeekend = istDayOfWeek === "Sat" || istDayOfWeek === "Sun";
            const isWeekday = !isWeekend;
            // =========================================================================
            // 1. CHECK AND DISPATCH AUTOMATED FESTIVAL CAMPAIGNS (At 09:00 IST)
            // =========================================================================
            if (istTime === "09:00") {
                try {
                    await checkAndDispatchDailyFestivals(now);
                }
                catch (festivalErr) {
                    console.error("[PushCampaignScheduler] Error in festival dispatch checker:", festivalErr);
                }
            }
            // =========================================================================
            // 2. EVALUATE WEEKLY SCHEDULED SLOTS
            // Weekdays: 9:00 AM (09:00)
            // Weekends: 9:00 AM (09:00), 2:30 PM (14:30), 9:00 PM (21:00)
            // =========================================================================
            const matchingSlotKeys = [];
            if (isWeekday && istTime === "09:00") {
                matchingSlotKeys.push("weekday_morning");
            }
            else if (isWeekend) {
                if (istTime === "09:00")
                    matchingSlotKeys.push("weekend_morning");
                else if (istTime === "14:30")
                    matchingSlotKeys.push("weekend_afternoon");
                else if (istTime === "21:00")
                    matchingSlotKeys.push("weekend_night");
            }
            // Also support custom dynamic times from pushScheduleSetting if configured in DB
            const dbSlots = await prisma.pushScheduleSetting.findMany({
                where: {
                    isEnabled: true,
                    time: istTime
                }
            }).catch(() => []);
            for (const s of dbSlots) {
                if (!matchingSlotKeys.includes(s.slotKey)) {
                    matchingSlotKeys.push(s.slotKey);
                }
            }
            // Execute matched slots
            for (const slotKey of matchingSlotKeys) {
                console.log(`[PushCampaignScheduler] ⏰ Triggering scheduled slot: ${slotKey} at IST ${istTime} (${istDayOfWeek})`);
                await executeScheduledSlot(slotKey);
            }
            // =========================================================================
            // 3. DISPATCH ONE-SHOT CUSTOM CAMPAIGNS DUE AT THIS MINUTE
            // =========================================================================
            const customCampaigns = await prisma.pushCampaign.findMany({
                where: {
                    scheduleSlot: "CUSTOM",
                    status: "ACTIVE",
                    deletedAt: null,
                    customScheduleAt: { lte: now }
                }
            }).catch(() => []);
            for (const camp of customCampaigns) {
                // Prevent double sending (if sent within last 24h)
                if (camp.lastSentAt && now.getTime() - new Date(camp.lastSentAt).getTime() < 24 * 60 * 60 * 1000) {
                    continue;
                }
                console.log(`[PushCampaignScheduler] 🎯 Triggering CUSTOM EXACT TIME campaign: ${camp.title}`);
                await dispatchCampaign(camp.id, "CUSTOM_EXACT_TIME");
                // Mark COMPLETED/PAUSED after one-shot delivery to prevent repeated firing
                await prisma.pushCampaign.update({
                    where: { id: camp.id },
                    data: { status: "COMPLETED" }
                }).catch(() => { });
            }
        }
        catch (err) {
            console.error("[PushCampaignScheduler] Cron error:", err);
        }
    });
    console.log("[PushCampaignScheduler] Cron engine started successfully.");
}
