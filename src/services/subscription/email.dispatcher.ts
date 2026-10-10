import { prisma } from '../../config/database.js';
import { sendEmail } from '../mobile/email.service.js';
import { renderEmailTemplate } from '../settings/settings.service.js';

export type SubscriptionLifecycleEvent = {
  eventType: 'ACTIVATED' | 'RENEWED' | 'UPGRADED' | 'ADDON_ACTIVATED' | 'EXPIRY_WARNING' | 'EXPIRED';
  userId: string;
  planId?: string;
  subscriptionId?: string;
  paymentId?: string;
  invoicePdfPath?: string;
  invoicePublicUrl?: string;
};

/**
 * Dispatch subscription lifecycle emails using the existing email template engine.
 * Safely avoids duplicates and maps correct template variables.
 */
export const dispatchSubscriptionLifecycleEmail = async (event: SubscriptionLifecycleEvent): Promise<boolean> => {
  const { eventType, userId, planId, subscriptionId, paymentId, invoicePdfPath, invoicePublicUrl } = event;

  // Let's fetch the user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, fullName: true }
  });
  if (!user || !user.email) return false;

  // Let's fetch subscription and plan
  let subscription, plan;
  if (subscriptionId) {
    subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true }
    });
    if (subscription) plan = subscription.plan;
  }
  
  if (!plan && planId) {
    plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  }

  const planName = plan ? plan.name : 'Go Experts Plan';
  
  let templateKey = '';
  switch (eventType) {
    case 'ACTIVATED':
    case 'ADDON_ACTIVATED':
      templateKey = 'tpl_subscription_activated';
      break;
    case 'RENEWED':
      templateKey = 'tpl_subscription_renewal';
      break;
    case 'UPGRADED':
      templateKey = 'tpl_subscription_activated'; // Fallback to activated since upgraded doesn't exist natively
      break;
    case 'EXPIRY_WARNING':
      templateKey = 'tpl_subscription_expiry_warning';
      break;
    case 'EXPIRED':
      templateKey = 'tpl_subscription_expired';
      break;
    default:
      return false;
  }

  // Idempotency check via Notification table
  const notifKey = `sub_email_${eventType}_${subscriptionId || planId}_${paymentId || ''}`;
  
  // ATOMIC CLAIM: Lock the user record to serialize concurrent webhooks
  const claim = await prisma.$transaction(async (tx) => {
    // 1. Acquire row lock on user
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    
    // 2. Check if already claimed
    const existing = await tx.notification.findFirst({
      where: {
        userId,
        type: 'EMAIL_DISPATCH',
        contextType: notifKey
      }
    });

    if (existing) {
      if (existing.status === 'sent') return { status: 'already_sent', id: existing.id };
      if (existing.status === 'draft') {
        const ageInMs = Date.now() - new Date(existing.updatedAt).getTime();
        if (ageInMs > 5 * 60 * 1000) return { status: 'retry', id: existing.id }; // Recover abandoned draft after 5 mins
        return { status: 'already_sent', id: existing.id }; // Another process is currently sending
      }
      if (existing.status === 'failed') return { status: 'retry', id: existing.id };
    }

    // 3. Claim it
    const created = await tx.notification.create({
      data: {
        userId,
        type: 'EMAIL_DISPATCH',
        title: `Subscription Email: ${eventType}`,
        message: `Pending ${templateKey}`,
        channel: 'email',
        contextType: notifKey,
        status: 'draft'
      }
    });
    return { status: 'claimed', id: created.id };
  });

  if (claim.status === 'already_sent') {
    console.log(`[EMAIL DISPATCH] Skipped duplicate email: ${notifKey}`);
    return true; // Already processed
  }

  try {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://goexperts.in';
    const amount = plan?.amount || 0;
    
    const formatDate = (date?: Date | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    };

    const dashboardLink = `${FRONTEND_URL}/dashboard`;

    let vars: any = {
      full_name: user.fullName || 'User',
      plan_name: planName,
      start_date: formatDate(subscription?.startDate),
      end_date: formatDate(subscription?.endDate),
      expired_date: formatDate(subscription?.endDate),
      billing_amount: amount.toFixed(2),
      dashboard_link: dashboardLink,
      renew_link: `${FRONTEND_URL}/dashboard/billing`,
      upgrade_link: `${FRONTEND_URL}/dashboard/billing`,
      days_remaining: subscription?.endDate ? Math.max(0, Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0,
      invoice_link: invoicePublicUrl ? `${process.env.BACKEND_URL || 'https://api.goexperts.in'}${invoicePublicUrl}` : '',
    };

    const rendered = await renderEmailTemplate(templateKey, vars);
    
    const attachments = invoicePdfPath ? [
      {
        filename: `Invoice_${planName.replace(/\\s+/g, '_')}.pdf`,
        path: invoicePdfPath
      }
    ] : [];

    if (attachments.length > 0) {
      const { sendEmailWithAttachment } = await import('../mobile/email.service.js');
      await sendEmailWithAttachment(user.email, rendered.subject, rendered.html, attachments);
    } else {
      await sendEmail(user.email, rendered.subject, rendered.html);
    }

    await prisma.notification.update({
      where: { id: claim.id },
      data: {
        status: 'sent',
        message: `Sent ${templateKey} to ${user.email}`
      }
    });

    return true;
  } catch (error) {
    console.error(`[EMAIL DISPATCH ERROR] Event ${eventType}:`, error);
    await prisma.notification.update({
      where: { id: claim.id },
      data: {
        status: 'failed',
        message: `Failed ${templateKey}: ${error instanceof Error ? error.message : 'Unknown'}`
      }
    });
    return false;
  }
};
