import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgres://mock',
    JWT_SECRET: 'mock-jwt-secret-key',
    JWT_REFRESH_SECRET: 'mock-jwt-refresh-secret',
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:8080'
  }
}));

vi.mock('../../routes/index.js', () => ({ default: {} }));
vi.mock('../../routes/auth/auth.routes.js', () => ({ default: {} }));

import { getConversationMessages } from '../../controllers/messages/messages.controller.js';
import { prisma } from '../../config/database.js';

vi.mock('../../config/database.js', () => ({
  prisma: {
    conversation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    message: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    }
  },
}));

describe('Messaging Resource Ownership', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      user: { id: 'user_1', role: 'freelancer' },
      params: { id: 'conv_1' },
      body: { content: 'hello' },
      query: {}
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('allows access if user is a participant', async () => {
    (prisma.conversation.findUnique as any).mockResolvedValue({
      id: 'conv_1',
      userA: 'user_1',
      userB: 'user_2'
    });
    (prisma.message.findMany as any).mockResolvedValue([]);

    await getConversationMessages(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
    }));
  });

  it('denies access if user is not a participant', async () => {
    (prisma.conversation.findUnique as any).mockResolvedValue({
      id: 'conv_1',
      userA: 'user_2',
      userB: 'user_3' // user_1 is not a participant
    });

    await getConversationMessages(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Access denied'
    }));
  });

  it('returns 404 for missing conversation', async () => {
    (prisma.conversation.findUnique as any).mockResolvedValue(null);

    await getConversationMessages(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
