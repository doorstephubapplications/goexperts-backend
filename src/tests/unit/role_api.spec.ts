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

vi.mock('../../routes/index.js', () => ({
  default: {},
}));

vi.mock('../../routes/auth/auth.routes.js', () => ({
  default: {},
}));

import { switchRole } from '../../controllers/auth/auth.controller.js';
import { prisma } from '../../config/database.js';

vi.mock('../../config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('Role API Contracts - switchRole', () => {
  let req: any;
  let res: any;

  beforeEach(() => {
    req = {
      user: { id: 'user_1', role: 'freelancer' },
      body: { role: 'investor' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('allows switching to an active secondary role without issuing new JWT', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: [{ role: 'investor', status: 'active' }]
    });

    await switchRole(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        activeWorkspace: 'investor',
      }),
    }));
    // Does not issue JWT
    const callArgs = res.json.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('token');
  });

  it('denies switching to an inactive secondary role', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: [{ role: 'investor', status: 'inactive' }]
    });

    await switchRole(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ROLE_NOT_ENTITLED',
    }));
  });

  it('allows switching back to primary role', async () => {
    req.body.role = 'freelancer'; // user is freelancer
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: []
    });

    await switchRole(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        activeWorkspace: 'freelancer',
      })
    }));
  });
});
