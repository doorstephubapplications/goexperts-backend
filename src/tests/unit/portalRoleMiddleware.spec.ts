import { describe, it, expect, vi, beforeEach } from 'vitest';
import { portalRoleMiddleware } from '../../middlewares/role.middleware.js';

// Mock dependencies imported dynamically inside the middleware
vi.mock('../../controllers/auth/auth.controller.js', () => ({
  resolveUserTeamMembership: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../../config/database.js';

describe('portalRoleMiddleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      path: '/api/test',
      user: {
        id: 'user_1',
        email: 'test@example.com',
        role: 'freelancer', // primary role
        activeWorkspace: 'freelancer',
        type: 'portal',
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('1. Primary role without workspace header - allowed when permitted by route', async () => {
    req.user.activeWorkspace = undefined; // No header fallback to primary role
    const middleware = portalRoleMiddleware(['freelancer']);
    
    // Mock prisma response
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: [],
    });

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('2. Primary role with matching header - allowed', async () => {
    req.user.activeWorkspace = 'freelancer';
    const middleware = portalRoleMiddleware(['freelancer']);
    
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: [],
    });

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('3. Unauthorized secondary role - denied', async () => {
    req.user.activeWorkspace = 'founder';
    const middleware = portalRoleMiddleware(['founder']);
    
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer', // only has freelancer
      userRoles: [],
    });

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ROLE_NOT_ACTIVATED',
    }));
  });

  it('4. Active additional membership - allowed when permitted by route', async () => {
    req.user.activeWorkspace = 'founder';
    const middleware = portalRoleMiddleware(['founder']);
    
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: [
        { role: 'founder', status: 'active' }
      ],
    });

    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('5. Inactive additional membership - denied', async () => {
    req.user.activeWorkspace = 'founder';
    const middleware = portalRoleMiddleware(['founder']);
    
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: [
        { role: 'founder', status: 'inactive' }
      ],
    });

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ROLE_NOT_ACTIVATED',
    }));
  });

  it('6. Missing membership - denied', async () => {
    req.user.activeWorkspace = 'investor';
    const middleware = portalRoleMiddleware(['freelancer', 'investor']);
    
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: [], // Missing investor membership
    });

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ROLE_NOT_ACTIVATED',
    }));
  });

  it('7. Invalid workspace - denied', async () => {
    req.user.activeWorkspace = 'invalid_role';
    const middleware = portalRoleMiddleware(['freelancer']);

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'WORKSPACE_MISMATCH',
    }));
  });

  it('8. Workspace not permitted by route - denied', async () => {
    req.user.activeWorkspace = 'investor';
    const middleware = portalRoleMiddleware(['founder']); // route only allows founder

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'WORKSPACE_MISMATCH',
    }));
  });

  it('9. Database lookup failure - fail closed', async () => {
    req.user.activeWorkspace = 'founder';
    const middleware = portalRoleMiddleware(['founder']);
    
    (prisma.user.findUnique as any).mockRejectedValue(new Error('DB connection failed'));

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('Forbidden'),
    }));
  });

  it('10. Profile existing without active UserRole - denied', async () => {
    req.user.activeWorkspace = 'founder';
    const middleware = portalRoleMiddleware(['founder']);
    
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      founderProfile: { id: 'some_id' }, // Has profile but NO active userRoles
      userRoles: [],
    });

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ROLE_NOT_ACTIVATED',
    }));
  });

  it('11. Shared messaging route authorization prevents impersonation', async () => {
    req.path = '/api/messages'; // Shared route
    req.user.activeWorkspace = 'founder';
    const middleware = portalRoleMiddleware(['freelancer', 'client', 'founder', 'investor']);
    
    (prisma.user.findUnique as any).mockResolvedValue({
      role: 'freelancer',
      userRoles: [], // Does NOT own founder workspace
    });

    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ROLE_NOT_ACTIVATED',
    }));
  });
});
