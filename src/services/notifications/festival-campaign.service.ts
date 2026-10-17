/**
 * GoExperts Automated Festival & International Observance Campaign Service
 * Detects today's occasion based on Gregorian calendar, prevents duplicates across instances,
 * and coordinates automated delivery.
 */

import { prisma } from "../../config/database.js";
import { FESTIVAL_CALENDAR_SEEDS, FestivalOccasionDefinition } from "./festival-calendar.data.js";
import { validateDeepLink, normalizeTargetRole } from "./push-campaign-validator.js";
import { v4 as uuidv4 } from "uuid";

export const FESTIVALS_SETTING_KEY = "PUSH_CAMPAIGN_FESTIVAL_CALENDAR";

/**
 * Loads all configured festival and observance occasions
 */
export async function getFestivalOccasions(): Promise<FestivalOccasionDefinition[]> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: FESTIVALS_SETTING_KEY }
    });

    if (setting?.value) {
      const parsed = JSON.parse(setting.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[FestivalCampaignService] Failed reading festival settings from DB, falling back to seeds:", err);
  }

  return FESTIVAL_CALENDAR_SEEDS;
}

/**
 * Saves festival occasions into the settings database
 */
export async function saveFestivalOccasions(occasions: FestivalOccasionDefinition[]): Promise<void> {
  await prisma.setting.upsert({
    where: { key: FESTIVALS_SETTING_KEY },
    update: {
      value: JSON.stringify(occasions),
      category: "push_campaigns"
    },
    create: {
      key: FESTIVALS_SETTING_KEY,
      value: JSON.stringify(occasions),
      category: "push_campaigns"
    }
  });
}

/**
 * Seeds or re-initializes the festival calendar with approved occasions
 */
export async function seedFestivalCalendar(overwrite = false): Promise<{ count: number; items: FestivalOccasionDefinition[] }> {
  let existing: FestivalOccasionDefinition[] = [];
  if (!overwrite) {
    existing = await getFestivalOccasions();
  }

  const existingIds = new Set(existing.map((o) => o.id));
  const merged = [...existing];

  for (const seed of FESTIVAL_CALENDAR_SEEDS) {
    if (!existingIds.has(seed.id)) {
      merged.push(seed);
    }
  }

  const finalOccasions = overwrite ? FESTIVAL_CALENDAR_SEEDS : merged;
  await saveFestivalOccasions(finalOccasions);
  return { count: finalOccasions.length, items: finalOccasions };
}

/**
 * Adds a new festival occasion
 */
