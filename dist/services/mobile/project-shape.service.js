import { prisma } from '../../config/database.js';
import { getJsonSetting } from '../../common/helpers/portal-shared.js';
const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const parseAttachments = (raw) => {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((item) => {
                if (typeof item === 'string')
                    return item;
                if (item && typeof item === 'object' && item.url)
                    return String(item.url);
                return '';
            })
                .filter(Boolean);
        }
    }
    catch {
        // comma-separated fallback
    }
    return String(raw)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
};
const splitIds = (raw) => String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
const defaultTimelineOptions = [
    { id: 'less_than_1_week', name: 'Less than a week' },
    { id: '1_2_weeks', name: '1-2 weeks' },
    { id: '2_4_weeks', name: '2-4 weeks' },
    { id: '1_3_months', name: '1-3 months' },
    { id: '3_6_months', name: '3-6 months' },
    { id: '6_plus_months', name: '6+ months' },
];
/**
 * Enrich project rows with human-readable names (never expose raw IDs in display fields).
 */
export const shapeProjects = async (projects, viewerUserId) => {
    if (!projects.length)
        return [];
    const clientIds = [...new Set(projects.map((p) => p.client).filter(Boolean))];
    const allCategoryKeys = [...new Set(projects.map((p) => String(p.category || '').trim()).filter(Boolean))];
    const allExperienceKeys = [...new Set(projects.map((p) => String(p.experienceLevel || '').trim()).filter(Boolean))];
    const allWorkModeKeys = [...new Set(projects.map((p) => String(p.workMode || '').trim()).filter(Boolean))];
    const allTimelineKeys = [...new Set(projects.map((p) => String(p.timeline || '').trim()).filter(Boolean))];
    const allSkillKeys = [...new Set(projects.flatMap((p) => splitIds(p.technology)).filter(Boolean))];
    const budgetIds = [...new Set(projects.map((p) => p.budgetRangeId).filter(Boolean))];
    const allLookupKeys = [...new Set([
            ...allCategoryKeys,
            ...allExperienceKeys,
            ...allWorkModeKeys,
            ...allTimelineKeys,
            ...allSkillKeys,
        ])];
    const [clients, industries, skillCategories, experienceLevels, workModes, budgetRanges, skills, masterOptions] = await Promise.all([
        clientIds.length
            ? prisma.user.findMany({
                where: { id: { in: clientIds }, status: 'active', deletedAt: null },
                select: { id: true, fullName: true, avatarUrl: true, isVerified: true },
            }).catch(() => [])
            : Promise.resolve([]),
        allCategoryKeys.length
            ? prisma.industry.findMany({
                where: { OR: [{ id: { in: allCategoryKeys } }, { name: { in: allCategoryKeys } }] },
                select: { id: true, name: true },
            }).catch(() => [])
            : Promise.resolve([]),
        allCategoryKeys.length
            ? prisma.skillCategory.findMany({
                where: { OR: [{ id: { in: allCategoryKeys } }, { name: { in: allCategoryKeys } }] },
                select: { id: true, name: true },
            }).catch(() => [])
            : Promise.resolve([]),
        allExperienceKeys.length
            ? prisma.experienceLevel.findMany({
                where: { OR: [{ id: { in: allExperienceKeys } }, { name: { in: allExperienceKeys } }] },
                select: { id: true, name: true },
            }).catch(() => [])
            : Promise.resolve([]),
        allWorkModeKeys.length
            ? prisma.workMode.findMany({
                where: { OR: [{ id: { in: allWorkModeKeys } }, { name: { in: allWorkModeKeys } }] },
                select: { id: true, name: true },
            }).catch(() => [])
            : Promise.resolve([]),
        budgetIds.length
            ? prisma.masterOption?.findMany({
                where: { id: { in: budgetIds } },
                select: { id: true, label: true, value: true, min: true, max: true, sortOrder: true }
            }).catch(() => [])
            : Promise.resolve([]),
        allSkillKeys.length
            ? prisma.skill.findMany({
                where: { OR: [{ id: { in: allSkillKeys } }, { name: { in: allSkillKeys } }] },
                select: { id: true, name: true },
            }).catch(() => [])
            : Promise.resolve([]),
        allLookupKeys.length
            ? prisma.masterOption?.findMany({
                where: {
                    OR: [
                        { id: { in: allLookupKeys } },
                        { label: { in: allLookupKeys } },
                        { value: { in: allLookupKeys } },
                    ],
                },
                select: { id: true, label: true, value: true, type: true }
            }).catch(() => [])
            : Promise.resolve([]),
    ]);
    const clientById = new Map(clients.map((c) => [c.id, c]));
    // Build two-way maps (id -> {id, name}, name -> {id, name})
    const industryMap = new Map();
    const addIndustry = (id, name) => {
        if (!id && !name)
            return;
        const entry = { id: id || '', name: name || '' };
        if (id)
            industryMap.set(id, entry);
        if (name) {
            industryMap.set(name, entry);
            industryMap.set(name.toLowerCase(), entry);
        }
    };
    industries.forEach((i) => addIndustry(i.id, i.name));
    skillCategories.forEach((c) => addIndustry(c.id, c.name));
    (masterOptions || []).forEach((m) => {
        const label = m.label || m.value || '';
        if (label)
            addIndustry(m.id, label);
    });
    const experienceLevelMap = new Map();
    const addExp = (id, name) => {
        if (!id && !name)
            return;
        const entry = { id: id || '', name: name || '' };
        if (id)
            experienceLevelMap.set(id, entry);
        if (name) {
            experienceLevelMap.set(name, entry);
            experienceLevelMap.set(name.toLowerCase(), entry);
        }
    };
    experienceLevels.forEach((e) => addExp(e.id, e.name));
    (masterOptions || []).filter((m) => m.type === 'experience_level').forEach((m) => {
        const label = m.label || m.value || '';
        if (label)
            addExp(m.id, label);
    });
    const workModeMap = new Map();
    const addWorkMode = (id, name) => {
        if (!id && !name)
            return;
        const entry = { id: id || '', name: name || '' };
        if (id)
            workModeMap.set(id, entry);
        if (name) {
            workModeMap.set(name, entry);
            workModeMap.set(name.toLowerCase(), entry);
        }
    };
    workModes.forEach((w) => addWorkMode(w.id, w.name));
    (masterOptions || []).filter((m) => m.type === 'work_mode').forEach((m) => {
        const label = m.label || m.value || '';
        if (label)
            addWorkMode(m.id, label);
    });
    const budgetRangeById = new Map(budgetRanges.map((b) => [b.id, b]));
    const timelineMap = new Map();
    const addTimeline = (id, name) => {
        if (!id && !name)
            return;
        const entry = { id: id || name, name: name || id };
        if (id)
            timelineMap.set(id, entry);
        if (name) {
            timelineMap.set(name, entry);
            timelineMap.set(name.toLowerCase(), entry);
        }
    };
    defaultTimelineOptions.forEach((t) => addTimeline(t.id, t.name));
    (masterOptions || []).filter((m) => ['project_timeline', 'project_timeline_option', 'timeline'].includes(m.type)).forEach((m) => {
        const label = m.label || m.value || '';
        if (label)
            addTimeline(m.id, label);
    });
    const skillMap = new Map();
    const addSkill = (id, name) => {
        if (!id && !name)
            return;
        const entry = { id: id || '', name: name || '' };
        if (id)
            skillMap.set(id, entry);
        if (name) {
            skillMap.set(name, entry);
            skillMap.set(name.toLowerCase(), entry);
        }
    };
    skills.forEach((s) => addSkill(s.id, s.name));
    (masterOptions || []).filter((m) => m.type === 'technology' || m.type === 'skill').forEach((m) => {
        const label = m.label || m.value || '';
        if (label)
            addSkill(m.id, label);
    });
    const proposalCounts = await prisma.proposal.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projects.map((p) => p.id) } },
        _count: { id: true },
    }).catch((err) => {
        console.error('[shapeProjects] proposal groupBy failed:', err);
        return [];
    });
    const countByProject = new Map(proposalCounts.map((row) => [row.projectId, row._count.id]));
    let savedIds = new Set();
    let appliedProjectIds = new Set();
    const proposalIdByProject = new Map();
    if (viewerUserId) {
        const savedRows = await getJsonSetting(viewerUserId, 'saved-projects', []);
        savedIds = new Set(savedRows);
        const appliedRows = await prisma.proposal.findMany({
            where: {
                freelancerId: viewerUserId,
                projectId: { in: projects.map((p) => p.id) },
                status: { not: 'withdrawn' },
                deletedAt: null,
            },
            select: { id: true, projectId: true },
            orderBy: { createdAt: 'desc' },
        }).catch((err) => {
            console.error('[shapeProjects] appliedRows query failed:', err);
            return [];
        });
        appliedProjectIds = new Set(appliedRows.map((r) => r.projectId));
        appliedRows.forEach((row) => proposalIdByProject.set(row.projectId, row.id));
    }
    return projects.map((project) => {
        const client = clientById.get(project.client);
        const skillIdList = splitIds(project.technology);
        const formattedSkills = skillIdList.map((key) => {
            const trimmed = key.trim();
            const resolved = skillMap.get(trimmed) || skillMap.get(trimmed.toLowerCase());
            if (resolved) {
                return {
                    skillId: resolved.id || (uuidLike.test(trimmed) ? trimmed : ''),
                    skillName: resolved.name || trimmed
                };
            }
            return {
                skillId: uuidLike.test(trimmed) ? trimmed : '',
                skillName: trimmed
            };
        });
        const skillNames = formattedSkills.map((s) => s.skillName).filter(Boolean);
        const catKey = String(project.category || '').trim();
        const resolvedInd = industryMap.get(catKey) || industryMap.get(catKey.toLowerCase());
        const industryObj = {
            id: resolvedInd?.id || (uuidLike.test(catKey) ? catKey : ''),
            name: resolvedInd?.name || (uuidLike.test(catKey) ? 'General' : catKey || 'General'),
        };
        const expKey = String(project.experienceLevel || '').trim();
        const resolvedExp = experienceLevelMap.get(expKey) || experienceLevelMap.get(expKey.toLowerCase());
        const experienceLevelObj = {
            id: resolvedExp?.id || (uuidLike.test(expKey) ? expKey : ''),
            name: resolvedExp?.name || expKey || 'Intermediate',
        };
        const wmKey = String(project.workMode || '').trim();
        const resolvedWm = workModeMap.get(wmKey) || workModeMap.get(wmKey.toLowerCase());
        const workModeObj = {
            id: resolvedWm?.id || (uuidLike.test(wmKey) ? wmKey : ''),
            name: resolvedWm?.name || wmKey || 'Remote',
        };
        const budgetRangeRecord = budgetRangeById.get(String(project.budgetRangeId || '').trim()) || null;
        const timelineKey = String(project.timeline || '').trim();
        const resolvedTimeline = timelineMap.get(timelineKey) || timelineMap.get(timelineKey.toLowerCase());
        const timelineObj = {
            id: resolvedTimeline?.id || timelineKey,
            name: resolvedTimeline?.name || timelineKey,
        };
        return {
            id: project.id,
            title: project.title,
            description: project.description ?? '',
            avatar: project.avatar ?? null,
            coverImage: project.coverImage ?? null,
            clientId: project.client,
            clientName: client?.fullName || 'Client',
            clientAvatar: client?.avatarUrl ?? null,
            clientVerified: Boolean(client?.isVerified),
            industry: industryObj,
            industryId: industryObj.id,
            industryName: industryObj.name,
            skills: formattedSkills,
            techStack: skillNames,
            technology: skillNames.join(', '),
            budget: project.budget,
            budgetMin: project.budgetMin ?? project.budget,
            budgetMax: project.budgetMax ?? project.budget,
            budgetRange: budgetRangeRecord
                ? {
                    id: budgetRangeRecord.id,
                    label: budgetRangeRecord.label ?? '',
                    value: budgetRangeRecord.value ?? '',
                    min: budgetRangeRecord.min,
                    max: budgetRangeRecord.max,
                    sortOrder: budgetRangeRecord.sortOrder ?? 0,
                }
                : null,
            isHourly: false,
            timeline: timelineObj,
            timelineId: timelineObj.id,
            timelineName: timelineObj.name,
            startDate: project.startDate ? new Date(project.startDate).toISOString() : null,
            endDate: project.endDate ? new Date(project.endDate).toISOString() : null,
            workMode: workModeObj,
            workModeId: workModeObj.id,
            workModeName: workModeObj.name,
            experienceLevel: experienceLevelObj,
            experienceLevelId: experienceLevelObj.id,
            experienceLevelName: experienceLevelObj.name,
            attachments: parseAttachments(project.attachments),
            status: project.status,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
            proposalsCount: countByProject.get(project.id) ?? 0,
            shareCount: project.shareCount ?? 0,
            isOwner: Boolean(viewerUserId && viewerUserId === project.client),
            milestones: project.milestones,
            tasks: project.tasks,
            proposals: undefined,
            isSaved: savedIds.has(project.id),
            isApplied: appliedProjectIds.has(project.id),
            proposalId: proposalIdByProject.get(project.id) ?? null,
        };
    });
};
export const shapeProject = async (project, viewerUserId) => {
    const [shaped] = await shapeProjects([project], viewerUserId);
    return shaped;
};
export const serializeAttachments = (attachments) => {
    if (!attachments)
        return null;
    const imageExt = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|svg|ico|tif|tiff)(\?|$)/i;
    const toUrls = (items) => items
        .map((item) => {
        if (typeof item === 'string')
            return item.trim();
        if (item && typeof item === 'object' && item.url) {
            return String(item.url).trim();
        }
        return '';
    })
        .filter(Boolean)
        .filter((url) => !imageExt.test(url));
    let urls = [];
    if (typeof attachments === 'string') {
        try {
            const parsed = JSON.parse(attachments);
            urls = Array.isArray(parsed) ? toUrls(parsed) : toUrls([attachments]);
        }
        catch {
            urls = toUrls(attachments
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean));
        }
    }
    else if (Array.isArray(attachments)) {
        urls = toUrls(attachments);
    }
    else {
        return null;
    }
    // Cap at 20 project attachments.
    urls = [...new Set(urls)].slice(0, 20);
    return JSON.stringify(urls);
};
