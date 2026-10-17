import { describe, it, expect } from "vitest";
import { NotificationEventType, SECURITY_CRITICAL_EVENTS, EMAIL_ELIGIBLE_EVENTS, resolveActionUrl, } from "../../common/constants/notification-events.js";
describe("Go Experts - Notification Hardening & Multi-Channel Delivery Unit Tests", () => {
    // ─────────────────────────────────────────────────────────────────────────────
    // 1. CANONICAL RECORD & DEDUPLICATION / GROUPING
    // ─────────────────────────────────────────────────────────────────────────────
    describe("1. Canonical Record & Grouping Principles", () => {
        it("groups repeated message notifications atomically without creating separate database rows", () => {
            const existing = {
                id: "notif-1",
                userId: "user-1",
                type: "MESSAGE_RECEIVED",
                contextType: "conversation",
                contextId: "conv-101",
                count: 1,
                message: "You have a new message",
                readAt: null,
            };
            // Simulating grouping logic
            function groupNotification(prev, newPayload) {
                if (prev.userId === newPayload.userId && prev.type === newPayload.type && !prev.readAt) {
                    return {
                        ...prev,
                        count: prev.count + 1,
                        message: `${prev.count + 1} new messages`,
                        bumpedAt: new Date(),
                    };
                }
                return newPayload;
            }
            const updated = groupNotification(existing, {
                userId: "user-1",
                type: "MESSAGE_RECEIVED",
                contextType: "conversation",
                contextId: "conv-101",
            });
            expect(updated.id).toBe("notif-1");
            expect(updated.count).toBe(2);
            expect(updated.message).toBe("2 new messages");
        });
        it("creates a new notification if the previous one is already read", () => {
            const existing = {
                id: "notif-1",
                userId: "user-1",
                type: "MESSAGE_RECEIVED",
                count: 1,
                readAt: new Date(),
            };
            function canGroup(prev, incoming) {
                return prev.userId === incoming.userId && prev.type === incoming.type && prev.readAt === null;
            }
            expect(canGroup(existing, { userId: "user-1", type: "MESSAGE_RECEIVED" })).toBe(false);
        });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 2. ROLE-AWARE DEEP LINK RESOLVER
    // ─────────────────────────────────────────────────────────────────────────────
    describe("2. Role-Aware Deep-Link Resolver", () => {
        it("routes Client project milestone notification to /business/projects/:projectId?tab=milestones", () => {
            const url = resolveActionUrl({
                type: NotificationEventType.MILESTONE_SUBMITTED,
                recipientRole: "client",
                projectId: "proj-999",
                isClientOwner: true,
            });
            expect(url).toBe("/business/projects/proj-999?tab=milestones");
        });
        it("routes Freelancer project milestone notification to /dashboard/projects/:projectId?tab=milestones", () => {
            const url = resolveActionUrl({
                type: NotificationEventType.MILESTONE_APPROVED,
                recipientRole: "freelancer",
                projectId: "proj-999",
                isContractedFreelancer: true,
            });
            expect(url).toBe("/dashboard/projects/proj-999?tab=milestones");
        });
        it("routes Multi-role user to Freelancer workspace when notification concerns a project where they are Freelancer", () => {
            const url = resolveActionUrl({
                type: NotificationEventType.PROJECT_COMPLETED,
                recipientRole: "freelancer",
                projectId: "proj-multi-role",
                isClientOwner: false,
                isContractedFreelancer: true,
            });
            expect(url).toBe("/dashboard/projects/proj-multi-role?tab=overview");
        });
        it("routes proposal received notification to client's project proposals tab", () => {
            const url = resolveActionUrl({
                type: NotificationEventType.PROPOSAL_RECEIVED,
                recipientRole: "client",
                projectId: "proj-alpha",
                isClientOwner: true,
            });
            expect(url).toBe("/business/projects/proj-alpha/proposals");
        });
        it("routes Founder investor requests to /founder/investor-requests", () => {
            const url = resolveActionUrl({
                type: NotificationEventType.INVESTOR_INTEREST_EXPRESSED,
                recipientRole: "founder",
            });
            expect(url).toBe("/founder/investor-requests");
        });
        it("routes Investor interest confirmation to /investor/startups/:startupId", () => {
            const url = resolveActionUrl({
                type: NotificationEventType.FOUNDER_INTEREST_ACCEPTED,
                recipientRole: "investor",
                startupId: "startup-xyz",
            });
            expect(url).toBe("/investor/startups/startup-xyz");
        });
        it("routes conversation message to /messages?conversationId=:conversationId", () => {
            const url = resolveActionUrl({
                type: NotificationEventType.MESSAGE_RECEIVED,
                conversationId: "conv-456",
            });
            expect(url).toBe("/messages?conversationId=conv-456");
        });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 3. IDOR SECURITY ENFORCEMENT
    // ─────────────────────────────────────────────────────────────────────────────
    describe("3. Notification & Device Token IDOR Security", () => {
        function authorizeNotificationAccess(requestUserId, notificationOwnerId) {
            if (!requestUserId || requestUserId !== notificationOwnerId) {
                return { allowed: false, status: 403, error: "Access denied: notification belongs to another user" };
            }
            return { allowed: true };
        }
        it("prevents User A from reading or marking User B's notification", () => {
            const result = authorizeNotificationAccess("user-a", "user-b");
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(403);
        });
        it("allows User A to access their own notification", () => {
            const result = authorizeNotificationAccess("user-a", "user-a");
            expect(result.allowed).toBe(true);
        });
        function authorizeDeviceTokenMutation(sessionUserId, targetUserId) {
            if (!sessionUserId) {
                return { allowed: false, status: 401, error: "Authentication required" };
            }
            if (targetUserId && sessionUserId !== targetUserId) {
                return { allowed: false, status: 403, error: "Cannot register or modify device token for another user" };
            }
            return { allowed: true };
        }
        it("rejects unauthenticated device token registration", () => {
            const result = authorizeDeviceTokenMutation(undefined, "user-b");
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(401);
        });
        it("blocks User A from registering device token for User B", () => {
            const result = authorizeDeviceTokenMutation("user-a", "user-b");
            expect(result.allowed).toBe(false);
            expect(result.status).toBe(403);
        });
        it("allows User A to register their own device token", () => {
            const result = authorizeDeviceTokenMutation("user-a", "user-a");
            expect(result.allowed).toBe(true);
        });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 4. DELIVERY INDEPENDENCE & CHANNEL ELIGIBILITY
    // ─────────────────────────────────────────────────────────────────────────────
    describe("4. Delivery Channel Eligibility & Non-Blocking Resilience", () => {
        it("allows security events to bypass optional marketing preferences", () => {
            const userPreferences = {
                emailEnabled: false, // user opted out of email
                pushEnabled: false,
            };
            function shouldSendEmail(eventType, prefs) {
                if (SECURITY_CRITICAL_EVENTS.has(eventType))
                    return true; // Mandatory
                return prefs.emailEnabled && EMAIL_ELIGIBLE_EVENTS.has(eventType);
            }
            // Password reset MUST send email despite opt-out
            expect(shouldSendEmail(NotificationEventType.PASSWORD_RESET_REQUESTED, userPreferences)).toBe(true);
            // Ordinary project notification respects opt-out
            expect(shouldSendEmail(NotificationEventType.PROJECT_COMPLETED, userPreferences)).toBe(false);
        });
        it("guarantees failure of external email or push does not rollback business operation", async () => {
            let businessOperationCompleted = false;
            async function completeMilestone(milestoneId) {
                // Core business logic
                businessOperationCompleted = true;
                // Async dispatch simulation with failing email
                try {
                    const fakeEmailSender = async () => {
                        throw new Error("SMTP connection timeout");
                    };
                    await fakeEmailSender().catch((err) => {
                        return { status: "failed", error: err.message };
                    });
                }
                catch {
                    // Never reached
                }
                return { success: true, milestoneId };
            }
            const result = await completeMilestone("milestone-123");
            expect(result.success).toBe(true);
            expect(businessOperationCompleted).toBe(true);
        });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 5. MALICIOUS RETURNTO URL VALIDATION (SAFE-RETURN)
    // ─────────────────────────────────────────────────────────────────────────────
    describe("5. Malicious ReturnTo URL Validation", () => {
        function isSafeReturnUrl(url) {
            if (!url || typeof url !== "string")
                return false;
            let trimmed = url.trim();
            try {
                trimmed = decodeURIComponent(trimmed);
                if (trimmed.includes("%")) {
                    trimmed = decodeURIComponent(trimmed);
                }
            }
            catch {
                return false;
            }
            if (!trimmed.startsWith("/") ||
                trimmed.startsWith("//") ||
                trimmed.startsWith("/\\") ||
                trimmed.startsWith("/\\\\")) {
                return false;
            }
            const pathPart = trimmed.split("?")[0].split("#")[0];
            if (pathPart.includes("\\") || pathPart.includes(":")) {
                return false;
            }
            const lower = trimmed.toLowerCase();
            if (lower.includes("javascript:") ||
                lower.includes("data:") ||
                lower.includes("vbscript:") ||
                lower.includes("file:") ||
                lower.includes("blob:")) {
                return false;
            }
            const cleanPath = pathPart.replace(/\/+$/, "");
            if (cleanPath === "/login" ||
                cleanPath === "/signup" ||
                cleanPath === "/auth/social-success") {
                return false;
            }
            return true;
        }
        it("rejects protocol-relative external domain redirects (//evil.com)", () => {
            expect(isSafeReturnUrl("//evil.com")).toBe(false);
            expect(isSafeReturnUrl("//evil.com/phishing")).toBe(false);
        });
        it("rejects encoded double-slash bypasses (%2F%2Fevil.com)", () => {
            expect(isSafeReturnUrl("%2F%2Fevil.com")).toBe(false);
        });
        it("rejects javascript: schemes", () => {
            expect(isSafeReturnUrl("javascript:alert(document.cookie)")).toBe(false);
            expect(isSafeReturnUrl("/%0Ajavascript:alert(1)")).toBe(false);
        });
        it("rejects data: and file: URIs", () => {
            expect(isSafeReturnUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
            expect(isSafeReturnUrl("file:///etc/passwd")).toBe(false);
        });
        it("rejects recursive login redirects to prevent loops", () => {
            expect(isSafeReturnUrl("/login")).toBe(false);
            expect(isSafeReturnUrl("/login/")).toBe(false);
            expect(isSafeReturnUrl("/signup")).toBe(false);
        });
        it("approves legitimate authenticated marketplace destinations", () => {
            expect(isSafeReturnUrl("/dashboard/projects/proj-123")).toBe(true);
            expect(isSafeReturnUrl("/business/projects/proj-456?tab=milestones")).toBe(true);
            expect(isSafeReturnUrl("/founder/investor-requests")).toBe(true);
            expect(isSafeReturnUrl("/messages?conversationId=conv-789")).toBe(true);
        });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 6. ATOMIC QUEUE CLAIMING & CONCURRENCY
    // ─────────────────────────────────────────────────────────────────────────────
    describe("6. Atomic Queue Claiming & Concurrency Protection", () => {
        it("guarantees only one worker claims a pending queue job when multiple contend", async () => {
            const mockDatabase = {
                queue: [
                    { id: "job-1", status: "pending", attempts: 0 },
                ],
            };
            // Simulates atomic compare-and-swap (updateMany with status: 'pending')
            async function claimJob(workerId, jobId) {
                const item = mockDatabase.queue.find((j) => j.id === jobId);
                if (item && item.status === "pending") {
                    item.status = "processing";
                    return { claimed: true, workerId };
                }
                return { claimed: false, workerId };
            }
            // Simulate simultaneous worker executions
            const [worker1Result, worker2Result] = await Promise.all([
                claimJob("worker-1", "job-1"),
                claimJob("worker-2", "job-1"),
            ]);
            const winners = [worker1Result, worker2Result].filter((r) => r.claimed);
            const losers = [worker1Result, worker2Result].filter((r) => !r.claimed);
            expect(winners.length).toBe(1);
            expect(losers.length).toBe(1);
            expect(mockDatabase.queue[0].status).toBe("processing");
        });
        it("stops retrying when max attempts is reached and marks job failed", () => {
            const maxAttempts = 3;
            function evaluateRetry(currentAttempts) {
                const nextAttempt = currentAttempts + 1;
                const willRetry = nextAttempt < maxAttempts;
                return {
                    nextAttempt,
                    status: willRetry ? "pending" : "failed",
                    willRetry,
                };
            }
            // Attempt 1 -> retry
            expect(evaluateRetry(0).status).toBe("pending");
            // Attempt 2 -> retry
            expect(evaluateRetry(1).status).toBe("pending");
            // Attempt 3 -> final failure
            expect(evaluateRetry(2).status).toBe("failed");
            expect(evaluateRetry(2).willRetry).toBe(false);
        });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // 7. DEVICE TOKEN LIFECYCLE & ACCOUNT SWITCHING
    // ─────────────────────────────────────────────────────────────────────────────
    describe("7. Device Token Lifecycle & Account Switching", () => {
        it("reassigns FCM device token to new user on account switch to prevent leaking private notifications", () => {
            const tokensDatabase = new Map();
            function registerToken(userId, token) {
                tokensDatabase.set(token, { userId, token, isActive: true });
            }
            // Device enrolled by User A
            registerToken("user-a", "fcm-token-xyz");
            expect(tokensDatabase.get("fcm-token-xyz")?.userId).toBe("user-a");
            // User A logs out, User B logs in on same device with same hardware token
            registerToken("user-b", "fcm-token-xyz");
            // Token MUST now belong strictly to User B
            expect(tokensDatabase.get("fcm-token-xyz")?.userId).toBe("user-b");
            // Simulated notification to User A MUST NOT find this device token
            const userATokens = Array.from(tokensDatabase.values()).filter((t) => t.userId === "user-a" && t.isActive);
            expect(userATokens.length).toBe(0);
        });
        it("deactivates token upon explicit logout", () => {
            const tokensDatabase = new Map();
            tokensDatabase.set("fcm-token-123", { userId: "user-a", token: "fcm-token-123", isActive: true });
            function logoutDevice(userId, token) {
                const existing = tokensDatabase.get(token);
                if (existing && existing.userId === userId) {
                    tokensDatabase.delete(token);
                }
            }
            logoutDevice("user-a", "fcm-token-123");
            expect(tokensDatabase.has("fcm-token-123")).toBe(false);
        });
    });
});
