import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { RecommendationEngine } from '../../../../services/mobile/recommendation.service.js';
import { getSettingsSection } from '../../../../services/settings/settings.service.js';
import { cleanTag, cleanDesc, cleanProjectTitle, cleanStartupTitle, dedupeBy, } from '../../../../utils/mobile/discovery-cleaners.util.js';
export const addRecentlyViewed = async (req, res, next) => {
    try {
        const { entityType, entityId } = req.body;
        if (!entityType || !entityId) {
            return res.status(400).json(errorResponse('entityType and entityId are required', 'VALIDATION_ERROR'));
        }
        return res.status(201).json(successResponse('Recently viewed tracked', { entityType, entityId }));
    }
    catch (error) {
        next(error);
    }
};
export const listRecentlyViewed = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        return res.json(successResponse('Recently viewed', [], { page, limit, total: 0, totalPages: 0 }));
    }
    catch (error) {
        next(error);
    }
};
export const clearRecentlyViewed = async (req, res, next) => {
    try {
        return res.json(successResponse('Recently viewed cleared'));
    }
    catch (error) {
        next(error);
    }
};
export const deleteRecentlyViewedItem = async (req, res, next) => {
    try {
        return res.json(successResponse('Recently viewed item removed'));
    }
    catch (error) {
        next(error);
    }
};
export const getRecommendations = async (req, res, next) => {
    try {
        const role = req.user?.role || 'freelancer';
        const userId = req.user?.id || '';
        let recommendations = [];
        try {
            const section = await getSettingsSection('recommendation_tabs');
            const tabs = section?.data;
            recommendations = tabs?.[role] ?? [];
        }
        catch {
            recommendations = [];
        }
        const itemLists = await buildRecommendationItems(role, userId);
        return res.json(successResponse('Recommendations retrieved', {
            recommendedRoles: recommendations,
            roleTabs: recommendations,
            recommendedItems: itemLists,
        }));
    }
    catch (error) {
        return res.json(successResponse('Recommendations retrieved', {
            recommendedRoles: [],
            roleTabs: [],
            recommendedItems: {},
        }));
    }
};
async function getActiveStartupIdeas(limit = 5, excludeUserId) {
    const activeFounders = await prisma.user.findMany({
        where: { status: 'active', deletedAt: null },
        select: { id: true },
    }).catch(() => []);
    const activeFounderIds = activeFounders
        .map((f) => f.id)
        .filter((id) => !excludeUserId || id !== excludeUserId);
    if (activeFounderIds.length === 0)
        return [];
    return prisma.startupIdea.findMany({
        where: {
            status: { in: ['active', 'Active', 'Published', 'published', 'open', 'Open'] },
            deletedAt: null,
            founder: { in: activeFounderIds },
            NOT: [
                { startup: '' },
                { startup: { contains: "'s Startup" } },
                { startup: { contains: "’s Startup" } },
                { startup: { contains: "s Startup" } },
            ],
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    }).catch(() => []);
}
async function getActiveProjects(limit = 5, excludeUserId) {
    const activeClients = await prisma.user.findMany({
        where: { status: 'active', deletedAt: null },
        select: { id: true },
    }).catch(() => []);
    const activeClientIds = activeClients
        .map((c) => c.id)
        .filter((id) => !excludeUserId || id !== excludeUserId);
    if (activeClientIds.length === 0)
        return [];
    return prisma.project.findMany({
        where: {
            status: { in: ['open', 'approved', 'active', 'Published', 'Open', 'Approved', 'Active'] },
            deletedAt: null,
            client: { in: activeClientIds },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    }).catch(() => []);
}
async function buildRecommendationItems(role, userId) {
    const limit = 10;
    const userAvatarFields = (user) => ({
        avatarUrl: user?.avatarUrl ?? null,
        avatar: user?.avatarUrl ?? null,
        user: user
            ? {
                id: user.id,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl ?? null,
            }
            : null,
    });
    const avatarMapFor = async (ids) => {
        const uniqueIds = [...new Set(ids.filter(Boolean))];
        if (uniqueIds.length === 0)
            return new Map();
        const users = await prisma.user.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true, fullName: true, avatarUrl: true },
        }).catch(() => []);
        return new Map(users.map((u) => [u.id, u]));
    };
    try {
        if (role === 'freelancer') {
            const [projects, clients, startups] = await Promise.all([
                getActiveProjects(limit, userId),
                prisma.user.findMany({
                    where: { role: 'client', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
                    include: { clientProfile: true },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                }).catch(() => []),
                getActiveStartupIdeas(limit, userId),
            ]);
            const [projectUserMap, startupUserMap] = await Promise.all([
                avatarMapFor((projects || []).map((p) => p.client)),
                avatarMapFor((startups || []).map((s) => s.founder)),
            ]);
            const mappedProjects = dedupeBy((projects || []).map((p) => ({
                id: p.id,
                title: cleanProjectTitle(p.title, p.category, p.technology),
                subtitle: cleanTag(p.category, 'Project'),
                description: cleanDesc(p.technology ?? p.description, ''),
                budget: p.budget,
                ...userAvatarFields(projectUserMap.get(p.client)),
            })), (p) => p.title).slice(0, 5);
            const mappedClients = dedupeBy((clients || []).map((c) => ({
                id: c.id,
                title: c.fullName || 'Client',
                subtitle: cleanTag(c.clientProfile?.company, 'Client'),
                description: cleanDesc(c.clientProfile?.industry ?? c.city, ''),
                ...userAvatarFields(c),
            })), (c) => c.title).slice(0, 5);
            const mappedStartups = dedupeBy((startups || []).map((s) => ({
                id: s.id,
                title: cleanStartupTitle(s.title, s.startup, s.industry),
                subtitle: cleanTag(s.stage, 'Startup'),
                description: cleanDesc(s.industry, ''),
                funding: s.funding,
                ...userAvatarFields(startupUserMap.get(s.founder)),
            })), (s) => s.title).slice(0, 5);
            return {
                projects: mappedProjects,
                clients: mappedClients,
                startups: mappedStartups,
            };
        }
        if (role === 'client') {
            const [freelancers, startups, investors] = await Promise.all([
                prisma.user.findMany({
                    where: { role: 'freelancer', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
                    include: { freelancerProfile: true },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                }).catch(() => []),
                getActiveStartupIdeas(limit, userId),
                prisma.user.findMany({
                    where: { role: 'investor', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
                    include: { investorProfile: true },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                }).catch(() => []),
            ]);
            const startupUserMap = await avatarMapFor((startups || []).map((s) => s.founder));
            const mappedFreelancers = dedupeBy((freelancers || []).map((f) => ({
                id: f.id,
                title: f.fullName || 'Freelancer',
                subtitle: cleanTag(f.freelancerProfile?.skills, 'Freelancer'),
                description: cleanDesc(f.freelancerProfile?.industry ?? f.city, ''),
                ...userAvatarFields(f),
            })), (f) => f.title).slice(0, 5);
            const mappedStartups = dedupeBy((startups || []).map((s) => ({
                id: s.id,
                title: cleanStartupTitle(s.title, s.startup, s.industry),
                subtitle: cleanTag(s.stage, 'Startup'),
                description: cleanDesc(s.industry, ''),
                funding: s.funding,
                ...userAvatarFields(startupUserMap.get(s.founder)),
            })), (s) => s.title).slice(0, 5);
            const mappedInvestors = dedupeBy((investors || []).map((i) => ({
                id: i.id,
                title: i.fullName || 'Investor',
                subtitle: cleanTag(i.investorProfile?.firm, 'Investor'),
                description: cleanDesc(i.investorProfile?.focusAreas ?? i.city, ''),
                ...userAvatarFields(i),
            })), (i) => i.title).slice(0, 5);
            return {
                freelancers: mappedFreelancers,
                startups: mappedStartups,
                investors: mappedInvestors,
            };
        }
        if (role === 'investor') {
            const [startups, projects, freelancers] = await Promise.all([
                getActiveStartupIdeas(limit, userId),
                getActiveProjects(limit, userId),
                prisma.user.findMany({
                    where: { role: 'freelancer', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
                    include: { freelancerProfile: true },
                    orderBy: { createdAt: 'desc' },
                    take: limit,
                }).catch(() => []),
            ]);
            const [startupUserMap, projectUserMap] = await Promise.all([
                avatarMapFor((startups || []).map((s) => s.founder)),
                avatarMapFor((projects || []).map((p) => p.client)),
            ]);
            const mappedStartups = dedupeBy((startups || []).map((s) => ({
                id: s.id,
                title: cleanStartupTitle(s.title, s.startup, s.industry),
                subtitle: cleanTag(s.stage, 'Startup'),
                description: cleanDesc(s.industry, ''),
                funding: s.funding,
                ...userAvatarFields(startupUserMap.get(s.founder)),
            })), (s) => s.title).slice(0, 5);
            const mappedProjects = dedupeBy((projects || []).map((p) => ({
                id: p.id,
                title: cleanProjectTitle(p.title, p.category, p.technology),
                subtitle: cleanTag(p.category, 'Project'),
                description: cleanDesc(p.technology ?? p.description, ''),
                budget: p.budget,
                ...userAvatarFields(projectUserMap.get(p.client)),
            })), (p) => p.title).slice(0, 5);
            const mappedFreelancers = dedupeBy((freelancers || []).map((f) => ({
                id: f.id,
                title: f.fullName || 'Freelancer',
                subtitle: cleanTag(f.freelancerProfile?.skills, 'Freelancer'),
                description: cleanDesc(f.freelancerProfile?.industry ?? f.city, ''),
                ...userAvatarFields(f),
            })), (f) => f.title).slice(0, 5);
            return {
                startups: mappedStartups,
                projects: mappedProjects,
                freelancers: mappedFreelancers,
            };
        }
        const [investors, freelancers, startups, projects] = await Promise.all([
            prisma.user.findMany({ where: { role: 'investor', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) }, include: { investorProfile: true }, orderBy: { createdAt: 'desc' }, take: limit }).catch(() => []),
            prisma.user.findMany({ where: { role: 'freelancer', status: 'active', deletedAt: null, ...(userId ? { id: { not: userId } } : {}) }, include: { freelancerProfile: true }, orderBy: { createdAt: 'desc' }, take: limit }).catch(() => []),
            getActiveStartupIdeas(limit, userId),
            getActiveProjects(limit, userId),
        ]);
        const [startupUserMap, projectUserMap] = await Promise.all([
            avatarMapFor((startups || []).map((s) => s.founder)),
            avatarMapFor((projects || []).map((p) => p.client)),
        ]);
        return {
            investors: dedupeBy((investors || []).map((i) => ({ id: i.id, title: i.fullName, subtitle: cleanTag(i.investorProfile?.firm, 'Investor'), description: cleanDesc(i.investorProfile?.focusAreas ?? i.city, ''), ...userAvatarFields(i) })), (i) => i.title).slice(0, 5),
            freelancers: dedupeBy((freelancers || []).map((f) => ({ id: f.id, title: f.fullName, subtitle: cleanTag(f.freelancerProfile?.skills, 'Freelancer'), description: cleanDesc(f.freelancerProfile?.industry ?? f.city, ''), ...userAvatarFields(f) })), (f) => f.title).slice(0, 5),
            startups: dedupeBy((startups || []).map((s) => ({
                id: s.id,
                title: cleanStartupTitle(s.title, s.startup, s.industry),
                subtitle: cleanTag(s.stage, 'Startup'),
                description: cleanDesc(s.industry, ''),
                funding: s.funding,
                ...userAvatarFields(startupUserMap.get(s.founder)),
            })), (s) => s.title).slice(0, 5),
            projects: dedupeBy((projects || []).map((p) => ({
                id: p.id,
                title: cleanProjectTitle(p.title, p.category, p.technology),
                subtitle: cleanTag(p.category, 'Project'),
                description: cleanDesc(p.technology ?? p.description, ''),
                budget: p.budget,
                ...userAvatarFields(projectUserMap.get(p.client)),
            })), (p) => p.title).slice(0, 5),
        };
    }
    catch {
        return {
            freelancers: [],
            projects: [],
            investors: [],
            startups: [],
            clients: [],
            founders: [],
        };
    }
}
export const getTrending = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const [trendingFreelancers, trendingStartups, trendingSkills] = await Promise.all([
            prisma.user.findMany({ where: { role: 'freelancer', status: 'active', isVerified: true }, take: limit }),
            prisma.user.findMany({ where: { role: 'founder', status: 'active', isVerified: true }, take: limit }),
            prisma.skill.findMany({ where: { status: 'active' }, take: limit })
        ]);
        return res.json(successResponse('Trending items', {
            freelancers: trendingFreelancers,
            startups: trendingStartups,
            keywords: trendingSkills.map((skill) => skill.name)
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getPopular = async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const [popularFreelancers, popularStartups, popularSkills] = await Promise.all([
            prisma.user.findMany({ where: { role: 'freelancer', status: 'active' }, take: limit }),
            prisma.user.findMany({ where: { role: 'founder', status: 'active' }, take: limit }),
            prisma.skill.findMany({ where: { status: 'active' }, take: limit })
        ]);
        return res.json(successResponse('Popular items', {
            freelancers: popularFreelancers,
            startups: popularStartups,
            keywords: popularSkills.map((skill) => skill.name)
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getDiscoveryFeed = async (req, res, next) => {
    try {
        const limit = 5;
        let recommendations = {};
        if (req.user) {
            switch (req.user.role) {
                case 'freelancer':
                    recommendations = await RecommendationEngine.forFreelancer({ userId: req.user.id, role: 'freelancer', limit });
                    break;
                case 'client':
                    recommendations = await RecommendationEngine.forClient({ userId: req.user.id, role: 'client', limit });
                    break;
                case 'investor':
                    recommendations = await RecommendationEngine.forInvestor({ userId: req.user.id, role: 'investor', limit });
                    break;
                case 'founder':
                    recommendations = await RecommendationEngine.forFounder({ userId: req.user.id, role: 'founder', limit });
                    break;
            }
        }
        const trending = await prisma.user.findMany({ where: { status: 'active', isVerified: true }, take: limit });
        const popular = await prisma.skill.findMany({ where: { status: 'active' }, take: limit });
        return res.json(successResponse('Discovery feed', {
            recommendations,
            trending,
            popular: popular.map((skill) => skill.name)
        }));
    }
    catch (error) {
        next(error);
    }
};
