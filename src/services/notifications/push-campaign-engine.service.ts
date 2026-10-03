import cron from "node-cron";
import { prisma } from "../../config/database.js";
import { sendPushNotification } from "../mobile/push.service.js";

/**
 * Dispatches a specific Push Campaign to all users matching targetRole
 */
export async function dispatchCampaign(campaignId: string, slotName = "MANUAL") {
  const campaign = await prisma.pushCampaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign || campaign.deletedAt) {
    throw new Error("Campaign not found or deleted");
  }

  // Find target users by role
  let roleFilter: any = {};
  const targetRoleUpper = campaign.targetRole.toUpperCase();

  if (targetRoleUpper !== "ALL") {
    roleFilter = {
      OR: [
        { role: targetRoleUpper.toLowerCase() },
        { role: targetRoleUpper },
        { role: targetRoleUpper.charAt(0) + targetRoleUpper.slice(1).toLowerCase() }
      ]
    };
  }

  const users = await prisma.user.findMany({
    where: {
      ...roleFilter,
      deletedAt: null,
      status: { notIn: ["BLOCKED", "SUSPENDED", "deleted"] }
    },
    select: {
      id: true,
      role: true,
      fullName: true
    },
    take: 500 // Batch safe limit
  });

  // Load Global Campaign Layout Settings (Admin Managed Globally)
  let globalLayout: any = {
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
  } catch (e) {
    // fallback to defaults
  }

  let deliveredCount = 0;
  let failedCount = 0;

  for (const u of users) {
    try {
      const title = campaign.title.replace("{{fullName}}", u.fullName || "User");
      const body = campaign.description.replace("{{fullName}}", u.fullName || "User");
      const resolvedImage = campaign.imageUrl || globalLayout.defaultBannerUrl || null;

      // 1. Send Mobile Push Notification via device token
      const pushSuccess = await sendPushNotification(u.id, title, body, {
        campaignId: campaign.id,
        category: campaign.category,
        deepLink: campaign.deepLink || "/dashboard",
        imageUrl: resolvedImage,
        offer: campaign.offer,
        appName: globalLayout.appName,
        appLogoUrl: globalLayout.appLogoUrl,
        appLogoDarkUrl: globalLayout.appLogoDarkUrl || globalLayout.appLogoUrl,
        themeMode: globalLayout.themeMode || "auto",
        brandColor: globalLayout.brandColor,
        cta1: globalLayout.ctaButton1Text,
        cta2: globalLayout.ctaButton2Text
      });

      if (pushSuccess) {
        deliveredCount++;
      } else {
        // Production Level Analytics: If push fails (no token or FCM error), count it as a failure, not a success.
        failedCount++;
      }

      // 2. Create In-App Notification record
      await prisma.notification.create({
        data: {
          userId: u.id,
          role: u.role,
          type: "PROMOTIONAL",
          title,
          message: body,
          channel: "push",
          status: "sent",
          actionUrl: campaign.deepLink || "/dashboard",
          metadata: JSON.stringify({
            campaignId: campaign.id,
            category: campaign.category,
            deepLink: campaign.deepLink || "/dashboard",
            imageUrl: campaign.imageUrl,
            offer: campaign.offer
          })
        }
      }).catch(() => {});
    } catch (err) {
      failedCount++;
    }
  }

  const now = new Date();

  // Update campaign counters
  await prisma.pushCampaign.update({
    where: { id: campaign.id },
    data: {
      sendCount: { increment: 1 },
      lastSentAt: now
    }
  });

  // Log in History
  const history = await prisma.pushCampaignHistory.create({
    data: {
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      targetRole: campaign.targetRole,
      slotName,
      scheduledTime: now.toISOString(),
      recipientsCount: users.length,
      deliveredCount,
      failedCount,
      status: failedCount > 0 && deliveredCount === 0 ? "FAILED" : failedCount > 0 ? "PARTIAL" : "DELIVERED",
      payload: JSON.stringify({
        title: campaign.title,
        description: campaign.description,
        offer: campaign.offer,
        deepLink: campaign.deepLink,
        category: campaign.category,
        imageUrl: campaign.imageUrl
      }),
      sentAt: now
    }
  });

  return {
    success: true,
    campaign,
    recipientsCount: users.length,
    deliveredCount,
    failedCount,
    history
  };
}