export async function createFestivalOccasion(data: Partial<FestivalOccasionDefinition>): Promise<FestivalOccasionDefinition> {
  if (!data.name || !data.title || !data.description || !data.date) {
    throw new Error("name, title, description, and date (MM-DD or YYYY-MM-DD) are required");
  }

  const linkCheck = validateDeepLink(data.deepLink);
  const targetRole = normalizeTargetRole(data.targetRole);

  const newOccasion: FestivalOccasionDefinition = {
    id: data.id || `occ_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
    name: data.name.trim(),
    category: data.category || "INDIAN_FESTIVAL",
    date: data.date.trim(),
    year: data.year ?? (data.date.length === 10 ? parseInt(data.date.slice(0, 4), 10) : null),
    recurrence: data.date.length === 10 ? "VERIFIED_YEARLY" : "ANNUAL_FIXED",
    title: data.title.trim(),
    description: data.description.trim(),
    imageUrl: data.imageUrl || "https://images.unsplash.com/photo-1546271876-af61566eb085?w=800&auto=format&fit=crop&q=80",
    targetRole,
    scheduledTime: data.scheduledTime || "09:00",
    timezone: data.timezone || "Asia/Kolkata",
    deepLink: linkCheck.normalizedLink,
    offer: data.offer ? data.offer.trim() : undefined,
    isActive: data.isActive !== false
  };

  const list = await getFestivalOccasions();
  list.push(newOccasion);
  await saveFestivalOccasions(list);
  return newOccasion;
}

/**
 * Updates an existing festival occasion
 */
export async function updateFestivalOccasion(id: string, updates: Partial<FestivalOccasionDefinition>): Promise<FestivalOccasionDefinition> {
  const list = await getFestivalOccasions();
  const idx = list.findIndex((o) => o.id === id);
  if (idx === -1) {
    throw new Error(`Festival occasion with id '${id}' not found`);
  }

  const existing = list[idx];
  const deepLink = updates.deepLink !== undefined ? validateDeepLink(updates.deepLink).normalizedLink : existing.deepLink;
  const targetRole = updates.targetRole !== undefined ? normalizeTargetRole(updates.targetRole) : existing.targetRole;

  const updated: FestivalOccasionDefinition = {
    ...existing,
    ...updates,
    id: existing.id, // Immutable ID
    deepLink,
    targetRole,
    name: updates.name ? updates.name.trim() : existing.name,
    title: updates.title ? updates.title.trim() : existing.title,
    description: updates.description ? updates.description.trim() : existing.description
  };

  list[idx] = updated;
  await saveFestivalOccasions(list);
  return updated;
}

/**
 * Deletes a festival occasion
 */
export async function deleteFestivalOccasion(id: string): Promise<boolean> {
  const list = await getFestivalOccasions();
  const filtered = list.filter((o) => o.id !== id);
  if (filtered.length === list.length) {
    return false;
  }
  await saveFestivalOccasions(filtered);
  return true;
}

/**
 * Finds all active festival occasions matching today's Gregorian date in Asia/Kolkata.
 * Supports both fixed MM-DD (recurring every year) and verified YYYY-MM-DD for fluctuating lunar dates.
 */
export async function findActiveOccasionsForDate(targetDate: Date = new Date()): Promise<FestivalOccasionDefinition[]> {
  const occasions = await getFestivalOccasions();

  // Format date in IST
  const monthDay = targetDate.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
    month: "2-digit",
    day: "2-digit"
  }); // "MM-DD" e.g. "01-26"

  const fullDate = targetDate.toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }); // "YYYY-MM-DD" e.g. "2026-01-26"

  const currentYear = parseInt(fullDate.slice(0, 4), 10);

  return occasions.filter((occ) => {
    if (!occ.isActive) return false;

    // Match exact verified date (e.g. "2026-03-04" for Holi 2026)
    if (occ.date === fullDate) return true;

    // Match recurring annual date (e.g. "01-26" for Republic Day)
    if (occ.recurrence === "ANNUAL_FIXED") {
      const occMonthDay = occ.date.length === 5 ? occ.date : occ.date.slice(5);
      return occMonthDay === monthDay;
    }

    // Match yearly date with year check
    if (occ.year && occ.year === currentYear) {
      const occMonthDay = occ.date.length === 5 ? occ.date : occ.date.slice(5);
      return occMonthDay === monthDay;
    }

    return false;
  });
}

/**
 * Checks and dispatches applicable automated festival campaigns for today.
 * Guarantees duplicate prevention: each festival can only be dispatched ONCE per calendar year.
 */
export async function checkAndDispatchDailyFestivals(now: Date = new Date()): Promise<{
  executed: boolean;
  occasionsDispatched: string[];
  reasons: string[];
}> {
  const activeOccasions = await findActiveOccasionsForDate(now);
  if (activeOccasions.length === 0) {
    return { executed: false, occasionsDispatched: [], reasons: ["No festival scheduled for today"] };
  }

  const istYear = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata", year: "numeric" });
  const istTime = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const dispatchedIds: string[] = [];
  const reasons: string[] = [];

  for (const occasion of activeOccasions) {
    const scheduledTime = occasion.scheduledTime || "09:00";
    // Check if within dispatch time window (at or past scheduledTime)
    if (istTime < scheduledTime) {
      reasons.push(`Occasion '${occasion.name}' scheduled for ${scheduledTime} IST (current time: ${istTime})`);
      continue;
    }

    // Unique occurrence idempotency identifier: e.g. FESTIVAL_occ_republic_day_2026
    const occurrenceKey = `FESTIVAL_${occasion.id}_${istYear}`;

    // Check if this occurrence was already logged in PushCampaignHistory
    const alreadyDispatched = await prisma.pushCampaignHistory.findFirst({
      where: {
        slotName: occurrenceKey
      }
    });

    if (alreadyDispatched) {
      reasons.push(`Occasion '${occasion.name}' already dispatched for year ${istYear} at ${alreadyDispatched.sentAt.toISOString()}`);
      continue;
    }

    // Dispatch the festival push campaign
    try {
      const { dispatchDirectCampaign } = await import("./push-campaign-engine.service.js");
      console.log(`[FestivalCampaignEngine] 🎆 Auto-dispatching festival occasion: ${occasion.name} (${occurrenceKey})`);

      await dispatchDirectCampaign({
        campaignName: `[Festival] ${occasion.name}`,
        title: occasion.title,
        description: occasion.description,
        imageUrl: occasion.imageUrl,
        targetRole: occasion.targetRole,
        category: "Festival / Observance",
        offer: occasion.offer || null,
        deepLink: occasion.deepLink || "/dashboard",
        slotName: occurrenceKey,
        isFestival: true
      });

      dispatchedIds.push(occasion.id);
      reasons.push(`Successfully dispatched '${occasion.name}' to role ${occasion.targetRole}`);
    } catch (err: any) {
      console.error(`[FestivalCampaignEngine] Failed to dispatch occasion '${occasion.name}':`, err);
      reasons.push(`Error dispatching '${occasion.name}': ${err.message}`);
    }
  }

  return {
    executed: dispatchedIds.length > 0,
    occasionsDispatched: dispatchedIds,
    reasons
  };
}
