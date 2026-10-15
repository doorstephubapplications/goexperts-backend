import { prisma } from "../../config/database.js";

let tablesEnsured = false;

export async function ensureReminderDeliveryTable() {
  if (tablesEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`reminder_deliveries\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`user_id\` VARCHAR(191) NOT NULL,
        \`role\` VARCHAR(191) NOT NULL,
        \`category\` VARCHAR(191) NOT NULL,
        \`milestone\` VARCHAR(191) NOT NULL,
        \`channel\` VARCHAR(191) NOT NULL,
        \`idempotency_key\` VARCHAR(191) NOT NULL,
        \`status\` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
        \`attempts\` INT NOT NULL DEFAULT 0,
        \`last_attempt_at\` DATETIME(3) NULL,
        \`sent_at\` DATETIME(3) NULL,
        \`error_message\` TEXT NULL,
        \`metadata\` TEXT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`reminder_deliveries_idempotency_key_key\`(\`idempotency_key\`),
        INDEX \`reminder_deliveries_user_role_idx\`(\`user_id\`, \`role\`),
        INDEX \`reminder_deliveries_status_idx\`(\`status\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    tablesEnsured = true;
  } catch (err) {
    tablesEnsured = true;
  }
}

export interface ReminderDeliveryRecord {
  id: string;
  userId: string;
  role: string;
  category: "PROFILE_COMPLETION" | "KYC_ACTION";
  milestone: "24h" | "72h" | "168h" | "MANUAL" | "EVENT";
  channel: "email" | "in_app";
  idempotencyKey: string;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  attempts: number;
  lastAttemptAt?: Date | null;
  sentAt?: Date | null;
  errorMessage?: string | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function buildIdempotencyKey(params: {
  userId: string;
  role: string;
  category: string;
  milestone: string;
  channel: string;
  cycleAnchor?: string;
}): string {
  const { userId, role, category, milestone, channel, cycleAnchor = "initial" } = params;
  return `${userId}_${role.toLowerCase()}_${category}_${milestone}_${channel}_${cycleAnchor}`;
}

export async function hasReminderBeenSent(idempotencyKey: string): Promise<boolean> {
  await ensureReminderDeliveryTable();
  const rows: any[] = await prisma.$queryRawUnsafe(
    "SELECT id, status FROM `reminder_deliveries` WHERE `idempotency_key` = ? LIMIT 1",
    idempotencyKey
  );
  if (!rows || rows.length === 0) return false;
  return rows[0].status === "SENT";
}

export async function recordReminderAttempt(params: {
  userId: string;
  role: string;
  category: "PROFILE_COMPLETION" | "KYC_ACTION";
  milestone: "24h" | "72h" | "168h" | "MANUAL" | "EVENT";
  channel: "email" | "in_app";
  idempotencyKey: string;
  status: "PENDING" | "SENT" | "FAILED" | "SKIPPED";
  errorMessage?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await ensureReminderDeliveryTable();
  const now = new Date();
  const sentAt = params.status === "SENT" ? now : null;
  const metadataStr = params.metadata ? JSON.stringify(params.metadata) : null;
  const id = `rem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  await prisma.$executeRawUnsafe(
    `INSERT INTO \`reminder_deliveries\`
      (\`id\`, \`user_id\`, \`role\`, \`category\`, \`milestone\`, \`channel\`, \`idempotency_key\`, \`status\`, \`attempts\`, \`last_attempt_at\`, \`sent_at\`, \`error_message\`, \`metadata\`, \`created_at\`, \`updated_at\`)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      \`status\` = VALUES(\`status\`),
      \`attempts\` = \`attempts\` + 1,
      \`last_attempt_at\` = VALUES(\`last_attempt_at\`),
      \`sent_at\` = VALUES(\`sent_at\`),
      \`error_message\` = VALUES(\`error_message\`),
      \`metadata\` = VALUES(\`metadata\`),
      \`updated_at\` = VALUES(\`updated_at\`)`,
    id,
    params.userId,
    params.role.toLowerCase(),
    params.category,
    params.milestone,
    params.channel,
    params.idempotencyKey,
    params.status,
    now,
    sentAt,
    params.errorMessage || null,
    metadataStr,
    now,
    now
  );
}

export async function getReminderDeliveryStats(): Promise<{
  totalSent: number;
  totalFailed: number;
  totalPending: number;
  byCategory: Record<string, number>;
  byRole: Record<string, number>;
  recentDeliveries: any[];
}> {
  await ensureReminderDeliveryTable();
  const rows: any[] = await prisma.$queryRawUnsafe(
    "SELECT * FROM `reminder_deliveries` ORDER BY `created_at` DESC LIMIT 100"
  );

  let totalSent = 0;
  let totalFailed = 0;
  let totalPending = 0;
  const byCategory: Record<string, number> = {};
  const byRole: Record<string, number> = {};

  rows.forEach((r) => {
    if (r.status === "SENT") totalSent++;
    else if (r.status === "FAILED") totalFailed++;
    else totalPending++;

    byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    byRole[r.role] = (byRole[r.role] || 0) + 1;
  });

  return {
    totalSent,
    totalFailed,
    totalPending,
    byCategory,
    byRole,
    recentDeliveries: rows.slice(0, 50),
  };
}
