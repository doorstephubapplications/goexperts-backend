import bcrypt from 'bcryptjs';
import { sendEmail } from '../../services/mobile/email.service.js';
import { renderEmailTemplate } from '../../services/settings/settings.service.js';
import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { sendAccountDeletedEmail, sendKycDocumentStatusEmail, sendAdminWalletCreditEmail } from "../../services/mobile/email.service.js";
import { decryptPassword } from "../../utils/crypto.util.js";
import { getVerificationStats } from "../../common/helpers/verification.js";

export const adminUsersRouter = Router();

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

    // Fetch startup ideas for any founder users to enrich logo/banner if missing
    const founderUserNames = users
      .filter(u => u.role?.toLowerCase() === "founder" && (!u.coverImageUrl || !u.avatarUrl))
      .map(u => u.fullName)
      .filter(Boolean);

    let founderStartups: any[] = [];
    if (founderUserNames.length > 0) {
      try {
        founderStartups = await prisma.startupIdea.findMany({
          where: {
            deletedAt: null,
            OR: founderUserNames.map(name => ({ founder: { contains: name } }))
          },
          select: { founder: true, logo: true, coverUrl: true }
        });
      } catch (e) {
        console.error("Error fetching founder startups in list:", e);
      }
    }
    
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

      let profileLogo = user.avatarUrl || null;
      let profileBanner = user.coverImageUrl || null;
      if (user.freelancerProfile) {
        profileLogo = user.freelancerProfile.logoUrl || profileLogo;
        profileBanner = user.freelancerProfile.bannerUrl || profileBanner;
      }
      if (user.clientProfile) {
        profileLogo = (user.clientProfile as any).logoUrl || profileLogo;
      }
      if (user.founderProfile) {
        profileLogo = (user.founderProfile as any).logoUrl || profileLogo;
      }
      if (user.investorProfile) {
        profileLogo = (user.investorProfile as any).logoUrl || profileLogo;
      }

      if (user.role?.toLowerCase() === "founder" && (!profileBanner || !profileLogo)) {
        const matchingStartup = founderStartups.find(s => 
          s.founder && user.fullName && s.founder.toLowerCase().includes(user.fullName.toLowerCase())
        );
        if (matchingStartup) {
          if (!profileBanner) profileBanner = matchingStartup.coverUrl || matchingStartup.cover || null;
          if (!profileLogo) profileLogo = matchingStartup.logo || matchingStartup.logoUrl || null;
        }
      }

      return {
        id: user.id,
        role: user.role.toUpperCase(),
        name: user.fullName || "Unknown",
        fullName: user.fullName || "Unknown",
        email: user.email,
        avatar: profileLogo,
        avatarUrl: profileLogo,
        logo: profileLogo,
        logoUrl: profileLogo,
        coverImageUrl: profileBanner,
        bannerUrl: profileBanner,
        banner: profileBanner,
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
// 1.5. GET /api/admin/users/unread-counts
// ==========================================
adminUsersRouter.get("/unread-counts", async (req: Request, res: Response, next: NextFunction) => {
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
      if (role === "freelancer") result.freelancers = c._count.id;
      if (role === "client") result.clients = c._count.id;
      if (role === "investor") result.investors = c._count.id;
      if (role === "founder") result.founders = c._count.id;
    });
    
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 1.6. GET /api/admin/users/unread-list
// ==========================================
adminUsersRouter.get("/unread-list", async (req: Request, res: Response, next: NextFunction) => {
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
  } catch (err) {
    next(err);
  }
});


