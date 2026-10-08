/**
 * Go Experts Master Production Email Templates
 * Single source of truth for all real system email templates.
 */

export interface SystemEmailTemplate {
  id: string;
  name: string;
  module: string;
  fromName: string;
  subject: string;
  variables: string[];
  body: string;
  html: string;
  isDefault?: boolean;
}

export const MASTER_EMAIL_TEMPLATES: SystemEmailTemplate[] = [
  // ─────────────────────────────────────────────────────────────
  // 1. AUTH & IDENTITY
  // ─────────────────────────────────────────────────────────────
  {
    id: "tpl_verification_link",
    name: "Verification Link & OTP Email",
    module: "Auth",
    fromName: "Go Experts Support",
    subject: "Verify Your Go Experts Account 📧",
    variables: [
      "{full_name}",
      "{verification_link}",
      "{otp_code}",
      "{app_url}",
      "{app_name}",
      "{company_name}"
    ],
    body: "Hello {{full_name}},\n\nThank you for registering with Go Experts. Please click the button or link below to verify your email address (Link & Code expire in 15 minutes):\n\n{{verification_link}}\n\nYour Verification OTP Code: {{otp_code}}\n\nIf you did not create an account, you can safely ignore this email.\n\nThank you,\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; overflow: hidden;">
  <div style="padding: 24px; text-align: center; border-bottom: 3px solid #38B2AC; background: #ffffff;">
    <h1 style="color: #38B2AC; font-size: 26px; font-weight: 800; margin: 0;">Go Experts</h1>
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a202c; font-size: 22px; font-weight: 800; margin-bottom: 12px;">Verify Your Email Address 📧</h2>
    <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Hello <strong>{{full_name}}</strong>,</p>
    <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Thank you for registering with <strong>Go Experts</strong>. Please click the button below to verify your email address and activate your account:</p>
    
    <div style="text-align: center; margin: 32px 0;">
      <a href="{{verification_link}}" target="_blank" style="background-color: #38B2AC; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(227, 6, 19, 0.25);">Verify Email Address &rarr;</a>
    </div>

    <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Your Verification OTP Code</p>
      <span style="font-size: 26px; font-weight: 800; color: #38B2AC; letter-spacing: 4px;">{{otp_code}}</span>
    </div>

    <div style="background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 4px 8px 8px 4px; padding: 14px 16px; margin: 24px 0;">
      <p style="margin: 0; font-size: 13px; color: #78350f; line-height: 1.5;"><strong>⏰ Security Notice:</strong> This verification link and OTP code will expire in <strong>15 minutes</strong>. Never share your OTP with anyone.</p>
    </div>
    
  </div>
  <div style="background-color: #fafbfc; padding: 24px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #edf2f7;">
    <p style="margin: 0 0 6px 0; font-weight: 600; color: #4a5568;">Go Experts &bull; Empowering Businesses & Global Talent</p>
    <p style="margin: 0;">Need support? Contact us anytime at <a href="mailto:servicedesk@goexperts.in" style="color: #38B2AC; text-decoration: none;">servicedesk@goexperts.in</a></p>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_welcome",
    name: "Welcome & 90-Day Free Trial",
    module: "Auth",
    fromName: "Go Experts Team",
    subject: "Welcome to Go Experts! Your 90-Day Free Trial is Active 🎉",
    variables: [
      "{full_name}",
      "{role}",
      "{dashboard_link}",
      "{app_url}",
      "{app_name}"
    ],
    body: "Welcome to Go Experts, {{full_name}}!\n\nYour account has been successfully created as a {{role}}. You are entitled to a full 90-day Free Trial with complete platform access.\n\nLogin to your dashboard to get started:\n{{dashboard_link}}\n\nTeam Go Experts",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 36px 24px; text-align: center;">
    <h1 style="color: #ffffff; font-size: 26px; font-weight: 800; margin: 0 0 8px 0;">Welcome to Go Experts! 🎉</h1>
    <p style="color: #94a3b8; font-size: 15px; margin: 0;">Your 90-Day Free Trial is Now Active</p>
  </div>
  <div style="padding: 32px 24px;">
    <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Hi <strong>{{full_name}}</strong>,</p>
    <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">We're thrilled to welcome you as a verified <strong>{{role}}</strong>. Go Experts brings together verified clients, high-calibre freelancers, and leading startups across India and globally.</p>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <h3 style="color: #166534; margin: 0 0 8px 0; font-size: 16px; font-weight: 700;">🎁 What is included in your 90-day trial:</h3>
      <ul style="margin: 0; padding-left: 20px; color: #15803d; font-size: 14px; line-height: 1.8;">
        <li>Unlimited proposals & direct client messaging</li>
        <li>Zero commission fees for the first 3 months</li>
        <li>Milestone escrow security & verified badge preview</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{{dashboard_link}}" target="_blank" style="background-color: #38B2AC; color: #ffffff; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">Go to My Dashboard &rarr;</a>
    </div>
  </div>
  <div style="background-color: #fafbfc; padding: 24px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #edf2f7;">
    <p style="margin: 0;">Go Experts &bull; <a href="mailto:servicedesk@goexperts.in" style="color: #38B2AC; text-decoration: none;">servicedesk@goexperts.in</a></p>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_password_reset",
    name: "Password Reset Request",
    module: "Auth",
    fromName: "Go Experts Security",
    subject: "Reset Your Go Experts Password 🔐",
    variables: [
      "{full_name}",
      "{reset_link}",
      "{otp_code}",
      "{expiry_time}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nWe received a request to reset your Go Experts account password. Use the verification code below or click the reset link:\n\nCode: {{otp_code}}\nLink: {{reset_link}}\n\nThis request is valid for {{expiry_time}}. If you did not request this, please secure your account immediately.\n\nGo Experts Security Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; overflow: hidden;">
  <div style="padding: 24px; text-align: center; border-bottom: 3px solid #38B2AC; background: #ffffff;">
    <h1 style="color: #38B2AC; font-size: 26px; font-weight: 800; margin: 0;">Go Experts</h1>
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a202c; font-size: 20px; font-weight: 800; margin-bottom: 12px;">Password Reset Request 🔐</h2>
    <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">Hello <strong>{{full_name}}</strong>,</p>
    <p style="font-size: 15px; color: #4a5568; line-height: 1.6;">A password reset was requested for your account. Please use the 6-digit verification code below:</p>

    <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #9f1239; font-weight: 700; text-transform: uppercase;">One-Time Security Code</p>
      <span style="font-size: 32px; font-weight: 800; color: #38B2AC; letter-spacing: 6px;">{{otp_code}}</span>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #9f1239;">Valid for 10 minutes</p>
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="{{reset_link}}" target="_blank" style="background-color: #38B2AC; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; text-decoration: none; display: inline-block;">Reset Password Online &rarr;</a>
    </div>

    <p style="font-size: 13px; color: #718096; line-height: 1.5;">If you did not initiate this password reset, please ignore this email or contact support immediately.</p>
  </div>
  <div style="background-color: #fafbfc; padding: 20px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #edf2f7;">
    <p style="margin: 0;">Go Experts Security Desk &bull; servicedesk@goexperts.in</p>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_delete_account_otp",
    name: "Delete Account Verification OTP",
    module: "Auth",
    fromName: "Go Experts Security",
    subject: "Delete Account Verification Code - Go Experts",
    variables: [
      "{full_name}",
      "{email}",
      "{otp_code}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nYou have requested to delete your Go Experts account ({{email}}). Your 6-digit confirmation code is: {{otp_code}}.\n\nThis verification code is valid for 10 minutes. If you did not request account deletion, ignore this email or contact support immediately.",
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff;">
  <h2 style="color: #38B2AC; margin-top: 0;">Go Experts &bull; Delete Account Request</h2>
  <p style="color: #3f3f46; font-size: 15px;">You have requested to delete your account registered on Go Experts (<strong>{{email}}</strong>).</p>
  <p style="color: #3f3f46; font-size: 15px;">Your 6-digit OTP verification code is:</p>
  <div style="background-color: #fff1f2; border: 1px solid #fecdd3; padding: 16px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #38B2AC; border-radius: 10px; margin: 20px 0;">
    {{otp_code}}
  </div>
  <p style="color: #71717a; font-size: 13px;">This verification code is valid for 10 minutes. If you did not request account deletion, please ignore this email or contact support immediately.</p>
  <hr style="border: none; border-top: 1px solid #f4f4f5; margin: 24px 0;" />
  <p style="font-size: 12px; color: #a1a1aa; margin: 0;">Go Experts Support Team &bull; servicedesk@goexperts.in</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_account_deleted",
    name: "Account Deleted Confirmation",
    module: "Auth",
    fromName: "Go Experts Support",
    subject: "Your GoExperts Account Has Been Deleted",
    variables: [
      "{full_name}",
      "{email}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nThis is to confirm that your GoExperts account ({{email}}) and all associated data have been permanently deleted as requested.\n\nIf you did not request this deletion, contact our support team immediately at servicedesk@goexperts.in.\n\nThe GoExperts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;text-transform:uppercase;">Account Update</p>
  <h1 style="margin:0 0 16px;color:#0f172a;font-size:24px;font-weight:800;">Account Deleted</h1>
  <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
    This is to confirm that your GoExperts account ({{email}}) and all associated personal records have been permanently deleted as requested.
  </p>
  <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 16px;border-radius:4px;margin:20px 0;">
    <p style="margin:0;color:#991b1b;font-size:13px;font-weight:600;">Was this a mistake?</p>
    <p style="margin:4px 0 0;color:#7f1d1d;font-size:13px;">If you did not request this deletion, contact our support team immediately at <a href="mailto:servicedesk@goexperts.in" style="color:#991b1b;font-weight:bold;">servicedesk@goexperts.in</a>.</p>
  </div>
  <p style="margin:24px 0 0;color:#374151;font-size:13px;font-weight:600;">The GoExperts Team</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_account_active",
    name: "Account Activated / KYC Verified",
    module: "Auth",
    fromName: "Go Experts Support",
    subject: "✅ Your Go Experts Account is Now Active",
    variables: [
      "{full_name}",
      "{dashboard_link}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nGreat news! Your KYC verification has been approved and your Go Experts account is now fully active.\n\nSign in now: {{dashboard_link}}\n\nThe Go Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;text-transform:uppercase;">Account Status Update</p>
  <h1 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;line-height:1.2;">Your account is now active! 🎉</h1>
  <p style="margin:0 0 20px;color:#64748b;font-size:15px;">Hi <strong>{{full_name}}</strong>,</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
    <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">✅ KYC Verification Approved</p>
    <p style="margin:6px 0 0;color:#15803d;font-size:13px;">Your identity has been verified by our team. Your Go Experts account is now fully active and ready to use.</p>
  </div>
  <div style="text-align:center;margin:28px 0;">
    <a href="{{dashboard_link}}" style="background-color:#38B2AC;color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;display:inline-block;">Go to My Dashboard &rarr;</a>
  </div>
  <p style="margin:24px 0 0;color:#374151;font-size:13px;font-weight:600;">The Go Experts Team</p>
</div>`,
    isDefault: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 2. BILLING & SUBSCRIPTIONS
  // ─────────────────────────────────────────────────────────────
  {
    id: "tpl_free_plan_activated",
    name: "Free Plan Activated Confirmation",
    module: "Billing",
    fromName: "Go Experts Billing",
    subject: "Your Go Experts Free Plan is Active",
    variables: [
      "{full_name}",
      "{plan_name}",
      "{role}",
      "{valid_until}",
      "{dashboard_link}"
    ],
    body: "Hi {{full_name}},\n\nYour KYC is verified and your {{plan_name}} has been activated automatically until {{valid_until}}.\n\nAccess your workspace: {{dashboard_link}}\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;text-transform:uppercase;">Plan Activated</p>
  <h1 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;line-height:1.2;">Your Free Plan is Active 🚀</h1>
  <p style="margin:0 0 20px;color:#64748b;font-size:15px;">Hi <strong>{{full_name}}</strong>,</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
    <p style="margin:0;color:#166534;font-size:14px;font-weight:700;">✅ KYC Approved + Free Plan Activated</p>
    <p style="margin:6px 0 0;color:#15803d;font-size:13px;">Your {{plan_name}} has been activated automatically. Valid until <strong>{{valid_until}}</strong>.</p>
  </div>
  <div style="text-align:center;margin:28px 0;">
    <a href="{{dashboard_link}}" style="background-color:#38B2AC;color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;display:inline-block;">Go to My Dashboard &rarr;</a>
  </div>
  <p style="margin:24px 0 0;color:#374151;font-size:13px;font-weight:600;">The Go Experts Team</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_plan_activation_promo",
    name: "Activate Free 90-Day Plan Promo",
    module: "Billing",
    fromName: "Go Experts Growth",
    subject: "🚀 Activate Your Free 90-Day Plan on Go Experts",
    variables: [
      "{full_name}",
      "{activation_link}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nCongratulations on getting approved! You are eligible for a Free 90-Day Access Plan on Go Experts. Click the link below to activate instantly:\n\n{{activation_link}}\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;text-transform:uppercase;">Action Required</p>
  <h1 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;line-height:1.2;">Activate your Free Plan 🚀</h1>
  <p style="margin:0 0 20px;color:#64748b;font-size:15px;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.7;">
    Congratulations on getting approved! You're eligible for a <strong>Free 90-Day Access Plan</strong>. Click the button below, verify your email with a quick OTP, and your plan activates instantly.
  </p>
  <div style="text-align:center;margin:28px 0;">
    <a href="{{activation_link}}" style="background-color:#38B2AC;color:#ffffff;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;display:inline-block;">Activate Free Plan Now &rarr;</a>
  </div>
  <p style="margin:24px 0 0;color:#374151;font-size:13px;font-weight:600;">The Go Experts Team</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_plan_activation_otp",
    name: "Plan Activation OTP Code",
    module: "Billing",
    fromName: "Go Experts Security",
    subject: "🔑 Your Plan Activation Code Go Experts",
    variables: [
      "{full_name}",
      "{otp_code}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nUse this 6-digit code to activate your Go Experts free plan:\n\nOTP: {{otp_code}}\n\nValid for 10 minutes.\n\nGo Experts Team",
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff;">
  <h2 style="color: #0f172a; margin-top: 0;">Plan Activation OTP Code 🔑</h2>
  <p style="color: #4a5568; font-size: 15px;">Use the 6-digit code below to verify your email and activate your Go Experts plan:</p>
  <div style="background-color: #0f172a; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
    <span style="font-size: 32px; font-weight: 800; color: #f97316; letter-spacing: 6px;">{{otp_code}}</span>
    <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0;">Expires in 10 minutes</p>
  </div>
  <p style="color: #71717a; font-size: 13px;">Never share your OTP with anyone. The Go Experts Team will never call or message to ask for it.</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_subscription_activated",
    name: "Subscription Activated",
    module: "Billing",
    fromName: "Go Experts Billing",
    subject: "Your {{plan_name}} subscription is now active! 🚀",
    variables: [
      "{full_name}",
      "{plan_name}",
      "{start_date}",
      "{end_date}",
      "{billing_amount}",
      "{dashboard_link}"
    ],
    body: "Hi {{full_name}},\n\nYour subscription to {{plan_name}} has been activated successfully.\n\nStart date: {{start_date}}\nExpiry date: {{end_date}}\nAmount: ₹{{billing_amount}}\n\nThank you for choosing Go Experts!\n\nTeam Go Experts",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">Subscription Activated 🚀</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Your subscription to <strong>{{plan_name}}</strong> is now active!</p>
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <p style="margin: 4px 0; font-size: 14px;"><strong>Plan:</strong> {{plan_name}}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Active From:</strong> {{start_date}}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Valid Until:</strong> {{end_date}}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Amount Paid:</strong> ₹{{billing_amount}}</p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{dashboard_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Go to Dashboard &rarr;</a>
  </div>
  <p style="font-size: 13px; color: #718096;">Team Go Experts &bull; servicedesk@goexperts.in</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_subscription_expiry_warning",
    name: "Subscription Expiry Warning",
    module: "Billing",
    fromName: "Go Experts Subscriptions",
    subject: "Your {{plan_name}} subscription expires in {{days_remaining}} days ⚠️",
    variables: [
      "{full_name}",
      "{plan_name}",
      "{days_remaining}",
      "{end_date}",
      "{renew_link}"
    ],
    body: "Hi {{full_name}},\n\nThis is a reminder that your {{plan_name}} subscription will expire in {{days_remaining}} days on {{end_date}}.\n\nRenew now to avoid any interruption to your active projects and client messaging:\n{{renew_link}}\n\nTeam Go Experts",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #b45309; font-size: 22px; font-weight: 800; margin-top: 0;">Subscription Expiring Soon ⚠️</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Your <strong>{{plan_name}}</strong> subscription will expire in <strong>{{days_remaining}} days</strong> on <strong>{{end_date}}</strong>.</p>
  <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <p style="margin: 0; color: #92400e; font-size: 14px;">Renew your plan today to keep uninterrupted access to proposals, clients, and workspace features.</p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{renew_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Renew Subscription &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_subscription_expired",
    name: "Subscription Expired Notification",
    module: "Billing",
    fromName: "Go Experts Subscriptions",
    subject: "Your Go Experts plan has expired ⚠️ upgrade required",
    variables: [
      "{full_name}",
      "{plan_name}",
      "{expired_date}",
      "{upgrade_link}"
    ],
    body: "Hi {{full_name}},\n\nYour {{plan_name}} subscription expired on {{expired_date}}. Please renew or upgrade your plan to restore full platform access:\n\n{{upgrade_link}}\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #c2410c; font-size: 22px; font-weight: 800; margin-top: 0;">Your Plan Has Expired</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Your <strong>{{plan_name}}</strong> plan expired on <strong>{{expired_date}}</strong>. Your account access is limited until you renew.</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{upgrade_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Upgrade Your Plan &rarr;</a>
  </div>
  <p style="font-size: 13px; color: #718096;">The Go Experts Team &bull; servicedesk@goexperts.in</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_subscription_renewal",
    name: "Subscription Renewal Success",
    module: "Billing",
    fromName: "Go Experts Billing",
    subject: "Subscription renewed successfully",
    variables: [
      "{full_name}",
      "{plan_name}",
      "{end_date}",
      "{billing_amount}",
      "{dashboard_link}"
    ],
    body: "Hi {{full_name}},\n\nYour {{plan_name}} subscription has been renewed successfully. New expiry date: {{end_date}}.\n\nThank you for renewing!\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #166534; font-size: 22px; font-weight: 800; margin-top: 0;">Subscription Renewed Successfully ✅</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Your <strong>{{plan_name}}</strong> subscription has been renewed. New expiry date: <strong>{{end_date}}</strong>.</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{dashboard_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">View Workspace &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_payment_success",
    name: "Payment Receipt / Invoice",
    module: "Billing",
    fromName: "Go Experts Accounts",
    subject: "Payment of ₹{{amount}} Received - Invoice #{{invoice_number}} ✅",
    variables: [
      "{full_name}",
      "{amount}",
      "{invoice_number}",
      "{transaction_id}",
      "{payment_method}",
      "{invoice_download_link}"
    ],
    body: "Hi {{full_name}},\n\nWe have received your payment of ₹{{amount}} for Invoice #{{invoice_number}}.\n\nTransaction ID: {{transaction_id}}\nMethod: {{payment_method}}\n\nDownload Invoice: {{invoice_download_link}}\n\nThank you,\nGo Experts Accounts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #166534; font-size: 22px; font-weight: 800; margin-top: 0;">Payment Received ✅</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">We have received your payment of <strong>₹{{amount}}</strong> for Invoice #{{invoice_number}}.</p>
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <p style="margin: 4px 0; font-size: 14px;"><strong>Transaction ID:</strong> {{transaction_id}}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Payment Method:</strong> {{payment_method}}</p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{invoice_download_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Download Invoice PDF &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_payment_failed",
    name: "Payment Failed Alert",
    module: "Billing",
    fromName: "Go Experts Accounts",
    subject: "Payment of ₹{{amount}} Failed – Please Retry ❌",
    variables: [
      "{full_name}",
      "{amount}",
      "{invoice_number}",
      "{reason}",
      "{retry_link}"
    ],
    body: "Hi {{full_name}},\n\nYour payment of ₹{{amount}} for Invoice #{{invoice_number}} could not be completed.\nReason: {{reason}}\n\nPlease retry: {{retry_link}}\n\nGo Experts Accounts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #991b1b; font-size: 22px; font-weight: 800; margin-top: 0;">Payment Failed ❌</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Your payment of <strong>₹{{amount}}</strong> for Invoice #{{invoice_number}} could not be processed.</p>
  <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; color: #991b1b; font-size: 14px;"><strong>Reason:</strong> {{reason}}</p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{retry_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Retry Payment &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_payment_refund",
    name: "Payment Refund Initiated",
    module: "Billing",
    fromName: "Go Experts Accounts",
    subject: "Refund of ₹{{amount}} Initiated",
    variables: [
      "{full_name}",
      "{amount}",
      "{transaction_id}",
      "{timeline}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nA refund of ₹{{amount}} has been initiated (Txn: {{transaction_id}}) and will reflect in your account within {{timeline}}.\n\nGo Experts Accounts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">Refund Initiated</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">A refund of <strong>₹{{amount}}</strong> has been initiated and will reflect in 5–7 business days.</p>
  <p style="font-size: 13px; color: #718096;">Txn ID: {{transaction_id}}</p>
</div>`,
    isDefault: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 3. WALLET & CASHBACK
  // ─────────────────────────────────────────────────────────────
  {
    id: "tpl_referral_cashback",
    name: "Referral Cashback Earned",
    module: "Wallet",
    fromName: "Go Experts Rewards",
    subject: "You've earned ₹{{cashback_amount}} cashback! 💰",
    variables: [
      "{full_name}",
      "{friend_name}",
      "{cashback_amount}",
      "{new_balance}",
      "{wallet_link}"
    ],
    body: "Hi {{full_name}},\n\nGreat news! Your friend {{friend_name}} just signed up and subscribed on Go Experts. We've credited ₹{{cashback_amount}} into your Go Experts wallet as your referral reward.\n\nNew Wallet Balance: ₹{{new_balance}}\n\nView Wallet: {{wallet_link}}\n\nTeam Go Experts",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #15803d; font-size: 24px; font-weight: 800; margin-top: 0;">You've earned cashback! 💰</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Your friend <strong>{{friend_name}}</strong> just purchased a subscription. We've credited your referral bonus directly to your wallet!</p>
  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
    <p style="margin: 0; color: #166534; font-size: 12px; font-weight: 700; text-transform: uppercase;">Cashback Credited</p>
    <div style="color: #15803d; font-size: 36px; font-weight: 800; margin: 8px 0;">₹{{cashback_amount}}</div>
    <p style="margin: 0; color: #166534; font-size: 13px;">New Wallet Balance: ₹{{new_balance}}</p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{wallet_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">View My Wallet &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_monthly_cashback",
    name: "Monthly Cashback Credited",
    module: "Wallet",
    fromName: "Go Experts Rewards",
    subject: "🎉 Your Monthly Cashback is Here GoExperts",
    variables: [
      "{full_name}",
      "{plan_name}",
      "{cashback_amount}",
      "{wallet_link}"
    ],
    body: "Hi {{full_name}},\n\nYour monthly 5% cashback of ₹{{cashback_amount}} for the {{plan_name}} plan has just been credited to your GoExperts Wallet!\n\nView Wallet: {{wallet_link}}\n\nThe GoExperts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;text-transform:uppercase;">Monthly Reward</p>
  <h1 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">Cashback Credited! 🎉</h1>
  <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
    Your monthly cashback for the <strong>{{plan_name}}</strong> plan has just been credited to your GoExperts Wallet!
  </p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
    <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Cashback Amount</p>
    <div style="color:#10b981;font-size:32px;font-weight:800;">₹{{cashback_amount}}</div>
  </div>
  <div style="text-align:center;margin:24px 0;">
    <a href="{{wallet_link}}" style="background:#38B2AC;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;display:inline-block;">Check Wallet Balance &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_welcome_bonus",
    name: "Welcome Bonus Credited",
    module: "Wallet",
    fromName: "Go Experts Rewards",
    subject: "🎁 Welcome Bonus Credited GoExperts",
    variables: [
      "{full_name}",
      "{bonus_amount}",
      "{wallet_link}"
    ],
    body: "Hi {{full_name}},\n\nCongratulations! Your KYC is approved and your ₹{{bonus_amount}} welcome bonus is in your wallet!\n\nView Wallet: {{wallet_link}}\n\nThe GoExperts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <p style="margin:0 0 4px;color:#64748b;font-size:13px;font-weight:500;text-transform:uppercase;">KYC Approved</p>
  <h1 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:800;">Welcome Bonus Credited! 🎁</h1>
  <p style="margin:0 0 20px;color:#64748b;font-size:14px;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="color:#374151;font-size:14px;line-height:1.7;margin:0 0 16px;">
    Congratulations! Your KYC verification is complete. As a thank you for joining Go Experts, we have credited a <strong>Welcome Bonus of ₹{{bonus_amount}}</strong> directly to your wallet.
  </p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin:20px 0;">
    <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;">Bonus Amount</p>
    <div style="color:#10b981;font-size:32px;font-weight:800;">₹{{bonus_amount}}</div>
  </div>
  <div style="text-align:center;margin:24px 0;">
    <a href="{{wallet_link}}" style="background:#38B2AC;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;display:inline-block;">Go to Wallet &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 4. COMPLIANCE & ONBOARDING REMINDERS
  // ─────────────────────────────────────────────────────────────
  {
    id: "tpl_kyc_document_status",
    name: "KYC Document Review Status",
    module: "Compliance",
    fromName: "Go Experts Verification Desk",
    subject: "Go Experts KYC Document Status Update",
    variables: [
      "{full_name}",
      "{role}",
      "{overall_status}",
      "{document_summary}",
      "{kyc_link}"
    ],
    body: "Hi {{full_name}},\n\nYour KYC document review status has been updated to: {{overall_status}}.\n\nReview details: {{document_summary}}\n\nManage KYC: {{kyc_link}}\n\nGo Experts Verification Desk",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">KYC Document Status Update 📋</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Your KYC verification documents have been reviewed by our compliance team.</p>
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <p style="margin: 0; font-size: 14px; color: #334155;"><strong>Overall Status:</strong> {{overall_status}}</p>
    <div style="margin-top: 10px; font-size: 13px; color: #64748b;">{{document_summary}}</div>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{kyc_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Update KYC Documents &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_kyc_reminder",
    name: "Complete KYC Verification Reminder",
    module: "Compliance",
    fromName: "Go Experts Onboarding",
    subject: "⚠️ Action Required: Complete Your KYC on Go Experts",
    variables: [
      "{full_name}",
      "{kyc_link}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nYour KYC verification is currently pending. Submitting your verification documents is required to unlock proposals, escrow payments, and your Verified badge.\n\nComplete KYC now: {{kyc_link}}\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #b45309; font-size: 22px; font-weight: 800; margin-top: 0;">Complete Your KYC Verification 📋</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; color: #92400e; font-size: 14px;"><strong>KYC Incomplete:</strong> Upload your ID documents to activate your account and start sending proposals or hiring talent.</p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{kyc_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Complete KYC Verification &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_profile_reminder",
    name: "Complete Profile Reminder",
    module: "Onboarding",
    fromName: "Go Experts Onboarding",
    subject: "Action Required: Complete Your Go Experts Profile",
    variables: [
      "{full_name}",
      "{profile_link}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nProfiles with complete details and portfolio items receive up to 5x more engagement on Go Experts. Complete your profile now:\n\n{{profile_link}}\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #1d4ed8; font-size: 22px; font-weight: 800; margin-top: 0;">Finish Setting Up Your Profile 🚀</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Profiles with full details, portfolio links, and skills get up to <strong>5x more visibility</strong> on Go Experts.</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{profile_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Complete My Profile &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_registration_reminder",
    name: "Complete Registration Reminder",
    module: "Onboarding",
    fromName: "Go Experts Onboarding",
    subject: "Action Required: Complete Your Go Experts Registration",
    variables: [
      "{full_name}",
      "{login_link}",
      "{app_url}"
    ],
    body: "Hi {{full_name}},\n\nYour registration on Go Experts is pending. Please complete your registration to activate your account and start using the platform:\n\n{{login_link}}\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">Complete Your Registration 🌟</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Finish your registration to start connecting with top professionals and verified clients.</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{login_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Resume Registration &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 5. CLIENT & TEAM MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  {
    id: "tpl_team_invitation",
    name: "Team Member Invitation",
    module: "Team",
    fromName: "Go Experts Team",
    subject: "Invitation to join {{client_name}}'s Team on Go Experts",
    variables: [
      "{name}",
      "{client_name}",
      "{role}",
      "{department}",
      "{email}",
      "{temp_password}",
      "{login_url}"
    ],
    body: "Hi {{name}},\n\n{{client_name}} has invited you to join their organization as a {{role}} in the {{department}} department on Go Experts.\n\nLogin Portal: {{login_url}}\nUsername: {{email}}\nTemporary Password: {{temp_password}}\n\nGo Experts Team",
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <h2 style="color: #38B2AC; margin-top: 0;">Welcome to Go Experts!</h2>
  <p>Hi <strong>{{name}}</strong>,</p>
  <p><strong>{{client_name}}</strong> has invited you to join their organization as a <strong>{{role}}</strong> in the <strong>{{department}}</strong> department.</p>
  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 18px; border-radius: 8px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #0f172a; font-size: 14px;">Your Dashboard Login Credentials:</h3>
    <p style="margin: 6px 0; font-size: 13px;"><strong>Login Portal:</strong> <a href="{{login_url}}" target="_blank" style="color: #38B2AC;">{{login_url}}</a></p>
    <p style="margin: 6px 0; font-size: 13px;"><strong>Username / Email:</strong> <code style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-weight: bold;">{{email}}</code></p>
    <p style="margin: 6px 0; font-size: 13px;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 3px 6px; border-radius: 4px; font-weight: bold;">{{temp_password}}</code></p>
  </div>
  <div style="text-align: center; margin: 24px 0;">
    <a href="{{login_url}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Sign In to Dashboard &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_team_credentials",
    name: "Team Access Credentials Resend",
    module: "Team",
    fromName: "Go Experts Support",
    subject: "Your Team Access Credentials - {{client_name}} on Go Experts",
    variables: [
      "{name}",
      "{client_name}",
      "{role}",
      "{department}",
      "{email}",
      "{temp_password}",
      "{login_url}"
    ],
    body: "Hi {{name}},\n\nHere are your access credentials for {{client_name}}'s team on Go Experts:\n\nLogin: {{login_url}}\nEmail: {{email}}\nPassword: {{temp_password}}\n\nGo Experts Team",
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <h2 style="color: #38B2AC; margin-top: 0;">Your Team Access Credentials</h2>
  <p>Hi <strong>{{name}}</strong>,</p>
  <p>Here are your access credentials for <strong>{{client_name}}'s organization</strong> as a <strong>{{role}}</strong>:</p>
  <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 18px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 6px 0; font-size: 13px;"><strong>Portal:</strong> <a href="{{login_url}}" style="color: #38B2AC;">{{login_url}}</a></p>
    <p style="margin: 6px 0; font-size: 13px;"><strong>Email:</strong> {{email}}</p>
    <p style="margin: 6px 0; font-size: 13px;"><strong>Password:</strong> {{temp_password}}</p>
  </div>
  <div style="text-align: center; margin: 24px 0;">
    <a href="{{login_url}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Sign In to Dashboard &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 6. MESSAGING & SUPPORT
  // ─────────────────────────────────────────────────────────────
  {
    id: "tpl_unread_digest",
    name: "Unread Messages Summary Digest",
    module: "Messaging",
    fromName: "Go Experts Notifications",
    subject: "You have unread messages on GoExperts",
    variables: [
      "{full_name}",
      "{num_messages}",
      "{num_conversations}",
      "{messages_link}"
    ],
    body: "Hi {{full_name}},\n\nYou have {{num_messages}} unread messages from {{num_conversations}} conversations waiting for you on GoExperts.\n\nView Messages: {{messages_link}}\n\nGoExperts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">Unread Messages 💬</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">You have <strong>{{num_messages}} unread messages</strong> from <strong>{{num_conversations}} conversations</strong> waiting for you on GoExperts.</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{messages_link}}" style="background-color: #10B981; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">View Messages &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_support_ticket_status",
    name: "Support Ticket Status Update",
    module: "Support",
    fromName: "Go Experts Support Desk",
    subject: "Support Ticket {{status}} - Go Experts",
    variables: [
      "{full_name}",
      "{ticket_number}",
      "{ticket_subject}",
      "{status}",
      "{support_link}"
    ],
    body: "Hi {{full_name}},\n\nYour support ticket #{{ticket_number}} regarding \"{{ticket_subject}}\" has been marked as {{status}}.\n\nView Ticket: {{support_link}}\n\nGo Experts Support Team",
    html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
  <h2 style="color: #6366f1; margin-top: 0;">Support Ticket Update</h2>
  <p>Hi <strong>{{full_name}}</strong>,</p>
  <p>Your support ticket <b>#{{ticket_number}}</b> regarding "<strong>{{ticket_subject}}</strong>" has been marked as <b>{{status}}</b>.</p>
  <p>If you have any further questions, you can reopen or reply to this ticket in your dashboard:</p>
  <div style="text-align: center; margin: 24px 0;">
    <a href="{{support_link}}" style="background-color: #6366f1; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">View Ticket &rarr;</a>
  </div>
  <p style="font-size: 12px; color: #94a3b8;">Go Experts Support Desk &bull; servicedesk@goexperts.in</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_meeting_invitation",
    name: "Meeting Invitation / Schedule",
    module: "Meetings",
    fromName: "Go Experts Calendar",
    subject: "Meeting Scheduled: {{meeting_title}} 📅",
    variables: [
      "{full_name}",
      "{meeting_title}",
      "{meeting_date}",
      "{meeting_time}",
      "{meeting_url}",
      "{host_name}"
    ],
    body: "Hi {{full_name}},\n\nA meeting has been scheduled with {{host_name}}:\nTitle: {{meeting_title}}\nDate: {{meeting_date}} at {{meeting_time}}\n\nJoin Link: {{meeting_url}}\n\nGo Experts Calendar",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">Meeting Scheduled 📅</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">You have an upcoming meeting with <strong>{{host_name}}</strong>:</p>
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <p style="margin: 4px 0; font-size: 14px;"><strong>Title:</strong> {{meeting_title}}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Date & Time:</strong> {{meeting_date}} at {{meeting_time}}</p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{meeting_url}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Join Video Meeting &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },

  // ─────────────────────────────────────────────────────────────
  // 7. CONTRACTS & PROJECTS
  // ─────────────────────────────────────────────────────────────
  {
    id: "tpl_contract_signed",
    name: "Contract Signed Notification",
    module: "Contracts",
    fromName: "Go Experts Contracts",
    subject: "Contract Signed: {{contract_number}} – {{project_title}} 📝",
    variables: [
      "{full_name}",
      "{contract_number}",
      "{project_title}",
      "{client_name}",
      "{freelancer_name}",
      "{contract_link}"
    ],
    body: "Hi {{full_name}},\n\nContract {{contract_number}} for \"{{project_title}}\" has been digitally signed by both parties. Work can now officially begin!\n\nView Contract: {{contract_link}}\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">Contract Signed 📝</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">Contract <strong>{{contract_number}}</strong> for "<strong>{{project_title}}</strong>" has been digitally signed by all parties. Work can now begin!</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{contract_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">View Signed Contract &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_proposal_received",
    name: "New Proposal Received",
    module: "Projects",
    fromName: "Go Experts Projects",
    subject: "New Proposal on {{project_title}} from {{freelancer_name}} 💼",
    variables: [
      "{client_name}",
      "{project_title}",
      "{freelancer_name}",
      "{bid_amount}",
      "{proposal_link}"
    ],
    body: "Hi {{client_name}},\n\nA freelancer has submitted a new proposal for your project \"{{project_title}}\".\nFreelancer: {{freelancer_name}}\nBid Amount: ₹{{bid_amount}}\n\nView Proposal: {{proposal_link}}\n\nGo Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">New Proposal Received 💼</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{client_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">You have received a new proposal for your project "<strong>{{project_title}}</strong>".</p>
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <p style="margin: 4px 0; font-size: 14px;"><strong>Freelancer:</strong> {{freelancer_name}}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>Bid Amount:</strong> ₹{{bid_amount}}</p>
  </div>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{proposal_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Review Proposal &rarr;</a>
  </div>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_security_alert",
    name: "Security Alert - New Login Detected",
    module: "Security",
    fromName: "Go Experts Security",
    subject: "Security Alert: New login detected from {{device}} 🛡️",
    variables: [
      "{full_name}",
      "{device}",
      "{ip_address}",
      "{location}",
      "{login_time}",
      "{security_link}"
    ],
    body: "Hi {{full_name}},\n\nA new login was detected on your Go Experts account:\nDevice: {{device}}\nIP: {{ip_address}}\nLocation: {{location}}\nTime: {{login_time}}\n\nIf this was not you, please reset your password immediately:\n{{security_link}}\n\nGo Experts Security Desk",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #991b1b; font-size: 22px; font-weight: 800; margin-top: 0;">Security Alert 🛡️</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">We detected a new sign-in to your Go Experts account.</p>
  <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <p style="margin: 4px 0; font-size: 13px;"><strong>Device:</strong> {{device}}</p>
    <p style="margin: 4px 0; font-size: 13px;"><strong>IP Address:</strong> {{ip_address}}</p>
    <p style="margin: 4px 0; font-size: 13px;"><strong>Location:</strong> {{location}}</p>
    <p style="margin: 4px 0; font-size: 13px;"><strong>Time:</strong> {{login_time}}</p>
  </div>
  <p style="font-size: 13px; color: #718096;">If you do not recognize this activity, please secure your account immediately:</p>
  <div style="text-align: center; margin: 24px 0;">
    <a href="{{security_link}}" style="background-color: #991b1b; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Secure My Account Now &rarr;</a>
  </div>
</div>`,
  },
  {
    id: "tpl_message_received",
    name: "New Message Received",
    module: "General",
    fromName: "Go Experts Messages",
    subject: "New message from {{sender_name}} 💬",
    variables: [
      "{full_name}",
      "{sender_name}",
      "{message}",
      "{action_link}"
    ],
    body: "Hi {{full_name}},\n\nYou have received a new message from {{sender_name}}.\n\n\"{{message}}\"\n\nReply: {{action_link}}\n\nThe Go Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">New Message Received 💬</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  <p style="font-size: 15px; color: #4a5568;">You have received a new message from <strong>{{sender_name}}</strong>.</p>
  
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
    <p style="margin: 0; font-size: 14px; font-style: italic; color: #475569;">"{{message}}"</p>
  </div>
  
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{action_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Reply to {{sender_name}} &rarr;</a>
  </div>
  
  <p style="font-size: 13px; color: #718096; margin-top: 30px;">The Go Experts Team</p>
</div>`,
    isDefault: true,
  },
  {
    id: "tpl_connection_accepted",
    name: "Connection Accepted",
    module: "General",
    fromName: "Go Experts Notifications",
    subject: "{{sender_name}} accepted your connection request! 🎉",
    variables: [
      "{full_name}",
      "{sender_name}",
      "{action_link}"
    ],
    body: "Hi {{full_name}},\n\nGood news! {{sender_name}} just accepted your connection request.\n\nView Connection: {{action_link}}\n\nThe Go Experts Team",
    html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #2d3748; background: #ffffff; border-radius: 12px; border: 1px solid #eaedf1; padding: 32px 24px;">
  <h1 style="color: #0f172a; font-size: 22px; font-weight: 800; margin-top: 0;">Connection Accepted! 🎉</h1>
  <p style="font-size: 15px; color: #4a5568;">Hi <strong>{{full_name}}</strong>,</p>
  
  <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
    <p style="margin: 0; color: #15803d; font-size: 14px;">Good news! <strong>{{sender_name}}</strong> just accepted your connection request. You can now chat directly and collaborate on projects.</p>
  </div>
  
  <div style="text-align: center; margin: 28px 0;">
    <a href="{{action_link}}" style="background-color: #38B2AC; color: #ffffff; padding: 12px 28px; border-radius: 8px; font-weight: 700; text-decoration: none; display: inline-block;">Message {{sender_name}} &rarr;</a>
  </div>
  
  <p style="font-size: 13px; color: #718096; margin-top: 30px;">The Go Experts Team</p>
</div>`,
    isDefault: true,
  }
];
