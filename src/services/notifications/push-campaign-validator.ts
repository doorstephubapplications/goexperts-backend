/**
 * GoExperts Push Campaign Validator & Utilities
 * Validates deep links, campaign fields, roles, and formats notification previews.
 */

// Supported GoExperts application route prefixes
export const SUPPORTED_GOEXPERTS_ROUTES = [
  "/dashboard",
  "/freelancer",
  "/client",
  "/founder",
  "/investor",
  "/projects",
  "/proposals",
  "/contracts",
  "/wallet",
  "/profile",
  "/messages",
  "/network",
  "/settings",
  "/verification",
  "/notifications",
  "/hire",
  "/deals",
  "/startups",
  "/pitch",
  "/team",
  "/auth/onboarding"
];

export const VALID_ROLES = ["FREELANCER", "CLIENT", "FOUNDER", "INVESTOR", "ALL"] as const;
export type ValidTargetRole = typeof VALID_ROLES[number];

export const VALID_CAMPAIGN_TYPES = ["WEEKLY_SCHEDULED", "FESTIVAL", "ANNOUNCEMENT"] as const;
export type ValidCampaignType = typeof VALID_CAMPAIGN_TYPES[number];

/**
 * Normalizes and validates the target role.
 * Role selection is optional: if omitted, empty, or 'ALL', it returns 'ALL' (targets all eligible user roles).
 */
export function normalizeTargetRole(role?: string | null): ValidTargetRole {
  if (!role || typeof role !== "string" || !role.trim()) {
    return "ALL";
  }
  const clean = role.trim().toUpperCase();
  if (clean === "ALL" || clean === "ALL_ROLES" || clean === "ALL ROLES" || clean === "*") {
    return "ALL";
  }
  if (clean === "FREELANCER" || clean === "FREELANCERS") {
    return "FREELANCER";
  }
  if (clean === "CLIENT" || clean === "CLIENTS" || clean === "CUSTOMER" || clean === "CUSTOMERS") {
    return "CLIENT";
  }
  if (clean === "FOUNDER" || clean === "FOUNDERS" || clean === "STARTUP" || clean === "STARTUP IDEA CREATOR" || clean === "STARTUP_IDEA_CREATOR") {
    return "FOUNDER";
  }
  if (clean === "INVESTOR" || clean === "INVESTORS") {
    return "INVESTOR";
  }
  return "ALL"; // Safe fallback to All Roles
}

/**
 * Normalizes campaign type
 */
export function normalizeCampaignType(type?: string | null): ValidCampaignType {
  if (!type || typeof type !== "string") {
    return "WEEKLY_SCHEDULED";
  }
  const clean = type.trim().toUpperCase().replace(/[\s/-]+/g, "_");
  if (clean.includes("FESTIVAL") || clean.includes("OBSERVANCE")) {
    return "FESTIVAL";
  }
  if (clean.includes("ANNOUNCE") || clean.includes("PLATFORM")) {
    return "ANNOUNCEMENT";
  }
  return "WEEKLY_SCHEDULED";
}

/**
 * Validates a notification deep link destination against supported GoExperts routes.
 * Blocks dangerous schemes (javascript:, data:, vbscript:) and arbitrary external domains.
 */
export function validateDeepLink(deepLink?: string | null): { isValid: boolean; normalizedLink: string; error?: string } {
  if (!deepLink || typeof deepLink !== "string" || !deepLink.trim()) {
    return { isValid: true, normalizedLink: "/dashboard" };
  }

  const trimmed = deepLink.trim();

  // Reject malicious schemes immediately
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("file:") ||
    lower.includes("<script")
  ) {
    return {
      isValid: false,
      normalizedLink: "/dashboard",
      error: "Unsafe deep link protocol detected. Only supported GoExperts application routes are permitted."
    };
  }

  // If absolute URL, ensure it points to goexperts.in
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const allowedHosts = ["goexperts.in", "www.goexperts.in", "adminai.goexperts.in", "apiai.goexperts.in", "localhost"];
      if (!allowedHosts.some((h) => url.hostname === h || url.hostname.endsWith(".goexperts.in"))) {
        return {
          isValid: false,
          normalizedLink: "/dashboard",
          error: `External arbitrary domain (${url.hostname}) is not permitted as a deep link destination.`
        };
      }
      return { isValid: true, normalizedLink: url.pathname + url.search + url.hash };
    } catch {
      return { isValid: false, normalizedLink: "/dashboard", error: "Malformed destination URL." };
    }
  }

  // Relative path must start with '/'
  if (!trimmed.startsWith("/")) {
    return {
      isValid: false,
      normalizedLink: "/dashboard",
      error: "Deep link destination must start with '/' (e.g. /dashboard or /freelancer/projects)."
    };
  }

  // Check prefix against supported routes
  const isSupported = SUPPORTED_GOEXPERTS_ROUTES.some((prefix) => trimmed.startsWith(prefix));
  if (!isSupported) {
    return {
      isValid: false,
      normalizedLink: "/dashboard",
      error: `Destination '${trimmed}' is not a recognized GoExperts route. Supported sections include: ${SUPPORTED_GOEXPERTS_ROUTES.slice(0, 8).join(", ")}...`
    };
  }

  return { isValid: true, normalizedLink: trimmed };
}

