import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// Mock database config before imports
vi.mock("../../config/database.js", () => {
  const mockPrisma = {
    pushCampaign: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn()
    },
    pushCampaignHistory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn()
    },
    pushScheduleSetting: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({})
    },
    setting: {
      findUnique: vi.fn(),
      upsert: vi.fn()
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn()
    },
    notificationPreference: {
      findMany: vi.fn()
    },
    deviceToken: {
      findMany: vi.fn(),
      updateMany: vi.fn()
    },
    notification: {
      create: vi.fn(),
      groupBy: vi.fn()
    }
  };
  return { prisma: mockPrisma };
});

// Mock mobile push service
vi.mock("../../services/mobile/push.service.js", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(true)
}));

import { prisma } from "../../config/database.js";
import { sendPushNotification } from "../../services/mobile/push.service.js";
import { adminPushCampaignsRouter } from "../../routes/admin/admin-push-campaigns.routes.js";
import {
  normalizeTargetRole,
  normalizeCampaignType,
  validateDeepLink,
  validateCampaignPayload,
  buildNotificationPreview
} from "../../services/notifications/push-campaign-validator.js";
import {
  dispatchCampaign,
  dispatchDirectCampaign,
  executeScheduledSlot,
  calculateEligibleAudience,
  DEFAULT_WEEKLY_SCHEDULES
} from "../../services/notifications/push-campaign-engine.service.js";
import {
  getFestivalOccasions,
  findActiveOccasionsForDate,
  checkAndDispatchDailyFestivals,
  seedFestivalCalendar,
  createFestivalOccasion
} from "../../services/notifications/festival-campaign.service.js";

const app = express();
app.use(express.json());
app.use("/admin/push-campaigns", adminPushCampaignsRouter);

