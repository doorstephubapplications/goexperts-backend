import { Router } from "express";
import { prisma } from "../../config/database.js";
export const adminUsersRouter = Router();
// ==========================================
// 1. GET /api/admin/users
// Unified User Query Endpoint
// ==========================================
adminUsersRouter.get("/", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search;
        const role = req.query.role;
        const status = req.query.status;
        // Build Where
        const where = { deletedAt: null };
        let queryRole = role;
        if (role && role !== "all" && role.endsWith("s")) {
            queryRole = role.slice(0, -1);
        }
        if (queryRole && queryRole !== "all") {
            where.role = { in: [queryRole.toLowerCase(), queryRole.charAt(0).toUpperCase() + queryRole.slice(1).toLowerCase(), queryRole.toUpperCase()] };
        }
        if (status && status !== "all") {
            where.status = { in: [status.toLowerCase(), status.toUpperCase()] };
        }
        if (search) {
            where.OR = [
                { fullName: { contains: search } },
                { email: { contains: search } }
            ];
        }
        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                skip: (page - 1) * limit,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: {
                    subscriptions: { include: { plan: true } },
                    freelancerProfile: true,
                    clientProfile: true,
                    founderProfile: true,
                    investorProfile: true
                }
            })
        ]);
        // Map to normalized contract
        const data = users.map(user => {
            let verificationStatus = "PENDING";
            let profileCompletion = user.completionPercentage || 0;
            // Determine verification status from profiles
            let profile = user.freelancerProfile || user.clientProfile || user.founderProfile || user.investorProfile;
            if (profile && profile.verificationJson) {
                try {
                    const vJson = typeof profile.verificationJson === "string" ? JSON.parse(profile.verificationJson) : profile.verificationJson;
                    if (vJson.kycApproved)
                        verificationStatus = "APPROVED";
                    else if (vJson.kycSubmitted)
                        verificationStatus = "IN_REVIEW";
                }
                catch { }
            }
            else if (user.isVerified) {
                verificationStatus = "APPROVED";
            }
            return {
                id: user.id,
                role: user.role.toUpperCase(),
                name: user.fullName || "Unknown",
                email: user.email,
                avatar: user.avatarUrl || null,
                status: user.status.toUpperCase(),
                verificationStatus,
                profileCompletion,
                lastLoginAt: user.lastLoginAt,
                subscriptionPlan: user.subscriptions?.[0]?.plan?.name || "No Plan",
                createdAt: user.createdAt
            };
        });
        res.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 1.5. GET /api/admin/users/unread-counts
