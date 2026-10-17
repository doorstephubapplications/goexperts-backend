import { prisma } from '../../config/database.js';
export async function resolveProfileStats(userId, role) {
    const normalizedRole = (role || 'freelancer').toLowerCase();
    switch (normalizedRole) {
        case 'client':
        case 'business': {
            // 1. Projects posted
            const projectsPostedCount = await prisma.project.count({
                where: {
                    client: userId,
                    deletedAt: null,
                },
            });
            // 2. Completed projects
            const completedProjectsCount = await prisma.project.count({
                where: {
                    client: userId,
                    status: { in: ['completed', 'COMPLETED', 'closed'] },
                    deletedAt: null,
                },
            });
            // 3. Talent hired (distinct freelancers on contracts)
            const contracts = await prisma.contract.findMany({
                where: {
                    clientId: userId,
                    deletedAt: null,
                },
                select: {
                    freelancerId: true,
                    status: true,
                },
            });
            const uniqueFreelancers = new Set(contracts.map((c) => c.freelancerId));
            const talentHiredCount = uniqueFreelancers.size;
            // 4. Repeat hiring rate
            let repeatHiringRate = null;
            let repeatAvailable = false;
            if (talentHiredCount > 0) {
                const freelancerContractCounts = new Map();
                for (const c of contracts) {
                    freelancerContractCounts.set(c.freelancerId, (freelancerContractCounts.get(c.freelancerId) || 0) + 1);
                }
                let repeatHires = 0;
                for (const count of freelancerContractCounts.values()) {
                    if (count > 1)
                        repeatHires++;
                }
                repeatHiringRate = Math.round((repeatHires / talentHiredCount) * 100);
                repeatAvailable = true;
            }
            return {
                role: 'client',
                metrics: {
                    projectsPosted: {
                        label: 'Projects Posted',
                        value: projectsPostedCount,
                        available: true,
                        icon: 'briefcase',
                    },
                    talentHired: {
                        label: 'Talent Hired',
                        value: talentHiredCount,
                        available: true,
                        icon: 'users',
                    },
                    completedProjects: {
                        label: 'Completed Projects',
                        value: completedProjectsCount,
                        available: true,
                        icon: 'heart',
                    },
                    repeatHiringRate: {
                        label: 'Repeat Hiring Rate',
                        value: repeatAvailable ? `${repeatHiringRate}%` : null,
                        available: repeatAvailable,
                        icon: 'repeat',
                    },
                },
            };
        }
        case 'founder': {
            const founderProfile = await prisma.founderProfile.findUnique({
                where: { userId },
            });
            // Inquiries count (conversations where founder is participant)
            const inquiryCount = await prisma.conversation.count({
                where: {
                    OR: [{ userA: userId }, { userB: userId }],
                },
            });
            const stage = founderProfile?.stage || null;
            const targetRaise = founderProfile?.targetRaise;
            const teamSize = founderProfile?.teamSize || 1;
            return {
                role: 'founder',
                metrics: {
                    startupStage: {
                        label: 'Startup Stage',
                        value: stage,
                        available: Boolean(stage),
                        icon: 'trending-up',
                    },
                    targetRaise: {
                        label: 'Target Raise',
                        value: typeof targetRaise === 'number' && targetRaise > 0
                            ? `₹${Number(targetRaise).toLocaleString('en-IN')}`
                            : null,
                        available: typeof targetRaise === 'number' && targetRaise > 0,
                        icon: 'wallet',
                    },
                    teamSize: {
                        label: 'Team Size',
                        value: `${teamSize} ${teamSize === 1 ? 'Member' : 'Members'}`,
                        available: true,
                        icon: 'users',
                    },
                    pitchInquiries: {
                        label: 'Pitch Inquiries',
                        value: inquiryCount,
                        available: true,
                        icon: 'eye',
                    },
                },
            };
        }
        case 'investor': {
            const investorProfile = await prisma.investorProfile.findUnique({
                where: { userId },
            });
            let ticketDisplay = null;
            if (investorProfile?.ticketMin || investorProfile?.ticketMax) {
                const minL = investorProfile.ticketMin ? `₹${investorProfile.ticketMin / 100000}L` : '';
                const maxL = investorProfile.ticketMax ? `₹${investorProfile.ticketMax / 100000}L` : '+';
                ticketDisplay = `${minL} - ${maxL}`;
            }
            const dealsCount = investorProfile?.deals ?? 0;
            return {
                role: 'investor',
                metrics: {
                    ticketRange: {
                        label: 'Ticket Range',
                        value: ticketDisplay,
                        available: Boolean(ticketDisplay),
                        icon: 'wallet',
                    },
                    portfolio: {
                        label: 'Portfolio',
                        value: `${dealsCount} Co's`,
                        available: dealsCount > 0,
                        icon: 'building',
                    },
                    dealsClosed: {
                        label: 'Deals Closed',
                        value: `${dealsCount} Deals`,
                        available: dealsCount > 0,
                        icon: 'heart',
                    },
                    responseRate: {
                        label: 'Response Rate',
                        value: null,
                        available: false,
                        icon: 'thumbs-up',
                    },
                },
            };
        }
        case 'freelancer':
        default: {
            // 1. Rating & Review Count
            const reviews = await prisma.review.findMany({
                where: { revieweeId: userId },
                select: { rating: true },
            });
            let avgRating = null;
            let reviewCount = reviews.length;
            let clientSatisfaction = null;
            let satisfactionAvailable = false;
            if (reviewCount > 0) {
                const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
                avgRating = (sum / reviewCount).toFixed(1);
                const satisfiedCount = reviews.filter((r) => r.rating >= 4.0).length;
                const satPct = Math.round((satisfiedCount / reviewCount) * 100);
                clientSatisfaction = `${satPct}%`;
                satisfactionAvailable = true;
            }
            // 2. Projects Completed
            const completedContractsCount = await prisma.contract.count({
                where: {
                    freelancerId: userId,
                    status: { in: ['completed', 'COMPLETED', 'closed'] },
                    deletedAt: null,
                },
            });
            const completedProjectsCount = await prisma.project.count({
                where: {
                    freelancer: userId,
                    status: { in: ['completed', 'COMPLETED', 'closed'] },
                    deletedAt: null,
                },
            });
            const totalCompletedProjects = Math.max(completedContractsCount, completedProjectsCount);
            // 4. Connections count
            const connectionsCount = await prisma.connection.count({
                where: {
                    OR: [{ userOneId: userId }, { userTwoId: userId }],
                    status: 'ACTIVE',
                },
            });
            // 5. On-Time Delivery: derived from tasks or contracts if dates exist, otherwise unavailable
            return {
                role: 'freelancer',
                metrics: {
                    rating: {
                        label: 'Rating',
                        value: avgRating,
                        sublabel: reviewCount > 0 ? `(${reviewCount} Reviews)` : null,
                        available: reviewCount > 0,
                        icon: 'star',
                    },
                    projectsCompleted: {
                        label: 'Projects Completed',
                        value: totalCompletedProjects,
                        available: true,
                        icon: 'heart',
                    },
                    clientSatisfaction: {
                        label: 'Client Satisfaction',
                        value: clientSatisfaction,
                        available: satisfactionAvailable,
                        icon: 'thumbs-up',
                    },
                    onTimeDelivery: {
                        label: 'On-Time Delivery',
                        value: null,
                        available: false,
                        icon: 'clock',
                    },
                    connections: {
                        label: 'Connections',
                        value: connectionsCount,
                        available: true,
                        icon: 'users',
                    },
                },
            };
        }
    }
}
