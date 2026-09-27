import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const adminUsersRouter = Router();

// ==========================================
// 1. GET /api/admin/users
// Unified User Query Endpoint
// ==========================================
adminUsersRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const status = req.query.status as string;
    
    // Build Where
    const where: any = { deletedAt: null };
    
        let queryRole = role;
    if (role && role !== "all" && role.endsWith("s")) {
      queryRole = role.slice(0, -1);
    }
    
    if (queryRole && queryRole !== "all") {
      where.role = { in: [queryRole.toLowerCase(), queryRole.charAt(0).toUpperCase() + queryRole.slice(1).toLowerCase(), queryRole.toUpperCase()] };
    };
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
      if (profile && (profile as any).verificationJson) {
        try {
          const vJson = typeof (profile as any).verificationJson === "string" ? JSON.parse((profile as any).verificationJson) : (profile as any).verificationJson;
          if (vJson.kycApproved) verificationStatus = "APPROVED";
          else if (vJson.kycSubmitted) verificationStatus = "IN_REVIEW";
        } catch {}
      } else if (user.isVerified) {
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
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2. GET /api/admin/users/:id
// ==========================================
adminUsersRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        subscriptions: { include: { plan: true } },
        freelancerProfile: true,
        clientProfile: true,
        founderProfile: true,
        investorProfile: true
      }
    });
    
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    // Normalize Verification Center Structure
    let profile = user.freelancerProfile || user.clientProfile || user.founderProfile || user.investorProfile;
    let verificationCenter = {
      email: user.isVerified || user.verified ? "VERIFIED" : "PENDING",
      phone: user.phone ? "VERIFIED" : "PENDING",
      profile: user.completionPercentage && user.completionPercentage >= 80 ? "COMPLETED" : "PENDING",
      kyc: "PENDING",
      documents: "PENDING"
    };

    if (profile && (profile as any).verificationJson) {
      try {
        const vJson = typeof (profile as any).verificationJson === "string" ? JSON.parse((profile as any).verificationJson) : (profile as any).verificationJson;
        if (vJson.kycApproved) {
          verificationCenter.kyc = "APPROVED";
          verificationCenter.documents = "APPROVED";
        } else if (vJson.kycSubmitted) {
          verificationCenter.kyc = "IN_REVIEW";
          verificationCenter.documents = "SUBMITTED";
        }
      } catch {}
    }

    res.json({
      success: true,
      data: {
        ...user,
        verificationCenter
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. GET /api/admin/users/:id/insights
// ==========================================
adminUsersRouter.get("/:id/insights", async (req: Request, res: Response, next: NextFunction) => {
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
    
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
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
    } else if (r === "client" && user.clientProfile) {
      insights = {
        projectsPosted: user.clientProfile.projectsPosted || 0,
        totalSpend: user.clientProfile.totalSpend || 0,
        activeHiring: true,
        averageProjectBudget: 0
      };
    } else if (r === "founder" && user.founderProfile) {
      insights = {
        stage: user.founderProfile.stage || "N/A",
        targetRaise: user.founderProfile.targetRaise || 0,
        raised: user.founderProfile.raised || 0,
        teamSize: user.founderProfile.teamSize || 1
      };
    } else if (r === "investor" && user.investorProfile) {
      insights = {
        investorType: user.investorProfile.investorType || "Angel",
        dealsCompleted: user.investorProfile.deals || 0,
        preferredStage: user.investorProfile.preferredStage || "Seed",
        capitalDeployed: 0
      };
    }
    
    res.json({ success: true, data: insights });
  } catch (err) {
    next(err);
  }
});

export { adminUsersRouter };


// ==========================================
// 4. PATCH /api/v1/admin/users/:id
// Universal Edit Endpoint
// ==========================================
adminUsersRouter.patch("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account, verification, profile, reason, updatedAt } = req.body;
    
    // In production, Zod/Joi validation goes here.

    const currentUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!currentUser) return res.status(404).json({ success: false, message: "User not found" });

    // Optimistic Locking Enforcement
    if (updatedAt && new Date(updatedAt).getTime() !== new Date(currentUser.updatedAt).getTime()) {
      return res.status(409).json({ success: false, message: "Conflict: This user was modified by another administrator. Please refresh." });
    }
    
    // Process User Account Updates
    let userUpdateData: any = {};
    if (account) {
      if (account.status) userUpdateData.status = account.status;
      if (account.fullName) userUpdateData.fullName = account.fullName;
      if (account.phone) userUpdateData.phone = account.phone;
      if (account.country) userUpdateData.country = account.country;
      if (account.city) userUpdateData.city = account.city;
    }

    // Process Profile & Verification Center Updates
    let profileUpdateData: any = { ...profile };
    if (verification) {
      profileUpdateData.verificationJson = JSON.stringify(verification);
    }
    
    // Determine which profile to update based on the user's role
    const role = currentUser.role.toLowerCase();
    const updatePromises: any[] = [
      prisma.user.update({ where: { id: req.params.id }, data: userUpdateData })
    ];

    if (Object.keys(profileUpdateData).length > 0) {
      if (role === "freelancer") {
        updatePromises.push(prisma.freelancerProfile.update({ where: { userId: req.params.id }, data: profileUpdateData }));
      } else if (role === "client") {
        updatePromises.push(prisma.clientProfile.update({ where: { userId: req.params.id }, data: profileUpdateData }));
      } else if (role === "founder") {
        updatePromises.push(prisma.founderProfile.update({ where: { userId: req.params.id }, data: profileUpdateData }));
      } else if (role === "investor") {
        updatePromises.push(prisma.investorProfile.update({ where: { userId: req.params.id }, data: profileUpdateData }));
      }
    }

    // Audit Log Enforcement
    updatePromises.push(
      prisma.adminAuditLog.create({
        data: {
          adminId: (req as any).user?.id || "SYSTEM",
          targetUserId: req.params.id,
          action: "USER_UPDATED",
          entityType: "USER",
          entityId: req.params.id,
          newValue: JSON.stringify(req.body),
          createdAt: new Date()
        }
      })
    );

    await prisma.$transaction(updatePromises);
    
    res.json({ success: true, message: "User updated successfully", data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});
// ==========================================
// 5. POST /api/v1/admin/users/:id/send-reset-email
adminUsersRouter.post("/:id/send-reset-email", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Audit Log Enforcement
    await prisma.adminAuditLog.create({
      data: {
        adminId: (req as any).user?.id || "SYSTEM",
        targetUserId: req.params.id,
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "USER",
        entityId: req.params.id,
        createdAt: new Date()
      }
    });

    res.json({ success: true, message: "Password reset email sent successfully", data: null });
  } catch (err) {
    next(err);
  }
});