/**
 * Executes an automated scheduled dispatch slot
 */
export async function executeScheduledSlot(slotKey: string) {
  const slot = await prisma.pushScheduleSetting.findUnique({
    where: { slotKey }
  });

  if (!slot || !slot.isEnabled) {
    return { success: false, message: `Slot ${slotKey} is disabled or missing` };
  }

  const roles = slot.targetRole === "ALL" 
    ? ["FREELANCER", "CLIENT", "FOUNDER", "INVESTOR"]
    : [slot.targetRole];

  const results: any[] = [];

  for (const role of roles) {
    // Pick active campaign for this role that was either never sent or sent longest ago
    const campaign = await prisma.pushCampaign.findFirst({
      where: {
        targetRole: role,
        status: "ACTIVE",
        deletedAt: null
      },
      orderBy: [
        { lastSentAt: "asc" },
        { createdAt: "asc" }
      ]
    });

    if (campaign) {
      try {
        const dispatchRes = await dispatchCampaign(campaign.id, slotKey.toUpperCase());
        results.push({ role, campaignId: campaign.id, title: campaign.title, ...dispatchRes });
      } catch (err: any) {
        results.push({ role, campaignId: campaign.id, error: err.message });
      }
    }
  }

  // Update lastRunAt on slot setting
  await prisma.pushScheduleSetting.update({
    where: { slotKey },
    data: { lastRunAt: new Date() }
  });

  return {
    success: true,
    slotKey,
    dispatched: results
  };
}

/**
 * Initializes the background cron checking every minute against dynamic DB schedule
 */
export function startPushCampaignCron() {
  console.log("[PushCampaignScheduler] Initializing dynamic 3x daily cron engine...");

  // Runs at second 0 of every minute
  cron.schedule("* * * * *", async () => {
    try {
      // Calculate current time in Indian Standard Time (IST)
      const now = new Date();
      const istTime = now.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      }); // e.g. "09:30", "12:30", "18:30"

      // Fetch enabled schedule settings matching current time
      const matchingSlots = await prisma.pushScheduleSetting.findMany({
        where: {
          isEnabled: true,
          time: istTime
        }
      });

      for (const slot of matchingSlots) {
        // Prevent running multiple times in the same minute
        if (slot.lastRunAt) {
          const diffMinutes = (now.getTime() - new Date(slot.lastRunAt).getTime()) / (1000 * 60);
          if (diffMinutes < 1.5) {
            continue; // Already ran this minute
          }
        }

        console.log(`[PushCampaignScheduler] Triggering automated slot: ${slot.slotKey} (${slot.label}) at IST ${istTime}`);
        await executeScheduledSlot(slot.slotKey);
      }

      // 2. Dispatch custom campaigns scheduled for this exact minute (or past due)
      const customCampaigns = await prisma.pushCampaign.findMany({
        where: {
          scheduleSlot: "CUSTOM",
          status: "ACTIVE",
          deletedAt: null,
          customScheduleAt: { lte: now }
        }
      });

      for (const camp of customCampaigns) {
        // Prevent double sending (if sent within last 24h)
        if (camp.lastSentAt && (now.getTime() - new Date(camp.lastSentAt).getTime() < 24 * 60 * 60 * 1000)) {
          continue;
        }

        console.log(`[PushCampaignScheduler] Triggering CUSTOM EXACT TIME campaign: ${camp.title}`);
        await dispatchCampaign(camp.id, "CUSTOM_EXACT_TIME");

        // Set status to PAUSED after one-shot delivery to prevent firing again
        await prisma.pushCampaign.update({
          where: { id: camp.id },
          data: { status: "PAUSED" }
        });
      }
    } catch (err) {
      console.error("[PushCampaignScheduler] Cron error:", err);
    }
  });

  console.log("[PushCampaignScheduler] Cron engine started successfully.");
}