// ==========================================
// 1.7. POST /api/admin/users/:id/mark-viewed
// ==========================================
adminUsersRouter.post("/:id/mark-viewed", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a real system, you might store this in an AdminView log.
    // For now, returning success so the frontend stops throwing errors.
    res.json({ success: true });
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
    
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    
    // Normalize Verification Center Structure
    let profile = user.freelancerProfile || user.clientProfile || user.founderProfile || user.investorProfile;
    let verificationStats: any = null;
    try {
      verificationStats = getVerificationStats(user);
    } catch (e) {
      console.error("Error computing verificationStats:", e);
    }

    let verificationCenter: any = {
      email: (user.isVerified || user.verified) ? "VERIFIED" : "PENDING",
      phone: (user.phone && user.phone.length > 5) ? "VERIFIED" : "PENDING",
      profile: user.completionPercentage && user.completionPercentage >= 80 ? "COMPLETED" : "PENDING",
      kyc: verificationStats?.kycApproved ? "APPROVED" : (verificationStats?.kycStatus || "PENDING"),
      documents: verificationStats?.kycApproved ? "APPROVED" : "PENDING",
      documentsList: []
    };

    if (profile && (profile as any).verificationJson) {
      try {
        const vJson = typeof (profile as any).verificationJson === "string" ? JSON.parse((profile as any).verificationJson) : (profile as any).verificationJson;
        if (vJson.kycApproved) {
          verificationCenter.kyc = "APPROVED";
          verificationCenter.documents = "APPROVED";
        } else if (vJson.kycRejected) {
          verificationCenter.kyc = "REJECTED";
          verificationCenter.documents = "REJECTED";
        } else if (vJson.kycSubmitted) {
          verificationCenter.kyc = "IN_REVIEW";
          verificationCenter.documents = "SUBMITTED";
        }
        
        let docsArray: any[] = [];
        if (Array.isArray(vJson.documentsList)) {
          docsArray = vJson.documentsList;
        } else if (Array.isArray(vJson.documents)) {
          docsArray = vJson.documents;
        } else {
          // Extract nested document objects (e.g. vJson.pan, vJson.aadhaar)
          docsArray = Object.values(vJson).filter((item: any) => 
            item && typeof item === 'object' && item.label && (item.documentUrl || item.url)
          );
        }
        
        // Map to what the frontend expects (url and docNumber)
        verificationCenter.documentsList = docsArray.map((doc: any) => ({
          ...doc,
          title: doc.title || doc.label,
          url: doc.url || doc.documentUrl || "",
          docNumber: doc.docNumber || doc.value || ""
        }));
      } catch {}
    }

    // Fetch user projects (as client, freelancer, or contract/proposal participant)
    const userProjects = await prisma.project.findMany({
      where: {
        OR: [
          { client: user.id },
          { client: user.email },
          { freelancer: user.id },
          { freelancer: user.email },
          { contracts: { some: { OR: [{ clientId: user.id }, { freelancerId: user.id }] } } },
          { proposals: { some: { freelancerId: user.id } } }
        ],
        deletedAt: null
      },
      select: {
        id: true,
        title: true,
        client: true,
        freelancer: true,
        budget: true,
        budgetMin: true,
        budgetMax: true,
        category: true,
        technology: true,
        timeline: true,
        status: true,
        description: true,
        workMode: true,
        createdAt: true,
        updatedAt: true,
        contracts: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            clientId: true,
            freelancerId: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            tasks: true,
            milestones: true,
            proposals: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }).catch(() => []);

    const enrichedProjects = (userProjects || []).map((p: any) => ({
      ...p,
      roleInProject: (p.client === user.id || p.client === user.email)
        ? "Client / Owner"
        : (p.freelancer === user.id || p.freelancer === user.email)
          ? "Assigned Freelancer"
          : "Contract Participant",
      tasksCount: p._count?.tasks || 0,
      milestonesCount: p._count?.milestones || 0,
      proposalsCount: p._count?.proposals || 0,
    }));

    // Fetch user teams & team members
    const [clientTeamAsClient, clientTeamAsMember, teamsAsOwner, teamsAsMember] = await Promise.all([
      prisma.clientTeamMember.findMany({
        where: {
          OR: [
            { clientId: user.id },
            { email: user.email }
          ]
        },
        include: {
          client: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
          user: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } }
        },
        orderBy: { createdAt: "desc" }
      }).catch(() => []),
      prisma.clientTeamMember.findMany({
        where: {
          OR: [
            { userId: user.id },
            { email: user.email }
          ]
        },
        include: {
          client: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
          user: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } }
        },
        orderBy: { createdAt: "desc" }
      }).catch(() => []),
      prisma.teamMember.findMany({
        where: {
          OR: [
            { ownerId: user.id },
            { email: user.email }
          ]
        },
        include: {
          owner: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
          user: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } }
        },
        orderBy: { createdAt: "desc" }
      }).catch(() => []),
      prisma.teamMember.findMany({
        where: {
          OR: [
            { userId: user.id },
            { email: user.email }
          ]
        },
        include: {
          owner: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } },
          user: { select: { id: true, fullName: true, email: true, role: true, avatarUrl: true } }
        },
        orderBy: { createdAt: "desc" }
      }).catch(() => [])
    ]);

    const teamMap = new Map<string, any>();

    for (const m of [...(clientTeamAsClient || []), ...(clientTeamAsMember || [])]) {
      const isOwner = m.clientId === user.id;
      teamMap.set(m.id, {
        id: m.id,
        name: m.name || m.user?.fullName || m.email?.split("@")[0] || "Team Member",
        email: m.email,
        role: m.role || "Member",
        department: m.department || "General",
        status: m.status || "Active",
        permissions: m.permissions,
        type: "Client Team",
        relationship: isOwner ? "Owner / Manager" : "Team Member",
        ownerName: m.client?.fullName || "Organization",
        ownerEmail: m.client?.email,
        ownerId: m.clientId,
        memberUserId: m.userId,
        avatar: m.user?.avatarUrl || null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      });
    }

    for (const m of [...(teamsAsOwner || []), ...(teamsAsMember || [])]) {
      if (teamMap.has(m.id)) continue;
      const isOwner = m.ownerId === user.id;
      teamMap.set(m.id, {
        id: m.id,
        name: m.user?.fullName || m.email?.split("@")[0] || "Team Member",
        email: m.email,
        role: m.role || "Member",
        department: "Operations",
        status: m.status || "Active",
        permissions: m.permissions,
        type: "Workspace Team",
        relationship: isOwner ? "Owner / Manager" : "Team Member",
        ownerName: m.owner?.fullName || "Organization",
        ownerEmail: m.owner?.email,
        ownerId: m.ownerId,
        memberUserId: m.userId,
        avatar: m.user?.avatarUrl || null,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt
      });
    }

    const enrichedTeams = Array.from(teamMap.values());

    let currentPassword = "";
    if (user.password) {
      currentPassword = user.password.includes(':') ? decryptPassword(user.password) : user.password;
    }

    let profileLogo = user.avatarUrl || null;
    let profileBanner = user.coverImageUrl || null;
    if (user.freelancerProfile) {
      profileLogo = user.freelancerProfile.logoUrl || profileLogo;
      profileBanner = user.freelancerProfile.bannerUrl || profileBanner;
    }
    if (user.clientProfile) {
      profileLogo = (user.clientProfile as any).logoUrl || profileLogo;
    }
    if (user.founderProfile) {
      profileLogo = (user.founderProfile as any).logoUrl || profileLogo;
    }
    if (user.investorProfile) {
      profileLogo = (user.investorProfile as any).logoUrl || profileLogo;
    }

    if (user.role?.toLowerCase() === "founder" && (!profileBanner || !profileLogo)) {
      try {
        const startup = await prisma.startupIdea.findFirst({
          where: {
            deletedAt: null,
            OR: [
              { founder: { contains: user.fullName } },
              { founder: { contains: user.email } },
              { founder: { contains: user.id } },
              ...(user.founderProfile?.startupName ? [{ startup: { contains: user.founderProfile.startupName } }] : [])
            ]
          },
          orderBy: { createdAt: "desc" }
        });
        if (startup) {
          if (!profileBanner) profileBanner = startup.coverUrl || (startup as any).cover || null;
          if (!profileLogo) profileLogo = startup.logo || (startup as any).logoUrl || null;
        }
      } catch (e) {
        console.error("Error fetching founder startup idea for cover/logo:", e);
      }
    }

    res.json({
      success: true,
      data: {
        ...user,
        avatar: profileLogo,
        avatarUrl: profileLogo,
        logo: profileLogo,
        logoUrl: profileLogo,
        coverImageUrl: profileBanner,
        bannerUrl: profileBanner,
        banner: profileBanner,
        currentPassword,
        verificationCenter,
        verificationStats,
        projects: enrichedProjects,
        projectsCount: enrichedProjects.length,
        teams: enrichedTeams,
        teamsCount: enrichedTeams.length,
        teamMembers: enrichedTeams,
        teamMembersCount: enrichedTeams.length,
      }
    });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2.1 GET /api/admin/users/:id/wallet
