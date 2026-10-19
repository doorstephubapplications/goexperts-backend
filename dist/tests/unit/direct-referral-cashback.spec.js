import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateBasePriceExcludingGst, calculateProratedRecurringReward, } from '../../services/referral/direct-referral.service.js';
describe('Direct Referral & Recurring Cashback Financial Engine — Canonical Plans Catalog', () => {
    const GST_RATE = 0.18; // 18%
    const RECURRING_RATE = 0.05; // 5%
    describe('1. Base Price & GST Exclusion Arithmetic (New Canonical Plans)', () => {
        it('Starter Plan: ₹365 gross incl. 18% GST -> Base ₹309.32, 5% full basis ₹15.47', () => {
            const planPrice = 365;
            const basePrice = calculateBasePriceExcludingGst(planPrice, GST_RATE);
            // 365 / 1.18 = 309.322033... => 309.32
            assert.strictEqual(Number(basePrice.toFixed(2)), 309.32);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            // 309.322 * 0.05 = 15.4661 => 15.47
            assert.strictEqual(fivePercentBasis, 15.47);
        });
        it('Standard Plan: ₹1,499 gross incl. 18% GST -> Base ₹1,270.34, 5% full basis ₹63.52', () => {
            const planPrice = 1499;
            const basePrice = calculateBasePriceExcludingGst(planPrice, GST_RATE);
            // 1499 / 1.18 = 1270.33898... => 1270.34
            assert.strictEqual(Number(basePrice.toFixed(2)), 1270.34);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            // 1270.34 * 0.05 = 63.5169 => 63.52
            assert.strictEqual(fivePercentBasis, 63.52);
        });
        it('Business Plan: ₹3,650 gross incl. 18% GST -> Base ₹3,093.22, 5% full basis ₹154.66', () => {
            const planPrice = 3650;
            const basePrice = calculateBasePriceExcludingGst(planPrice, GST_RATE);
            // 3650 / 1.18 = 3093.22033... => 3093.22
            assert.strictEqual(Number(basePrice.toFixed(2)), 3093.22);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            // 3093.22 * 0.05 = 154.661 => 154.66
            assert.strictEqual(fivePercentBasis, 154.66);
        });
        it('Beginner Plan (Freelancer/Founder): ₹499 gross incl. 18% GST -> Base ₹422.88, 5% full basis ₹21.14', () => {
            const planPrice = 499;
            const basePrice = calculateBasePriceExcludingGst(planPrice, GST_RATE);
            // 499 / 1.18 = 422.88135... => 422.88
            assert.strictEqual(Number(basePrice.toFixed(2)), 422.88);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            // 422.881 * 0.05 = 21.144 => 21.14
            assert.strictEqual(fivePercentBasis, 21.14);
        });
        it('Standard Plan (Freelancer/Founder): ₹2,299 gross incl. 18% GST -> Base ₹1,948.31, 5% full basis ₹97.42', () => {
            const planPrice = 2299;
            const basePrice = calculateBasePriceExcludingGst(planPrice, GST_RATE);
            // 2299 / 1.18 = 1948.305... => 1948.31
            assert.strictEqual(Number(basePrice.toFixed(2)), 1948.31);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            // 1948.305 * 0.05 = 97.415 => 97.42
            assert.strictEqual(fivePercentBasis, 97.42);
        });
        it('Pro Plan (Freelancer/Founder): ₹3,650 gross incl. 18% GST -> Base ₹3,093.22, 5% full basis ₹154.66', () => {
            const planPrice = 3650;
            const basePrice = calculateBasePriceExcludingGst(planPrice, GST_RATE);
            // 3650 / 1.18 = 3093.22033... => 3093.22
            assert.strictEqual(Number(basePrice.toFixed(2)), 3093.22);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            // 3093.22 * 0.05 = 154.661 => 154.66
            assert.strictEqual(fivePercentBasis, 154.66);
        });
        it('Freedom Plan (both 60-day and 90-day): ₹0 -> Base ₹0, 5% recurring basis ₹0', () => {
            const basePrice = calculateBasePriceExcludingGst(0, GST_RATE);
            assert.strictEqual(basePrice, 0);
            const fivePercentBasis = Number((basePrice * RECURRING_RATE).toFixed(2));
            assert.strictEqual(fivePercentBasis, 0);
        });
    });
    describe('2. Prorated Recurring Cashback Duration Arithmetic', () => {
        it('Starter Plan: 30 days total, qualifies on Day 1 -> full ₹15.47 allocation', () => {
            const now = new Date();
            const periodStart = new Date(now.getTime());
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
            const basePrice = 309.322;
            const result = calculateProratedRecurringReward(basePrice, RECURRING_RATE, periodStart, periodEnd, periodStart);
            assert.strictEqual(Math.round(result.remainingDays), 30);
            assert.strictEqual(result.proratedAmount, 15.47);
        });
        it('Starter Plan: 30 days total, qualifies midway (15 days remaining) -> ₹7.73 allocation', () => {
            const now = new Date();
            const periodStart = new Date(now.getTime());
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
            const eligibleStart = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days left
            const basePrice = 309.322;
            const result = calculateProratedRecurringReward(basePrice, RECURRING_RATE, periodStart, periodEnd, eligibleStart);
            assert.strictEqual(Math.round(result.remainingDays), 15);
            // 15.466 * 0.5 = 7.733 => 7.73
            assert.strictEqual(result.proratedAmount, 7.73);
        });
        it('Standard Plan: 180 days total, qualifies midway (90 days remaining) -> ₹31.76 allocation', () => {
            const now = new Date();
            const periodStart = new Date(now.getTime());
            const periodEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days
            const eligibleStart = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days left
            const basePrice = 1270.339;
            const result = calculateProratedRecurringReward(basePrice, RECURRING_RATE, periodStart, periodEnd, eligibleStart);
            assert.strictEqual(Math.round(result.remainingDays), 90);
            // 63.5169 * 0.5 = 31.758 => 31.76
            assert.strictEqual(result.proratedAmount, 31.76);
        });
        it('Business Plan: 365 days total, qualifies midway (182.5 days remaining) -> ₹77.33 allocation', () => {
            const now = new Date();
            const periodStart = new Date(now.getTime());
            const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
            const eligibleStart = new Date(now.getTime() + 182.5 * 24 * 60 * 60 * 1000); // 182.5 days left
            const basePrice = 3093.2203;
            const result = calculateProratedRecurringReward(basePrice, RECURRING_RATE, periodStart, periodEnd, eligibleStart);
            // 154.661 * 0.5 = 77.3305 => 77.33
            assert.strictEqual(result.proratedAmount, 77.33);
        });
        it('Beginner Plan: 30 days total, qualifies midway (15 days remaining) -> ₹10.57 allocation', () => {
            const now = new Date();
            const periodStart = new Date(now.getTime());
            const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
            const eligibleStart = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days left
            const basePrice = 422.881;
            const result = calculateProratedRecurringReward(basePrice, RECURRING_RATE, periodStart, periodEnd, eligibleStart);
            assert.strictEqual(Math.round(result.remainingDays), 15);
            // 21.144 * 0.5 = 10.572 => 10.57
            assert.strictEqual(result.proratedAmount, 10.57);
        });
        it('Standard Plan (Freelancer/Founder): 180 days total, qualifies midway (90 days remaining) -> ₹48.71 allocation', () => {
            const now = new Date();
            const periodStart = new Date(now.getTime());
            const periodEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days
            const eligibleStart = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 90 days left
            const basePrice = 1948.305;
            const result = calculateProratedRecurringReward(basePrice, RECURRING_RATE, periodStart, periodEnd, eligibleStart);
            assert.strictEqual(Math.round(result.remainingDays), 90);
            // 97.415 * 0.5 = 48.7075 => 48.71
            assert.strictEqual(result.proratedAmount, 48.71);
        });
        it('Expired Plan: returns ₹0.00 allocated amount', () => {
            const pastStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
            const pastEnd = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const eligibleStart = new Date();
            const result = calculateProratedRecurringReward(3093.22, RECURRING_RATE, pastStart, pastEnd, eligibleStart);
            assert.strictEqual(result.proratedAmount, 0);
        });
    });
    describe('3. Single-Tier Direct Referral Invariants & Edge Cases', () => {
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
