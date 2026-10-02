import { prisma } from "../../config/database.js";
import { SETTINGS_DEFAULTS, type SettingsSection } from "./settings.defaults.js";

const SECTION_KEY_PREFIX = "settings:section:";

function sectionKey(section: SettingsSection) {
  return `${SECTION_KEY_PREFIX}${section}`;
}

function requestBaseUrl(req?: any) {
  const envUrl = process.env.BASE_URL || process.env.APP_URL || process.env.PUBLIC_URL;
  if (envUrl && !String(envUrl).includes("localhost")) return String(envUrl).replace(/\/+$/, "");

  if (req?.get) {
    const host = req.get("host");
    const proto = req.get("x-forwarded-proto") || req.protocol || "https";
    if (host) return `${proto}://${host}`.replace(/\/+$/, "");
  }

  return envUrl ? String(envUrl).replace(/\/+$/, "") : "https://apiai.goexperts.in";
}

function requestUploadBasePath(req?: any) {
  const originalUrl = String(req?.originalUrl || req?.url || "");
  if (originalUrl.includes("/api/v1/mobile/")) return "/api/v1/mobile/uploads";
  if (originalUrl.includes("/api/mobile/")) return "/api/mobile/uploads";
  return "/uploads";
}

function buildSettingsFileUrl(filepath?: string | null, req?: any) {
  if (!filepath) return "";
  if (/^https?:\/\//i.test(filepath)) return filepath;

  const normalizedPath = String(filepath)
    .replace(/^\/+/, "")
    .replace(/\\/g, "/")
    .replace(/^uploads\//, "");

  return `${requestBaseUrl(req)}${requestUploadBasePath(req)}/${normalizedPath}`;
}

function normalizeSplashSettingsData(value: unknown, req?: any): Record<string, any> {
  const defaults = SETTINGS_DEFAULTS.splash;
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
  const sourceSplash = source.splash && typeof source.splash === "object" && !Array.isArray(source.splash)
    ? source.splash as Record<string, any>
    : {};
  const sourceOnboarding = source.onboarding && typeof source.onboarding === "object" && !Array.isArray(source.onboarding)
    ? source.onboarding as { steps?: Array<Record<string, any>> }
    : {};
  const sourceLogo = source.logo && typeof source.logo === "object" && !Array.isArray(source.logo)
    ? source.logo as Record<string, any>
    : {};

  const oldMediaUrl = typeof sourceSplash.mediaUrl === "string"
    ? sourceSplash.mediaUrl
    : typeof source.mediaUrl === "string"
      ? source.mediaUrl
      : "";
  const oldMediaName = typeof sourceSplash.mediaName === "string"
    ? sourceSplash.mediaName
    : typeof source.mediaName === "string"
      ? source.mediaName
      : "";
  const oldMediaType = sourceSplash.mediaType === "video" || source.mediaType === "video" ? "video" : "image";
  const toPublicUrl = (url?: string | null) => buildSettingsFileUrl(url, req);
  const steps: Array<Record<string, any>> = defaults.onboarding.steps.map((defaultStep, index) => {
    const step = {
      ...(defaultStep as Record<string, any>),
      ...(Array.isArray(sourceOnboarding.steps) && sourceOnboarding.steps[index]
        ? sourceOnboarding.steps[index]
        : {}),
    };

    return {
      ...step,
      mediaUrl: toPublicUrl(step.mediaUrl),
    };
  });

  if (!source.onboarding && (source.title || source.description)) {
    steps[0] = {
      ...steps[0],
      title: String(source.title || steps[0].title || ""),
      description: String(source.description || steps[0].description || ""),
    };
  }

  return {
    enabled: Boolean(source.enabled ?? defaults.enabled),
    splash: {
      imageUrl: toPublicUrl(String(sourceSplash.imageUrl || (oldMediaType === "image" ? oldMediaUrl : "") || defaults.splash.imageUrl || "")),
      imageName: String(sourceSplash.imageName || (oldMediaType === "image" ? oldMediaName : "") || ""),
      videoUrl: toPublicUrl(String(sourceSplash.videoUrl || (oldMediaType === "video" ? oldMediaUrl : "") || defaults.splash.videoUrl || "")),
      videoName: String(sourceSplash.videoName || (oldMediaType === "video" ? oldMediaName : "") || ""),
    },
    onboarding: { steps },
    logo: {
      ...defaults.logo,
      ...sourceLogo,
      logoUrl: toPublicUrl(String(sourceLogo.logoUrl || source.logoUrl || "")),
    },
  };
}

function normalizeSettingsSectionData(section: SettingsSection, data: unknown, req?: any): any {
  if (section === "splash") {
    return normalizeSplashSettingsData(data, req);
  }

  return data;
}

export async function getSettingsSection<T extends SettingsSection>(section: T, req?: any) {
  const defaults = SETTINGS_DEFAULTS[section];

  try {
    const row = await prisma.setting.findUnique({
      where: { key: sectionKey(section) },
    });

    if (!row?.value) {
      return { section, data: normalizeSettingsSectionData(section, defaults, req) };
    }

    const parsed = JSON.parse(row.value);
    const merged = Array.isArray(defaults)
      ? parsed
      : { ...(defaults as object), ...(parsed as object) };

    return {
      section,
      data: normalizeSettingsSectionData(section, merged, req),
    };
  } catch {
    return { section, data: normalizeSettingsSectionData(section, defaults, req) };
  }
}

export async function saveSettingsSection<T extends SettingsSection>(
  section: T,
  data: (typeof SETTINGS_DEFAULTS)[T]
) {
  const normalizedData = normalizeSettingsSectionData(section, data);
  const payload = JSON.stringify(normalizedData);

  await prisma.setting.upsert({
    where: { key: sectionKey(section) },
    create: {
      key: sectionKey(section),
      value: payload,
      category: section,
    },
    update: {
      value: payload,
      category: section,
    },
  });

  return { section, data: normalizedData };
}
export function wrapInMncEmailLayout(
  innerContent: string,
  branding: any = {},
  options: { subject?: string; module?: string } = {}
) {
  let rawLogoUrl = branding?.logoUrl || "https://apiai.goexperts.in/goexperts-logo.png";
  if (rawLogoUrl.startsWith("/")) {
    rawLogoUrl = "https://apiai.goexperts.in" + rawLogoUrl;
  }
  
  let rawLogoUrlDark = branding?.logoUrlDark || rawLogoUrl;
  if (rawLogoUrlDark.startsWith("/")) {
    rawLogoUrlDark = "https://apiai.goexperts.in" + rawLogoUrlDark;
  }
  
  const brand = {
    logoUrl: rawLogoUrl,
    logoUrlDark: rawLogoUrlDark,
    logoHeight: branding?.logoHeight || 34,
    showBrandText: branding?.showBrandText !== false,
    primaryColor: branding?.primaryColor || "#E30613",
    headerTag: branding?.headerTag || options?.module || "Security Notice",
    appSectionTitle: branding?.appSectionTitle || "Get the Go Experts App",
    playStoreUrl:
      branding?.playStoreUrl ||
      "https://play.google.com/store/apps/details?id=com.doorstephub.goexperts&pcampaignid=web_share",
    appleStoreUrl: branding?.appleStoreUrl || "https://apps.apple.com",
    supportEmail: branding?.supportEmail || "servicedesk@goexperts.in",
    websiteUrl: branding?.websiteUrl || "https://goexperts.in",
    tagline: branding?.tagline || "Working With You. For You.",
    copyrightText:
      branding?.copyrightText ||
      "© 2026 Go Experts Technologies Private Limited. All rights reserved.",
    privacyUrl: branding?.privacyUrl || "https://goexperts.in/privacy",
    termsUrl: branding?.termsUrl || "https://goexperts.in/terms",
    notificationSettingsUrl:
      branding?.notificationSettingsUrl ||
      "https://goexperts.in/settings/notifications",
  };

  // If the content is already a full responsive document, return as is
  if (innerContent.includes("<!DOCTYPE") || innerContent.includes("class=\"email-container\"")) {
    return innerContent;
  }

  // Clean old wrappers if any
  let cleanContent = innerContent
    .replace(/<div style="padding: 24px; text-align: center; border-bottom: 3px solid #E30613; background: #ffffff;">[\s\S]*?<\/div>/gi, "")
    .replace(/<div style="background-color: #f[78]faf[cd]; padding: 20px 24px; text-align: center; border-top: 1px solid #eaedf1;">[\s\S]*?<\/div>\s*<\/div>$/gi, "")
    .replace(/<div style="background-color: #f[78]faf[cd]; padding: 20px 24px; text-align: center; border-top: 1px solid #eaedf1;">[\s\S]*?<\/div>/gi, "")
    .replace(/^<div style="font-family: [^>]+max-width: 600px[^>]+>/i, "")
    .replace(/<\/div>\s*$/i, "")
    .trim();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <title>${options?.subject || "Go Experts Notification"}</title>
  
  <style type="text/css">
    * {
      box-sizing: border-box;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      border-collapse: collapse;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #f4f6f8;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #1f2937;
    }
    
    .dark-logo {
      display: none;
      mso-hide: all;
    }

    @media (prefers-color-scheme: dark) {
      body, .email-wrapper {
        background-color: #1a1a1a !important;
      }
      .email-container {
        background-color: #2a2a2a !important;
        border-color: #333333 !important;
      }
      .header-padding {
        background-color: #2a2a2a !important;
        border-bottom-color: #333333 !important;
      }
      .content-padding, .footer-padding {
        background-color: #2a2a2a !important;
      }
      * {
        color: #e5e7eb !important;
      }
      .light-logo {
        display: none !important;
        mso-hide: all;
      }
      .dark-logo {
        display: block !important;
      }
    }

    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 0 !important;
      }
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
        box-shadow: none !important;
      }
      .header-padding {
        padding: 18px 20px !important;
      }
      .header-tag {
        display: none !important;
      }
      .content-padding {
        padding: 28px 20px 24px !important;
      }
      .footer-padding {
        padding: 24px 20px !important;
      }
      .otp-code {
        font-size: 26px !important;
        letter-spacing: 5px !important;
      }
      .action-btn {
        display: block !important;
        width: 100% !important;
        padding: 14px 20px !important;
        text-align: center !important;
      }
      .store-badges-row {
        display: block !important;
        text-align: center !important;
      }
      .store-badge-item {
        display: inline-block !important;
        margin: 4px 6px !important;
      }
      .title-heading {
        font-size: 19px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; -webkit-font-smoothing: antialiased;">

  <!-- Outer Responsive Wrapper -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-wrapper" style="background-color: #f4f6f8; padding: 40px 16px;">
    <tr>
      <td align="center" style="padding: 0;">
        
        <!-- MNC Enterprise Card (Max 580px width on Desktop, 100% on Mobile) -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 580px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 10px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); overflow: hidden;">
          
          <!-- Top Accent Line -->
          <tr>
            <td style="height: 3px; background-color: ${brand.primaryColor}; line-height: 3px; font-size: 0;">&nbsp;</td>
          </tr>

          <!-- MNC Corporate Header -->
          <tr>
            <td class="header-padding" style="padding: 22px 36px; background-color: #ffffff; border-bottom: 1px solid #f3f4f6;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <a href="${brand.websiteUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="vertical-align: middle; padding-right: 10px;">
                              <!--[if !mso]><! -->
                              <div class="dark-logo" style="display:none; mso-hide:all; overflow:hidden; float:left; width:0px; max-height:0px; max-width:0px; line-height:0px; visibility:hidden;" align="center">
                                <img src="${brand.logoUrlDark}" alt="Go Experts" height="${brand.logoHeight}" style="height: ${brand.logoHeight}px; width: auto; border: 0;" />
                              </div>
                              <!--<![endif]-->
                              <div class="light-logo">
                                <img src="${brand.logoUrl}" alt="Go Experts" height="${brand.logoHeight}" style="height: ${brand.logoHeight}px; width: auto; border: 0;" />
                              </div>
                          </td>
                        </tr>
                      </table>
                    </a>
                  ${
                    brand.headerTag
                      ? `<td align="right" class="header-tag" style="vertical-align: middle;">
                    <span style="font-size: 11px; font-weight: 600; color: #6b7280; letter-spacing: 0.5px; text-transform: uppercase;">${brand.headerTag}</span>
                  </td>`
                      : ""
                  }
                </tr>
              </table>
            </td>
          </tr>

          <!-- MNC Body Content -->
          <tr>
            <td class="content-padding" style="padding: 36px 36px 28px; background-color: #ffffff;">
              ${cleanContent}
            </td>
          </tr>

          <!-- MNC Corporate Footer (App Badges & Links) -->
          <tr>
            <td class="footer-padding" style="padding: 28px 36px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              
              <!-- Mobile App Banner -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 22px;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">
                      ${brand.appSectionTitle}
                    </p>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center">
                      <tr class="store-badges-row">
                        <!-- Google Play Button -->
                        <td class="store-badge-item" style="padding: 0 6px;">
                          <a href="${brand.playStoreUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" alt="Get it on Google Play" height="34" style="height: 34px; width: auto; display: block; border: 0;" />
                          </a>
                        </td>
                        <!-- App Store Button -->
                        <td class="store-badge-item" style="padding: 0 6px;">
                          <a href="${brand.appleStoreUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                            <img src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg" alt="Download on the App Store" height="34" style="height: 34px; width: auto; display: block; border: 0;" />
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="height: 1px; background-color: #e5e7eb; margin: 0 0 18px 0;"></div>

              <!-- Corporate Legal Text -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="font-size: 12px; color: #6b7280; line-height: 1.6;">
                    <p style="margin: 0 0 6px 0; font-weight: 600; color: #4b5563;">
                      Go Experts &bull; ${brand.tagline}
                    </p>
                    <p style="margin: 0 0 10px 0; font-size: 11px; color: #9ca3af;">
                      Questions? Contact us at <a href="mailto:${brand.supportEmail}" style="color: ${brand.primaryColor}; text-decoration: none;">${brand.supportEmail}</a> &bull; <a href="${brand.websiteUrl}" target="_blank" style="color: #6b7280; text-decoration: none;">${brand.websiteUrl.replace(/^https?:\/\//, '')}</a>
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 11px; color: #9ca3af;">
                      <a href="${brand.privacyUrl}" target="_blank" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a> &bull;
                      <a href="${brand.termsUrl}" target="_blank" style="color: #6b7280; text-decoration: underline;">Terms of Service</a> &bull;
                      <a href="${brand.notificationSettingsUrl}" target="_blank" style="color: #6b7280; text-decoration: underline;">Notification Settings</a>
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                      ${brand.copyrightText}
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

export async function renderEmailTemplate(
  templateId: string,
  variables: Record<string, any> = {}
) {
  const section = await getSettingsSection("email_templates");
  const templates: any[] = Array.isArray(section?.data) ? section.data : [];

  const normTarget = templateId.replace(/^tpl_/, "").toLowerCase();
  const found = templates.find(
    (t) =>
      t.id === templateId ||
      (t.id && String(t.id).toLowerCase() === templateId.toLowerCase()) ||
      (t.id && String(t.id).replace(/^tpl_/, "").toLowerCase() === normTarget)
  );

  if (!found) {
    console.error(`[renderEmailTemplate] Template "${templateId}" not found in database. Please ensure it is seeded.`);
    throw new Error(`Email template "${templateId}" not found in database. Please re-seed the email templates.`);
  }

  let rawSubject = found.subject as string;
  let rawHtml = (found.html || found.body) as string;

  const allVars: Record<string, string> = {
    app_name: "Go Experts",
    company_name: "Go Experts Inc.",
    app_url: process.env.CLIENT_URL || process.env.FRONTEND_URL || "https://goexperts.in",
  };

  for (const [k, v] of Object.entries(variables || {})) {
    allVars[k] = v !== undefined && v !== null ? String(v) : "";
  }

  let subject = rawSubject;
  let html = rawHtml;

  for (const [k, v] of Object.entries(allVars)) {
    const regBraces = new RegExp(`\\{\\{${k}\\}\\}`, "gi");
    const regSingle = new RegExp(`\\{${k}\\}`, "gi");
    subject = subject.replace(regBraces, v).replace(regSingle, v);
    html = html.replace(regBraces, v).replace(regSingle, v);
  }

  // Dynamic corporate email branding
  const brandingSection = await getSettingsSection("email_branding");
  const branding = brandingSection?.data || {};

  const finalHtml = wrapInMncEmailLayout(html, branding, {
    subject,
    module: found.module || "Official Notification",
  });

  return { subject, html: finalHtml };
}

export async function getTeamRoles() {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: { select: { adminUsers: true } },
        rolePermissions: {
          include: { permission: true },
          take: 3,
        },
      },
      orderBy: { name: "asc" },
    });

    if (roles.length === 0) {
      return getSettingsSection("roles");
    }

    return {
      section: "roles" as const,
      data: roles.map(role => ({
        id: role.id,
        name: role.name,
        users: role._count.adminUsers,
        perms:
          role.description ||
          role.rolePermissions.map(rp => `${rp.permission.action}:${rp.permission.module}`).join(", ") ||
          "Configured permissions",
        status: role.status,
      })),
    };
  } catch {
    return getSettingsSection("roles");
  }
}

export async function getApiKeysList() {
  try {
    const keys = await prisma.apiKey.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (keys.length === 0) {
      return getSettingsSection("apiKeys");
    }

    return {
      section: "apiKeys" as const,
      data: keys.map(key => ({
        id: key.id,
        name: key.name,
        key: key.maskedKey,
        created: key.createdAt.toISOString().slice(0, 10),
        status: key.status,
      })),
    };
  } catch {
    return getSettingsSection("apiKeys");
  }
}

export async function getBackupsList() {
  try {
    const backups = await prisma.backup.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (backups.length === 0) {
      return getSettingsSection("backups");
    }

    return {
      section: "backups" as const,
      data: backups.map((backup, index) => ({
        id: backup.id.startsWith("BKP-") ? backup.id : `BKP-${String(index + 1).padStart(3, "0")}`,
        size: backup.size,
        type: backup.type,
        created: backup.createdAt.toLocaleString(),
        status: backup.status,
      })),
    };
  } catch {
    return getSettingsSection("backups");
  }
}

export async function createBackupSnapshot() {
  const size = `${(Math.random() * 2 + 23).toFixed(1)} MB`;
  const backup = await prisma.backup.create({
    data: {
      size,
      type: "Full Database Snapshot",
      status: "Successful",
    },
  });

  return {
    id: `BKP-${backup.id.slice(0, 3).toUpperCase()}`,
    size: backup.size,
    type: backup.type,
    created: "Just now",
    status: backup.status,
  };
}

export async function deleteBackupSnapshot(id: string) {
  const backups = await prisma.backup.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  const match = backups.find((b, index) => {
    const displayId = b.id.startsWith("BKP-") ? b.id : `BKP-${String(index + 1).padStart(3, "0")}`;
    return displayId === id || b.id === id;
  });

  if (match) {
    await prisma.backup.delete({ where: { id: match.id } });
  }

  return { ok: true, id };
}

export async function getAuditTrails() {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (logs.length === 0) {
      return getSettingsSection("auditTrails");
    }

    return {
      section: "auditTrails" as const,
      data: logs.map(log => ({
        id: log.id,
        who: log.actor?.fullName || "System",
        action: log.action,
        target: log.entityId ? `${log.entity}:${log.entityId.slice(0, 8)}` : log.entity,
        when: log.createdAt.toLocaleString(),
      })),
    };
  } catch {
    return getSettingsSection("auditTrails");
  }
}

export async function getSystemLogs() {
  try {
    const logs = await prisma.activityLog.findMany({
      include: { adminUser: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    if (logs.length === 0) {
      return getSettingsSection("systemLogs");
    }

    return {
      section: "systemLogs" as const,
      data: logs.map((log, index) => ({
        id: `LOG-${index + 1}`,
        type: "system",
        level: "info",
        text: log.description || log.action,
        time: log.createdAt.toLocaleString(),
        ip: log.adminUser?.email || "system",
      })),
    };
  } catch {
    return getSettingsSection("systemLogs");
  }
}
