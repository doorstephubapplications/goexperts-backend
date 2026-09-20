export class EmailTemplateEngine {
  /**
   * Replaces placeholders in a template with actual values.
   * e.g., compile('Hello {{name}}', { name: 'John' }) => 'Hello John'
   */
  static compile(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  // Define reusable HTML templates
  static templates = {
    WELCOME: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to Go Experts, {{name}}!</h2>
        <p>We're thrilled to have you on board. Explore the platform and find top opportunities.</p>
      </div>
    `,
    RESET_PASSWORD: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset</h2>
        <p>Hi {{name}},</p>
        <p>You requested a password reset. Use the following code:</p>
        <h3>{{code}}</h3>
      </div>
    `,
    VERIFY_EMAIL: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Verify your Email</h2>
        <p>Hi {{name}},</p>
        <p>Please use this code to verify your account:</p>
        <h3>{{code}}</h3>
      </div>
    `,
    PAYMENT_SUCCESS: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Payment Successful</h2>
        <p>Hi {{name}},</p>
        <p>Your payment of {{amount}} was successful for {{planName}}.</p>
        <p>Transaction ID: {{transactionId}}</p>
      </div>
    `,
    MEETING_INVITATION: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Meeting Scheduled</h2>
        <p>Hi {{name}},</p>
        <p>You have a new meeting: <strong>{{meetingTitle}}</strong></p>
        <p>Date: {{date}} at {{time}}</p>
        <p><a href="{{link}}">Join Meeting</a></p>
      </div>
    `,
    SECURITY_ALERT: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: red;">
        <h2>Security Alert</h2>
        <p>Hi {{name}},</p>
        <p>We detected a new login from a new device ({{device}}) at {{ip}}.</p>
        <p>If this was not you, please change your password immediately.</p>
      </div>
    `,
    SUBSCRIPTION_REMINDER: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background-color: #f8fafc; padding: 24px 32px; border-bottom: 1px solid #e5e7eb; text-align: center;">
          <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Go Experts</h1>
        </div>
        
        <!-- Body -->
        <div style="padding: 32px; color: #334155; line-height: 1.6; font-size: 16px;">
          <p style="margin-top: 0;">Hi <strong>{{name}}</strong>,</p>
          <p>This is a quick reminder that your active <strong>{{planName}}</strong> subscription is expiring in exactly <strong>{{daysLeft}} days</strong>.</p>
          
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 0 8px 8px 0; margin: 24px 0;">
            <p style="margin: 0; color: #991b1b; font-weight: 600;">Expiration Date: {{expirationDate}}</p>
            <p style="margin: 4px 0 0 0; color: #b91c1c; font-size: 14px;">To ensure uninterrupted access to all your premium tools, please renew your plan before it expires.</p>
          </div>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="{{renewLink}}" style="display: inline-block; background-color: #6366f1; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: 600; text-decoration: none; text-align: center; transition: background-color 0.2s;">Renew Subscription Now</a>
          </div>
          
          <p style="margin-bottom: 0;">If you need any assistance or have questions regarding your plan, our support team is always here to help.</p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="margin: 0; color: #64748b; font-size: 13px;">© {{currentYear}} Go Experts. All rights reserved.</p>
          <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 12px;">
            <a href="{{supportLink}}" style="color: #6366f1; text-decoration: none;">Contact Support</a> &nbsp;|&nbsp; 
            <a href="{{settingsLink}}" style="color: #6366f1; text-decoration: none;">Manage Settings</a>
          </p>
          <p style="margin: 12px 0 0 0; color: #94a3b8; font-size: 11px;">You are receiving this email because you have an active subscription with Go Experts. This is a mandatory service alert regarding your account status.</p>
        </div>
      </div>
    `
  };
}
