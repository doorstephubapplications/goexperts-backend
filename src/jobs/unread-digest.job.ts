import cron from 'node-cron';
import { prisma } from '../config/database.js';
import { sendEmail, shell } from '../services/mobile/email.service.js';

export function startUnreadMessageDigestCron() {
  console.log('[JOB] Initializing Unread Message Digest cron...');
  
  // Run every hour to check for users whose local time is between 18:00 and 19:00 (6 PM)
  cron.schedule('0 * * * *', async () => {
    console.log('[JOB] Running Unread Message Digest...');
    try {
      // 1. Fetch users with unread messages
      // A user has unread messages if there is a message in a conversation they belong to
      // that is NOT sent by them and readAt is NULL.
      // We will only do this for active users.
      
      const users = await prisma.user.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          email: true,
          fullName: true,
          timezone: true,
          notificationPreferences: true
        }
      });

      const currentUtcTime = new Date();

      for (const user of users) {
        // Check preferences
        let emailEnabled = true;
        let digestEnabled = true;

        if (user.notificationPreferences) {
          emailEnabled = user.notificationPreferences.emailEnabled;
          try {
            const prefs = JSON.parse(user.notificationPreferences.preferences || '{}');
            if (prefs.unreadMessageDigest === false) {
              digestEnabled = false;
            }
          } catch(e) {}
        }

        if (!emailEnabled || !digestEnabled) continue;

        // Check Local Time (target 18:00 - 19:00)
        let localHour = currentUtcTime.getUTCHours();
        let localDateStr = currentUtcTime.toISOString().split('T')[0]; // Default fallback

        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: user.timezone || 'UTC',
            hour: 'numeric',
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          
          const parts = formatter.formatToParts(currentUtcTime);
          const hourPart = parts.find(p => p.type === 'hour')?.value;
          const year = parts.find(p => p.type === 'year')?.value;
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;

          if (hourPart) localHour = parseInt(hourPart, 10);
          if (year && month && day) localDateStr = `${year}-${month}-${day}`;
        } catch (e) {
          // If timezone is invalid, fallback to UTC
        }

        // Only send at 18:00 local time
        if (localHour !== 18) continue;

        // 2. Check Idempotency (has digest been sent today?)
        const existingDigest = await prisma.messageEmailDigest.findUnique({
          where: {
            userId_localDate: {
              userId: user.id,
              localDate: localDateStr
            }
          }
        });

        if (existingDigest) continue; // Already sent today

        // 3. Find unread messages
        // Messages where conversation involves user, sender is NOT user, readAt is NULL
        const unreadMessages = await prisma.message.findMany({
          where: {
            readAt: null,
            senderId: { not: user.id },
            conversation: {
              OR: [
                { userA: user.id },
                { userB: user.id }
              ],
              status: { not: 'BLOCKED' }
            }
          },
          include: {
            conversation: true
          }
        });

        if (unreadMessages.length === 0) continue;

        // Group by conversation
        const convSet = new Set(unreadMessages.map(m => m.conversationId));
        const numConvs = convSet.size;
        const numMsgs = unreadMessages.length;

        // 4. Try to claim idempotency lock BEFORE sending email
        // If it's already SENT, we skip.
        // If it's FAILED or missing, we set it to PROCESSING.
        // If it's PROCESSING and older than 30 mins, we consider it stale and retry.

        const nowUtc = new Date();
        const thirtyMinsAgo = new Date(nowUtc.getTime() - 30 * 60000);

        let digestRecord = null;
        try {
          const existing = await prisma.messageEmailDigest.findUnique({
            where: { userId_localDate: { userId: user.id, localDate: localDateStr } }
          });

          if (existing) {
            if (existing.status === 'SENT') continue;
            if (existing.status === 'PROCESSING' && existing.createdAt > thirtyMinsAgo) continue; // Still processing

            // Try to update to PROCESSING (optimistic concurrency not strictly needed for cron, but good)
            digestRecord = await prisma.messageEmailDigest.update({
              where: { id: existing.id },
              data: { status: 'PROCESSING', createdAt: new Date() }
            });
          } else {
            digestRecord = await prisma.messageEmailDigest.create({
              data: {
                userId: user.id,
                localDate: localDateStr,
                status: 'PROCESSING'
              }
            });
          }
        } catch (dbError: any) {
          // If duplicate key error on create, another instance claimed it. Skip.
          if (dbError.code === 'P2002') continue; 
          throw dbError; // Otherwise fail
        }

        // 5. Send Email
        try {
          const emailBody = `
            <p>Hi ${user.fullName},</p>
            <p>You have <strong>${numMsgs} unread message${numMsgs > 1 ? 's' : ''}</strong> from <strong>${numConvs} conversation${numConvs > 1 ? 's' : ''}</strong> waiting for you on GoExperts.</p>
            <p>Stay responsive to keep your connections engaged!</p>
            <br/>
            <p><a href="https://goexperts.in/dashboard/messages" style="display:inline-block;padding:10px 20px;background:#10B981;color:#fff;text-decoration:none;border-radius:5px;font-weight:bold;">View Messages</a></p>
          `;

          await sendEmail(
            user.email,
            "You have unread messages on GoExperts",
            shell("Unread Messages Summary", emailBody)
          );

          // Mark as SENT
          await prisma.messageEmailDigest.update({
            where: { id: digestRecord.id },
            data: { status: 'SENT' }
          });
        } catch (emailError) {
          console.error(`[JOB ERROR] Failed to send digest email to ${user.email}:`, emailError);
          // Mark as FAILED so it can be retried on the next run
          await prisma.messageEmailDigest.update({
            where: { id: digestRecord.id },
            data: { status: 'FAILED' }
          });
        }
      }
    } catch (error) {
      console.error('[JOB ERROR] Unread Message Digest failed:', error);
    }
  });
}
