/**
 * Canonical calendar date arithmetic utility for Go Experts.
 * Handles month-end clipping (e.g. Jan 31 + 1 mo = Feb 28/29), leap years, and exact day validity.
 * NO FIXED 30-DAY OR 365-DAY APPROXIMATIONS.
 */

export type ValidityUnit = "DAYS" | "MONTHS" | "YEARS";
export type QuotaResetPolicy = "NONE" | "FULL_TERM" | "CALENDAR_MONTHLY" | "CUSTOM_INTERVAL";

/**
 * Normalizes legacy or alternate naming for quota reset policies into the canonical 4 policies:
 * NONE, FULL_TERM, CALENDAR_MONTHLY, CUSTOM_INTERVAL
 */
export function normalizeQuotaResetPolicy(rawPolicy?: string | null): QuotaResetPolicy {
  if (!rawPolicy) return "CALENDAR_MONTHLY";
  const normalized = String(rawPolicy).trim().toUpperCase();
  if (normalized === "NONE" || normalized === "NEVER" || normalized === "ONE_TIME") {
    return "NONE";
  }
  if (
    normalized === "FULL_TERM" ||
    normalized === "BILLING_CYCLE" ||
    normalized === "TERM_POOL" ||
    normalized === "NO_RESET"
  ) {
    return "FULL_TERM";
  }
  if (
    normalized === "CALENDAR_MONTHLY" ||
    normalized === "MONTHLY" ||
    normalized === "CALENDAR_MONTH" ||
    normalized === "ANNIVERSARY"
  ) {
    return "CALENDAR_MONTHLY";
  }
  if (
    normalized === "CUSTOM_INTERVAL" ||
    normalized === "CUSTOM" ||
    normalized === "INTERVAL" ||
    normalized === "ANNUAL"
  ) {
    return "CUSTOM_INTERVAL";
  }
  return "CALENDAR_MONTHLY";
}

/**
 * Authoritative start-inclusive, end-exclusive subscription interval check.
 * Subscriptions are active when: now >= startDate && now < endDate.
 * At exact now == endDate, the subscription is strictly expired.
 */
export function isSubscriptionActiveAt(
  startDate?: Date | string | null,
  endDate?: Date | string | null,
  asOfDate: Date | string = new Date()
): boolean {
  if (!endDate) return false;
  const startMs = startDate ? new Date(startDate).getTime() : 0;
  const endMs = new Date(endDate).getTime();
  const asOfMs = new Date(asOfDate).getTime();
  if (isNaN(endMs) || isNaN(asOfMs)) return false;
  return asOfMs >= startMs && asOfMs < endMs;
}

/**
 * Validates numeric duration and unit against business limits.
 * Duration must be a positive whole number.
 */
export function validateDurationConfig(
  validityValue: number,
  validityUnit: ValidityUnit
): { isValid: boolean; error?: string } {
  if (
    typeof validityValue !== "number" ||
    !Number.isInteger(validityValue) ||
    validityValue <= 0
  ) {
    return { isValid: false, error: "Duration must be a positive whole number." };
  }
  const unit = String(validityUnit || "").toUpperCase();
  if (!["DAYS", "MONTHS", "YEARS"].includes(unit)) {
    return { isValid: false, error: "Validity unit must be DAYS, MONTHS, or YEARS." };
  }
  if (unit === "DAYS" && validityValue > 730) {
    return { isValid: false, error: "Days validity cannot exceed 730 days." };
  }
  if (unit === "MONTHS" && validityValue > 60) {
    return { isValid: false, error: "Months validity cannot exceed 60 months." };
  }
  if (unit === "YEARS" && validityValue > 5) {
    return { isValid: false, error: "Years validity cannot exceed 5 years." };
  }
  return { isValid: true };
}

/**
 * Adds exact days to a date.
 */
export function addExactDays(startDate: Date, days: number): Date {
  const result = new Date(startDate.getTime());
  result.setUTCDate(result.getUTCDate() + Math.max(0, Math.floor(days)));
  return result;
}

