import { prisma } from '../../../../config/database.js';
import { successResponse } from '../../../../core/response.js';
const contractFreelancerSelect = {
    id: true,
    fullName: true,
    avatarUrl: true,
    freelancerProfile: true,
};
const attachContractFreelancers = async (contracts) => {
    const freelancerIds = [...new Set(contracts.map((c) => c.freelancerId).filter(Boolean))];
    if (!freelancerIds.length)
        return contracts.map((contract) => ({ ...contract, freelancer: null }));
    const freelancers = await prisma.user.findMany({
        where: { id: { in: freelancerIds } },
        select: contractFreelancerSelect,
    });
    const freelancerById = new Map(freelancers.map((freelancer) => [freelancer.id, freelancer]));
    return contracts.map((contract) => ({
        ...contract,
        freelancer: contract.freelancerId ? freelancerById.get(contract.freelancerId) ?? null : null,
    }));
};
export const listContracts = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 20, 100);
        const skip = (page - 1) * limit;
        const status = req.query.status;
        const where = { clientId: req.user.id };
        if (status)
            where.status = status;
        const [contracts, total] = await Promise.all([
            prisma.contract.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    project: { select: { id: true, title: true, status: true } },
                    proposal: {
                        select: {
                            id: true,
                            bidAmount: true,
                            deliveryTime: true,
                            coverLetter: true,
                            status: true,
                            createdAt: true,
                        }
                    }
                }
            }),
            prisma.contract.count({ where })
        ]);
        const contractsWithFreelancers = await attachContractFreelancers(contracts);
        return res.json(successResponse('Contracts retrieved', contractsWithFreelancers, { page, limit, total, totalPages: Math.ceil(total / limit) }));
    }
    catch (error) {
        next(error);
    }
};
export const getContract = async (req, res, next) => {
    try {
        const contract = await prisma.contract.findFirst({
            where: {
                clientId: req.user.id,
                OR: [{ id: req.params.id }, { proposalId: req.params.id }],
            },
            include: {
                project: {
                    select: { id: true, title: true, status: true }
                }
            }
        });
        if (!contract) {
            return res.status(404).json(successResponse('Contract not found', null));
        }
        const [contractWithFreelancer] = await attachContractFreelancers([contract]);
        let proposal = null;
        if (contract.proposalId) {
            proposal = await prisma.proposal.findUnique({
                where: { id: contract.proposalId }
            });
        }
        return res.json(successResponse('Contract details', {
            ...contractWithFreelancer,
            proposal: proposal
        }));
    }
    catch (error) {
        next(error);
    }
};
export const createContract = async (req, res, next) => {
    try {
        const { projectId, freelancerId, proposalId } = req.body;
        const num = `CON-${Date.now()}`;
        const contract = await prisma.contract.create({
            data: { contractNumber: num, projectId, clientId: req.user.id, freelancerId, proposalId, status: 'pending_acceptance' }
        });
        return res.status(201).json(successResponse('Contract created', contract));
    }
    catch (error) {
        next(error);
    }
};
const updateContractStatus = (status) => async (req, res, next) => {
    try {
        await prisma.contract.updateMany({ where: { id: req.params.id, clientId: req.user.id }, data: { status } });
        return res.json(successResponse(`Contract ${status}`));
    }
    catch (error) {
        next(error);
    }
};
export const activateContract = updateContractStatus('active');
export const completeContract = updateContractStatus('completed');
export const cancelContract = updateContractStatus('cancelled');
export const getContractMilestones = async (req, res, next) => {
    try {
        const contract = await prisma.contract.findFirst({ where: { id: req.params.id, clientId: req.user.id } });
        if (!contract)
            return res.json(successResponse('Milestones', []));
        const milestones = await prisma.milestone.findMany({ where: { projectId: contract.projectId } });
        return res.json(successResponse('Milestones retrieved', milestones));
    }
    catch (error) {
        next(error);
    }
};
export const addContractMilestone = async (req, res, next) => {
    try {
        const contract = await prisma.contract.findFirst({ where: { id: req.params.id, clientId: req.user.id } });
        if (!contract)
            return res.json(successResponse('Contract not found'));
        const { title, dueDate } = req.body;
        const milestone = await prisma.milestone.create({ data: { projectId: contract.projectId, title, dueDate } });
        return res.status(201).json(successResponse('Milestone added', milestone));
    }
    catch (error) {
        next(error);
    }
};
