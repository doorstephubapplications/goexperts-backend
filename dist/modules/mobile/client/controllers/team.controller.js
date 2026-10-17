import { successResponse, errorResponse } from '../../../../core/response.js';
import { getJsonSetting, setJsonSetting } from '../../../../common/helpers/portal-shared.js';
const userIdFrom = (req) => req.user?.id;
export const getTeam = async (req, res, next) => {
    try {
        const userId = userIdFrom(req);
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
        const members = await getJsonSetting(userId, 'team', []);
        return res.json(successResponse('Team members retrieved', members, { total: members.length }));
    }
    catch (error) {
        next(error);
    }
};
export const inviteTeamMember = async (req, res, next) => {
    try {
        const userId = userIdFrom(req);
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
        const name = String(req.body?.name || '').trim();
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!name || !email)
            return res.status(400).json(errorResponse('name and email are required', 'VALIDATION_ERROR'));
        const members = await getJsonSetting(userId, 'team', []);
        if (members.some((member) => String(member.email).toLowerCase() === email)) {
            return res.status(409).json(errorResponse('Team member already invited', 'TEAM_MEMBER_EXISTS'));
        }
        const member = {
            id: `TM-${Date.now().toString(36).toUpperCase()}`,
            name,
            email,
            role: req.body?.role || 'Member',
            department: req.body?.department || req.body?.dept || 'General',
            status: 'invited',
            createdAt: new Date().toISOString(),
        };
        const nextMembers = [member, ...members];
        await setJsonSetting(userId, 'team', nextMembers);
        return res.status(201).json(successResponse('Team member invited', member));
    }
    catch (error) {
        next(error);
    }
};
export const updateTeamMemberRole = async (req, res, next) => {
    try {
        const userId = userIdFrom(req);
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
        const members = await getJsonSetting(userId, 'team', []);
        const index = members.findIndex((member) => member.id === req.params.id);
        if (index < 0)
            return res.status(404).json(errorResponse('Team member not found', 'NOT_FOUND'));
        members[index] = { ...members[index], role: req.body?.role || members[index].role, updatedAt: new Date().toISOString() };
        await setJsonSetting(userId, 'team', members);
        return res.json(successResponse('Team member role updated', members[index]));
    }
    catch (error) {
        next(error);
    }
};
export const removeTeamMember = async (req, res, next) => {
    try {
        const userId = userIdFrom(req);
        if (!userId)
            return res.status(401).json(errorResponse('Unauthorized', 'UNAUTHORIZED'));
        const members = await getJsonSetting(userId, 'team', []);
        if (!members.some((member) => member.id === req.params.id)) {
            return res.status(404).json(errorResponse('Team member not found', 'NOT_FOUND'));
        }
        await setJsonSetting(userId, 'team', members.filter((member) => member.id !== req.params.id));
        return res.json(successResponse('Team member removed'));
    }
    catch (error) {
        next(error);
    }
};