/**
 * Validates core push campaign fields
 */
export function validateCampaignPayload(payload: any): { isValid: boolean; errors: string[]; sanitized: any } {
  const errors: string[] = [];

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    errors.push("Notification title is required.");
  } else if (title.length > 120) {
    errors.push("Notification title cannot exceed 120 characters.");
  }

  const description = typeof payload.description === "string" ? payload.description.trim() : (typeof payload.message === "string" ? payload.message.trim() : "");
  if (!description) {
    errors.push("Notification description / message is required.");
  } else if (description.length > 500) {
    errors.push("Notification description cannot exceed 500 characters.");
  }

  const name = typeof payload.name === "string" && payload.name.trim() 
    ? payload.name.trim() 
    : title;

  // Validate image if provided
  let imageUrl: string | null = null;
  if (payload.imageUrl && typeof payload.imageUrl === "string" && payload.imageUrl.trim()) {
    const imgTrimmed = payload.imageUrl.trim();
    if (!imgTrimmed.startsWith("http://") && !imgTrimmed.startsWith("https://") && !imgTrimmed.startsWith("/")) {
      errors.push("Image must be a valid HTTP/HTTPS URL or static media path.");
    } else {
      imageUrl = imgTrimmed;
    }
  }

  // Deep Link validation
  const linkValidation = validateDeepLink(payload.deepLink);
  if (!linkValidation.isValid) {
    errors.push(linkValidation.error || "Invalid destination deep link.");
  }

  const targetRole = normalizeTargetRole(payload.role || payload.targetRole);
  const campaignType = normalizeCampaignType(payload.campaignType || payload.type);

  // Status
  let status = "ACTIVE";
  if (payload.status) {
    const s = String(payload.status).toUpperCase();
    if (s === "INACTIVE" || s === "PAUSED") status = "PAUSED";
    else if (s === "DRAFT") status = "DRAFT";
    else if (s === "ACTIVE") status = "ACTIVE";
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name,
      title,
      description,
      imageUrl,
      targetRole,
      campaignType,
      category: payload.category ? String(payload.category).trim() : "General",
      offer: payload.offer ? String(payload.offer).trim() : null,
      deepLink: linkValidation.normalizedLink,
      status,
      scheduleSlot: payload.scheduleSlot || "SLOT_1",
      customScheduleAt: payload.customScheduleAt ? new Date(payload.customScheduleAt) : null
    }
  };
}

/**
 * Generates rich visual preview metadata for notification preview in admin UI
 */
export function buildNotificationPreview(campaign: {
  title: string;
  description: string;
  imageUrl?: string | null;
  deepLink?: string | null;
  targetRole?: string | null;
  category?: string | null;
  offer?: string | null;
}) {
  return {
    title: campaign.title,
    body: campaign.description,
    imageUrl: campaign.imageUrl || null,
    deepLink: campaign.deepLink || "/dashboard",
    targetRoleLabel: campaign.targetRole === "ALL" ? "All Eligible Users" : campaign.targetRole || "All Roles",
    categoryBadge: campaign.category || "Promotional",
    offerBadge: campaign.offer || null,
    androidPreview: {
      appName: "GoExperts",
      smallIcon: "ic_notification",
      color: "#2563EB",
      bigPicture: campaign.imageUrl || null,
      actions: [
        { title: "Explore Now", actionUrl: campaign.deepLink || "/dashboard" },
        { title: "Dismiss", actionUrl: null }
      ]
    },
    iosPreview: {
      subtitle: "GoExperts Official",
      body: campaign.description,
      badge: 1,
      sound: "default",
      attachment: campaign.imageUrl || null
    }
  };
}
