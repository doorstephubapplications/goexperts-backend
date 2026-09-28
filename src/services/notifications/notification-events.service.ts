import { prisma } from "../../config/database.js";
import { getIo } from "../../socket/index.js";
import {
  EMAIL_ELIGIBLE_EVENTS,
  PUSH_ELIGIBLE_EVENTS,
  SECURITY_CRITICAL_EVENTS,
  resolveActionUrl,
} from "../../common/constants/notification-events.js";
import { sendEmail } from "../mobile/email.service.js";
import { sendPushNotification } from "../mobile/push.service.js";

export type NotificationPayload = {
  userId: string;
  role?: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
  priority?: string;
  contextType?: string;
  contextId?: string;
  actorId?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
};

/**
 * Builds a responsive, professional HTML email matching Go Experts brand design tokens
 */
function buildNotificationHtml(title: string, message: string, actionUrl?: string, ctaText = "View in Go Experts"): string {
  const frontendUrl = process.env.PUBLIC_WEB_URL || process.env.FRONTEND_URL || "https://goexperts.in";
  const fullCtaUrl = actionUrl
    ? (actionUrl.startsWith("http") ? actionUrl : `${frontendUrl}${actionUrl.startsWith("/") ? "" : "/"}${actionUrl}`)
    : frontendUrl;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 28px 32px; text-align: left; border-bottom: 2px solid #E30613;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <h2 style="color: #E30613; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Go Experts</h2>
                  </td>
                  <td align="right">
                    <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px;">Notification</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h1 style="color: #0f172a; font-size: 19px; font-weight: 700; margin: 0 0 16px 0; line-height: 1.4;">
                ${title}
              </h1>
              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 28px 0;">
                ${message.replace(/\n/g, "<br>")}
              </p>
              
              <!-- Call to Action -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #E30613;">
                    <a href="${fullCtaUrl}" target="_blank" rel="noopener noreferrer" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; display: inline-block; letter-spacing: 0.2px;">
                      ${ctaText} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                If button does not work, copy and paste this secure link into your browser:<br>
                <a href="${fullCtaUrl}" style="color: #E30613; text-decoration: underline; word-break: break-all;">${fullCtaUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 32px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-weight: 600; color: #475569;">Go Experts Platform &bull; Professional Talent & Business Ecosystem</p>
              <p style="margin: 0;">You received this transactional notification based on your account activity. Manage alerts in your account settings.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Emit a canonical notification.
 * Persists one canonical database record, updates Socket.io in realtime,
 * and asynchronously delivers to eligible channels (Email, Push) without blocking business execution.
 */
export const emitNotification = async (payload: NotificationPayload) => {
  try {
    const channel = "in_app";
    const priority = payload.priority || "normal";

    // Auto-resolve deep-link actionUrl if not provided
    const actionUrl = payload.actionUrl || resolveActionUrl({
      type: payload.type,
      recipientRole: payload.role,
      contextType: payload.contextType,
      contextId: payload.contextId,
      metadata: payload.metadata,
    });

    // 1. Atomic grouping: find existing unread, increment count, or create new
    const notification = await prisma.$transaction(async (tx) => {
      const existingUnread = await tx.notification.findFirst({
        where: {
          userId: payload.userId,
          type: payload.type,
          contextType: payload.contextType || null,
          contextId: payload.contextId || null,
          actorId: payload.actorId || null,
          readAt: null,
          status: { not: "deleted" },
        },
        orderBy: { createdAt: "desc" },
      });

      if (existingUnread) {
        let newMessage = payload.message;
        if (payload.type === "MESSAGE_SENT" || payload.type === "MESSAGE_RECEIVED") {
          newMessage = `${existingUnread.count + 1} new messages`;
        } else if (payload.type === "PROPOSAL_SUBMITTED" || payload.type === "PROPOSAL_RECEIVED") {
          newMessage = `${existingUnread.count + 1} proposals received`;
        }

        return await tx.notification.update({
          where: { id: existingUnread.id },
          data: {
            count: { increment: 1 },
            message: newMessage,
            actionUrl: actionUrl || existingUnread.actionUrl,
            createdAt: new Date(), // bump to top
          },
        });
      }

      // Create new canonical notification
      return await tx.notification.create({
        data: {
          userId: payload.userId,
          role: payload.role || null,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          channel,
          priority,
          status: "delivered",
          contextType: payload.contextType || null,
          contextId: payload.contextId || null,
          actorId: payload.actorId || null,
          actionUrl: actionUrl || null,
          metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
          count: 1,
        },
      });
    });

    // 2. Realtime WebSocket Delivery
    const io = getIo();
    if (io) {
      io.to(payload.userId).emit("notification:new", {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        contextType: notification.contextType,
        contextId: notification.contextId,
        actionUrl: notification.actionUrl,
        createdAt: notification.createdAt,
        count: notification.count,
        read: false,
      });
    }

    // 3. Asynchronous Multi-Channel Dispatch (Non-blocking: failures NEVER roll back business logic)
    setImmediate(async () => {
      try {
        const [user, pref] = await Promise.all([
          prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, email: true, fullName: true },
          }),
          prisma.notificationPreference.findUnique({
            where: { userId: payload.userId },
          }),
        ]);

        if (!user) return;

        const isSecurity = SECURITY_CRITICAL_EVENTS.has(payload.type);

        // --- EMAIL CHANNEL ---
        const shouldSendEmail =
          isSecurity ||
          ((pref?.emailEnabled ?? true) && (EMAIL_ELIGIBLE_EVENTS.has(payload.type) || priority === "urgent" || priority === "high"));

        if (shouldSendEmail && user.email) {
          const emailHtml = buildNotificationHtml(payload.title, payload.message, actionUrl);
          const emailResult = await sendEmail(user.email, `[Go Experts] ${payload.title}`, emailHtml);
          const status = emailResult === true ? "delivered" : "failed";
          const errorMessage = emailResult === true ? null : String(emailResult);

          await prisma.notificationDeliveryAttempt.create({
            data: {
              notificationId: notification.id,
              channel: "email",
              status,
              errorMessage,
              attemptNumber: 1,
            },
          }).catch(() => null);
        }

        // --- PUSH CHANNEL ---
        const shouldSendPush =
          isSecurity ||
          ((pref?.pushEnabled ?? true) && (PUSH_ELIGIBLE_EVENTS.has(payload.type) || priority === "urgent" || priority === "high"));

        if (shouldSendPush) {
          const pushPayload = {
            type: payload.type,
            contextType: payload.contextType,
            contextId: payload.contextId,
            actionUrl,
            notificationId: notification.id,
          };

          const pushSuccess = await sendPushNotification(user.id, payload.title, payload.message, pushPayload);
          await prisma.notificationDeliveryAttempt.create({
            data: {
              notificationId: notification.id,
              channel: "push",
              status: pushSuccess ? "delivered" : "failed",
              attemptNumber: 1,
            },
          }).catch(() => null);
        }
      } catch (bgErr) {
        console.warn("[NOTIFICATION DISPATCH BACKGROUND ERROR]", bgErr);
      }
    });

    return notification;
  } catch (error) {
    console.error("Error emitting notification:", error);
    throw error;
  }
};

export const emitToAdmins = async (payload: Omit<NotificationPayload, "userId" | "role">) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        OR: [{ role: "admin" }, { role: "super_admin" }],
        status: { not: "deleted" },
      },
      select: { id: true },
    });

    const promises = admins.map((admin) =>
      emitNotification({
        ...payload,
        userId: admin.id,
        role: "admin",
      })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error("Error emitting to admins:", error);
  }
};
