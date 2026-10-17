import { describe, it, expect } from 'vitest';
import { resolveRoleRoute, resolveKycRoute } from '../../services/notifications/reminder-eligibility.service.js';
import { buildIdempotencyKey } from '../../services/notifications/reminder-tracking.service.js';
describe('Profile Completion & KYC Reminder Services', () => {
    it('correctly maps roles to existing dashboard profile routes', () => {
        expect(resolveRoleRoute('freelancer')).toBe('/dashboard/profile');
        expect(resolveRoleRoute('client')).toBe('/business/profile');
        expect(resolveRoleRoute('founder')).toBe('/founder/profile');
        expect(resolveRoleRoute('investor')).toBe('/investor/profile');
    });
    it('correctly maps roles to existing KYC routes', () => {
        expect(resolveKycRoute('freelancer')).toBe('/dashboard/verification');
        expect(resolveKycRoute('client')).toBe('/business/verification');
        expect(resolveKycRoute('founder')).toBe('/founder/verification');
        expect(resolveKycRoute('investor')).toBe('/investor/verification');
    });
    it('builds unique deterministic idempotency keys preventing duplicates across channels and milestones', () => {
        const keyEmail = buildIdempotencyKey({
            userId: 'usr_123',
            role: 'founder',
            category: 'PROFILE_COMPLETION',
            milestone: '24h',
            channel: 'email',
        });
        const keyInApp = buildIdempotencyKey({
            userId: 'usr_123',
            role: 'founder',
            category: 'PROFILE_COMPLETION',
            milestone: '24h',
            channel: 'in_app',
        });
        expect(keyEmail).toBe('usr_123_founder_PROFILE_COMPLETION_24h_email_initial');
        expect(keyInApp).toBe('usr_123_founder_PROFILE_COMPLETION_24h_in_app_initial');
        expect(keyEmail).not.toBe(keyInApp);
    });
});
