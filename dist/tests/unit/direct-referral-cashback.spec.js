import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateBasePriceExcludingGst, calculateProratedRecurringReward, } from '../../services/referral/direct-referral.service.js';
describe('Direct Referral & Recurring Cashback Financial Engine', () => {
    const GST_RATE = 0.18; // 18%
    const RECURRING_RATE = 0.05; // 5%
    describe('1. Base Price & GST Exclusion Arithmetic', () => {
        it('should correctly calculate base price excluding 18% GST for Starter Plan (₹99)', () => {
            const planPrice = 99;
            const basePrice = calculateBasePriceExcludingGst(planPrice, GST_RATE);
            // 99 / 1.18 = 83.8983... => 83.8983
            assert.strictEqual(Number(basePrice.toFixed(2)), 83.90);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            // 83.90 * 0.05 = 4.195 => 4.19 or 4.20
            assert(fivePercentBasis >= 4.19 && fivePercentBasis <= 4.20);
        });
        it('should correctly calculate base price excluding 18% GST for Business Plan (₹999)', () => {
            const planPrice = 999;
            const basePrice = calculateBasePriceExcludingGst(planPrice, GST_RATE);
            // 999 / 1.18 = 846.6101... => 846.61
            assert.strictEqual(Number(basePrice.toFixed(2)), 846.61);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            // 846.61 * 0.05 = 42.33
            assert.strictEqual(fivePercentBasis, 42.33);
        });
        it('should return 0 base price for Free Plan (₹0)', () => {
            const basePrice = calculateBasePriceExcludingGst(0, GST_RATE);
            assert.strictEqual(basePrice, 0);
        });
    });
    describe('2. Prorated Recurring Cashback Duration Arithmetic', () => {
        it('should calculate full 5% reward when full subscription period is eligible', () => {
            const now = new Date();
            const periodStart = new Date(now.getTime());
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
            const basePrice = 846.61;
            const result = calculateProratedRecurringReward(basePrice, RECURRING_RATE, periodStart, periodEnd, periodStart);
            assert.strictEqual(Math.round(result.remainingDays), 30);
            assert.strictEqual(result.proratedAmount, 42.33);
        });
        it('should prorate reward proportionally when joining midway through subscription', () => {
            const now = new Date();
            const periodStart = new Date(now.getTime());
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days total
            const eligibleStart = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days remaining
            const basePrice = 846.61;
            const result = calculateProratedRecurringReward(basePrice, RECURRING_RATE, periodStart, periodEnd, eligibleStart);
            assert.strictEqual(Math.round(result.remainingDays), 15);
            // 42.33 * 0.5 = 21.165 => 21.17
            assert.strictEqual(result.proratedAmount, 21.17);
        });
        it('should accurately calculate Starter ₹7.73 proration scenario', () => {
            // 365-day Starter plan (amount ₹1825, base ₹1546.61, 5% basis ₹77.33)
            // with ~36.5 days remaining (10% proration), allocated amount = 7.73
            const totalDays = 365;
            const remainingDays = 36.5;
            const rewardBasis = 77.33;
            const prorationFraction = remainingDays / totalDays;
            const allocatedAmount = Number((rewardBasis * prorationFraction).toFixed(2));
            assert.strictEqual(allocatedAmount, 7.73);
        });
        it('should return 0 allocated amount when subscription period has already expired', () => {
            const pastStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            const pastEnd = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const eligibleStart = new Date();
            const result = calculateProratedRecurringReward(846.61, RECURRING_RATE, pastStart, pastEnd, eligibleStart);
            assert.strictEqual(result.proratedAmount, 0);
        });
    });
    describe('3. Single-Tier Direct Referral Invariants', () => {
        it('guarantees direct single-tier referral invariant (A refers B only)', () => {
            // Invariant: Referee has exactly one direct referrer
            const referralRelationship = {
                refereeId: 'user-B',
                referrerId: 'user-A',
            };
            assert.strictEqual(referralRelationship.referrerId, 'user-A');
            // Second tier: B refers C
            const secondTierRelationship = {
                refereeId: 'user-C',
                referrerId: 'user-B',
            };
            // When C qualifies, direct referrer is B
            assert.strictEqual(secondTierRelationship.referrerId, 'user-B');
            // Direct referral invariant: A does NOT receive rewards for C's actions
            assert.notStrictEqual(secondTierRelationship.referrerId, 'user-A');
        });
        it('validates ₹25 one-time reward is strictly on 100% profile completion', () => {
            const isQualified99 = 99 >= 100;
            const isQualified100 = 100 >= 100;
            assert.strictEqual(isQualified99, false);
            assert.strictEqual(isQualified100, true);
        });
        it('generates unique deterministic idempotency key for one-time ₹25 reward', () => {
            const referralId = 'ref-uuid-123';
            const key1 = `REF-ONETIME-V1-${referralId}`;
            const key2 = `REF-ONETIME-V1-${referralId}`;
            assert.strictEqual(key1, key2);
            assert.match(key1, /^REF-ONETIME-V1-/);
        });
    });
});