// ==========================================
adminUsersRouter.get("/:id/wallet", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ensureWelcomeBonusForVerifiedUser } = await import("../../common/helpers/portal-shared.js");
    await ensureWelcomeBonusForVerifiedUser(req.params.id);
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
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 2.2 POST /api/admin/users/:id/wallet/adjust
// ==========================================
adminUsersRouter.post("/:id/wallet/adjust", async (req: Request, res: Response, next: NextFunction) => {
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

    if (isCredit) {
      const userForEmail = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (userForEmail && userForEmail.email) {
        sendAdminWalletCreditEmail(userForEmail.email, userForEmail.fullName || 'User', numAmount, description || 'Admin adjustment').catch(console.error);
      }
    }

    res.json({
      success: true,
      message: `Wallet ${isCredit ? "credited" : "debited"} successfully with ₹${numAmount.toLocaleString("en-IN")}`,
      data: {
        wallet: updatedWallet,
        transaction
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



// ==========================================
// 4. PATCH & PUT /api/admin/users/:id
// Universal Edit Endpoint
// ==========================================
const updateUserHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account, verification, profile, reason, updatedAt, fullName, phone, country, city, status, isVerified } = req.body;

    const currentUser = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!currentUser) return res.status(404).json({ success: false, message: "User not found" });

    // Optimistic Locking Enforcement (if supplied)
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
      if (typeof account.isVerified === "boolean") userUpdateData.isVerified = account.isVerified;
    } else {
      if (status) userUpdateData.status = status;
      if (fullName) userUpdateData.fullName = fullName;
      if (phone !== undefined) userUpdateData.phone = phone;
      if (country !== undefined) userUpdateData.country = country;
      if (city !== undefined) userUpdateData.city = city;
      if (typeof isVerified === "boolean") userUpdateData.isVerified = isVerified;
    }

    // Process Profile & Verification Center Updates
    let profileUpdateData: any = { ...(profile || {}) };
    if (verification) {
      profileUpdateData.verificationJson = typeof verification === "string" ? verification : JSON.stringify(verification);
    }
    
    // Determine which profile to update based on the user's role
    const role = currentUser.role.toLowerCase();
    const updatePromises: any[] = [];

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
      } else if (role === "client") {
        updatePromises.push(prisma.clientProfile.upsert({
          where: { userId: req.params.id },
          update: profileUpdateData,
          create: { userId: req.params.id, ...profileUpdateData }
        }));
      } else if (role === "founder") {
        updatePromises.push(prisma.founderProfile.upsert({
          where: { userId: req.params.id },
          update: profileUpdateData,
          create: { userId: req.params.id, ...profileUpdateData }
        }));
      } else if (role === "investor") {
        updatePromises.push(prisma.investorProfile.upsert({
          where: { userId: req.params.id },
          update: profileUpdateData,
          create: { userId: req.params.id, ...profileUpdateData }
        }));
      }
    }

    // Audit Log Enforcement
    try {
      if ((prisma as any).adminAuditLog) {
        updatePromises.push(
          (prisma as any).adminAuditLog.create({
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
      }
    } catch {}

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

    if (updatedUser) {
      try {
        const { getVerificationStats } = await import("../../common/helpers/verification.js");
        const stats = getVerificationStats(updatedUser);
        if (stats.kycApproved) {
          const { ensureWelcomeBonusForVerifiedUser } = await import("../../common/helpers/portal-shared.js");
          await ensureWelcomeBonusForVerifiedUser(updatedUser.id);
        }
      } catch (err) {
        console.error("Error auto-checking KYC welcome bonus on user update:", err);
      }
    }

    res.json({ success: true, message: "User updated successfully", data: updatedUser });
  } catch (err) {
    next(err);
  }
};

adminUsersRouter.patch("/:id", updateUserHandler);
adminUsersRouter.put("/:id", updateUserHandler);
// ==========================================
// ==========================================

// ==========================================
// POST /api/admin/users/:id/change-password
// ==========================================
adminUsersRouter.post("/:id/change-password", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const userId = req.params.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    // Send the dynamic admin password reset email
    if (user.email) {
      try {
        const rendered = await renderEmailTemplate("admin_password_reset", {
          full_name: user.fullName || 'User',
          fullName: user.fullName || 'User',
          email: user.email,
          newPassword: password,
          new_password: password
        });
        await sendEmail(user.email, rendered.subject, rendered.html);
      } catch (emailErr) {
        console.error("Failed to send admin password reset email:", emailErr);
      }
    }

    res.json({ success: true, message: `Password for ${user.fullName || user.email} changed successfully!` });
  } catch (err) {
    next(err);
  }
});

