import { prisma } from "../config/database.js";
async function main() {
    try {
        await prisma.$connect();
        console.log("Connected to database successfully!");
        const count = await prisma.subscriptionPlan.count();
        console.log("Total subscription plans in DB:", count);
        const plans = await prisma.subscriptionPlan.findMany({
            select: {
                id: true,
                name: true,
                role: true,
                amount: true,
                originalAmount: true,
                duration: true,
                status: true,
                visibility: true,
                proposalsLimit: true,
                projectsLimit: true,
            },
            orderBy: { amount: "asc" },
        });
        console.log("Plans in DB:\n", JSON.stringify(plans, null, 2));
        const subsCount = await prisma.subscription.count();
        console.log("Total active/historical subscriptions in DB:", subsCount);
        const invoicesCount = await prisma.invoice.count();
        console.log("Total invoices in DB:", invoicesCount);
    }
    catch (err) {
        console.error("Database inspection error:", err.message);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
