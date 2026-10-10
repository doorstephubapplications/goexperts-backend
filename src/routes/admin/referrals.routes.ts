import { Router, Response } from "express";
import { prisma } from "../../config/database.js";
import { authMiddleware, AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

const router = Router();
router.use(authMiddleware as any);

// "?"? Cashback Stats "?"?
router.get("/cashback_stats", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = (req.query.search as string || "").trim().toLowerCase();
    const filter = (req.query.filter as string || "all").toLowerCase();
    
    const skip = (page - 1) * limit;

    const whereClause: any = { type: "referral_cashback" };
    
    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { wallet: { user: { fullName: { contains: search, mode: "insensitive" } } } },
        { wallet: { user: { email: { contains: search, mode: "insensitive" } } } }
      ];
    }
    
    if (filter && filter !== "all") {
      whereClause.description = { contains: filter, mode: "insensitive" };
    }

    // Get aggregated totals for ALL matching transactions
    const aggregate = await prisma.walletTransaction.aggregate({
      where: whereClause,
      _sum: { amount: true },
      _count: true
    });

    const totalDebited = aggregate._sum.amount || 0;
    const totalCount = aggregate._count;

    // Get paginated transactions
    const cashbackTxns = await prisma.walletTransaction.findMany({
      where: whereClause,
      include: {
        wallet: {
          include: {
            user: { select: { id: true, fullName: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    res.json({
      success: true,
      data: {
        totalDebited: parseFloat(totalDebited.toFixed(2)),
        count: totalCount,
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
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

