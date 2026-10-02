import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";

class HttpError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

// List all withdrawals (optional filter by status)
export const listWithdrawals = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.type !== "admin" && req.user?.role !== "super_admin") {
      throw new HttpError("Admin access required", 403);
    }
    const { status } = req.query;
    const whereClause: any = { type: "withdrawal" };
    if (status) {
      whereClause.status = status;
    }
    const transactions = await prisma.walletTransaction.findMany({
      where: whereClause,
      include: {
        wallet: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, avatarUrl: true, role: true }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, rows: transactions, total: transactions.length });
  } catch (err) {
    next(err);
  }
};

// Approve withdrawal
export const approveWithdrawal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.type !== "admin" && req.user?.role !== "super_admin") {
      throw new HttpError("Super Admin access required", 403);
    }
    const { id } = req.params;
    const txn = await prisma.walletTransaction.findUnique({ where: { id } });
    if (!txn || txn.type !== "withdrawal") {
      throw new HttpError("Withdrawal not found", 404);
    }
    if (txn.status !== "pending") {
      throw new HttpError(`Cannot approve a ${txn.status} withdrawal`);
    }

    const updated = await prisma.walletTransaction.update({
      where: { id },
      data: { status: "completed" },
    });

    // Notify user
    try {
      const wallet = await prisma.wallet.findUnique({ where: { id: txn.walletId } });
      if (wallet?.userId) {
        await prisma.notification.create({
          data: {
            userId: wallet.userId,
            title: "Withdrawal Approved",
            message: `Your withdrawal of ₹${txn.amount} has been approved.`,
            type: "WITHDRAWAL_APPROVED",
            channel: "in-app"
          }
        });
      }
    } catch {}

    res.json({ success: true, message: "Withdrawal approved successfully", data: updated });
  } catch (err) {
    next(err);
  }
};

// Reject withdrawal (Refunds wallet)
export const rejectWithdrawal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.type !== "admin" && req.user?.role !== "super_admin") {
      throw new HttpError("Super Admin access required", 403);
    }
    const { id } = req.params;
    const txn = await prisma.walletTransaction.findUnique({ 
      where: { id },
      include: { wallet: true }
    });
    
    if (!txn || txn.type !== "withdrawal") {
      throw new HttpError("Withdrawal not found", 404);
    }
    if (txn.status !== "pending") {
      throw new HttpError(`Cannot reject a ${txn.status} withdrawal`);
    }

    // Refund and mark rejected
    const result = await prisma.$transaction(async (tx) => {
      const updatedTxn = await tx.walletTransaction.update({
        where: { id },
        data: { status: "rejected" },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: txn.wallet.id },
        data: { balance: { increment: txn.amount } }
      });

      // Create refund transaction log
      await tx.walletTransaction.create({
        data: {
          walletId: txn.wallet.id,
          type: "refund",
          amount: txn.amount,
          direction: "credit",
          description: `Refund for rejected withdrawal (${id.slice(0, 8)})`,
          balanceAfter: updatedWallet.balance,
          status: "completed"
        }
      });

      return updatedTxn;
    });

    try {
      const { emitToAdmins } = await import("../../services/notifications/notification-events.service.js");
      await emitToAdmins({
        type: "PAYOUT_FAILED",
        title: "Withdrawal Rejected",
        message: `Withdrawal of ₹${txn.amount} by user ${txn.wallet?.userId} was rejected and refunded.`,
        contextType: "withdrawal",
        contextId: id,
        priority: "high",
      });
    } catch (e) { console.error("Admin emit error", e); }

    res.json({ success: true, message: "Withdrawal rejected and refunded", data: result });
  } catch (err) {
    next(err);
  }
};

