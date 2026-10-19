import cron from "node-cron";
import { settleRecurringCashback } from "../services/referral/direct-referral.service.js";
// Run every day at 00:00 (Midnight) UTC for automated cashback settlement
export const initCashbackJob = () => {
    cron.schedule("0 0 * * *", async () => {
        console.log("[CASHBACK JOB] Starting daily direct referral recurring cashback settlement...");
        try {
            const result = await settleRecurringCashback();
            console.log(`[CASHBACK JOB] Settlement completed successfully. Settled: ${result.settledCount}, Total Amount: ₹${result.totalSettledAmount}`);
        }
        catch (err) {
            console.error("[CASHBACK JOB] Error processing direct referral cashback:", err);
        }
    });
};
