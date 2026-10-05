import { prisma } from "../../config/database.js";
import { getVerificationStats } from "../../common/helpers/verification.js";
export async function activateFreeTrialOnKycApproval(userId) {
    try {
        if (!userId)
            return { success: false, message: "Missing userId" };
        // 1. Fetch user with existing subscriptions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true,
                subscriptions: {
                    where: { status: "active" },
                    include: { plan: true },
                },
            },
        });
        if (!user) {
            return { success: false, message: "User not found" };
        }
        const verificationStats = getVerificationStats(user);
        if (!verificationStats.kycApproved) {
            return { success: false, message: "KYC is not approved yet" };
        }
        // 2. Always mark as verified/active when admin approves, even if trial already exists
        await prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true, verified: true, status: "active" },
        });
        // 3. Send the Account Active email (Email 1) every time admin approves
        try {
            const { sendAccountActiveEmail, sendPlanActivationEmail } = await import("../../services/mobile/email.service.js");
            if (user.email) {
                await sendAccountActiveEmail(user.email, user.fullName || 'User');
                await sendPlanActivationEmail(user.email, user.fullName || 'User');
            }
        }
        catch (emailErr) {
            console.warn("[FreeTrialService] Could not send approval emails:", emailErr);
        }
        // 4. If user already has an active subscription, just return success (emails already sent)
        const hasActiveSub = user.subscriptions && user.subscriptions.length > 0;
        if (hasActiveSub) {
            console.log(`[FreeTrialService] User ${user.id} already has active subscription. Skipping free trial creation.`);
            return { success: true, message: "User already has active subscription. Approved and emails sent." };
        }
        // 5. Find 6-Month Free Access Plan (universal "all" role or role-specific)
        const userRole = (user.role || "freelancer").toLowerCase();
        let plan = await prisma.subscriptionPlan.findFirst({
            where: {
                status: "active",
                OR: [
                    { name: "6-Month Free Access" },
                    { duration: "180_days" },
                    { planType: "trial" },
                    { role: "all" },
                    { role: userRole },
                ],
                AND: [
                    {
                        OR: [
                            { duration: "180_days" },
                            { duration: "90_days" },
                            { amount: 0 },
                        ],
                    },
                ],
            },
            orderBy: { amount: "asc" },
        });
        if (!plan) {
            plan = await prisma.subscriptionPlan.create({
                data: {
                    name: "6-Month Free Access",
                    role: "all",
                    planType: "trial",
                    amount: 0,
                    currency: "INR",
                    duration: "180_days",
                    proposalsLimit: 36,
                    projectsLimit: 36,
                    sortOrder: 1,
                    visibility: "public",
                    status: "active",
                },
            });
        }
        // 6. Calculate exactly 6 calendar months expiration from now for new KYC approvals
        const startDate = new Date();
        const endDate = new Date(startDate.getTime());
        endDate.setMonth(endDate.getMonth() + 6);
        // 7. Create Subscription + Update User trial expiry + Record History
        const [createdSub] = await prisma.$transaction([
            prisma.subscription.create({
                data: {
                    userId: user.id,
                    planId: plan.id,
                    role: "all",
                    planType: "trial",
                    startDate,
                    endDate,
                    status: "active",
                    autoRenew: false,
                },
            }),
            prisma.user.update({
                where: { id: user.id },
                data: { trialEndsAt: endDate, status: "active" },
            }),
            prisma.subscriptionHistory.create({
                data: {
                    userId: user.id,
                    planId: plan.id,
                    action: "6_MONTH_FREE_TRIAL_ACTIVATED_ON_KYC",
                    metadata: JSON.stringify({
                        grantedAt: startDate.toISOString(),
                        expiresAt: endDate.toISOString(),
                        durationDays: 180,
                        planName: plan.name,
                        role: "all",
                    }),
                },
            }),
        ]);
        // 8. In-app notification
        try {
            await prisma.notification.create({
                data: {
                    userId: user.id,
                    type: "system",
                    title: "🎉 KYC Approved & 6-Month Free Access Activated!",
                    message: `Congratulations ${user.fullName || ""}! Your KYC has been approved. You have been granted 6 Months of Free Access across all workspaces until ${endDate.toLocaleDateString("en-IN")}.`,
                    channel: "in_app",
                    priority: "high",
                    status: "unread",
                },
            });
        }
        catch (notifErr) {
            console.error("[FreeTrialService] Failed to send notification:", notifErr);
        }
        console.log(`[FreeTrialService] ✅ Activated 6-month free plan for ${user.id} (${user.email}) until ${endDate.toISOString()}`);
        return { success: true, subscription: createdSub, expiresAt: endDate };
    }
    catch (err) {
        console.error("[FreeTrialService] Error activating free trial on KYC approval:", err);
        return { success: false, message: err?.message || "Failed to activate free trial" };
    }
}
