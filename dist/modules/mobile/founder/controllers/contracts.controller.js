import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
export const listContracts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const [contracts, total] = await Promise.all([
            prisma.contract.findMany({ where: { freelancerId: req.user.id }, skip, take: limit }),
            prisma.contract.count({ where: { freelancerId: req.user.id } })
        ]);
        return res.json(successResponse('Contracts retrieved', contracts, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getContractDetails = async (req, res, next) => {
    try {
        const contract = await prisma.contract.findFirst({
            where: { id: req.params.id, freelancerId: req.user.id },
            include: {
                client: {
                    select: { id: true, fullName: true, avatarUrl: true }
                },
                freelancer: {
                    select: { id: true, fullName: true, avatarUrl: true, freelancerProfile: true }
                },
                project: {
                    select: { id: true, title: true, status: true }
                }
            }
        });
        if (!contract) {
            return res.status(404).json(successResponse('Contract not found', null));
        }
        let proposal = null;
        if (contract.proposalId) {
            proposal = await prisma.proposal.findUnique({
                where: { id: contract.proposalId }
            });
        }
        const milestones = await prisma.milestone.findMany({
            where: { projectId: contract.projectId }
        });
        return res.json(successResponse('Contract details retrieved', {
            ...contract,
            proposal,
            milestones
        }));
    }
    catch (error) {
        next(error);
    }
};
export const acceptContract = async (req, res, next) => {
    try {
        const contract = await prisma.contract.updateMany({
            where: { id: req.params.id, freelancerId: req.user.id, status: 'pending_acceptance' },
            data: { status: 'active' }
        });
        return res.json(successResponse('Contract accepted', contract));
    }
    catch (error) {
        next(error);
    }
};
export const rejectContract = async (req, res, next) => {
    try {
        const contract = await prisma.contract.updateMany({
            where: { id: req.params.id, freelancerId: req.user.id, status: 'pending_acceptance' },
            data: { status: 'cancelled' }
        });
        return res.json(successResponse('Contract rejected', contract));
    }
    catch (error) {
        next(error);
    }
};
export const getContractMilestones = async (req, res, next) => res.json(successResponse('Contract milestones', []));
export const getContractTimeline = async (req, res, next) => res.json(successResponse('Contract timeline', []));
export const getContractDocuments = async (req, res, next) => res.json(successResponse('Contract documents', []));