describe("GoExperts Automated Push Campaign Management System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. VALIDATION, DEEP LINKS, AND CONTENT PREVIEWS
  // =========================================================================
  describe("1. Validation, Deep Links & Previews", () => {
    it("should accept valid GoExperts deep links and normalize relative paths", () => {
      const valid1 = validateDeepLink("/freelancer/projects?filter=recent");
      expect(valid1.isValid).toBe(true);
      expect(valid1.normalizedLink).toBe("/freelancer/projects?filter=recent");

      const valid2 = validateDeepLink("https://goexperts.in/client/dashboard");
      expect(valid2.isValid).toBe(true);
      expect(valid2.normalizedLink).toBe("/client/dashboard");
    });

    it("should reject malicious or arbitrary external URLs as deep links", () => {
      const malicious1 = validateDeepLink("javascript:alert(1)");
      expect(malicious1.isValid).toBe(false);
      expect(malicious1.error).toContain("Unsafe deep link");

      const externalDomain = validateDeepLink("https://malicious-phishing.com/login");
      expect(externalDomain.isValid).toBe(false);
      expect(externalDomain.error).toContain("External arbitrary domain");
    });

    it("should correctly validate and sanitize campaign form payload with an image", () => {
      const input = {
        name: "Morning Boost 1",
        title: "Exclusive Tech Gigs Available",
        description: "Submit your proposals before slots fill up today!",
        imageUrl: "https://images.unsplash.com/photo-1517245386807?w=600",
        deepLink: "/freelancer/projects",
        role: "FREELANCER"
      };
      const res = validateCampaignPayload(input);
      expect(res.isValid).toBe(true);
      expect(res.sanitized.name).toBe("Morning Boost 1");
      expect(res.sanitized.targetRole).toBe("FREELANCER");
      expect(res.sanitized.imageUrl).toBe(input.imageUrl);
    });

    it("should correctly validate text-only campaigns without an image", () => {
      const input = {
        title: "Platform System Maintenance Notice",
        description: "Brief scheduled maintenance tonight from 2 AM to 3 AM IST.",
        role: "ALL"
      };
      const res = validateCampaignPayload(input);
      expect(res.isValid).toBe(true);
      expect(res.sanitized.imageUrl).toBeNull();
      expect(res.sanitized.targetRole).toBe("ALL");
    });

    it("should generate rich previews for Android and iOS notification cards", () => {
      const preview = buildNotificationPreview({
        title: "New Project Match",
        description: "A client posted a project matching your React skills.",
        imageUrl: "https://example.com/banner.jpg",
        targetRole: "FREELANCER",
        deepLink: "/freelancer/projects"
      });
      expect(preview.title).toBe("New Project Match");
      expect(preview.androidPreview.appName).toBe("GoExperts");
      expect(preview.androidPreview.actions.length).toBeGreaterThan(0);
      expect(preview.iosPreview.subtitle).toBe("GoExperts Official");
    });
  });

  // =========================================================================
  // 2. ROLE SELECTION & ALL ROLES INTERPRETATION
  // =========================================================================
  describe("2. Role Selection & All Roles Behaviour", () => {
    it("should interpret missing, empty, or undefined role as ALL (All Roles targeting)", () => {
      expect(normalizeTargetRole(undefined)).toBe("ALL");
      expect(normalizeTargetRole(null)).toBe("ALL");
      expect(normalizeTargetRole("")).toBe("ALL");
      expect(normalizeTargetRole("   ")).toBe("ALL");
      expect(normalizeTargetRole("ALL")).toBe("ALL");
      expect(normalizeTargetRole("All Roles")).toBe("ALL");
    });

    it("should map specific role identifiers accurately without duplicate definitions", () => {
      expect(normalizeTargetRole("freelancer")).toBe("FREELANCER");
      expect(normalizeTargetRole("FREELANCERS")).toBe("FREELANCER");
      expect(normalizeTargetRole("client")).toBe("CLIENT");
      expect(normalizeTargetRole("customers")).toBe("CLIENT");
      expect(normalizeTargetRole("Startup Idea Creator")).toBe("FOUNDER");
      expect(normalizeTargetRole("founder")).toBe("FOUNDER");
      expect(normalizeTargetRole("investor")).toBe("INVESTOR");
    });
  });

  // =========================================================================
  // 3. CAMPAIGN CRUD & REST API ENDPOINTS
  // =========================================================================
  describe("3. Campaign Management CRUD API", () => {
    it("POST /admin/push-campaigns should create campaign with All Roles if role is empty", async () => {
      const mockCreated = {
        id: "camp-101",
        title: "Welcome All Roles Announcement",
        description: "Welcome to GoExperts! Explore top opportunities.",
        targetRole: "ALL",
        status: "ACTIVE",
        deepLink: "/dashboard"
      };
      (prisma.pushCampaign.create as any).mockResolvedValue(mockCreated);

      const res = await request(app)
        .post("/admin/push-campaigns")
        .send({
          name: "All Roles Welcome",
          title: "Welcome All Roles Announcement",
          description: "Welcome to GoExperts! Explore top opportunities."
          // role omitted intentionally
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.targetRole).toBe("ALL");
      expect(prisma.pushCampaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            targetRole: "ALL"
          })
        })
      );
    });

    it("POST /admin/push-campaigns should reject payloads missing required title or description", async () => {
      const res = await request(app)
        .post("/admin/push-campaigns")
        .send({
          title: ""
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it("PUT /admin/push-campaigns/:id should update campaign content safely", async () => {
      (prisma.pushCampaign.findFirst as any).mockResolvedValue({
        id: "camp-101",
        title: "Old Title",
        description: "Old description",
        targetRole: "FREELANCER",
        status: "ACTIVE"
      });
      (prisma.pushCampaign.update as any).mockResolvedValue({
        id: "camp-101",
        title: "Updated Title for Freelancers",
        description: "Updated fresh message",
        targetRole: "FREELANCER",
        status: "ACTIVE"
      });

      const res = await request(app)
        .put("/admin/push-campaigns/camp-101")
        .send({
          title: "Updated Title for Freelancers",
          description: "Updated fresh message"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Updated Title for Freelancers");
    });

    it("PATCH /admin/push-campaigns/:id/status should toggle or set status safely without backlogs", async () => {
      (prisma.pushCampaign.findFirst as any).mockResolvedValue({
        id: "camp-101",
        status: "ACTIVE"
      });
      (prisma.pushCampaign.update as any).mockResolvedValue({
        id: "camp-101",
        status: "PAUSED"
      });

      const res = await request(app)
        .patch("/admin/push-campaigns/camp-101/status")
        .send({ status: "INACTIVE" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PAUSED");
      expect(res.body.message).toContain("deactivated");
    });

    it("DELETE /admin/push-campaigns/:id should perform safe soft deletion", async () => {
      (prisma.pushCampaign.findFirst as any).mockResolvedValue({
        id: "camp-101",
        deletedAt: null
      });
      (prisma.pushCampaign.update as any).mockResolvedValue({
        id: "camp-101",
        deletedAt: new Date(),
        status: "DELETED"
      });

      const res = await request(app)
        .delete("/admin/push-campaigns/camp-101");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(prisma.pushCampaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "camp-101" },
          data: expect.objectContaining({ status: "DELETED" })
        })
      );
    });

    it("GET /admin/push-campaigns/audience/calculate should return eligible audience metrics", async () => {
      (prisma.user.findMany as any).mockResolvedValue([
        { id: "u-1", role: "freelancer", fullName: "Alice Developer" },
        { id: "u-2", role: "freelancer", fullName: "Bob Engineer" }
      ]);
      (prisma.user.count as any).mockResolvedValue(2);
      (prisma.notificationPreference.findMany as any).mockResolvedValue([]);
      (prisma.deviceToken.findMany as any).mockResolvedValue([
        { userId: "u-1" },
        { userId: "u-2" }
      ]);

      const res = await request(app)
        .get("/admin/push-campaigns/audience/calculate?role=FREELANCER");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.eligibleRecipientsCount).toBe(2);
      expect(res.body.data.pushEnabledUsers).toBe(2);
    });
  });

  // =========================================================================
  // 4. AUTOMATED WEEKLY SCHEDULING (WEEKDAYS 9 AM, WEEKENDS 9 AM, 2:30 PM, 9 PM)
  // =========================================================================
  describe("4. Automated Weekly Scheduling Engine", () => {
    it("should define standard weekly schedules matching product requirements", () => {
      expect(DEFAULT_WEEKLY_SCHEDULES).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slotKey: "weekday_morning", time: "09:00" }),
          expect.objectContaining({ slotKey: "weekend_morning", time: "09:00" }),
          expect.objectContaining({ slotKey: "weekend_afternoon", time: "14:30" }),
          expect.objectContaining({ slotKey: "weekend_night", time: "21:00" })
        ])
      );
    });

    it("executeScheduledSlot should prevent double-execution for the same occurrence key", async () => {
      // Simulate that this slot was already dispatched today
      (prisma.pushCampaignHistory.findFirst as any).mockResolvedValue({
        id: "hist-1",
        slotName: "2026-10-17_WEEKDAY_MORNING",
        sentAt: new Date()
      });

      const res = await executeScheduledSlot("weekday_morning", false);
      expect(res.success).toBe(false);
      expect(res.skipped).toBe(true);
      expect(res.message).toContain("already executed");
    });

    it("executeScheduledSlot should rotate and select active campaign with lowest sendCount", async () => {
      (prisma.pushCampaignHistory.findFirst as any).mockResolvedValue(null);
      (prisma.pushScheduleSetting.findUnique as any).mockResolvedValue({
        slotKey: "weekend_afternoon",
        isEnabled: true,
        targetRole: "FREELANCER"
      });

      // Campaign to be selected
      const mockCamp = {
        id: "camp-fresh-1",
        title: "Weekend High Budget Gig",
        description: "Verified clients posted fresh gigs.",
        targetRole: "FREELANCER",
        status: "ACTIVE",
        sendCount: 0,
        lastSentAt: null
      };
      (prisma.pushCampaign.findFirst as any).mockResolvedValue(mockCamp);
      (prisma.pushCampaign.findUnique as any).mockResolvedValue(mockCamp);

      // Users
      (prisma.user.findMany as any).mockResolvedValue([
        { id: "u-1", role: "freelancer", fullName: "Dev John" }
      ]);
      (prisma.notificationPreference.findMany as any).mockResolvedValue([]);
      (prisma.notification.groupBy as any).mockResolvedValue([]);
      (prisma.deviceToken.findMany as any).mockResolvedValue([
        { userId: "u-1", token: "fcm-token-123" }
      ]);
      (prisma.pushCampaign.update as any).mockResolvedValue({});
      (prisma.pushCampaignHistory.create as any).mockResolvedValue({ id: "hist-created" });

      const res = await executeScheduledSlot("weekend_afternoon", false);
      expect(res.success).toBe(true);
      expect(prisma.pushCampaign.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([
            { sendCount: "asc" },
            { lastSentAt: "asc" }
          ])
        })
      );
    });
  });

  // =========================================================================
  // 5. FESTIVAL & INTERNATIONAL OBSERVANCE AUTOMATED ENGINE
  // =========================================================================
  describe("5. Automated Festival & Observance Engine", () => {
    it("should identify fixed Gregorian festivals (e.g. Republic Day 01-26, Independence Day 08-15)", async () => {
      (prisma.setting.findUnique as any).mockResolvedValue(null);

      const republicDay = new Date("2026-01-26T09:00:00+05:30");
      const matched = await findActiveOccasionsForDate(republicDay);
      expect(matched.length).toBeGreaterThan(0);
      expect(matched[0].name).toContain("Republic Day");
    });

    it("should identify verified yearly dates for fluctuating lunar festivals (e.g. Holi 2026-03-04, Diwali 2026-11-08)", async () => {
      (prisma.setting.findUnique as any).mockResolvedValue(null);

      const holi2026 = new Date("2026-03-04T09:00:00+05:30");
      const matchedHoli = await findActiveOccasionsForDate(holi2026);
      expect(matchedHoli.some((m) => m.name.includes("Holi"))).toBe(true);

      const diwali2026 = new Date("2026-11-08T09:00:00+05:30");
      const matchedDiwali = await findActiveOccasionsForDate(diwali2026);
      expect(matchedDiwali.some((m) => m.name.includes("Diwali"))).toBe(true);
    });

    it("checkAndDispatchDailyFestivals should dispatch festival campaign automatically and prevent duplicates", async () => {
      (prisma.setting.findUnique as any).mockResolvedValue(null);

      // Simulate Republic Day
      const republicDay = new Date("2026-01-26T09:00:00+05:30");
      (prisma.pushCampaignHistory.findFirst as any).mockResolvedValue(null); // not sent yet

      (prisma.user.findMany as any).mockResolvedValue([
        { id: "u-1", role: "freelancer", fullName: "Citizen One" }
      ]);
      (prisma.notificationPreference.findMany as any).mockResolvedValue([]);
      (prisma.notification.groupBy as any).mockResolvedValue([]);
      (prisma.deviceToken.findMany as any).mockResolvedValue([
        { userId: "u-1", token: "tok-1" }
      ]);
      (prisma.pushCampaignHistory.create as any).mockResolvedValue({ id: "hist-festival" });

      const dispatchResult = await checkAndDispatchDailyFestivals(republicDay);
      expect(dispatchResult.executed).toBe(true);
      expect(dispatchResult.occasionsDispatched.length).toBeGreaterThan(0);
    });

    it("should suppress routine scheduled morning slot if festival greeting was dispatched today (collision rule)", async () => {
      (prisma.setting.findUnique as any).mockResolvedValue(null);

      // On Republic Day
      const republicDay = new Date("2026-01-26T09:00:00+05:30");
      const res = await executeScheduledSlot("weekday_morning", false, republicDay);
      // Because Republic Day is today, routine slot should be suppressed
      expect(res.festivalCollision).toBe(true);
      expect(res.suppressed).toBe(true);
    });
  });

  // =========================================================================
  // 6. MULTI-ROLE DEDUPLICATION, OPT-OUTS, & FREQUENCY LIMITS
  // =========================================================================
  describe("6. Multi-Role, Opt-Outs & Frequency Safeguards", () => {
    it("should deduplicate users with multiple roles so they receive only one notification per campaign", async () => {
      const mockCamp = {
        id: "camp-all-roles",
        title: "Platform Milestone",
        description: "Exciting updates for all users.",
        targetRole: "ALL",
        status: "ACTIVE"
      };
      (prisma.pushCampaign.findUnique as any).mockResolvedValue(mockCamp);

      // Query returns candidate users with duplicate user IDs (representing multiple roles)
      (prisma.user.findMany as any).mockResolvedValue([
        { id: "user-alpha", role: "freelancer", fullName: "Alpha" },
        { id: "user-alpha", role: "client", fullName: "Alpha" }
      ]);
      (prisma.notificationPreference.findMany as any).mockResolvedValue([]);
      (prisma.notification.groupBy as any).mockResolvedValue([]);
      (prisma.deviceToken.findMany as any).mockResolvedValue([
        { userId: "user-alpha", token: "device-tok-alpha" }
      ]);
      (prisma.pushCampaign.update as any).mockResolvedValue({});
      (prisma.pushCampaignHistory.create as any).mockResolvedValue({});

      const result = await dispatchCampaign("camp-all-roles", "TEST_DISPATCH");
      expect(result.recipientsCount).toBe(1); // exactly 1 recipient despite multiple roles
      expect(sendPushNotification).toHaveBeenCalledTimes(1);
    });

    it("should suppress users who opted out of push notifications in NotificationPreference", async () => {
      const mockCamp = {
        id: "camp-opt-out",
        title: "Deal Alert",
        description: "Special deal today.",
        targetRole: "ALL",
        status: "ACTIVE"
      };
      (prisma.pushCampaign.findUnique as any).mockResolvedValue(mockCamp);

      (prisma.user.findMany as any).mockResolvedValue([
        { id: "user-opted-out", role: "client", fullName: "Opted Out User" }
      ]);
      // User has pushEnabled: false
      (prisma.notificationPreference.findMany as any).mockResolvedValue([
        { userId: "user-opted-out", pushEnabled: false }
      ]);
      (prisma.notification.groupBy as any).mockResolvedValue([]);
      (prisma.deviceToken.findMany as any).mockResolvedValue([
        { userId: "user-opted-out", token: "tok-abc" }
      ]);
      (prisma.pushCampaign.update as any).mockResolvedValue({});
      (prisma.pushCampaignHistory.create as any).mockResolvedValue({});

      const result: any = await dispatchCampaign("camp-opt-out", "TEST_OPTOUT");
      expect(result.recipientsCount).toBe(0);
      expect(result.suppressedCount).toBe(1);
      expect(result.suppressionDetails?.optedOut).toBe(1);
      expect(sendPushNotification).not.toHaveBeenCalled();
    });

    it("should suppress users who have exceeded the daily advertisement push limit", async () => {
      const mockCamp = {
        id: "camp-frequency",
        title: "Third Push Today",
        description: "Too many notifications.",
        targetRole: "ALL",
        status: "ACTIVE"
      };
      (prisma.pushCampaign.findUnique as any).mockResolvedValue(mockCamp);

      (prisma.user.findMany as any).mockResolvedValue([
        { id: "user-busy", role: "freelancer", fullName: "Busy User" }
      ]);
      (prisma.notificationPreference.findMany as any).mockResolvedValue([]);
      // User already received 2 pushes today
      (prisma.notification.groupBy as any).mockResolvedValue([
        { userId: "user-busy", _count: { id: 2 } }
      ]);
      (prisma.deviceToken.findMany as any).mockResolvedValue([
        { userId: "user-busy", token: "tok-busy" }
      ]);
      (prisma.pushCampaign.update as any).mockResolvedValue({});
      (prisma.pushCampaignHistory.create as any).mockResolvedValue({});

      const result: any = await dispatchCampaign("camp-frequency", "TEST_LIMIT");
      expect(result.recipientsCount).toBe(0);
      expect(result.suppressionDetails?.dailyCapExceeded).toBe(1);
    });
  });

  // =========================================================================
  // 7. INACTIVE / EDIT SAFETY
  // =========================================================================
  describe("7. Inactive and Edit Safety", () => {
    it("dispatchCampaign should immediately abort if campaign is PAUSED or INACTIVE", async () => {
      (prisma.pushCampaign.findUnique as any).mockResolvedValue({
        id: "camp-inactive",
        title: "Inactive Ad",
        status: "PAUSED"
      });

      const res: any = await dispatchCampaign("camp-inactive");
      expect(res.success).toBe(false);
      expect(res.message).toContain("inactive/paused");
      expect(sendPushNotification).not.toHaveBeenCalled();
    });
  });
});
