import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertAndConsumeActionQuota, rollbackActionUsage } from '../../services/subscription/entitlement.service.js';
import { prisma } from '../../config/database.js';

vi.mock('../../config/database.js', () => ({
  prisma: {
    subscription: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    subscriptionUsage: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn(),
    },
    plan: {
      findUnique: vi.fn(),
    }
  }
}));

describe('Offline Subscription Validation (MOCKED)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Freelancer proposal limits: should enforce limit and consume quota', async () => {
    // Mock valid subscription for findMany
    (prisma.subscription.findMany as any).mockResolvedValue([{
      id: 'sub-1',
      planId: 'plan-pro',
      status: 'active',
      validUntil: new Date(Date.now() + 86400000), // Future date
      endDate: new Date(Date.now() + 86400000),
      plan: { name: 'Pro Plan' },
      snapshot: { features: { freelancer_proposals: 12 }, quotas: { proposals: 12 }, validity: 'monthly' }
    }]);

    // Mock user with active subscription
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-1',
      subscriptions: [{
        id: 'sub-1',
        planId: 'plan-pro',
        status: 'active',
        startDate: new Date(Date.now() - 1000),
        endDate: new Date(Date.now() + 86400000),
        plan: { name: 'Pro Plan', planType: 'all_access' },
        snapshot: { features: { freelancer_proposals: 12 }, quotas: { proposals: 12 }, validity: 'monthly' }
      }]
    });

    (prisma.subscriptionUsage.findUnique as any).mockResolvedValue({
      id: 'usage-1',
      used: 2,
      total: 2
    });

    (prisma.subscriptionUsage.upsert as any).mockResolvedValue({
      id: 'usage-1',
      used: 3,
      total: 3
    });

    const result = await assertAndConsumeActionQuota('user-1', 'freelancer', 'submitProposal');
    expect(result.entitlement.isEntitled).toBe(true);
    expect(result.entitlement.quotaLimit).toBe(3);
  });

  it('Freelancer proposal limits: should throw when quota exhausted', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-1',
      subscriptions: [{
        id: 'sub-1',
        planId: 'plan-pro',
        status: 'active',
        startDate: new Date(Date.now() - 1000),
        endDate: new Date(Date.now() + 86400000),
        plan: { name: 'Pro Plan', planType: 'all_access' },
        snapshot: { features: { freelancer_proposals: 12 }, quotas: { proposals: 12 }, validity: 'monthly' }
      }]
    });

    (prisma.subscriptionUsage.findUnique as any).mockResolvedValue({
      id: 'usage-1',
      used: 12,
      total: 12 // Exact limit
    });

    await expect(assertAndConsumeActionQuota('user-1', 'freelancer', 'submitProposal'))
      .rejects.toThrow(/quota.*reached/i);
  });

  it('Saved-item integrity: Rollback should decrease quota', async () => {
    (prisma.subscriptionUsage.findUnique as any).mockResolvedValue({
      id: 'usage-1',
      used: 5,
      total: 5
    });
    
    (prisma.subscription.findMany as any).mockResolvedValue([{
      id: 'sub-1',
      planId: 'plan-pro',
      status: 'active',
      validUntil: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 86400000),
      plan: { name: 'Pro Plan' },
      snapshot: { features: { freelancer_projects_saved: 50 }, quotas: { proposals: 50 }, validity: 'monthly' }
    }]);

    (prisma.subscriptionUsage.upsert as any).mockResolvedValue({
      id: 'usage-1',
      used: 4,
      total: 4
    });

    await rollbackActionUsage('sub-1', 'saveProject');
    expect(prisma.subscriptionUsage.update).toHaveBeenCalled();
  });

  it('Subscription Expiration: should throw if validUntil is past', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 'user-1',
      subscriptions: [{
        id: 'sub-1',
        planId: 'plan-pro',
        status: 'active',
        startDate: new Date(Date.now() - 100000000),
        endDate: new Date(Date.now() - 86400000), // Past date
        plan: { name: 'Pro Plan', planType: 'all_access' },
        snapshot: { features: { freelancer_proposals: 12 }, quotas: { proposals: 12 }, validity: 'monthly' }
      }]
    });

    await expect(assertAndConsumeActionQuota('user-1', 'freelancer', 'submitProposal'))
      .rejects.toThrow(/active subscription/i);
  });
});
