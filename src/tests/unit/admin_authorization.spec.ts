import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import router from "../../routes/index.js";
import { errorMiddleware } from "../../middlewares/error.middleware.js";

const app = express();
app.use(express.json());
app.use(router);
app.use(errorMiddleware);
import { prisma } from "../../config/database.js";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

vi.mock("../../config/database.js", () => {
  return {
    prisma: {
      $transaction: vi.fn(),
      user: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
      adminUser: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn().mockResolvedValue([]), groupBy: vi.fn().mockResolvedValue([]) },
      proposal: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
      project: { findFirst: vi.fn() },
      subscriptionUsage: { upsert: vi.fn(), update: vi.fn() },
    }
  };
});

vi.mock("../../common/helpers/crud-factory.js", () => ({
  createCrudRouter: vi.fn(() => {
    const r = express.Router();
    r.all("*", (req, res) => res.status(200).json({ success: true, mocked: true }));
    return r;
  })
}));

vi.mock("../../services/mobile/email.service.js", () => ({
  sendAccountDeletedEmail: vi.fn(),
  sendKycDocumentStatusEmail: vi.fn(),
  sendAdminWalletCreditEmail: vi.fn(),
}));

describe("Admin Backend Complete Authorization Boundary (R3.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const generateToken = (payload: any) => jwt.sign(payload, env.JWT_SECRET || "test-secret");

  const portalRoles = ["freelancer", "client", "founder", "investor"];

  // 1. Unauthenticated Checks
  it("should block unauthenticated access across all admin namespaces", async () => {
    const endpoints = [
      { method: "get", path: "/admin/users" },
      { method: "get", path: "/admin/kyc/123" },
      { method: "get", path: "/admin/founders" },
      { method: "get", path: "/admin/investors" },
      { method: "get", path: "/admin/clients" },
      { method: "get", path: "/admin/freelancers" },
      { method: "post", path: "/admin/push-campaigns" }
    ];

    for (const ep of endpoints) {
      const res = await (request(app) as any)[ep.method](ep.path);
      expect(res.status).toBe(401);
    }
  });

  // 2. Portal User Rejection Checks (Freelancer, Client, Founder, Investor)
  for (const role of portalRoles) {
    describe(`Unauthorized Role Rejection: ${role.toUpperCase()}`, () => {
      let token: string;

      beforeEach(() => {
        token = generateToken({ id: "user-1", email: "user@test.com", type: "portal" });
        vi.mocked(prisma.user.findFirst).mockResolvedValue({
          id: "user-1",
          status: "active",
          role,
        } as any);
      });

      it("should block access to /admin/users", async () => {
        const res = await request(app).get("/admin/users/unread-counts").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block access to /admin/kyc", async () => {
        const res = await request(app).get("/admin/kyc/user-123").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block sensitive mutation: KYC Approval", async () => {
        const res = await request(app).patch("/admin/kyc/user-123").send({ key: "idFront", status: "APPROVED" }).set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block access to /admin/founders", async () => {
        const res = await request(app).get("/admin/founders").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block sensitive mutation: Founder Update", async () => {
        const res = await request(app).put("/admin/founders/user-123").send({ firstName: "Hack" }).set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block access to /admin/investors", async () => {
        const res = await request(app).get("/admin/investors").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block sensitive mutation: Investor Update", async () => {
        const res = await request(app).put("/admin/investors/user-123").send({ firstName: "Hack" }).set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block access to /admin/clients", async () => {
        const res = await request(app).get("/admin/clients").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block sensitive mutation: Client Update", async () => {
        const res = await request(app).put("/admin/clients/user-123").send({ firstName: "Hack" }).set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block access to /admin/freelancers", async () => {
        const res = await request(app).get("/admin/freelancers").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });

      it("should block sensitive mutation: Freelancer Update", async () => {
        const res = await request(app).put("/admin/freelancers/user-123").send({ firstName: "Hack" }).set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });
      
      it("should block access to /admin/push-campaigns", async () => {
        const res = await request(app).get("/admin/push-campaigns").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(403);
      });
    });
  }

  // 3. Authorized Admin/Super Admin Checks
  const adminRoles = ["admin"];

  for (const role of adminRoles) {
    describe(`Authorized Role Access: ${role.toUpperCase()}`, () => {
      let token: string;

      beforeEach(() => {
        token = generateToken({ id: "admin-1", email: "admin@test.com", type: "admin" });
        vi.mocked(prisma.adminUser.findFirst).mockResolvedValue({
          id: "admin-1",
          status: "active",
          role: { name: role }
        } as any);
        
        // Mock internal operations so we don't crash on Prisma calls inside the endpoint
        vi.mocked(prisma.user.findFirst).mockResolvedValue(null as any); 
      });

      it("should allow access to /admin/users", async () => {
        const res = await request(app).get("/admin/users/unread-counts").set("Authorization", `Bearer ${token}`);
        expect(res.status).toBe(200);
      });

      it("should allow access to /admin/founders", async () => {
        // Just verify it doesn't return 401 or 403 (might return 500 if prisma throws, but it passed the boundary)
        const res = await request(app).get("/admin/founders?page=1").set("Authorization", `Bearer ${token}`);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
      
      it("should allow access to /admin/investors", async () => {
        const res = await request(app).get("/admin/investors?page=1").set("Authorization", `Bearer ${token}`);
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
      });
    });
  }
});
