import { Router, Response } from "express";
import { prisma } from "../../config/database.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware as any);

// Campaigns
router.get("/referral_campaigns", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await prisma.referralCampaign.findMany({
      include: { rules: true, clicks: true, referrals: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching campaigns" });
  }
});

router.post("/referral_campaigns", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaign = await prisma.referralCampaign.create({ data: req.body });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating campaign" });
  }
});

router.put("/referral_campaigns/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const campaign = await prisma.referralCampaign.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating campaign" });
  }
});

router.delete("/referral_campaigns/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.referralCampaign.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting campaign" });
  }
});

// Rules
router.get("/referral_rules", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rules = await prisma.referralRule.findMany({
      orderBy: { campaignId: "asc" },
    });
    res.json({ success: true, data: rules });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching rules" });
  }
});

router.post("/referral_rules", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await prisma.referralRule.create({ data: req.body });
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error creating rule" });
  }
});

router.put("/referral_rules/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rule = await prisma.referralRule.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json({ success: true, data: rule });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error updating rule" });
  }
});

router.delete("/referral_rules/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    await prisma.referralRule.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting rule" });
  }
});

  // Pending Referrals — server-side pagination, search, type & status filter
  router.get("/pending_referrals", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page       = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize   = Math.min(100, parseInt(req.query.pageSize as string) || 15);
      const skip       = (page - 1) * pageSize;
      const search     = (req.query.search as string || "").trim().toLowerCase();
      const typeFilter = (req.query.type   as string || "ALL").toUpperCase();
      const statusFilter = (req.query.status as string || "ALL").toUpperCase();

      // ── All possible status values per bucket ─────────────────────────────
      const WT_PENDING_VALS  = ["pending", "PENDING"];
      const WT_CREDITED_VALS = ["completed", "COMPLETED", "credited", "CREDITED", "approved", "APPROVED", "rewarded", "REWARDED"];
      const WT_REJECTED_VALS = ["failed", "FAILED", "rejected", "REJECTED"];

      const REF_PENDING_VALS  = ["pending", "PENDING"];
      const REF_CREDITED_VALS = ["successful","SUCCESSFUL","credited","CREDITED","approved","APPROVED","completed","COMPLETED","rewarded","REWARDED"];
      const REF_REJECTED_VALS = ["rejected","REJECTED","failed","FAILED"];

      // ── STATS via Prisma count/aggregate (always unfiltered) ──────────────
      const [
        wtTotal, wtPendingCount, wtCreditedCount, wtAmtAgg,
        refTotal, refPendingCount, refApprovedCount,
      ] = await Promise.all([
        prisma.walletTransaction.count({ where: { type: "welcome_bonus" } }),
        prisma.walletTransaction.count({ where: { type: "welcome_bonus", OR: [{ status: { in: WT_PENDING_VALS } }, { status: null }] } }),
        prisma.walletTransaction.count({ where: { type: "welcome_bonus", status: { in: WT_CREDITED_VALS } } }),
        prisma.walletTransaction.aggregate({ where: { type: "welcome_bonus", status: { in: WT_CREDITED_VALS } }, _sum: { amount: true } }),
        prisma.referral.count({ where: { referee: { is: { deletedAt: null } } } }),
        prisma.referral.count({ where: { referee: { is: { deletedAt: null } }, status: { in: REF_PENDING_VALS } } }),
        prisma.referral.count({ where: { referee: { is: { deletedAt: null } }, status: { in: REF_CREDITED_VALS } } }),
      ]);

      const stats = {
        totalWelcome:   wtTotal,
        wtPending:      wtPendingCount,
        wtCredited:     wtCreditedCount,
        wtCreditedAmt:  parseFloat(String(wtAmtAgg._sum?.amount ?? 0)) || 0,
        totalReferrals: refTotal,
        refPending:     refPendingCount,
        refApproved:    refApprovedCount,
      };

      // ── STATUS FILTER MAPS for paginated data ─────────────────────────────
      const wtStatusMap: Record<string, string[]> = {
        PENDING:  WT_PENDING_VALS,
        CREDITED: WT_CREDITED_VALS,
        REJECTED: WT_REJECTED_VALS,
      };
      const refStatusMap: Record<string, string[]> = {
        PENDING:  REF_PENDING_VALS,
        CREDITED: REF_CREDITED_VALS,
        REJECTED: REF_REJECTED_VALS,
      };

      // ── WELCOME BONUSES filtered data ─────────────────────────────────────
      const wtWhere: any = { type: "welcome_bonus" };
      if (statusFilter !== "ALL" && wtStatusMap[statusFilter]) {
        if (statusFilter === "PENDING") {
          wtWhere.OR = [{ status: { in: WT_PENDING_VALS } }, { status: null }];
        } else {
          wtWhere.status = { in: wtStatusMap[statusFilter] };
        }
      }

      const welcomeBonusesFull = await prisma.walletTransaction.findMany({
        where: wtWhere,
        include: { wallet: { include: { user: { select: { fullName: true, email: true, role: true } } } } },
        orderBy: { createdAt: "desc" },
      });

      let mappedWelcome = welcomeBonusesFull.map((tx: any) => ({
        id: tx.id, type: "WELCOME",
        status: tx.status || "PENDING",
        amount: parseFloat(tx.amount) || 0,
        createdAt: tx.createdAt, updatedAt: tx.updatedAt,
        referrerId: tx.wallet?.userId ?? null, refereeId: null,
        referrer: tx.wallet?.user ?? null, referee: null,
      }));

      if (search) {
        mappedWelcome = mappedWelcome.filter((r: any) =>
          r.referrer?.fullName?.toLowerCase().includes(search) ||
          r.referrer?.email?.toLowerCase().includes(search) ||
          r.id?.toLowerCase().includes(search)
        );
      }

      // ── REFERRAL BONUSES filtered data ────────────────────────────────────
      const refWhere: any = { referee: { is: { deletedAt: null } } };
      if (statusFilter !== "ALL" && refStatusMap[statusFilter]) {
        refWhere.status = { in: refStatusMap[statusFilter] };
      }

      const referralsFull = await prisma.referral.findMany({
        where: refWhere,
        include: {
          referrer: { select: { fullName: true, email: true, role: true } },
          referee:  { select: { fullName: true, email: true, isVerified: true, verified: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      let mappedReferrals = referralsFull.map((r: any) => ({ ...r, type: "REFERRAL", amount: 0 }));

      if (search) {
        mappedReferrals = mappedReferrals.filter((r: any) =>
          r.referrer?.fullName?.toLowerCase().includes(search) ||
          r.referrer?.email?.toLowerCase().includes(search) ||
          r.referee?.fullName?.toLowerCase().includes(search) ||
          r.referee?.email?.toLowerCase().includes(search) ||
          r.id?.toLowerCase().includes(search)
        );
      }

      // ── Merge & paginate ──────────────────────────────────────────────────
      let combined: any[] = [];
      if (typeFilter === "WELCOME")        combined = mappedWelcome;
      else if (typeFilter === "REFERRAL")  combined = mappedReferrals;
      else combined = [...mappedWelcome, ...mappedReferrals];

      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const total     = combined.length;
      const paginated = combined.slice(skip, skip + pageSize);

      res.json({ success: true, data: paginated, pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) }, stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Error fetching pending referrals: " + (error?.message || error) });
    }
  });




  // Bulk approve welcome bonuses
  router.post("/pending_referrals/bulk-approve", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: "No IDs provided" });
      }
      let approved = 0;
      for (const id of ids) {
        try {
          const wt = await prisma.walletTransaction.findUnique({ where: { id } });
          if (wt && (wt.status?.toLowerCase() === "pending")) {
            await prisma.walletTransaction.update({ where: { id }, data: { status: "completed" } });
            approved++;
          }
          // also try referral
          const ref = await prisma.referral.findUnique({ where: { id } });
          if (ref && ref.status === "PENDING") {
            await prisma.referral.update({ where: { id }, data: { status: "SUCCESSFUL" } });
            approved++;
          }
        } catch (_) {}
      }
      res.json({ success: true, message: `${approved} record(s) approved.` });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Bulk approve failed: " + (error?.message || error) });
    }
  });

  // Bulk reject
  router.post("/pending_referrals/bulk-reject", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { ids } = req.body as { ids: string[] };
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: "No IDs provided" });
      }
      let rejected = 0;
      for (const id of ids) {
        try {
          const wt = await prisma.walletTransaction.findUnique({ where: { id } });
          if (wt && (wt.status?.toLowerCase() === "pending")) {
            await prisma.walletTransaction.update({ where: { id }, data: { status: "rejected" } });
            rejected++;
          }
          const ref = await prisma.referral.findUnique({ where: { id } });
          if (ref && ref.status === "PENDING") {
            await prisma.referral.update({ where: { id }, data: { status: "REJECTED" } });
            rejected++;
          }
        } catch (_) {}
      }
      res.json({ success: true, message: `${rejected} record(s) rejected.` });
    } catch (error: any) {
      res.status(500).json({ success: false, message: "Bulk reject failed: " + (error?.message || error) });
    }
  });

