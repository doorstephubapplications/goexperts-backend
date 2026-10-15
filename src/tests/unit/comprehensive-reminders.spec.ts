import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  resolveRoleRoute, 
  resolveKycRoute, 
  evaluateUserRoleEligibility 
} from '../../services/notifications/reminder-eligibility.service.js';
import { 
  buildIdempotencyKey, 
  hasReminderBeenSent 
} from '../../services/notifications/reminder-tracking.service.js';
import { evaluateSchedulerInstance } from '../../config/scheduler-guard.js';

describe('Phase 3.1 Comprehensive Production Safety Tests', () => {

  describe('1. Role & KYC Route Resolvers', () => {
    it('correctly maps Freelancer, Client, Founder, and Investor profile routes', () => {
      expect(resolveRoleRoute('freelancer')).toBe('/dashboard/profile');
      expect(resolveRoleRoute('client')).toBe('/business/profile');
      expect(resolveRoleRoute('founder')).toBe('/founder/profile');
      expect(resolveRoleRoute('investor')).toBe('/investor/profile');
      expect(resolveRoleRoute('unknown')).toBe('/dashboard/profile'); // Fallback
    });

    it('correctly maps all 4 KYC verification routes', () => {
      expect(resolveKycRoute('freelancer')).toBe('/dashboard/verification');
      expect(resolveKycRoute('client')).toBe('/business/verification');
      expect(resolveKycRoute('founder')).toBe('/founder/verification');
      expect(resolveKycRoute('investor')).toBe('/investor/verification');
    });
  });

  describe('2. Deterministic Idempotency & Concurrency Safety', () => {
    it('guarantees unique keys across users, roles, categories, milestones, and channels', () => {
      const u1Email = buildIdempotencyKey({
        userId: 'u1',
        role: 'freelancer',
        category: 'PROFILE_COMPLETION',
        milestone: '24h',
        channel: 'email',
      });

      const u1InApp = buildIdempotencyKey({
        userId: 'u1',
        role: 'freelancer',
        category: 'PROFILE_COMPLETION',
        milestone: '24h',
        channel: 'in_app',
      });

      const u1KycEmail = buildIdempotencyKey({
        userId: 'u1',
        role: 'freelancer',
        category: 'KYC_ACTION',
        milestone: '24h',
        channel: 'email',
      });

      const u2FounderEmail = buildIdempotencyKey({
        userId: 'u2',
        role: 'founder',
        category: 'PROFILE_COMPLETION',
        milestone: '24h',
        channel: 'email',
      });

      expect(u1Email).toBe('u1_freelancer_PROFILE_COMPLETION_24h_email_initial');
      expect(u1InApp).toBe('u1_freelancer_PROFILE_COMPLETION_24h_in_app_initial');
      expect(u1KycEmail).toBe('u1_freelancer_KYC_ACTION_24h_email_initial');
      expect(u2FounderEmail).toBe('u2_founder_PROFILE_COMPLETION_24h_email_initial');

      // Assert complete distinctness
      const keys = [u1Email, u1InApp, u1KycEmail, u2FounderEmail];
      const uniqueSet = new Set(keys);
      expect(uniqueSet.size).toBe(4);
    });
  });

  describe('3. Scheduler Cluster Singleton Guard Safety', () => {
    it('allows execution on PM2 instance 0 and standalone mode', () => {
      const pm2Zero = evaluateSchedulerInstance({ NODE_APP_INSTANCE: '0' });
      expect(pm2Zero.isPrimary).toBe(true);
      expect(pm2Zero.reason).toContain('instance 0');

      const standalone = evaluateSchedulerInstance({});
      expect(standalone.isPrimary).toBe(true);
      expect(standalone.reason).toContain('Standalone');
    });

    it('strictly blocks secondary PM2 cluster instances (instances 1, 2, 3...)', () => {
      const pm2Inst1 = evaluateSchedulerInstance({ NODE_APP_INSTANCE: '1' });
      expect(pm2Inst1.isPrimary).toBe(false);
      expect(pm2Inst1.reason).toContain('schedulers bypassed');

      const pm2Inst2 = evaluateSchedulerInstance({ NODE_APP_INSTANCE: '2' });
      expect(pm2Inst2.isPrimary).toBe(false);
    });

    it('honors explicit ENABLE_SCHEDULER overrides regardless of cluster instance', () => {
      const disabledZero = evaluateSchedulerInstance({ NODE_APP_INSTANCE: '0', ENABLE_SCHEDULER: 'false' });
      expect(disabledZero.isPrimary).toBe(false);

      const forcedSecondary = evaluateSchedulerInstance({ NODE_APP_INSTANCE: '1', ENABLE_SCHEDULER: 'true' });
      expect(forcedSecondary.isPrimary).toBe(true);
    });
  });

});