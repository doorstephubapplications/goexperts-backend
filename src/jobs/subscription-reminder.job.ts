import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { sendSubscriptionReminderEmail } from "../services/mobile/email.service.js";

const prisma = new PrismaClient();

// Run every day at 00:00 (Midnight)
export const initSubscriptionReminderJob = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("[SUBSCRIPTION REMINDER JOB] Starting daily expiration check...");
    
    try {
      const now = new Date();
      
      // Get all active subscriptions that have an end date
      const subscriptions = await prisma.subscription.findMany({
        where: {
          status: "active",
          endDate: { not: undefined }, 
        },
        include: {
          user: true,
          plan: true,
        },
      }) as any[];

      console.log(`[SUBSCRIPTION REMINDER JOB] Found ${subscriptions.length} active subscriptions.`);

      for (const sub of subscriptions) {
        if (!sub.endDate || !sub.user) continue;

        // Calculate days left (end date - current date)
        const diffTime = new Date(sub.endDate).getTime() - now.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // We only care about 3, 2, or 1 days left
        if (daysLeft === 3 || daysLeft === 2 || daysLeft === 1) {
          
          // Deduplication: Check if we already sent THIS specific reminder day for this subscription
          const dedupeContext = `reminder_${daysLeft}_days_${sub.id}`;
          
          const existingReminder = await prisma.notification.findFirst({
            where: {
              userId: sub.user.id,
              type: "SUBSCRIPTION",
              contextType: dedupeContext
            }
          });

          if (existingReminder) {
            console.log(`[SUBSCRIPTION REMINDER JOB] Skipping ${sub.user.email}, ${daysLeft} day reminder already sent.`);
            continue;
          }

          // Determine renew link based on user role (best effort fallback)
          let renewLink = `${process.env.FRONTEND_URL || 'https://goexperts.in'}/dashboard/subscriptions`;
          if (sub.user.role === "client") renewLink = `${process.env.FRONTEND_URL || 'https://goexperts.in'}/business/billing`;
          if (sub.user.role === "founder") renewLink = `${process.env.FRONTEND_URL || 'https://goexperts.in'}/founder/subscription`;
          if (sub.user.role === "investor") renewLink = `${process.env.FRONTEND_URL || 'https://goexperts.in'}/investor/subscription`;

          const planName = sub.plan?.name || "Free Plan";
          const formattedExpiration = new Date(sub.endDate).toLocaleDateString("en-IN", {
            day: 'numeric', month: 'long', year: 'numeric'
          });

          // 1. Send Email
          await sendSubscriptionReminderEmail(
            sub.user.email,
            sub.user.fullName || sub.user.email,
            planName,
            daysLeft,
            formattedExpiration,
            renewLink
          );

          // 2. Insert In-App Notification (triggers socket.io automatically)
          await prisma.notification.create({
            data: {
              userId: sub.user.id,
              type: "SUBSCRIPTION",
              title: "Subscription Expiring Soon!",
              message: `Your ${planName} expires in ${daysLeft} day${daysLeft > 1 ? 's' : ''} on ${formattedExpiration}. Renew now to maintain uninterrupted access.`,
              channel: "in_app",
              priority: "high",
              status: "unread",
              actionUrl: renewLink,
              contextType: dedupeContext // Used for deduplication
            }
          });

          console.log(`[SUBSCRIPTION REMINDER JOB] Successfully processed ${daysLeft} day reminder for ${sub.user.email}`);
        }
      }
      
      console.log("[SUBSCRIPTION REMINDER JOB] Finished daily check.");
    } catch (error) {
      console.error("[SUBSCRIPTION REMINDER JOB] Failed:", error);
    }
  });
};