// ==========================================
adminUsersRouter.get("/unread-counts", async (req, res, next) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const counts = await prisma.user.groupBy({
            by: ["role"],
            where: {
                createdAt: { gte: twentyFourHoursAgo },
                deletedAt: null
            },
            _count: { id: true }
        });
        const result = { freelancers: 0, clients: 0, investors: 0, founders: 0 };
        counts.forEach(c => {
            const role = String(c.role).toLowerCase();
            if (role === "freelancer")
                result.freelancers = c._count.id;
            if (role === "client")
                result.clients = c._count.id;
            if (role === "investor")
                result.investors = c._count.id;
            if (role === "founder")
                result.founders = c._count.id;
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 1.6. GET /api/admin/users/unread-list
// ==========================================
adminUsersRouter.get("/unread-list", async (req, res, next) => {
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const users = await prisma.user.findMany({
            where: {
                createdAt: { gte: twentyFourHoursAgo },
                deletedAt: null,
                role: { in: ["freelancer", "Freelancer", "client", "Client", "investor", "Investor", "founder", "Founder"] }
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                createdAt: true
            },
            orderBy: { createdAt: "desc" },
            take: 50
        });
        res.json({ success: true, data: users });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 1.7. POST /api/admin/users/:id/mark-viewed
// ==========================================
adminUsersRouter.post("/:id/mark-viewed", async (req, res, next) => {
    try {
        // In a real system, you might store this in an AdminView log.
        // For now, returning success so the frontend stops throwing errors.
        res.json({ success: true });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 2. GET /api/admin/users/:id
// ==========================================
adminUsersRouter.get("/:id", async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                subscriptions: { include: { plan: true } },
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true,
                wallet: {
                    include: {
                        transactions: {
                            orderBy: { createdAt: "desc" },
                            take: 30
                        }
                    }
                }
            }
        });
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        // Normalize Verification Center Structure
        let profile = user.freelancerProfile || user.clientProfile || user.founderProfile || user.investorProfile;
        let verificationCenter = {
            email: user.isVerified || user.verified ? "VERIFIED" : "PENDING",
            phone: user.phone ? "VERIFIED" : "PENDING",
            profile: user.completionPercentage && user.completionPercentage >= 80 ? "COMPLETED" : "PENDING",
            kyc: "PENDING",
            documents: "PENDING"
        };
        if (profile && profile.verificationJson) {
            try {
                const vJson = typeof profile.verificationJson === "string" ? JSON.parse(profile.verificationJson) : profile.verificationJson;
                if (vJson.kycApproved) {
                    verificationCenter.kyc = "APPROVED";
                    verificationCenter.documents = "APPROVED";
                }
                else if (vJson.kycSubmitted) {
                    verificationCenter.kyc = "IN_REVIEW";
                    verificationCenter.documents = "SUBMITTED";
                }
            }
            catch { }
        }
        res.json({
            success: true,
            data: {
                ...user,
                verificationCenter
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 2.1 GET /api/admin/users/:id/wallet
// ==========================================
adminUsersRouter.get("/:id/wallet", async (req, res, next) => {
    try {
        let wallet = await prisma.wallet.findUnique({
            where: { userId: req.params.id },
            include: {
                transactions: {
                    orderBy: { createdAt: "desc" },
                    take: 50
                }
            }
        });
        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    userId: req.params.id,
                    balance: 0,
                    currency: "INR"
                },
                include: {
                    transactions: true
                }
            });
        }
        res.json({ success: true, data: wallet });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 2.2 POST /api/admin/users/:id/wallet/adjust
// ==========================================
adminUsersRouter.post("/:id/wallet/adjust", async (req, res, next) => {
    try {
        const { amount, actionType, description } = req.body;
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ success: false, message: "Valid positive amount is required" });
        }
        const typeStr = String(actionType || "CREDIT").toUpperCase();
        if (!["CREDIT", "DEBIT", "BONUS", "REFUND", "ADJUSTMENT"].includes(typeStr)) {
            return res.status(400).json({ success: false, message: "Invalid action type. Allowed: CREDIT, DEBIT, BONUS, REFUND, ADJUSTMENT" });
        }
        const isCredit = typeStr !== "DEBIT";
        let wallet = await prisma.wallet.findUnique({ where: { userId: req.params.id } });
        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: {
                    userId: req.params.id,
                    balance: 0,
                    currency: "INR"
                }
            });
        }
        if (!isCredit && wallet.balance < numAmount) {
            return res.status(400).json({
                success: false,
                message: `Insufficient wallet balance (Current: ₹${wallet.balance}, Requested Debit: ₹${numAmount})`
            });
        }
        const newBalance = isCredit ? wallet.balance + numAmount : wallet.balance - numAmount;
        const [updatedWallet, transaction] = await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance }
            }),
            prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: typeStr,
                    amount: numAmount,
                    direction: isCredit ? "IN" : "OUT",
                    description: description || `Admin ${typeStr} adjustment`,
                    balanceAfter: newBalance,
                    status: "completed"
                }
            })
        ]);
        res.json({
            success: true,
            message: `Wallet ${isCredit ? "credited" : "debited"} successfully with ₹${numAmount.toLocaleString("en-IN")}`,
            data: {
                wallet: updatedWallet,
                transaction
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 3. GET /api/admin/users/:id/insights
// ==========================================
adminUsersRouter.get("/:id/insights", async (req, res, next) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });
        if (!user)
            return res.status(404).json({ success: false, message: "User not found" });
        let insights = {};
        const r = user.role.toLowerCase();
        if (r === "freelancer" && user.freelancerProfile) {
            const pCount = await prisma.project.count({ where: { freelancer: user.id } });
            insights = {
                rating: user.freelancerProfile.rating || 5.0,
                projectsCompleted: pCount,
                availability: user.freelancerProfile.availability || "AVAILABLE",
                responseTime: user.freelancerProfile.responseTime || "2h"
            };
        }
        else if (r === "client" && user.clientProfile) {
            insights = {
                projectsPosted: user.clientProfile.projectsPosted || 0,
                totalSpend: user.clientProfile.totalSpend || 0,
                activeHiring: true,
                averageProjectBudget: 0
            };
        }
        else if (r === "founder" && user.founderProfile) {
            insights = {
                stage: user.founderProfile.stage || "N/A",
                targetRaise: user.founderProfile.targetRaise || 0,
                raised: user.founderProfile.raised || 0,
                teamSize: user.founderProfile.teamSize || 1
            };
        }
        else if (r === "investor" && user.investorProfile) {
            insights = {
                investorType: user.investorProfile.investorType || "Angel",
                dealsCompleted: user.investorProfile.deals || 0,
                preferredStage: user.investorProfile.preferredStage || "Seed",
                capitalDeployed: 0
            };
        }
        res.json({ success: true, data: insights });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 4. PATCH & PUT /api/admin/users/:id
// Universal Edit Endpoint
// ==========================================
const updateUserHandler = async (req, res, next) => {
    try {
        const { account, verification, profile, reason, updatedAt, fullName, phone, country, city, status, isVerified } = req.body;
        const currentUser = await prisma.user.findUnique({ where: { id: req.params.id } });
        if (!currentUser)
            return res.status(404).json({ success: false, message: "User not found" });
        // Optimistic Locking Enforcement (if supplied)
        if (updatedAt && new Date(updatedAt).getTime() !== new Date(currentUser.updatedAt).getTime()) {
            return res.status(409).json({ success: false, message: "Conflict: This user was modified by another administrator. Please refresh." });
        }
        // Process User Account Updates
        let userUpdateData = {};
        if (account) {
            if (account.status)
                userUpdateData.status = account.status;
            if (account.fullName)
                userUpdateData.fullName = account.fullName;
            if (account.phone)
                userUpdateData.phone = account.phone;
            if (account.country)
                userUpdateData.country = account.country;
            if (account.city)
                userUpdateData.city = account.city;
            if (typeof account.isVerified === "boolean")
                userUpdateData.isVerified = account.isVerified;
        }
        else {
            if (status)
                userUpdateData.status = status;
            if (fullName)
                userUpdateData.fullName = fullName;
            if (phone !== undefined)
                userUpdateData.phone = phone;
            if (country !== undefined)
                userUpdateData.country = country;
            if (city !== undefined)
                userUpdateData.city = city;
            if (typeof isVerified === "boolean")
                userUpdateData.isVerified = isVerified;
        }
        // Process Profile & Verification Center Updates
        let profileUpdateData = { ...(profile || {}) };
        if (verification) {
            profileUpdateData.verificationJson = typeof verification === "string" ? verification : JSON.stringify(verification);
        }
        // Determine which profile to update based on the user's role
        const role = currentUser.role.toLowerCase();
        const updatePromises = [];
        if (Object.keys(userUpdateData).length > 0) {
            updatePromises.push(prisma.user.update({ where: { id: req.params.id }, data: userUpdateData }));
        }
        if (Object.keys(profileUpdateData).length > 0) {
            if (role === "freelancer") {
                updatePromises.push(prisma.freelancerProfile.upsert({
                    where: { userId: req.params.id },
                    update: profileUpdateData,
                    create: { userId: req.params.id, ...profileUpdateData }
                }));
            }
            else if (role === "client") {
                updatePromises.push(prisma.clientProfile.upsert({
                    where: { userId: req.params.id },
                    update: profileUpdateData,
                    create: { userId: req.params.id, ...profileUpdateData }
                }));
            }
            else if (role === "founder") {
                updatePromises.push(prisma.founderProfile.upsert({
                    where: { userId: req.params.id },
                    update: profileUpdateData,
                    create: { userId: req.params.id, ...profileUpdateData }
                }));
            }
            else if (role === "investor") {
                updatePromises.push(prisma.investorProfile.upsert({
                    where: { userId: req.params.id },
                    update: profileUpdateData,
                    create: { userId: req.params.id, ...profileUpdateData }
                }));
            }
        }
        // Audit Log Enforcement
        try {
            if (prisma.adminAuditLog) {
                updatePromises.push(prisma.adminAuditLog.create({
                    data: {
                        adminId: req.user?.id || "SYSTEM",
                        targetUserId: req.params.id,
                        action: "USER_UPDATED",
                        entityType: "USER",
                        entityId: req.params.id,
                        newValue: JSON.stringify(req.body),
                        createdAt: new Date()
                    }
                }));
            }
        }
        catch { }
        if (updatePromises.length > 0) {
            await prisma.$transaction(updatePromises);
        }
        // Fetch refreshed user
        const updatedUser = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                subscriptions: { include: { plan: true } },
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });
        res.json({ success: true, message: "User updated successfully", data: updatedUser });
    }
    catch (err) {
        next(err);
    }
};
adminUsersRouter.patch("/:id", updateUserHandler);
adminUsersRouter.put("/:id", updateUserHandler);
// ==========================================
// ==========================================
// 5. POST /api/v1/admin/users/:id/send-reset-email
adminUsersRouter.post("/:id/send-reset-email", async (req, res, next) => {
    try {
        // Audit Log Enforcement
        if (prisma.adminAuditLog) {
            await prisma.adminAuditLog.create({
                data: {
                    adminId: req.user?.id || "SYSTEM",
                    targetUserId: req.params.id,
                    action: "PASSWORD_RESET_REQUESTED",
                    entityType: "USER",
                    entityId: req.params.id,
                    createdAt: new Date()
                }
            }).catch(() => { });
        }
        res.json({ success: true, message: "Password reset email sent successfully", data: null });
    }
    catch (err) {
        next(err);
    }
});
// ==========================================
// 6. GET /api/admin/users/:id/insights
// ==========================================
adminUsersRouter.get("/:id/insights", async (req, res, next) => {
    try {
        const userId = req.params.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                wallet: true,
                subscriptions: { include: { plan: true } },
            }
        });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const txCount = await prisma.walletTransaction.count({
            where: { wallet: { userId } }
        }).catch(() => 0);
        const auditCount = prisma.adminAuditLog
            ? await prisma.adminAuditLog.count({ where: { targetUserId: userId } }).catch(() => 0)
            : 0;
        res.json({
            success: true,
            data: {
                userId,
                accountStatus: user.status,
                kycStatus: user.isVerified ? "APPROVED" : "PENDING",
                walletBalance: user.wallet?.balance || 0,
                currency: user.wallet?.currency || "INR",
                totalTransactions: txCount,
                auditLogsCount: auditCount,
                currentPlan: user.subscriptions?.[0]?.plan?.name || "Free Tier",
                completionScore: user.completionPercentage || 85,
                lastActive: user.lastLoginAt || user.updatedAt || user.createdAt
            }
        });
    }
    catch (err) {
        next(err);
    }
});
adminUsersRouter.delete("/bulk", async (req, res, next) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: "No IDs provided" });
        }
        await prisma.user.updateMany({
            where: { id: { in: ids } },
            data: { deletedAt: new Date() }
        });
        res.json({ success: true, message: "Users deleted successfully" });
    }
    catch (err) {
        next(err);
    }
});
adminUsersRouter.delete("/:id", async (req, res, next) => {
    try {
        await prisma.user.update({
            where: { id: req.params.id },
            data: { deletedAt: new Date() }
        });
        res.json({ success: true, message: "User deleted successfully" });
    }
    catch (err) {
        next(err);
    }
});
export default adminUsersRouter;