export const addCalendarDays = addExactDays;

/**
 * Adds calendar months with month-end clipping.
 * e.g., 31 Jan + 1 mo -> 28 Feb (or 29 Feb in leap year).
 * 31 March + 6 mo -> 30 Sept.
 */
export function addCalendarMonths(startDate: Date, monthsToAdd: number): Date {
  const result = new Date(startDate.getTime());
  const originalDay = result.getUTCDate();
  const months = Math.max(0, Math.floor(monthsToAdd));

  // Set day to 1 to avoid inadvertent overflow during month increment
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  // Find maximum days in target month
  const targetYear = result.getUTCFullYear();
  const targetMonth = result.getUTCMonth();
  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();

  // Clip to max days in target month
  result.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return result;
}

/**
 * Adds calendar years with leap-year handling.
 * e.g., 29 Feb 2028 + 1 yr -> 28 Feb 2029.
 */
export function addCalendarYears(startDate: Date, yearsToAdd: number): Date {
  return addCalendarMonths(startDate, Math.max(0, Math.floor(yearsToAdd)) * 12);
}

/**
 * Computes authoritative subscription expiry from activation date and configured validity.
 */
export function computeSubscriptionExpiry(
  startDate: Date = new Date(),
  validityValue: number = 1,
  validityUnit: ValidityUnit = "MONTHS"
): Date {
  const num = Math.max(1, Math.floor(validityValue || 1));
  const unit = String(validityUnit || "MONTHS").toUpperCase() as ValidityUnit;

  switch (unit) {
    case "DAYS":
      return addExactDays(startDate, num);
    case "YEARS":
      return addCalendarYears(startDate, num);
    case "MONTHS":
    default:
      return addCalendarMonths(startDate, num);
  }
}

/**
 * Parses legacy duration string into canonical numeric validityValue and validityUnit.
 * Handles: "monthly", "yearly", "180_days", "90_days", "1_months", "1_years", "7_days", etc.
 */
export function parseDurationString(duration?: string | null): {
  validityValue: number;
  validityUnit: ValidityUnit;
} {
  if (!duration) {
    return { validityValue: 1, validityUnit: "MONTHS" };
  }

  const raw = String(duration).toLowerCase().trim();

  // Pattern: "7_days", "1_months", "1_years"
  const match = raw.match(/^(\d+)[_\s]*(day|days|month|months|year|years)$/);
  if (match) {
    const val = parseInt(match[1], 10);
    const unitRaw = match[2];
    if (unitRaw.startsWith("day")) return { validityValue: val, validityUnit: "DAYS" };
    if (unitRaw.startsWith("year")) return { validityValue: val, validityUnit: "YEARS" };
    return { validityValue: val, validityUnit: "MONTHS" };
  }

  // Legacy aliases
  if (raw === "yearly" || raw === "annual" || raw === "1year" || raw === "1_year") {
    return { validityValue: 1, validityUnit: "YEARS" };
  }
  if (raw === "180_days" || raw === "6_months" || raw === "6months") {
    return { validityValue: 6, validityUnit: "MONTHS" };
  }
  if (raw === "90_days" || raw === "quarterly" || raw === "3_months") {
    return { validityValue: 3, validityUnit: "MONTHS" };
  }
  if (raw === "monthly" || raw === "1_month" || raw === "1month") {
    return { validityValue: 1, validityUnit: "MONTHS" };
  }

  return { validityValue: 1, validityUnit: "MONTHS" };
}

/**
 * Formats duration into a clean customer-facing string.
 * e.g., "1 MONTHS" -> "/ 1 month", "12 MONTHS" -> "/ 12 months", "1 YEARS" -> "/ 1 year", "7 DAYS" -> "/ 7 days".
 */
export function formatValidityLabel(validityValue: number, validityUnit: ValidityUnit): string {
  const val = Math.max(1, Math.floor(validityValue || 1));
  const unit = String(validityUnit || "MONTHS").toUpperCase() as ValidityUnit;

  if (unit === "DAYS") {
    return val === 1 ? "/ 1 day" : `/ ${val} days`;
  }
  if (unit === "YEARS") {
    return val === 1 ? "/ 1 year" : `/ ${val} years`;
  }
  // MONTHS
  return val === 1 ? "/ 1 month" : `/ ${val} months`;
}

