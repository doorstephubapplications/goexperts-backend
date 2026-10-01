import { prisma } from "../config/database.js";
import { renderEmailTemplate } from "../services/settings/settings.service.js";
import { EmailChannelAdapter } from "../modules/notifications/notification.service.js";
/**
 * Daily Trial Expiration Reminder Service.
 * Sends automated daily email notifications to users whose 90-day free trial expires in <= 10 days.
 */
export async function runTrialReminderCron() {
    console.log("[TRIAL CRON] Running daily 90-day free trial expiration check...");
    try {
        const now = new Date();
        const tenDaysFromNow = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
        // Find users whose trial is active and expires in <= 10 days
        const expiringUsers = await prisma.user.findMany({
            where: {
                trialEndsAt: {
                    gt: now,
                    lte: tenDaysFromNow,
                },
                status: "active",
            },
        });
        console.log(`[TRIAL CRON] Found ${expiringUsers.length} users with expiring free trials.`);
        const emailAdapter = new EmailChannelAdapter();
        let parsedConfig = {};
        try {
            const chanConfig = await prisma.communicationChannel.findUnique({
                where: { name: "email" },
            });
            if (chanConfig && chanConfig.config) {
                parsedConfig = JSON.parse(chanConfig.config);
            }
        }
        catch {
            // fallback
        }
        for (const u of expiringUsers) {
            if (!u.trialEndsAt)
                continue;
            const msRemaining = u.trialEndsAt.getTime() - now.getTime();
            const daysLeft = Math.max(1, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
            const expiryDateStr = u.trialEndsAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
            const clientHost = process.env.CLIENT_URL || "https://goexperts.in";
            const rendered = await renderEmailTemplate("tpl_trial_expiry_warning", {
                full_name: u.fullName,
                days_left: String(daysLeft),
                trial_ends_at: expiryDateStr,
                pricing_url: `${clientHost}/pricing`,
                role: u.role.toUpperCase(),
            });
            await emailAdapter.send({
                to: u.email,
                subject: rendered.subject,
                body: `Hello ${u.fullName},\n\nYour 90-Day Free Trial expires in ${daysLeft} days on ${expiryDateStr}.\nPlease upgrade your plan at ${clientHost}/pricing to continue enjoying platform features.\n\nBest regards,\nGo Experts Team`,
                html: rendered.html,
            }, parsedConfig);
            console.log(`[TRIAL CRON SUCCESS] Sent ${daysLeft}-day expiry reminder to ${u.email}`);
        }
    }
    catch (err) {
        console.error("[TRIAL CRON ERROR]", err);
    }
}
