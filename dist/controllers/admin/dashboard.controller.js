import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export const getExecutiveOverview = async (req, res) => {
    try {
        const activeUsers = await prisma.user.count({ where: { status: "active" } });
        const pendingApprovals = await prisma.user.count({ where: { status: "pending" } });
        // In a real system, you'd check active sessions
        const onlineAdmins = await prisma.session.count({
            where: { expiresAt: { gt: new Date() }, revokedAt: null }
        });
        res.json({
            platformHealth: 98,
            activeUsers,
            onlineAdmins,
            pendingApprovals
        });
    }
    catch (error) {
        console.error("[Dashboard] Error in getExecutiveOverview:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getRevenueOverview = async (req, res) => {
    try {
        // Note: Adjust table queries to match actual schema fields for payments
        const payments = await prisma.payment.findMany({
            where: { status: "completed" }
        });
        const mtdRevenue = payments
            .filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth())
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const ytdRevenue = payments
            .filter(p => new Date(p.createdAt).getFullYear() === new Date().getFullYear())
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const prevMonthPayments = payments
            .filter(p => {
            const d = new Date(p.createdAt);
            const now = new Date();
            return d.getMonth() === (now.getMonth() - 1 + 12) % 12 && d.getFullYear() === now.getFullYear();
        })
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const growth = prevMonthPayments > 0
            ? (((mtdRevenue - prevMonthPayments) / prevMonthPayments) * 100)
            : 0;
        res.json({ mtdRevenue, ytdRevenue, growth: parseFloat(growth.toFixed(1)) });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getRevenueChart = async (req, res) => {
    try {
        const payments = await prisma.payment.findMany({ where: { status: "completed" } });
        const currentYear = new Date().getFullYear();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = months.map(m => ({ month: m, subscriptions: 0, commissions: 0, featured: 0, ads: 0 }));
        payments.forEach(p => {
            const d = new Date(p.createdAt);
            if (d.getFullYear() === currentYear) {
                const idx = d.getMonth();
                const amount = Number(p.amount) || 0;
                const type = String(p.type || p.category || "").toLowerCase();
                if (type.includes("commission") || type.includes("fee"))
                    chartData[idx].commissions += amount;
                else if (type.includes("featured") || type.includes("listing"))
                    chartData[idx].featured += amount;
                else if (type.includes("ad") || type.includes("sponsor"))
                    chartData[idx].ads += amount;
                else
                    chartData[idx].subscriptions += amount;
            }
        });
        res.json(chartData.slice(0, new Date().getMonth() + 1));
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getEcosystem = async (req, res) => {
    try {
        const freelancers = await prisma.user.count({ where: { role: "FREELANCER" } });
        const verifiedFreelancers = await prisma.user.count({ where: { role: "FREELANCER", isVerified: true } });
        const clients = await prisma.user.count({ where: { role: "CLIENT" } });
        const verifiedClients = await prisma.user.count({ where: { role: "CLIENT", isVerified: true } });
        const founders = await prisma.user.count({ where: { role: "FOUNDER" } });
        const investors = await prisma.user.count({ where: { role: "INVESTOR" } });
        res.json({
            freelancers: { total: freelancers, verified: verifiedFreelancers, active: Math.floor(freelancers * 0.4) },
            clients: { total: clients, verified: verifiedClients, active: Math.floor(clients * 0.3) },
            founders: { total: founders, verified: 0, active: 0 },
            investors: { total: investors, verified: 0, active: 0 }
        });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getFunding = async (req, res) => {
    try {
        const activeInvestors = await prisma.user.count({ where: { role: "INVESTOR", status: "active" } });
        const pendingPitches = await prisma.startupIdea.count({ where: { status: "pending" } }).catch(() => 0);
        const fundedStartups = await prisma.investment.count({ where: { status: "completed" } }).catch(() => 0);
        const ideas = await prisma.startupIdea.findMany({ select: { funding: true } }).catch(() => []);
        const avgRequest = ideas.length > 0 ? ideas.reduce((acc, i) => acc + i.funding, 0) / ideas.length : 0;
        res.json({ openFunding: 0, activeInvestors, pendingPitches, fundedStartups, successRate: 0, avgRequest, fundingGrowth: 0 });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getPlatformHealth = async (req, res) => {
    try {
        const pendingApprovals = await prisma.user.count({ where: { status: "pending" } });
        const completedPayments = await prisma.payment.count({ where: { status: "completed" } });
        const failedLogins = await prisma.loginAttempt.count({
            where: { success: false, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        }).catch(() => 0);
        res.json({
            database: "operational",
            api: "operational",
            storage: "operational",
            payments: completedPayments > 0 ? "operational" : "warning",
            email: failedLogins > 5 ? "warning" : "operational",
            sockets: "operational",
            queueWorkers: pendingApprovals > 50 ? "warning" : "operational",
            aiServices: "operational"
        });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getModeration = async (req, res) => {
    try {
        const pendingKyc = await prisma.user.count({ where: { isVerified: false, status: "pending" } });
        const reportedUsers = await prisma.report.count({ where: { status: "pending" } });
        const projectReviews = await prisma.review.count({ where: { status: "pending" } }).catch(() => 0);
        const supportTickets = await prisma.conversation.count({ where: { contextType: "support", status: "active" } }).catch(() => 0);
        res.json({ pendingKyc, reportedProfiles: reportedUsers, flaggedMessages: 0, projectReviews, supportTickets });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getSecurity = async (req, res) => {
    try {
        const failedLogins = await prisma.loginAttempt.count({
            where: { success: false, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        }).catch(() => 0);
        const blockedAccounts = await prisma.user.count({ where: { status: "blocked" } });
        const suspiciousActivities = await prisma.loginAttempt.count({
            where: { success: false, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } }
        }).catch(() => 0);
        const activeAdminSessions = await prisma.session.count({ where: { expiresAt: { gt: new Date() }, revokedAt: null } });
        res.json({ failedLogins, blockedAccounts, suspiciousActivities, activeAdminSessions });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getActivity = async (req, res) => {
    try {
        const recentUsers = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, role: true, createdAt: true, fullName: true }
        });
        const activity = recentUsers.map(u => ({
            id: u.id,
            action: `${u.fullName || 'User'} registered as ${u.role.toLowerCase()}`,
            time: u.createdAt,
            type: u.role.toLowerCase()
        }));
        res.json(activity);
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getNotifications = async (req, res) => {
    try {
        const newThisMonth = await prisma.user.count({
            where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }
        });
        const pendingPitches = await prisma.startupIdea.count({ where: { status: "pending" } }).catch(() => 0);
        const blockedAccounts = await prisma.user.count({ where: { status: "blocked" } });
        const failedLogins = await prisma.loginAttempt.count({
            where: { success: false, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        }).catch(() => 0);
        res.json([
            { id: 1, title: "New Registrations", message: `${newThisMonth} new users joined this month.`, type: "info" },
            { id: 2, title: "Investment Pitches", message: pendingPitches > 0 ? `${pendingPitches} pitches awaiting review.` : "No pending pitches.", type: "info" },
            { id: 3, title: "System Warning", message: failedLogins > 5 ? `${failedLogins} failed login attempts detected.` : "All systems normal.", type: "warning" },
            { id: 4, title: "Security Alert", message: blockedAccounts > 0 ? `${blockedAccounts} accounts are blocked.` : "No blocked accounts.", type: "critical" }
        ]);
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getSearch = async (req, res) => {
    try {
        const q = String(req.query.q || "");
        if (!q)
            return res.json({ users: [], projects: [] });
        const users = await prisma.user.findMany({
            where: {
                OR: [
                    { fullName: { contains: q } },
                    { email: { contains: q } }
                ]
            },
            take: 5,
            select: { id: true, fullName: true, email: true, role: true }
        });
        res.json({
            users,
            projects: []
        });
    }
    catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
export const getOverview = async (req, res) => {
    try {
        const activeUsers = await prisma.user.count({ where: { status: "active" } });
        const pendingApprovals = await prisma.user.count({ where: { status: "pending" } });
        const verifiedUsers = await prisma.user.count({ where: { isVerified: true } });
        const newThisMonth = await prisma.user.count({
            where: {
                createdAt: {
                    gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
            }
        });
        const activeToday = await prisma.session.count({
            where: {
                createdAt: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
            }
        });
        const onlineAdmins = await prisma.session.count({
            where: { expiresAt: { gt: new Date() }, revokedAt: null }
        });
        const payments = await prisma.payment.findMany({
            where: { status: "completed" }
        });
        const geoGroups = await prisma.user.groupBy({
            by: ['country'],
            _count: { id: true },
            where: { country: { not: null } },
            orderBy: { _count: { id: 'desc' } },
            take: 5
        });
        const mtdRevenue = payments
            .filter(p => new Date(p.createdAt).getMonth() === new Date().getMonth())
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const ytdRevenue = payments
            .filter(p => new Date(p.createdAt).getFullYear() === new Date().getFullYear())
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const currentYear = new Date().getFullYear();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const chartData = months.map(m => ({ month: m, subscriptions: 0, commissions: 0, featured: 0, ads: 0 }));
        payments.forEach(p => {
            const d = new Date(p.createdAt);
            if (d.getFullYear() === currentYear) {
                const monthIndex = d.getMonth();
                const amount = Number(p.amount) || 0;
                const type = String(p.type || p.category || p.purpose || "subscriptions").toLowerCase();
                if (type.includes("commission") || type.includes("fee")) {
                    chartData[monthIndex].commissions += amount;
                }
                else if (type.includes("featured") || type.includes("listing")) {
                    chartData[monthIndex].featured += amount;
                }
                else if (type.includes("ad") || type.includes("sponsor")) {
                    chartData[monthIndex].ads += amount;
                }
                else {
                    chartData[monthIndex].subscriptions += amount;
                }
            }
        });
        const freelancers = await prisma.user.count({ where: { role: "FREELANCER" } });
        const verifiedFreelancers = await prisma.user.count({ where: { role: "FREELANCER", isVerified: true } });
        const clients = await prisma.user.count({ where: { role: "CLIENT" } });
        const verifiedClients = await prisma.user.count({ where: { role: "CLIENT", isVerified: true } });
        const founders = await prisma.user.count({ where: { role: "FOUNDER" } });
        const investors = await prisma.user.count({ where: { role: "INVESTOR" } });
        const pendingKyc = await prisma.user.count({ where: { isVerified: false, status: "pending" } });
        const reportedUsers = await prisma.report.count({ where: { status: "pending" } });
        const failedLogins = await prisma.loginAttempt.count({
            where: { success: false, createdAt: { gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
        }).catch(() => 0); // Catch in case table missing
        const blockedAccounts = await prisma.user.count({ where: { status: "blocked" } });
        // Fetch real metrics instead of dummy data
        const activeJobsCount = await prisma.project.count({ where: { status: "open" } });
        const pendingPitchesCount = await prisma.startupIdea.count({ where: { status: "pending" } }).catch(() => 0);
        const fundedStartupsCount = await prisma.investment.count({ where: { status: "completed" } }).catch(() => 0);
        // Average ask
        const ideas = await prisma.startupIdea.findMany({ select: { funding: true } }).catch(() => []);
        const avgAsk = ideas.length > 0 ? ideas.reduce((acc, idea) => acc + idea.funding, 0) / ideas.length : 0;
        const capitalPool = await prisma.investorProfile.aggregate({ _sum: { ticketMax: true } }).catch(() => ({ _sum: { ticketMax: 0 } }));
        // Moderation and Security
        const projectReviewsCount = await prisma.review.count({ where: { status: "pending" } }).catch(() => 0);
        const supportTicketsCount = await prisma.conversation.count({ where: { contextType: "support", status: "active" } }).catch(() => 0);
        const suspiciousActivitiesCount = await prisma.loginAttempt.count({
            where: { success: false, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } }
        }).catch(() => 0);
        // Latest activity feed from real users
        const recentUsers = await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, take: 4, select: { id: true, role: true, createdAt: true } });
        const realActivity = recentUsers.map(u => ({
            id: u.id,
            action: `New ${u.role.toLowerCase()} registered`,
            time: u.createdAt,
            type: u.role.toLowerCase()
        }));
        // Compute revenue growth: current month vs previous month — purely from DB payments
        const prevMonthRevenue = payments
            .filter(p => {
            const d = new Date(p.createdAt);
            const now = new Date();
            return d.getMonth() === (now.getMonth() - 1 + 12) % 12 && d.getFullYear() === now.getFullYear();
        })
            .reduce((sum, p) => sum + Number(p.amount), 0);
        const revenueGrowth = prevMonthRevenue > 0
            ? parseFloat((((mtdRevenue - prevMonthRevenue) / prevMonthRevenue) * 100).toFixed(1))
            : null;
        // Active freelancers = verified + active in DB
        const activeFreelancers = await prisma.user.count({
            where: { role: "FREELANCER", status: "active", isVerified: true }
        });
        // Active clients = those who have posted at least 1 project
        const activeClients = await prisma.clientProfile.count({
            where: { projectsPosted: { gt: 0 } }
        });
        // Open project total budget — used as a funding proxy
        const openProjectsBudget = await prisma.project.aggregate({
            _sum: { budget: true },
            where: { status: "open" }
        });
        const activeInvestors = await prisma.user.count({ where: { role: "INVESTOR", status: "active" } });
        const activeAdminSessions = await prisma.session.count({
            where: { expiresAt: { gt: new Date() }, revokedAt: null }
        });
        const colors = ["bg-blue-500", "bg-indigo-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500"];
        res.json({
            executive: {
                activeUsers,
                onlineAdmins,
                pendingApprovals,
                newThisMonth,
                verifiedUsers,
                activeToday
            },
            revenue: {
                mtdRevenue,
                ytdRevenue,
                revenueGrowth
            },
            ecosystem: {
                freelancers: {
                    total: freelancers,
                    verified: verifiedFreelancers,
                    active: activeFreelancers,
                    activeJobs: activeJobsCount
                },
                clients: {
                    total: clients,
                    verified: verifiedClients,
                    active: activeClients,
                    hiringNow: activeJobsCount
                },
                founders: {
                    total: founders,
                    funded: fundedStartupsCount,
                    pendingPitch: pendingPitchesCount,
                    avgAsk: avgAsk
                },
                investors: {
                    total: investors,
                    capitalPool: capitalPool._sum?.ticketMax ?? null
                }
            },
            funding: {
                openFunding: openProjectsBudget._sum?.budget ?? null,
                activeInvestors,
                pendingPitches: pendingPitchesCount,
                fundedStartups: fundedStartupsCount,
                avgRequest: avgAsk
            },
            platformHealth: {
                database: "operational",
                api: "operational",
                payments: payments.length > 0 ? "operational" : "warning",
                email: failedLogins > 5 ? "warning" : "operational",
                queueWorkers: pendingApprovals > 50 ? "warning" : "operational"
            },
            moderation: {
                pendingKyc,
                reportedProfiles: reportedUsers,
                projectReviews: projectReviewsCount,
                supportTickets: supportTicketsCount
            },
            security: {
                failedLogins,
                blockedAccounts,
                suspiciousActivities: suspiciousActivitiesCount,
                activeAdminSessions
            },
            activity: realActivity,
            chart: chartData.slice(0, new Date().getMonth() + 1),
            geoData: geoGroups.map((g, i) => ({
                country: g.country,
                users: g._count.id,
                revenue: `₹${((ytdRevenue * (activeUsers > 0 ? g._count.id / activeUsers : 0)) / 100000).toFixed(1)}L`,
                color: colors[i % colors.length]
            })),
            notifications: [
                {
                    id: 1,
                    title: "New Registrations",
                    desc: `${newThisMonth} new users joined this month.`,
                    type: "info"
                },
                {
                    id: 2,
                    title: "Investment Pitches",
                    desc: `${pendingPitchesCount} pitches awaiting review.`,
                    type: "info"
                },
                {
                    id: 3,
                    title: failedLogins > 5 ? "System Warning" : "System Status",
                    desc: failedLogins > 5 ? `${failedLogins} failed login attempts in the last 24h.` : "All systems normal.",
                    type: failedLogins > 5 ? "warning" : "info"
                },
                {
                    id: 4,
                    title: blockedAccounts > 0 ? "Security Alert" : "Security Status",
                    desc: blockedAccounts > 0 ? `${blockedAccounts} accounts are currently blocked.` : "No blocked accounts.",
                    type: blockedAccounts > 0 ? "critical" : "info"
                }
            ]
        });
    }
    catch (error) {
        console.error("[Dashboard] getOverview error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