/**
 * Computes next quota reset date independently of plan validity.
 */
export function computeQuotaResetDate(
  startDate: Date,
  rawPolicy: string = "CALENDAR_MONTHLY",
  quotaResetValue: number = 1,
  quotaResetUnit: ValidityUnit = "MONTHS",
  termEndDate?: Date,
  asOfDate: Date = new Date()
): Date | null {
  const quotaResetPolicy = normalizeQuotaResetPolicy(rawPolicy);

  if (termEndDate && asOfDate.getTime() >= termEndDate.getTime()) {
    return termEndDate;
  }

  if (quotaResetPolicy === "NONE" || quotaResetPolicy === "FULL_TERM") {
    return termEndDate || null;
  }

  if (quotaResetPolicy === "CALENDAR_MONTHLY") {
    // Computes next monthly billing anniversary from original start anchor
    let nextReset = addCalendarMonths(startDate, 1);
    while (nextReset.getTime() <= asOfDate.getTime()) {
      nextReset = addCalendarMonths(nextReset, 1);
    }
    if (termEndDate && nextReset.getTime() > termEndDate.getTime()) {
      return termEndDate;
    }
    return nextReset;
  }

  if (quotaResetPolicy === "CUSTOM_INTERVAL") {
    const val = Math.max(1, Math.floor(quotaResetValue || 1));
    let nextReset = computeSubscriptionExpiry(startDate, val, quotaResetUnit);
    while (nextReset.getTime() <= asOfDate.getTime()) {
      nextReset = computeSubscriptionExpiry(nextReset, val, quotaResetUnit);
    }
    if (termEndDate && nextReset.getTime() > termEndDate.getTime()) {
      return termEndDate;
    }
    return nextReset;
  }

  return termEndDate || null;
}

/**
 * Computes the start and end of the current active quota window for a subscription.
 * Used for lazy quota resets and historical cycle boundary accounting.
 */
export function computeCurrentQuotaWindow(
  startDate: Date,
  rawPolicy: string = "CALENDAR_MONTHLY",
  quotaResetValue: number = 1,
  quotaResetUnit: ValidityUnit = "MONTHS",
  termEndDate?: Date,
  asOfDate: Date = new Date()
): { windowStart: Date; windowEnd: Date } {
  const quotaResetPolicy = normalizeQuotaResetPolicy(rawPolicy);

  if (quotaResetPolicy === "NONE" || quotaResetPolicy === "FULL_TERM") {
    return {
      windowStart: startDate,
      windowEnd: termEndDate || addCalendarYears(startDate, 10),
    };
  }

  if (quotaResetPolicy === "CALENDAR_MONTHLY") {
    let windowStart = new Date(startDate.getTime());
    let windowEnd = addCalendarMonths(startDate, 1);
    while (windowEnd.getTime() <= asOfDate.getTime()) {
      windowStart = new Date(windowEnd.getTime());
      windowEnd = addCalendarMonths(windowEnd, 1);
    }
    if (termEndDate && windowEnd.getTime() > termEndDate.getTime()) {
      windowEnd = termEndDate;
    }
    return { windowStart, windowEnd };
  }

  // CUSTOM_INTERVAL
  const val = Math.max(1, Math.floor(quotaResetValue || 1));
  let windowStart = new Date(startDate.getTime());
  let windowEnd = computeSubscriptionExpiry(startDate, val, quotaResetUnit);
  while (windowEnd.getTime() <= asOfDate.getTime()) {
    windowStart = new Date(windowEnd.getTime());
    windowEnd = computeSubscriptionExpiry(windowEnd, val, quotaResetUnit);
  }
  if (termEndDate && windowEnd.getTime() > termEndDate.getTime()) {
    windowEnd = termEndDate;
  }
  return { windowStart, windowEnd };
}