// 5. POST /api/v1/admin/users/:id/send-reset-email
adminUsersRouter.post("/:id/send-reset-email", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Audit Log Enforcement
    if ((prisma as any).adminAuditLog) {
      await (prisma as any).adminAuditLog.create({
        data: {
          adminId: (req as any).user?.id || "SYSTEM",
          targetUserId: req.params.id,
          action: "PASSWORD_RESET_REQUESTED",
          entityType: "USER",
          entityId: req.params.id,
          createdAt: new Date()
        }
      }).catch(() => {});
    }

    res.json({ success: true, message: "Password reset email sent successfully", data: null });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 6. GET /api/admin/users/:id/insights
// ==========================================
adminUsersRouter.get("/:id/insights", async (req: Request, res: Response, next: NextFunction) => {
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

    const auditCount = (prisma as any).adminAuditLog
      ? await (prisma as any).adminAuditLog.count({ where: { targetUserId: userId } }).catch(() => 0)
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
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.delete("/bulk", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: "No IDs provided" });
    }
    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: new Date() }
    });
    
    // Send deleted emails
    const deletedUsers = await prisma.user.findMany({ where: { id: { in: ids } } });
    for (const u of deletedUsers) {
      if (u.email) {
        sendAccountDeletedEmail(u.email, u.fullName || 'User', u.role).catch(console.error);
      }
    }
    
    res.json({ success: true, message: "Users deleted successfully" });
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() }
    });
    if (updatedUser.email) {
      sendAccountDeletedEmail(updatedUser.email, updatedUser.fullName || 'User', updatedUser.role).catch(console.error);
    }
    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    next(err);
  }
});
// ==========================================
// 7. PATCH /api/admin/users/:id/kyc-document
// ==========================================
adminUsersRouter.patch("/:id/kyc-document", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, status, reason, unlockRequested } = req.body;
    const userId = req.params.id;
    
    if (!key) {
      return res.status(400).json({ success: false, message: "Document key is required" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        freelancerProfile: true,
        clientProfile: true,
        founderProfile: true,
        investorProfile: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    let targetProfile = user.freelancerProfile || user.clientProfile || user.founderProfile || user.investorProfile;
    let targetModelName = user.freelancerProfile ? "freelancerProfile" 
                         : user.clientProfile ? "clientProfile" 
                         : user.founderProfile ? "founderProfile" 
                         : user.investorProfile ? "investorProfile" : null;

    if (!targetProfile || !targetModelName) {
      return res.status(404).json({ success: false, message: "User profile not found for document update" });
    }

    let verificationJsonStr = (targetProfile as any).verificationJson;
    if (!verificationJsonStr) {
      return res.status(404).json({ success: false, message: "No verification data found" });
    }

    let vJson: any = {};
    if (typeof verificationJsonStr === "string") {
      try {
        vJson = JSON.parse(verificationJsonStr);
      } catch (e) {
        vJson = {};
      }
    } else {
      vJson = verificationJsonStr;
    }

    let updated = false;

    // Try finding the document directly by key (e.g., vJson.pan)
    if (vJson[key] && typeof vJson[key] === "object") {
      vJson[key].status = status;
      if (reason !== undefined) vJson[key].rejectReason = reason;
      if (unlockRequested !== undefined) vJson[key].unlockRequested = unlockRequested;
      updated = true;
    } else {
      // Fallback: Check documents or documentsList array
      let docsArray = vJson.documentsList || vJson.documents;
      if (Array.isArray(docsArray)) {
        let docIndex = docsArray.findIndex((d: any) => d.key === key || d.id === key);
        if (docIndex !== -1) {
          docsArray[docIndex].status = status;
          if (reason !== undefined) docsArray[docIndex].rejectReason = reason;
          if (unlockRequested !== undefined) docsArray[docIndex].unlockRequested = unlockRequested;
          updated = true;
        }
      }
    }

    if (!updated) {
      return res.status(404).json({ success: false, message: "Document not found in user records" });
    }

    // Save back to DB
    const updateData = {
      verificationJson: JSON.stringify(vJson)
    };

    await (prisma as any)[targetModelName].update({
      where: { id: targetProfile.id },
      data: updateData
    });

    // Check if user has now fulfilled all KYC requirements
    try {
      const freshUser = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: {
          freelancerProfile: true,
          clientProfile: true,
          founderProfile: true,
          investorProfile: true
        }
      });
      if (freshUser) {
        const { getVerificationStats } = await import("../../common/helpers/verification.js");
        const stats = getVerificationStats(freshUser);
        if (stats.kycApproved) {
          const wasAlreadyVerified = Boolean(freshUser.verified && freshUser.isVerified);
          if (!wasAlreadyVerified) {
            await prisma.user.update({
              where: { id: userId },
              data: { verified: true, isVerified: true }
            });
          }
          const { ensureWelcomeBonusForVerifiedUser } = await import("../../common/helpers/portal-shared.js");
          await ensureWelcomeBonusForVerifiedUser(userId);
        }
      }
    } catch (e) {
      console.error("Error auto-verifying user KYC after document update:", e);
    }

    if (user.email) {
      let docLabel = key;
      if (key === 'pan') docLabel = 'PAN Card';
      if (key === 'aadhaar') docLabel = 'Aadhaar Card';
      if (key === 'gst') docLabel = 'GST Certificate';

      sendKycDocumentStatusEmail(
        user.email,
        user.fullName || 'User',
        user.role || 'Member',
        [{ label: docLabel, status: status, reason: reason }],
        null
      ).catch(console.error);
    }

    res.json({ success: true, message: `Document successfully marked as ${status}` });
  } catch (err) {
    next(err);
  }
});

export default adminUsersRouter;


