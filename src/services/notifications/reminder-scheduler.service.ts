import { prisma } from "../../config/database.js";
import { isPrimarySchedulerInstance } from "../../config/scheduler-guard.js";
import { dispatchRoleReminder } from "./reminder-dispatcher.service.js";

export interface ReminderSchedulerConfig {
  enabled: boolean;
  profileRemindersEnabled: boolean;
  kycRemindersEnabled: boolean;
  emailChannelEnabled: boolean;
  inAppChannelEnabled: boolean;
  milestonesHours: number[]; // e.g. [24, 72, 168]
  batchSize: number;
}

const DEFAULT_CONFIG: ReminderSchedulerConfig = {
  enabled: false, // Default DISABLED for safe production rollout
  profileRemindersEnabled: true,
  kycRemindersEnabled: true,
  emailChannelEnabled: true,
  inAppChannelEnabled: true,
  milestonesHours: [24, 72, 168],
  batchSize: 50,
};

export async function getReminderConfig(): Promise<ReminderSchedulerConfig> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "settings:profile_reminders" },
    });
    if (setting && setting.value) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(setting.value) };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export async function saveReminderConfig(config: Partial<ReminderSchedulerConfig>): Promise<ReminderSchedulerConfig> {
  const current = await getReminderConfig();
  const updated = { ...current, ...config };
  await prisma.setting.upsert({
    where: { key: "settings:profile_reminders" },
    update: { value: JSON.stringify(updated) },
    create: {
      key: "settings:profile_reminders",
      value: JSON.stringify(updated),
      category: "notifications",
    },
  });
  return updated;
}

/**
 * Executes a deterministic milestone evaluation run across all active roles.
 * Governed by PM2 cluster singleton guard to prevent concurrent multi-node dispatch.
 */
export async function runProfileReminderScheduler(): Promise<{
  scanned: number;
  dispatched: number;
  skipped: number;
  errors: number;
}> {
  if (!isPrimarySchedulerInstance()) {
    return { scanned: 0, dispatched: 0, skipped: 0, errors: 0 };
  }

  const config = await getReminderConfig();
  if (!config.enabled) {
    return { scanned: 0, dispatched: 0, skipped: 0, errors: 0 };
  }

  const now = new Date();
  let scanned = 0;
  let dispatched = 0;
  let skipped = 0;
  let errors = 0;

  try {
    // 1. Fetch batch of active portal users
    const users = await prisma.user.findMany({
      where: {
        status: "active",
        deletedAt: null,
      },
      select: {
        id: true,
        role: true,
        createdAt: true,
        userRoles: {
          where: { status: "active" },
          select: { role: true, createdAt: true },
        },
      },
      take: config.batchSize,
      orderBy: { createdAt: "desc" },
    });

    for (const u of users) {
      scanned++;

      // Collect all authorized active roles for this user
      const rolesToEvaluate: Array<{ role: string; activatedAt: Date }> = [
        { role: u.role, activatedAt: u.createdAt },
      ];

      if (u.userRoles && Array.isArray(u.userRoles)) {
        u.userRoles.forEach((ur) => {
          if (ur.role && ur.role.toLowerCase() !== u.role.toLowerCase()) {
            rolesToEvaluate.push({ role: ur.role, activatedAt: ur.createdAt });
          }
        });
      }

      for (const r of rolesToEvaluate) {
        const ageHours = (now.getTime() - r.activatedAt.getTime()) / (1000 * 60 * 60);

        // Determine current milestone
        let milestone: "24h" | "72h" | "168h" | null = null;
        if (ageHours >= 168) {
          milestone = "168h";
        } else if (ageHours >= 72) {
          milestone = "72h";
        } else if (ageHours >= 24) {
          milestone = "24h";
        }

        if (!milestone) {
          skipped++;
          continue;
        }

        try {
          // A. Profile Completion Reminder
          if (config.profileRemindersEnabled) {
            const profileRes = await dispatchRoleReminder({
              userId: u.id,
              role: r.role,
              category: "PROFILE_COMPLETION",
              milestone,
              sendEmailChannel: config.emailChannelEnabled,
              sendInAppChannel: config.inAppChannelEnabled,
            });
            if (profileRes.success) dispatched++;
            else skipped++;
          }

          // B. KYC Action Reminder
          if (config.kycRemindersEnabled) {
            const kycRes = await dispatchRoleReminder({
              userId: u.id,
              role: r.role,
              category: "KYC_ACTION",
              milestone,
              sendEmailChannel: config.emailChannelEnabled,
              sendInAppChannel: config.inAppChannelEnabled,
            });
            if (kycRes.success) dispatched++;
            else skipped++;
          }
        } catch (err) {
          errors++;
        }
      }
    }
  } catch (globalErr) {
    errors++;
  }

  return { scanned, dispatched, skipped, errors };
}