router.put("/pending_referrals/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, amount } = req.body;

    // Try WalletTransaction (Welcome Bonus)
    const wt = await prisma.walletTransaction.findUnique({ where: { id } });
    if (wt) {
      await prisma.walletTransaction.update({
        where: { id },
        data: { 
          status: status || wt.status,
          amount: amount !== undefined ? Number(amount) : wt.amount 
        }
      });
      return res.json({ success: true, message: "Welcome Bonus updated" });
    }

    // Try Referral (Referral Bonus)
    const ref = await prisma.referral.findUnique({ where: { id } });
    if (ref) {
      await prisma.referral.update({
        where: { id },
        data: { status: status || ref.status }
      });
      return res.json({ success: true, message: "Referral updated" });
    }

    return res.status(404).json({ success: false, message: "Record not found" });
  } catch (error) {
    console.error("Error updating record", error);
    res.status(500).json({ success: false, message: "Error updating record" });
  }
});

router.post("/pending_referrals/:id/approve", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const referralId = req.params.id;
    const referral = await prisma.referral.findUnique({ where: { id: referralId } });
    if (!referral) return res.status(404).json({ success: false, message: "Referral not found" });
    if (referral.status !== "PENDING") return res.status(400).json({ success: false, message: "Referral already processed" });

    // Fetch settings to get configured amount
    const settingsRaw = await prisma.setting.findUnique({ where: { key: "app_settings" } });
    let amount = 25; // fallback
    if (settingsRaw?.value) {
      try {
        const parsed = typeof settingsRaw.value === "string" ? JSON.parse(settingsRaw.value) : settingsRaw.value;
        if (parsed.referral_amount) amount = Number(parsed.referral_amount);
      } catch (e) {}
    }

    // Process approval
    await prisma.$transaction(async (tx: any) => {
      // 1. Update referral status
      await tx.referral.update({
        where: { id: referralId },
        data: { status: "SUCCESSFUL" }
      });
      // 2. Add to wallet
      await tx.walletTransaction.create({
        data: {
          walletId: referral.referrerId, // Assuming wallet mapping or using user ID
          userId: referral.referrerId,
          type: "referral_credit",
          amount: amount.toString(),
          credit: amount.toString(),
          debit: "0",
          balance: "0", // Wallet balances should technically be updated, handled via triggers or views in real app
          status: "completed",
          description: "Refer & Earn Reward",
          currency: "INR"
        }
      });
    });

    res.json({ success: true, message: "Referral approved and reward credited!" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error approving referral" });
  }
});

// ── Cashback Stats ──
router.get("/cashback_stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Get all cashback transactions
    const cashbackTxns = await prisma.walletTransaction.findMany({
      where: { type: "referral_cashback" },
      include: {
        wallet: {
          include: {
            user: { select: { id: true, fullName: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    console.log("CASHBACK TXNS FOUND:", cashbackTxns.length);

    const totalDebited = cashbackTxns.reduce((sum, t) => sum + (t.amount || 0), 0);
    console.log("TOTAL DEBITED:", totalDebited);

    res.json({
      success: true,
      data: {
        totalDebited: parseFloat(totalDebited.toFixed(2)),
        count: cashbackTxns.length,
        transactions: cashbackTxns.map(t => ({
          id: t.id,
          amount: t.amount,
          description: t.description,
          createdAt: t.createdAt,
          user: t.wallet?.user,
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching cashback stats" });
  }
});

export default router;

