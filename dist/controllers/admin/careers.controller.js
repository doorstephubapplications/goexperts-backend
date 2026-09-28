import { careersCmsService } from "../../services/admin/careers.service.js";
export async function getPublicCareersPage(req, res, next) {
    try {
        const result = await careersCmsService.getPublicCareersPage();
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function getAdminCareersPage(req, res, next) {
    try {
        const result = await careersCmsService.getAdminCareersPage();
        res.json({ success: true, data: result });
    }
    catch (e) {
        next(e);
    }
}
export async function saveCareersDraft(req, res, next) {
    try {
        const result = await careersCmsService.saveCareersDraft(req.body);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function publishCareersPage(req, res, next) {
    try {
        const adminName = req.user?.name || "Admin";
        const result = await careersCmsService.publishCareersPage(req.body, adminName);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
/* Jobs */
export async function listPublicJobs(req, res, next) {
    try {
        const { search, department, location, workplaceType, employmentType } = req.query;
        const result = await careersCmsService.listPublicJobs({
            search: search,
            department: department,
            location: location,
            workplaceType: workplaceType,
            employmentType: employmentType,
        });
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function getPublicJobBySlug(req, res, next) {
    try {
        const result = await careersCmsService.getPublicJobBySlug(req.params.slug);
        res.json(result);
    }
    catch (e) {
        res.status(404).json({ success: false, message: e.message || "Job not found." });
    }
}
export async function listAdminJobs(req, res, next) {
    try {
        const { page, pageSize, search, status, department } = req.query;
        const result = await careersCmsService.listAdminJobs({
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            search: search,
            status: status,
            department: department,
        });
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function createJob(req, res, next) {
    try {
        const result = await careersCmsService.createJob(req.body);
        res.status(201).json(result);
    }
    catch (e) {
        res.status(400).json({ success: false, message: e.message || "Failed to create job opening." });
    }
}
export async function updateJob(req, res, next) {
    try {
        const result = await careersCmsService.updateJob(req.params.id, req.body);
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ success: false, message: e.message || "Failed to update job." });
    }
}
export async function deleteJob(req, res, next) {
    try {
        const result = await careersCmsService.deleteJob(req.params.id);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
/* Applications */
export async function submitCareerApplication(req, res, next) {
    try {
        const inputData = {
            ...req.body,
            jobId: req.params.jobId
        };
        const result = await careersCmsService.submitCareerApplication(inputData);
        res.status(201).json(result);
    }
    catch (e) {
        res.status(400).json({ success: false, message: e.message || "Failed to submit career application." });
    }
}
export async function listCareerApplications(req, res, next) {
    try {
        const { page, pageSize, search, status, jobId } = req.query;
        const result = await careersCmsService.listCareerApplications({
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            search: search,
            status: status,
            jobId: jobId,
        });
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function getCareerApplicationById(req, res, next) {
    try {
        const result = await careersCmsService.getCareerApplicationById(req.params.id);
        res.json(result);
    }
    catch (e) {
        res.status(404).json({ success: false, message: e.message || "Application not found." });
    }
}
export async function updateCareerApplication(req, res, next) {
    try {
        const result = await careersCmsService.updateCareerApplication(req.params.id, req.body);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
