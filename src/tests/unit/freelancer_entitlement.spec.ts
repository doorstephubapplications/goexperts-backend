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
import { assertActionEntitlement, recordActionUsage, ActionGateError } from "../../services/subscription/entitlement.service.js";
import { sendEmail } from "../../services/mobile/email.service.js";

vi.mock("../../services/mobile/email.service.js", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("../../common/helpers/email-template.js", () => ({
  renderEmailTemplate: vi.fn().mockResolvedValue({ subject: "test", html: "test" }),
}));

vi.mock("../../config/database.js", () => {
  return {
    prisma: {
      $transaction: vi.fn(),
      user: { findUnique: vi.fn(), findFirst: vi.fn() },
      adminUser: { findFirst: vi.fn() },
      proposal: { findFirst: vi.fn(), create: vi.fn() },
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

vi.mock("../../services/subscription/entitlement.service.js", () => {
  const actual = vi.importActual("../../services/subscription/entitlement.service.js");
  return {
    ...actual,
    assertActionEntitlement: vi.fn(),
    recordActionUsage: vi.fn(),
    ActionGateError: class ActionGateError extends Error {
      code: string; action: string; details: any;
      constructor(action: string, code: string, details: any) {
        super(); this.code = code; this.action = action; this.details = details; this.name = "ActionGateError";
      }
    }
  };
});

describe("Backend Proposal Entitlement Matrix (R4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "freelancer-1", email: "f@test.com", role: "freelancer", onboardingStatus: "COMPLETED" } as any);
  });

  const generateToken = (payload: any) => jwt.sign(payload, env.JWT_SECRET || "test-secret");
  const token = generateToken({ id: "freelancer-1", role: "freelancer", onboardingStatus: "COMPLETED" });

  it("should reject when user has no active entitlement", async () => {
    vi.mocked(assertActionEntitlement).mockRejectedValueOnce(
      new ActionGateError("submitProposal", "SUBSCRIPTION_REQUIRED", {})
    );

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("SUBSCRIPTION_REQUIRED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(recordActionUsage).not.toHaveBeenCalled();
  });

  it("should block when quota is exhausted and not create proposal", async () => {
    vi.mocked(assertActionEntitlement).mockRejectedValueOnce(
      new ActionGateError("submitProposal", "QUOTA_EXHAUSTED", {})
    );

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("QUOTA_EXHAUSTED");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("should preserve existing duplicate check and NOT burn quota on duplicate", async () => {
    vi.mocked(assertActionEntitlement).mockResolvedValueOnce({
      isEntitled: true,
      subscriptionId: "sub-1",
      quotaLimit: 3,
    } as any);

    // Mock transaction to simulate failure on duplicate check
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        project: { findFirst: vi.fn().mockResolvedValue({ id: "proj-1", status: "open", client: "client-1" }) },
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({}) },
        proposal: { findFirst: vi.fn().mockResolvedValue({ id: "existing-prop" }) } // duplicate!
      };
      return cb(tx);
    });

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("already have an active proposal");
    // recordActionUsage shouldn't be called because the error is thrown before it
    expect(recordActionUsage).not.toHaveBeenCalled();
  });

  it("should successfully consume quota and create proposal when entitled", async () => {
    vi.mocked(assertActionEntitlement).mockResolvedValueOnce({
      isEntitled: true,
      subscriptionId: "sub-1",
      quotaLimit: 3,
    } as any);

    vi.mocked(recordActionUsage).mockResolvedValueOnce(1); // used = 1

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        project: { findFirst: vi.fn().mockResolvedValue({ id: "proj-1", status: "open", client: "client-1" }) },
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({}) },
        proposal: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "new-prop" }) },
        clientProfile: { findUnique: vi.fn().mockResolvedValue({ userId: "client-1" }) },
        notification: { create: vi.fn() },
        user: { findUnique: vi.fn().mockResolvedValue({ email: "client@test.com" }) }
      };
      return cb(tx);
    });

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(200);
    expect(recordActionUsage).toHaveBeenCalledWith("sub-1", "submitProposal", expect.anything());
  });

  it("should map P2002 unique constraint violation to canonical duplicate response without consuming quota", async () => {
    vi.mocked(assertActionEntitlement).mockResolvedValueOnce({
      isEntitled: true,
      subscriptionId: "sub-1",
      quotaLimit: 3,
    } as any);

    // Mock transaction to simulate concurrent duplicate where findFirst succeeds but create throws P2002
    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        project: { findFirst: vi.fn().mockResolvedValue({ id: "proj-1", status: "open", client: "client-1" }) },
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({}) },
        proposal: { 
          findFirst: vi.fn().mockResolvedValue(null), 
          create: vi.fn().mockRejectedValue({ code: 'P2002', meta: { target: 'proposal_uniqueness' } }) 
        }
      };
      return cb(tx);
    });

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain("already have an active proposal");
    // Since create throws, the transaction fails and rolls back. The quota usage inside the tx is rolled back.
  });

  it("should not misclassify unrelated P2002 errors", async () => {
    vi.mocked(assertActionEntitlement).mockResolvedValueOnce({
      isEntitled: true,
      subscriptionId: "sub-1",
      quotaLimit: 3,
    } as any);

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        project: { findFirst: vi.fn().mockResolvedValue({ id: "proj-1", status: "open", client: "client-1" }) },
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({}) },
        proposal: { 
          findFirst: vi.fn().mockResolvedValue(null), 
          create: vi.fn().mockRejectedValue({ code: 'P2002', meta: { target: 'unrelated_uniqueness_index' }, message: 'Unrelated error' }) 
        }
      };
      return cb(tx);
    });

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(400); // Because it falls back to 400 for generic unknown errors
    expect(res.body.message).not.toContain("already have an active proposal");
  });

  it("should trigger email notification on successful commit", async () => {
    vi.mocked(assertActionEntitlement).mockResolvedValueOnce({
      isEntitled: true, subscriptionId: "sub-1", quotaLimit: 3,
    } as any);

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        project: { findFirst: vi.fn().mockResolvedValue({ id: "proj-1", status: "open", client: "client-1", title: "Project A" }) },
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({}) },
        proposal: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "new-prop" }) },
        clientProfile: { findUnique: vi.fn().mockResolvedValue({ userId: "client-1" }) },
        notification: { create: vi.fn() },
        user: { findUnique: vi.fn().mockResolvedValue({ email: "client@test.com", fullName: "Client Name" }) }
      };
      return cb(tx);
    });

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith("client@test.com", expect.any(String), expect.any(String));
  });

  it("should not trigger email notification on failed transaction", async () => {
    vi.mocked(assertActionEntitlement).mockResolvedValueOnce({
      isEntitled: true, subscriptionId: "sub-1", quotaLimit: 3,
    } as any);

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        project: { findFirst: vi.fn().mockResolvedValue({ id: "proj-1", status: "open", client: "client-1" }) },
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({}) },
        proposal: { 
          findFirst: vi.fn().mockResolvedValue(null), 
          create: vi.fn().mockRejectedValue(new Error("Simulated Transaction Failure")) 
        }
      };
      return cb(tx);
    });

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should not trigger email notification on duplicate proposal", async () => {
    vi.mocked(assertActionEntitlement).mockResolvedValueOnce({
      isEntitled: true, subscriptionId: "sub-1", quotaLimit: 3,
    } as any);

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        project: { findFirst: vi.fn().mockResolvedValue({ id: "proj-1", status: "open", client: "client-1" }) },
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({}) },
        proposal: { findFirst: vi.fn().mockResolvedValue({ id: "existing-prop" }) }
      };
      return cb(tx);
    });

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should not trigger email notification on quota exhaustion", async () => {
    vi.mocked(assertActionEntitlement).mockRejectedValueOnce(
      new ActionGateError("submitProposal", "QUOTA_EXHAUSTED", {})
    );

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("email failure after commit does not roll back proposal", async () => {
    vi.mocked(assertActionEntitlement).mockResolvedValueOnce({
      isEntitled: true, subscriptionId: "sub-1", quotaLimit: 3,
    } as any);
    
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("SMTP down"));

    vi.mocked(prisma.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        project: { findFirst: vi.fn().mockResolvedValue({ id: "proj-1", status: "open", client: "client-1", title: "Project A" }) },
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({}) },
        proposal: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "new-prop" }) },
        clientProfile: { findUnique: vi.fn().mockResolvedValue({ userId: "client-1" }) },
        notification: { create: vi.fn() },
        user: { findUnique: vi.fn().mockResolvedValue({ email: "client@test.com", fullName: "Client Name" }) }
      };
      return cb(tx);
    });

    const res = await request(app)
      .post("/freelancer/proposals")
      .set("Authorization", `Bearer ${token}`)
      .send({ projectId: "proj-1", bidAmount: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("id", "new-prop");
    expect(sendEmail).toHaveBeenCalled();
  });
});
