import { prisma } from "../../config/database.js";
import { renderEmailTemplate } from "../settings/settings.service.js";
import { sendEmail } from "../mobile/email.service.js";
import { emitNotification } from "./notification-events.service.js";
import {
  evaluateUserRoleEligibility,
  EvaluatedRoleReadiness,
} from "./reminder-eligibility.service.js";
import {
  buildIdempotencyKey,
  hasReminderBeenSent,
  recordReminderAttempt,
} from "./reminder-tracking.service.js";

const FRONTEND_URL = process.env.PUBLIC_WEB_URL || process.env.FRONTEND_URL || "https://goexperts.in";

export interface ReminderDispatchResult {
  success: boolean;
  emailSent: boolean;
  inAppSent: boolean;
  skipped: boolean;
  reason?: string;
}

/**
 * Dispatches an automated or manual reminder for an evaluated role workspace.
 * Uses tpl_profile_reminder and tpl_kyc_reminder templates from Super Admin.
 */
export async function dispatchRoleReminder(params: {
  userId: string;
  role: string;
  category: "PROFILE_COMPLETION" | "KYC_ACTION";
  milestone: "24h" | "72h" | "168h" | "MANUAL" | "EVENT";
  sendEmailChannel?: boolean;
  sendInAppChannel?: boolean;
  forceManual?: boolean;
}): Promise<ReminderDispatchResult> {
  const {
    userId,
    role,
    category,
    milestone,
    sendEmailChannel = true,
    sendInAppChannel = true,
    forceManual = false,
  } = params;

  // 1. Evaluate user eligibility
  const evalResult = await evaluateUserRoleEligibility(userId, role);
  if (!evalResult) {
    return { success: false, emailSent: false, inAppSent: false, skipped: true, reason: "User not eligible or suspended" };
  }

  // 2. Business rule checks
  if (category === "PROFILE_COMPLETION" && !evalResult.isProfileEligible) {
    return { success: true, emailSent: false, inAppSent: false, skipped: true, reason: "Profile has no actionable missing core requirements" };
  }

  if (category === "KYC_ACTION" && !evalResult.isKycActionRequired) {
    return { success: true, emailSent: false, inAppSent: false, skipped: true, reason: "KYC documents are either approved or already under review" };
  }

  let emailSent = false;
  let inAppSent = false;

  // 3. Email Channel Execution
  if (sendEmailChannel && evalResult.email) {
    const emailKey = buildIdempotencyKey({
      userId,
      role,
      category,
      milestone,
      channel: "email",
    });

    const alreadySent = await hasReminderBeenSent(emailKey);
    if (!alreadySent || forceManual) {
      try {
        if (category === "PROFILE_COMPLETION") {
          const actionUrl = `${FRONTEND_URL}${evalResult.actionableTargetRoute}`;
          const humanSteps = evalResult.missingCoreLabels.slice(0, 3).join(", ");
          const rendered = await renderEmailTemplate("tpl_profile_reminder", {
            full_name: evalResult.fullName,
            firstName: evalResult.fullName.split(" ")[0],
            role_name: evalResult.role.toUpperCase(),
            missing_steps: humanSteps || "Profile details",
            completion_percentage: String(evalResult.profileCompletion),
            profile_link: actionUrl,
            action_url: actionUrl,
            app_url: FRONTEND_URL,
          });

          await sendEmail(evalResult.email, rendered.subject || `Complete your ${evalResult.role} profile on Go Experts`, rendered.html);
          await recordReminderAttempt({
            userId,
            role,
            category,
            milestone,
            channel: "email",
            idempotencyKey: emailKey,
            status: "SENT",
            metadata: { missing: evalResult.missingCoreKeys, url: actionUrl },
          });
          emailSent = true;
        } else if (category === "KYC_ACTION") {
          const kycUrl = `${FRONTEND_URL}${evalResult.kycTargetRoute}`;
          const rendered = await renderEmailTemplate("tpl_kyc_reminder", {
            full_name: evalResult.fullName,
            firstName: evalResult.fullName.split(" ")[0],
            role_name: evalResult.role.toUpperCase(),
            kyc_status: evalResult.kycStatus,
            kyc_link: kycUrl,
            action_url: kycUrl,
            app_url: FRONTEND_URL,
          });

          await sendEmail(evalResult.email, rendered.subject || `Verification required for your Go Experts ${evalResult.role} profile`, rendered.html);
          await recordReminderAttempt({
            userId,
            role,
            category,
            milestone,
            channel: "email",
            idempotencyKey: emailKey,
            status: "SENT",
            metadata: { kycStatus: evalResult.kycStatus, url: kycUrl },
          });
          emailSent = true;
        }
      } catch (err: any) {
        await recordReminderAttempt({
          userId,
          role,
          category,
          milestone,
          channel: "email",
          idempotencyKey: emailKey,
          status: "FAILED",
          errorMessage: err?.message || "Email dispatch failed",
        });
      }
    }
  }

  // 4. In-App Notification Channel Execution
  if (sendInAppChannel) {
    const inAppKey = buildIdempotencyKey({
      userId,
      role,
      category,
      milestone,
      channel: "in_app",
    });

    const alreadySent = await hasReminderBeenSent(inAppKey);
    if (!alreadySent || forceManual) {
      try {
        if (category === "PROFILE_COMPLETION") {
          const stepCount = evalResult.missingCoreKeys.length;
          await emitNotification({
            userId,
            role: evalResult.role,
            type: "PROFILE_REMINDER",
            title: `Complete your ${evalResult.role.toUpperCase()} profile`,
            message: `You have ${stepCount} required step${stepCount > 1 ? "s" : ""} remaining (${evalResult.missingCoreLabels.slice(0, 2).join(", ")}). Complete them now to boost match quality.`,
            actionUrl: evalResult.actionableTargetRoute,
            priority: "normal",
            metadata: {
              role: evalResult.role,
              category,
              milestone,
              completion: evalResult.profileCompletion,
            },
          });

          await recordReminderAttempt({
            userId,
            role,
            category,
            milestone,
            channel: "in_app",
            idempotencyKey: inAppKey,
            status: "SENT",
          });
          inAppSent = true;
        } else if (category === "KYC_ACTION") {
          await emitNotification({
            userId,
            role: evalResult.role,
            type: "KYC_ACTION_REMINDER",
            title: `Verification needs your attention`,
            message: `Please complete required document verification for your ${evalResult.role.toUpperCase()} profile to unlock full platform features.`,
            actionUrl: evalResult.kycTargetRoute,
            priority: "high",
            metadata: {
              role: evalResult.role,
              category,
              milestone,
              kycStatus: evalResult.kycStatus,
            },
          });

          await recordReminderAttempt({
            userId,
            role,
            category,
            milestone,
            channel: "in_app",
            idempotencyKey: inAppKey,
            status: "SENT",
          });
          inAppSent = true;
        }
      } catch (err: any) {
        await recordReminderAttempt({
          userId,
          role,
          category,
          milestone,
          channel: "in_app",
          idempotencyKey: inAppKey,
          status: "FAILED",
          errorMessage: err?.message || "In-app notification dispatch failed",
        });
      }
    }
  }

  return {
    success: emailSent || inAppSent,
    emailSent,
    inAppSent,
    skipped: !emailSent && !inAppSent,
  };
}
