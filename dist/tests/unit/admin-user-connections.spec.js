import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import adminUserConnectionsRouter from "../../routes/admin/admin-user-connections.routes.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { roleMiddleware } from "../../middlewares/role.middleware.js";
import { prisma } from "../../config/database.js";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
const app = express();
app.use(express.json());
app.use("/admin/user-connections", authMiddleware, roleMiddleware(["admin"]), adminUserConnectionsRouter);
vi.mock("../../config/database.js", () => {
    return {
        prisma: {
            $transaction: vi.fn(),
            connection: {
                count: vi.fn(),
                findMany: vi.fn(),
                findUnique: vi.fn(),
            },
            connectionInvitation: {
                count: vi.fn(),
                findMany: vi.fn(),
                findUnique: vi.fn(),
            },
            conversation: {
                findFirst: vi.fn(),
            },
            user: {
                findUnique: vi.fn(),
                findFirst: vi.fn(),
                count: vi.fn(),
                findMany: vi.fn().mockResolvedValue([]),
            },
            adminUser: {
                findFirst: vi.fn(),
            }
        }
    };
});
describe("Admin User Connections Management Module (Functional Verification)", () => {
    const adminToken = jwt.sign({ id: "admin-1", email: "admin@goexperts.in", type: "admin" }, env.JWT_SECRET || "test-secret");
    const userToken = jwt.sign({ id: "user-1", email: "free@goexperts.in", type: "portal" }, env.JWT_SECRET || "test-secret");
    beforeEach(() => {
        vi.clearAllMocks();
        prisma.adminUser.findFirst.mockResolvedValue({
            id: "admin-1",
            email: "admin@goexperts.in",
            status: "active",
            role: { name: "admin" }
        });
        prisma.user.findFirst.mockResolvedValue({
            id: "user-1",
            email: "free@goexperts.in",
            status: "ACTIVE",
            role: "freelancer"
        });
    });
    it("1. blocks unauthenticated requests to /admin/user-connections with 401", async () => {
        const res = await request(app).get("/admin/user-connections");
        expect(res.status).toBe(401);
    });
    it("2. blocks non-admin users from /admin/user-connections with 403 Forbidden", async () => {
        const res = await request(app)
            .get("/admin/user-connections")
            .set("Authorization", `Bearer ${userToken}`);
        expect(res.status).toBe(403);
    });
    it("3. GET /admin/user-connections/summary returns real dynamic counts without double-counting", async () => {
        prisma.connection.count.mockResolvedValueOnce(45);
        prisma.connectionInvitation.count
            .mockResolvedValueOnce(12) // PENDING
            .mockResolvedValueOnce(8) // REJECTED
            .mockResolvedValueOnce(45) // ACCEPTED
            .mockResolvedValueOnce(65) // TOTAL INVITATIONS
            .mockResolvedValueOnce(20) // Freelancer senders
            .mockResolvedValueOnce(15) // Client senders
            .mockResolvedValueOnce(18) // Founder senders
            .mockResolvedValueOnce(12); // Investor senders
        const res = await request(app)
            .get("/admin/user-connections/summary")
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.totalAcceptedConnections).toBe(45);
        expect(res.body.data.totalPendingInvitations).toBe(12);
        expect(res.body.data.totalRejectedInvitations).toBe(8);
        expect(res.body.data.totalSentInvitations).toBe(65);
        expect(res.body.data.totalReceivedInvitations).toBe(65);
        expect(res.body.data.rolesBreakdown.freelancers).toBe(20);
    });
    it("4. GET /admin/user-connections with tab=all accurately combines and paginates records", async () => {
        prisma.connection.count.mockResolvedValueOnce(10);
        prisma.connectionInvitation.count.mockResolvedValueOnce(15);
        const now = new Date();
        prisma.connection.findMany.mockResolvedValueOnce([
            {
                id: "conn-1",
                status: "ACTIVE",
                createdAt: new Date(now.getTime() - 1000),
                updatedAt: now,
                userOne: { id: "u1", fullName: "Alice", email: "alice@test.com", role: "freelancer", avatarUrl: null },
                userTwo: { id: "u2", fullName: "Bob", email: "bob@test.com", role: "client", avatarUrl: null }
            }
        ]);
        prisma.connectionInvitation.findMany.mockResolvedValueOnce([
            {
                id: "inv-1",
                status: "PENDING",
                firstMessage: "Hi Bob",
                createdAt: now,
                updatedAt: now,
                acceptedAt: null,
                rejectedAt: null,
                sender: { id: "u3", fullName: "Charlie", email: "charlie@test.com", role: "founder", avatarUrl: null },
                receiver: { id: "u4", fullName: "Dave", email: "dave@test.com", role: "investor", avatarUrl: null }
            }
        ]);
        const res = await request(app)
            .get("/admin/user-connections?page=1&limit=10&tab=all")
            .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.records.length).toBe(2);
        // Should be globally sorted by createdAt DESC: inv-1 (now) before conn-1 (now - 1000)
        expect(res.body.data.records[0].recordType).toBe("INVITATION");
        expect(res.body.data.records[1].recordType).toBe("CONNECTION");
        expect(res.body.data.pagination.total).toBe(25);
    });
    it("5. POST /admin/user-connections/selection/resolve resolves items across pages for export", async () => {
        prisma.connection.findMany.mockResolvedValueOnce([
            {
                id: "conn-1",
                status: "ACTIVE",
                createdAt: new Date(),
                userOne: { id: "u1", fullName: "Alice", email: "alice@test.com", role: "freelancer" },
                userTwo: { id: "u2", fullName: "Bob", email: "bob@test.com", role: "client" }
            }
        ]);
        prisma.connectionInvitation.findMany.mockResolvedValueOnce([
            {
                id: "inv-1",
                status: "PENDING",
                createdAt: new Date(),
                sender: { id: "u3", fullName: "Charlie", email: "charlie@test.com", role: "founder" },
                receiver: { id: "u4", fullName: "Dave", email: "dave@test.com", role: "investor" }
            }
        ]);
        const res = await request(app)
            .post("/admin/user-connections/selection/resolve")
            .set("Authorization", `Bearer ${adminToken}`)
            .send({ recordIds: ["conn-1", "inv-1"] });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.selectedCount).toBe(2);
        expect(res.body.data.items.length).toBe(2);
        expect(res.body.data.items[0].sender.fullName).toBe("Alice");
        expect(res.body.data.items[1].sender.fullName).toBe("Charlie");
    });
});
