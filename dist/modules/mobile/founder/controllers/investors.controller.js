import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
const parseOptionValues = (value) => {
    if (!value)
        return [];
    const raw = String(value).trim();
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item).trim()).filter(Boolean);
        }
    }
    catch {
        // fall through
    }
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
};
const resolveLabels = async (values, type) => {
    if (!values.length)
        return [];
    const [masterOptions, industries, categories, skills, stages, projectCategories] = await Promise.all([
        prisma.masterOption?.findMany({
            where: {
                OR: [
                    { id: { in: values } },
                    { value: { in: values } },
                    { label: { in: values } },
                ],
                ...(type ? { type } : {}),
            },
            select: { id: true, label: true, value: true },
        }).catch(() => []),
        prisma.industry.findMany({ where: { id: { in: values } }, select: { id: true, name: true } }).catch(() => []),
        prisma.skillCategory.findMany({ where: { id: { in: values } }, select: { id: true, name: true } }).catch(() => []),
        prisma.skill.findMany({ where: { id: { in: values } }, select: { id: true, name: true } }).catch(() => []),
        prisma.startupStage.findMany({ where: { id: { in: values } }, select: { id: true, name: true } }).catch(() => []),
        prisma.projectCategory?.findMany({ where: { id: { in: values } }, select: { id: true, name: true } }).catch(() => []) || [],
    ]);
    const labelMap = new Map();
    for (const row of masterOptions || []) {
        labelMap.set(String(row.id), row.label || row.value || String(row.id));
        if (row.value)
            labelMap.set(String(row.value), row.label || String(row.value));
        if (row.label)
            labelMap.set(String(row.label), row.label);
    }
    for (const row of industries || [])
        labelMap.set(row.id, row.name);
    for (const row of categories || [])
        labelMap.set(row.id, row.name);
    for (const row of skills || [])
        labelMap.set(row.id, row.name);
    for (const row of stages || [])
        labelMap.set(row.id, row.name);
    for (const row of projectCategories || [])
        labelMap.set(row.id, row.name);
    return values.map((value) => labelMap.get(value) || (/^[0-9a-f-]{36}$/i.test(value) ? '' : value));
};
async function getSavedInvestorIds(viewerId) {
    const savedSet = new Set();
    if (!viewerId)
        return savedSet;
    try {
        const { getJsonSetting } = await import('../../../../common/helpers/portal-shared.js');
        const [founderWatchlist, genericFavorites, savedInvestors, portalSaved] = await Promise.all([
            prisma.setting.findUnique({ where: { key: `founder_investor_watchlist:${viewerId}` }, select: { value: true } }).catch(() => null),
            prisma.setting.findUnique({ where: { key: `favorites:${viewerId}` }, select: { value: true } }).catch(() => null),
            prisma.setting.findUnique({ where: { key: `savedInvestors:${viewerId}` }, select: { value: true } }).catch(() => null),
            getJsonSetting(viewerId, 'savedInvestors', []).catch(() => []),
        ]);
        if (founderWatchlist?.value) {
            try {
                const items = JSON.parse(founderWatchlist.value);
                if (Array.isArray(items)) {
                    items.forEach((item) => {
                        const id = typeof item === 'string' ? item : (item.investorId || item.id || item.entityId);
                        if (id)
                            savedSet.add(id);
                    });
                }
            }
            catch { }
        }
        if (genericFavorites?.value) {
            try {
                const items = JSON.parse(genericFavorites.value);
                if (Array.isArray(items)) {
                    items.forEach((item) => {
                        if (item.entityType === 'investor' || !item.entityType) {
                            const id = typeof item === 'string' ? item : (item.entityId || item.investorId || item.id);
                            if (id)
                                savedSet.add(id);
                        }
                    });
                }
            }
            catch { }
        }
        if (savedInvestors?.value) {
            try {
                const items = JSON.parse(savedInvestors.value);
                if (Array.isArray(items)) {
                    items.forEach((item) => {
                        const id = typeof item === 'string' ? item : (item.investorId || item.id || item.entityId);
                        if (id)
                            savedSet.add(id);
                    });
                }
            }
            catch { }
        }
        if (Array.isArray(portalSaved)) {
            portalSaved.forEach((item) => {
                const id = typeof item === 'string' ? item : (item.investorId || item.id || item.entityId);
                if (id)
                    savedSet.add(id);
            });
        }
    }
    catch { }
    return savedSet;
}
const mapInvestorAsync = async (investor, savedIds) => {
    const profile = investor?.investorProfile;
    const focusAreaValues = parseOptionValues(profile?.focusAreas);
    const preferredStageValues = parseOptionValues(profile?.preferredStage);
    const investorTypeValues = parseOptionValues(profile?.investorType);
    const [focusAreas, preferredStages, investorTypes] = await Promise.all([
        resolveLabels(focusAreaValues),
        resolveLabels(preferredStageValues),
        resolveLabels(investorTypeValues, 'investor_type'),
    ]);
    return {
        id: investor.id,
        fullName: investor.fullName || null,
        name: investor.fullName || null,
        email: investor.email || null,
        avatarUrl: investor.avatarUrl || null,
        role: investor.role || 'investor',
        bio: investor.bio || null,
        company: profile?.firm || null,
        firm: profile?.firm || null,
        ticketMin: profile?.ticketMin ?? null,
        ticketMax: profile?.ticketMax ?? null,
        FocusAreas: focusAreaValues.map((focusAreaId, index) => ({
            focusAreaId,
            focusAreaName: focusAreas[index] || '',
        })),
        deals: profile?.deals ?? 0,
        investmentsCount: profile?.deals ?? 0,
        PreferredStage: preferredStageValues.map((preferredStageId, index) => ({
            preferredStageId,
            preferredStageName: preferredStages[index] || '',
        })),
        InvestorType: investorTypeValues.length ? {
            investorTypeId: investorTypeValues[0],
            investorTypeName: investorTypes[0] || '',
        } : null,
        location: [investor.city, investor.country].filter(Boolean).join(', ') || null,
        city: investor.city || null,
        country: investor.country || null,
        verified: Boolean(investor.isVerified || investor.verified),
        createdAt: investor.createdAt,
        updatedAt: investor.updatedAt,
        isSaved: savedIds ? (savedIds.has(investor.id) || (profile?.id && savedIds.has(profile.id)) || false) : false,
    };
};
const enrichInvestments = async (investments) => {
    const investorIds = [...new Set(investments.map((investment) => investment.investor).filter(Boolean))];
    const users = investorIds.length
        ? await prisma.user.findMany({
            where: { id: { in: investorIds }, role: 'investor', deletedAt: null },
            include: { investorProfile: true },
        })
        : [];
    const userMap = new Map(users.map((user) => [user.id, user]));
    return Promise.all(investments.map(async (investment) => ({
        ...investment,
        investorProfile: userMap.get(investment.investor)
            ? await mapInvestorAsync(userMap.get(investment.investor))
            : null,
    })));
};
export const listInvestors = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const orderDirection = req.query.order === 'asc' ? 'asc' : 'desc';
        const where = {
            role: 'investor',
            status: 'active',
            deletedAt: null,
            OR: [{ isVerified: true }, { verified: true }],
        };
        const [investors, total, savedIds] = await Promise.all([
            prisma.user.findMany({
                where,
                include: { investorProfile: true },
                skip,
                take: limit,
                orderBy: { createdAt: orderDirection },
            }),
            prisma.user.count({ where }),
            getSavedInvestorIds(req.user?.id),
        ]);
        const mappedInvestors = await Promise.all(investors.map((inv) => mapInvestorAsync(inv, savedIds)));
        return res.json(successResponse('Investors retrieved', mappedInvestors, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
        }));
    }
    catch (error) {
        next(error);
    }
};
export const getInvestor = async (req, res, next) => {
    try {
        const investor = await prisma.user.findFirst({
            where: { id: req.params.id, role: 'investor', deletedAt: null },
            include: { investorProfile: true },
        });
        if (!investor) {
            return res.status(404).json(errorResponse('Investor not found', 'NOT_FOUND'));
        }
        const savedIds = await getSavedInvestorIds(req.user?.id);
        const data = await mapInvestorAsync(investor, savedIds);
        return res.json(successResponse('Details retrieved for investor', data));
    }
    catch (error) {
        next(error);
    }
};
export const getRecommendedInvestors = async (req, res, next) => {
    try {
        const [investors, savedIds] = await Promise.all([
            prisma.user.findMany({
                where: {
                    role: 'investor',
                    status: 'active',
                    deletedAt: null,
                    OR: [{ isVerified: true }, { verified: true }],
                },
                include: { investorProfile: true },
                orderBy: [{ investorProfile: { deals: 'desc' } }, { createdAt: 'desc' }],
                take: 10,
            }),
            getSavedInvestorIds(req.user?.id),
        ]);
        const mapped = await Promise.all(investors.map((inv) => mapInvestorAsync(inv, savedIds)));
        return res.json(successResponse('Recommended investors', mapped));
    }
    catch (error) {
        next(error);
    }
};
export const getInterestedInvestors = async (req, res, next) => {
    try {
        const investments = await prisma.investment.findMany({
            where: { startup: req.user.id, status: 'Pending', deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.json(successResponse('Interested investors', await enrichInvestments(investments)));
    }
    catch (error) {
        next(error);
    }
};
export const getActiveInvestors = async (req, res, next) => {
    try {
        const investments = await prisma.investment.findMany({
            where: { startup: req.user.id, status: 'Active', deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return res.json(successResponse('Active investors', await enrichInvestments(investments)));
    }
    catch (error) {
        next(error);
    }
};