// Credit money directly to a user's wallet (Admin action)
export const creditWallet = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.type !== "admin" && req.user?.role !== "super_admin") {
      throw new HttpError("Admin access required", 403);
    }
    const { userId, amount, description } = req.body;
    if (!userId || !amount || Number(amount) <= 0) {
      throw new HttpError("userId and a positive amount are required");
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new HttpError("Wallet not found for this user", 404);

    const result = await prisma.$transaction(async (tx) => {
      const newBalance = wallet.balance + Number(amount);
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance }
      });
      const txn = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "credit",
          direction: "credit",
          amount: Number(amount),
          description: description || "Admin credit",
          balanceAfter: updatedWallet.balance,
          status: "completed"
        }
      });
      await tx.notification.create({
        data: {
          userId,
          title: "Wallet Credited",
          message: `₹${amount} has been added to your wallet by admin.`,
          type: "WALLET_CREDITED",
          channel: "in-app"
        }
      });
      return { wallet: updatedWallet, transaction: txn };
    });

    res.json({ success: true, message: `₹${amount} credited to wallet successfully`, data: result });
  } catch (err) {
    next(err);
  }
};

export const bulkStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user?.type !== "admin" && req.user?.role !== "super_admin") {
      throw new HttpError("Super Admin access required", 403);
    }
    const { ids, value, field, adminNotes } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0 || field !== "status") {
      throw new HttpError("Invalid parameters");
    }

    let processedCount = 0;
    for (const id of ids) {
      const txn = await prisma.walletTransaction.findUnique({ where: { id }, include: { wallet: { include: { user: true } } } });
      if (!txn || txn.type !== "withdrawal" || txn.status !== "pending") continue;

      if (value === "completed") {
        await prisma.walletTransaction.update({
          where: { id },
          data: { status: "completed" },
        });

        if (txn.wallet?.userId) {
          await prisma.notification.create({
            data: {
              userId: txn.wallet.userId,
              title: "Withdrawal Approved",
              message: `Your withdrawal of ₹${txn.amount} has been approved. ${adminNotes ? 'Note: ' + adminNotes : ''}`,
              type: "WITHDRAWAL_APPROVED",
              channel: "in-app"
            }
          });
          
          if (txn.wallet.user?.email) {
            try {
              const { sendEmail } = await import("../../services/mobile/email.service.js");
              const { renderEmailTemplate } = await import("../../services/settings/settings.service.js");
              const frontendUrl = process.env.FRONTEND_URL || "https://goexperts.in";
              
              const rendered = await renderEmailTemplate("tpl_withdrawal_approved", {
                customer_name: txn.wallet.user.fullName || "User",
                amount: `₹${txn.amount}`,
                withdrawal_id: id.substring(0, 8).toUpperCase(),
                notes: adminNotes || "Processed successfully",
                date: new Date().toLocaleString(),
                login_url: `${frontendUrl}/login`
              });
              await sendEmail(txn.wallet.user.email, rendered.subject, rendered.html);
            } catch (mailErr) {
              console.warn("Failed to send withdrawal approval email:", mailErr);
            }
          }
        }
        processedCount++;
      } else if (value === "rejected") {
        await prisma.$transaction(async (tx) => {
          await tx.walletTransaction.update({
            where: { id },
            data: { status: "rejected" },
          });

          const updatedWallet = await tx.wallet.update({
            where: { id: txn.wallet.id },
            data: { balance: { increment: txn.amount } }
          });

          await tx.walletTransaction.create({
            data: {
              walletId: txn.wallet.id,
              type: "refund",
              amount: txn.amount,
              direction: "credit",
              description: `Refund for rejected withdrawal (${id.slice(0, 8)}) - ${adminNotes || ''}`,
              balanceAfter: updatedWallet.balance,
              status: "completed"
            }
          });
        });
        
        if (txn.wallet?.userId) {
          await prisma.notification.create({
            data: {
              userId: txn.wallet.userId,
              title: "Withdrawal Rejected",
              message: `Your withdrawal of ₹${txn.amount} was rejected and refunded. ${adminNotes ? 'Reason: ' + adminNotes : ''}`,
              type: "WITHDRAWAL_REJECTED",
              channel: "in-app"
            }
          });
        }
        processedCount++;
      }
    }

    res.json({ success: true, message: `Successfully updated ${processedCount} records` });
  } catch (err) {
    next(err);
  }
};
