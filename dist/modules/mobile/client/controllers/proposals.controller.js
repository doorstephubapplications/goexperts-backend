import { prisma } from '../../../../config/database.js';
import { successResponse, errorResponse } from '../../../../core/response.js';
import { NotificationEngine } from '../../../../services/mobile/notification.engine.js';
const freelancerSelect = {
    id: true,
    fullName: true,
    avatarUrl: true,
    freelancerProfile: true,
};
const attachFreelancers = async (proposals) => {
    const freelancerIds = [...new Set(proposals.map((p) => p.freelancerId).filter(Boolean))];
    if (!freelancerIds.length)
        return proposals.map((proposal) => ({ ...proposal, freelancer: null }));
    const freelancers = await prisma.user.findMany({
        where: { id: { in: freelancerIds } },
        select: freelancerSelect,
    });
    const freelancerById = new Map(freelancers.map((freelancer) => [freelancer.id, freelancer]));
    return proposals.map((proposal) => ({
        ...proposal,
        freelancer: proposal.freelancerId ? freelancerById.get(proposal.freelancerId) ?? null : null,
    }));
};
const shapeProposal = (proposal, contractId, currentUserId) => ({
    ...proposal,
    freelancerId: proposal.freelancerId || proposal.freelancer?.id,
    freelancerName: proposal.freelancer?.fullName || proposal.freelancerName || 'Freelancer',
    freelancerAvatar: proposal.freelancer?.avatarUrl || proposal.freelancerAvatar || null,
    clientId: proposal.project?.client || proposal.clientId || null,
    clientName: proposal.project?.clientDetails?.fullName || proposal.clientName || 'Client',
    clientAvatar: proposal.project?.clientDetails?.avatarUrl || proposal.clientAvatar || null,
    projectTitle: proposal.project?.title || proposal.projectTitle || 'Project',
    projectDescription: proposal.project?.description || proposal.projectDescription || '',
    contractId: contractId ?? proposal.contractId ?? null,
    isOwner: Boolean(currentUserId && proposal.project?.client === currentUserId),
});
export const listProposals = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const search = String(req.query.search || req.query.q || '').trim();
        const where = { deletedAt: null, project: { client: req.user.id } };
        if (search) {
            const matchingFreelancers = await prisma.user.findMany({
                where: {
                    OR: [
                        { fullName: { contains: search } },
                        { email: { contains: search } },
                    ],
                },
                select: { id: true },
            });
            where.OR = [
                { coverLetter: { contains: search } },
                { project: { title: { contains: search } } },
                { freelancerId: { in: matchingFreelancers.map((freelancer) => freelancer.id) } },
            ];
        }
        const [proposals, total] = await Promise.all([
            prisma.proposal.findMany({
                where,
                include: { project: true },
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.proposal.count({ where })
        ]);
        const proposalsWithFreelancers = await attachFreelancers(proposals);
        return res.json(successResponse('Proposals retrieved', proposalsWithFreelancers.map((p) => shapeProposal(p, null, req.user.id)), { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const listProjectProposals = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const [proposals, total] = await Promise.all([
            prisma.proposal.findMany({
                where: { projectId: req.params.projectId, project: { client: req.user.id } },
                skip, take: limit
            }),
            prisma.proposal.count({ where: { projectId: req.params.projectId, project: { client: req.user.id } } })
        ]);
        const proposalIds = proposals.map(p => p.id);
        const contracts = await prisma.contract.findMany({
            where: { proposalId: { in: proposalIds } },
            select: { id: true, proposalId: true }
        });
        const contractMap = new Map();
        contracts.forEach(c => {
            if (c.proposalId) {
                contractMap.set(c.proposalId, c.id);
            }
        });
        const proposalsWithFreelancers = await attachFreelancers(proposals);
        const shaped = proposalsWithFreelancers.map((p) => shapeProposal(p, contractMap.get(p.id) || null, req.user.id));
        return res.json(successResponse('Project proposals', shaped, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getProposal = async (req, res, next) => {
    try {
        const proposal = await prisma.proposal.findFirst({
            where: { id: req.params.id, project: { client: req.user.id } },
            include: {
                project: true,
            }
        });
        if (!proposal)
            return res.status(404).json(errorResponse('Proposal not found', 'NOT_FOUND'));
        const contract = await prisma.contract.findFirst({
            where: { proposalId: proposal.id },
            select: { id: true }
        });
        const [proposalWithFreelancer] = await attachFreelancers([proposal]);
        return res.json(successResponse('Proposal details', {
            ...shapeProposal(proposalWithFreelancer, contract?.id || null, req.user.id),
        }));
    }
    catch (error) {
        next(error);
    }
};
const updateProposalStatus = (status) => async (req, res, next) => {
    try {
        const proposal = await prisma.proposal.findFirst({ where: { id: req.params.id, project: { client: req.user.id } } });
        if (!proposal)
            return res.status(404).json(successResponse('Proposal not found'));
        if (status === 'accepted') {
            await prisma.$transaction([
                prisma.proposal.updateMany({
                    where: {
                        projectId: proposal.projectId,
                        id: { not: proposal.id },
                        deletedAt: null,
                        status: { not: 'withdrawn' },
                    },
                    data: { status: 'rejected' },
                }),
                prisma.proposal.update({
                    where: { id: proposal.id },
                    data: { status: 'accepted' },
                }),
            ]);
        }
        else {
            await prisma.proposal.update({ where: { id: proposal.id }, data: { status } });
        }
        await NotificationEngine.queueNotification({
            userId: proposal.freelancerId,
            type: `proposal_${status}`,
            title: `Proposal ${status.charAt(0).toUpperCase() + status.slice(1)}`,
            message: `${req.user.fullName || 'The client'} has ${status} your proposal.`,
            channel: 'all'
        });
        return res.json(successResponse(`Proposal ${status}`));
    }
    catch (error) {
        next(error);
    }
};
export const shortlistProposal = updateProposalStatus('shortlisted');
export const rejectProposal = updateProposalStatus('rejected');
export const interviewProposal = updateProposalStatus('interview');
export const acceptProposal = updateProposalStatus('accepted');
export const messageFreelancer = async (req, res, next) => {
    try {
        return res.json(successResponse('Message sent to freelancer'));
    }
    catch (error) {
        next(error);
    }
};
