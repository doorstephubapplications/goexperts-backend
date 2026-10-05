import { describe, it, expect } from "vitest";
import {
  calculateInclusiveGst,
  getPlanBaseAmountExcludingGst,
  GST_RATE_FOR_INCLUDED_PLAN_PRICE,
} from "../../utils/financial.util.js";

describe("Stage 2B.1 — GST-Inclusive Financial & Invoice Calculation Verification", () => {
  describe("1. Canonical Production Plan Catalog Tax Breakdown", () => {
    it("should calculate exact inclusive GST for Freelancer Monthly (₹399.00)", () => {
      const result = calculateInclusiveGst(399.0);
      expect(result.subtotal).toBe(338.14);
      expect(result.gst).toBe(60.86);
      expect(result.total).toBe(399.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });

    it("should calculate exact inclusive GST for Freelancer Annual (₹3,650.00)", () => {
      const result = calculateInclusiveGst(3650.0);
      expect(result.subtotal).toBe(3093.22);
      expect(result.gst).toBe(556.78);
      expect(result.total).toBe(3650.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });

    it("should calculate exact inclusive GST for Additional Role Add-on Monthly (₹149.00)", () => {
      const result = calculateInclusiveGst(149.0);
      expect(result.subtotal).toBe(126.27);
      expect(result.gst).toBe(22.73);
      expect(result.total).toBe(149.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });

    it("should calculate exact inclusive GST for Additional Role Add-on Annual (₹1,499.00)", () => {
      const result = calculateInclusiveGst(1499.0);
      expect(result.subtotal).toBe(1270.34);
      expect(result.gst).toBe(228.66);
      expect(result.total).toBe(1499.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });

    it("should calculate exact inclusive GST for All Access Monthly (₹699.00)", () => {
      const result = calculateInclusiveGst(699.0);
      expect(result.subtotal).toBe(592.37);
      expect(result.gst).toBe(106.63);
      expect(result.total).toBe(699.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });

    it("should calculate exact inclusive GST for All Access Annual (₹6,999.00)", () => {
      const result = calculateInclusiveGst(6999.0);
      expect(result.subtotal).toBe(5931.36);
      expect(result.gst).toBe(1067.64);
      expect(result.total).toBe(6999.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });

    it("should calculate exact inclusive GST for Legacy Starter (₹299.00)", () => {
      const result = calculateInclusiveGst(299.0);
      expect(result.subtotal).toBe(253.39);
      expect(result.gst).toBe(45.61);
      expect(result.total).toBe(299.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });

    it("should calculate exact inclusive GST for Grandfathered Pro (₹799.00)", () => {
      const result = calculateInclusiveGst(799.0);
      expect(result.subtotal).toBe(677.12);
      expect(result.gst).toBe(121.88);
      expect(result.total).toBe(799.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });

    it("should calculate exact inclusive GST for Grandfathered Annual (₹5,999.00)", () => {
      const result = calculateInclusiveGst(5999.0);
      expect(result.subtotal).toBe(5083.9);
      expect(result.gst).toBe(915.1);
      expect(result.total).toBe(5999.0);
      expect(result.subtotal + result.gst).toBe(result.total);
    });
  });

  describe("2. Accounting Invariants & Rounding Integrity", () => {
    it("strictly preserves subtotal + gst === total across 500 test amounts", () => {
      for (let amt = 10; amt <= 5000; amt += 10) {
        const { subtotal, gst, total } = calculateInclusiveGst(amt);
        expect(subtotal).toBeGreaterThanOrEqual(0);
        expect(gst).toBeGreaterThanOrEqual(0);
        expect(parseFloat((subtotal + gst).toFixed(2))).toBe(total);
      }
    });

    it("ensures effective tax rate relative to taxable base is 18% within currency rounding limits", () => {
      const testCases = [399, 3650, 149, 1499, 699, 6999, 299, 799, 5999];
      for (const gross of testCases) {
        const { subtotal, gst } = calculateInclusiveGst(gross);
        const computedTaxRate = (gst / subtotal) * 100;
        expect(computedTaxRate).toBeGreaterThanOrEqual(17.9);
        expect(computedTaxRate).toBeLessThanOrEqual(18.1);
      }
    });

    it("guarantees getPlanBaseAmountExcludingGst returns exact taxable subtotal", () => {
      expect(getPlanBaseAmountExcludingGst(399)).toBe(338.14);
      expect(getPlanBaseAmountExcludingGst(3650)).toBe(3093.22);
      expect(getPlanBaseAmountExcludingGst(699)).toBe(592.37);
    });
  });

  describe("3. Edge Cases & Safety Guards", () => {
    it("handles zero amount gracefully without NaN or negative values", () => {
      const result = calculateInclusiveGst(0);
      expect(result).toEqual({ subtotal: 0, gst: 0, total: 0 });
    });

    it("handles negative or invalid inputs by clamping to zero", () => {
      expect(calculateInclusiveGst(-500)).toEqual({ subtotal: 0, gst: 0, total: 0 });
      expect(calculateInclusiveGst(NaN)).toEqual({ subtotal: 0, gst: 0, total: 0 });
    });

    it("handles fractional cents and small amounts accurately", () => {
      const result = calculateInclusiveGst(1.0);
      expect(result.subtotal).toBe(0.85);
      expect(result.gst).toBe(0.15);
      expect(result.subtotal + result.gst).toBe(1.0);
    });

    it("handles large commercial enterprise amounts accurately", () => {
      const result = calculateInclusiveGst(100000.0);
      expect(result.subtotal).toBe(84745.76);
      expect(result.gst).toBe(15254.24);
      expect(result.subtotal + result.gst).toBe(100000.0);
    });
  });
});
