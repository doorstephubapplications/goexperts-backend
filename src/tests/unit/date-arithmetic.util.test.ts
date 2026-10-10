import { describe, it, expect } from "vitest";
import {
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  computeSubscriptionExpiry,
  computeQuotaResetDate,
  formatValidityLabel,
  validateDurationConfig,
  isSubscriptionActiveAt,
  normalizeQuotaResetPolicy,
} from "../../utils/date-arithmetic.util.js";
import { CANONICAL_PLANS } from "../../constants/plan-catalog.constants.js";

describe("Subscription Validity & Calendar Arithmetic Tests", () => {
  it("computes 7-day exact validity correctly", () => {
    const start = new Date(Date.UTC(2026, 0, 10, 12, 0, 0)); // Jan 10 2026
    const expiry = computeSubscriptionExpiry(start, 7, "DAYS");
    expect(expiry.toISOString()).toBe(new Date(Date.UTC(2026, 0, 17, 12, 0, 0)).toISOString());
  });

  it("computes 30-day exact validity correctly", () => {
    const start = new Date(Date.UTC(2026, 0, 1, 10, 0, 0)); // Jan 1 2026
    const expiry = computeSubscriptionExpiry(start, 30, "DAYS");
    expect(expiry.toISOString()).toBe(new Date(Date.UTC(2026, 0, 31, 10, 0, 0)).toISOString());
  });

  it("computes 1-month validity with month-end clipping (31 Jan -> 28 Feb non-leap year)", () => {
    const start = new Date(Date.UTC(2026, 0, 31, 10, 0, 0)); // 31 Jan 2026
    const expiry = computeSubscriptionExpiry(start, 1, "MONTHS");
    // Feb in 2026 has 28 days -> clipped to 28 Feb
    expect(expiry.getUTCFullYear()).toBe(2026);
    expect(expiry.getUTCMonth()).toBe(1); // Feb
    expect(expiry.getUTCDate()).toBe(28);
  });

  it("computes 6-month validity with month-end preservation (31 Jan + 6 months -> 31 Jul)", () => {
    const start = new Date(Date.UTC(2026, 0, 31, 10, 0, 0)); // 31 Jan 2026
    const expiry = computeSubscriptionExpiry(start, 6, "MONTHS");
    expect(expiry.getUTCFullYear()).toBe(2026);
    expect(expiry.getUTCMonth()).toBe(6); // July
    expect(expiry.getUTCDate()).toBe(31);
  });

  it("computes leap year 1-year expiry (29 Feb 2028 + 1 year -> 28 Feb 2029)", () => {
    const start = new Date(Date.UTC(2028, 1, 29, 10, 0, 0)); // 29 Feb 2028 (leap year)
    const expiry = computeSubscriptionExpiry(start, 1, "YEARS");
    expect(expiry.getUTCFullYear()).toBe(2029);
    expect(expiry.getUTCMonth()).toBe(1); // Feb
    expect(expiry.getUTCDate()).toBe(28); // Clipped to 28 Feb
  });

  it("validates positive whole number durations and rejects non-positive/fractional values", () => {
    expect(validateDurationConfig(1, "MONTHS").isValid).toBe(true);
    expect(validateDurationConfig(365, "DAYS").isValid).toBe(true);
    expect(validateDurationConfig(0, "MONTHS").isValid).toBe(false);
    expect(validateDurationConfig(-5, "DAYS").isValid).toBe(false);
    expect(validateDurationConfig(1.5, "MONTHS").isValid).toBe(false);
    expect(validateDurationConfig(15, "YEARS").isValid).toBe(false); // Exceeds max 5 years
  });

  it("formats validity labels cleanly", () => {
    expect(formatValidityLabel(1, "MONTHS")).toBe("/ 1 month");
    expect(formatValidityLabel(6, "MONTHS")).toBe("/ 6 months");
    expect(formatValidityLabel(1, "YEARS")).toBe("/ 1 year");
    expect(formatValidityLabel(45, "DAYS")).toBe("/ 45 days");
  });

  it("computes quota reset independently of package validity", () => {
    const start = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)); // Jan 1 2026
    const packageExpiry = new Date(Date.UTC(2026, 11, 31, 0, 0, 0)); // 1 Year validity

    // FULL_TERM: reset date is the package expiry
    const fullTermReset = computeQuotaResetDate(start, "FULL_TERM", 1, "YEARS", packageExpiry, start);
    expect(fullTermReset?.toISOString()).toBe(packageExpiry.toISOString());

    // CALENDAR_MONTHLY: reset date is 1 month from activation
    const monthlyReset = computeQuotaResetDate(start, "CALENDAR_MONTHLY", 1, "MONTHS", packageExpiry, start);
    expect(monthlyReset?.getUTCMonth()).toBe(1); // Feb 1
    expect(monthlyReset?.getUTCDate()).toBe(1);
  });

  it("verifies exact subscription interval boundaries (start-inclusive, end-exclusive)", () => {
    const start = new Date(Date.UTC(2026, 0, 1, 0, 0, 0)); // Jan 1, 2026 00:00:00
    const end = new Date(Date.UTC(2026, 1, 1, 0, 0, 0));   // Feb 1, 2026 00:00:00

    // Exact start date: ACTIVE (inclusive)
    expect(isSubscriptionActiveAt(start, end, start)).toBe(true);

    // Midway: ACTIVE
    const midway = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
    expect(isSubscriptionActiveAt(start, end, midway)).toBe(true);

    // 1 millisecond before expiry: ACTIVE
    const justBeforeEnd = new Date(end.getTime() - 1);
    expect(isSubscriptionActiveAt(start, end, justBeforeEnd)).toBe(true);

    // Exact now == endDate: EXPIRED (end-exclusive)
    expect(isSubscriptionActiveAt(start, end, end)).toBe(false);

    // Past endDate: EXPIRED
    const afterEnd = new Date(Date.UTC(2026, 1, 2, 0, 0, 0));
    expect(isSubscriptionActiveAt(start, end, afterEnd)).toBe(false);

    // Before startDate: NOT ACTIVE
    const beforeStart = new Date(Date.UTC(2025, 11, 31, 23, 59, 59));
    expect(isSubscriptionActiveAt(start, end, beforeStart)).toBe(false);
  });

  it("normalizes legacy and variant quota reset policy names into canonical 4 policies", () => {
    expect(normalizeQuotaResetPolicy("MONTHLY")).toBe("CALENDAR_MONTHLY");
    expect(normalizeQuotaResetPolicy("calendar_monthly")).toBe("CALENDAR_MONTHLY");
    expect(normalizeQuotaResetPolicy("BILLING_CYCLE")).toBe("FULL_TERM");
    expect(normalizeQuotaResetPolicy("full_term")).toBe("FULL_TERM");
    expect(normalizeQuotaResetPolicy("TERM_POOL")).toBe("FULL_TERM");
    expect(normalizeQuotaResetPolicy("ANNUAL")).toBe("CUSTOM_INTERVAL");
    expect(normalizeQuotaResetPolicy("custom_interval")).toBe("CUSTOM_INTERVAL");
    expect(normalizeQuotaResetPolicy("NEVER")).toBe("NONE");
    expect(normalizeQuotaResetPolicy("none")).toBe("NONE");
    expect(normalizeQuotaResetPolicy(null)).toBe("CALENDAR_MONTHLY");
  });

  it("verifies Investor catalog entries never use the shortcut 'EOI' and always use 'Expression of Interest' / 'Expressions of Interest'", () => {
    const investorPlans = CANONICAL_PLANS.filter((p) => p.role === "investor");
    expect(investorPlans.length).toBeGreaterThan(0);

    for (const plan of investorPlans) {
      // Check benefits and descriptions
      const allText = [
        plan.name,
        plan.shortDescription,
        plan.detailedDescription,
        ...plan.benefits.map((b) => `${b.title} ${b.explanation}`),
      ].join(" ");

      // Regex matches standalone word EOI or EOIs
      expect(allText).not.toMatch(/\bEOI\b/);
      expect(allText).not.toMatch(/\bEOIs\b/);

      // Verify full form is present in benefits
      const hasFullForm = plan.benefits.some(
        (b) =>
          b.title.includes("Expression of Interest") ||
          b.title.includes("Expressions of Interest") ||
          b.explanation.includes("Expression of Interest") ||
          b.explanation.includes("Expressions of Interest"),
      );
      expect(hasFullForm).toBe(true);
    }
  });
});
