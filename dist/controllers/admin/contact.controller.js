import { contactCmsService } from "../../services/admin/contact.service.js";
export async function getPublicContactPage(req, res, next) {
    try {
        const result = await contactCmsService.getPublicContactPage();
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function submitContactEnquiry(req, res, next) {
    try {
        const ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
        const userAgent = req.headers["user-agent"] || "";
        const result = await contactCmsService.submitPublicEnquiry({
            ...req.body,
            ipAddress,
            userAgent,
        });
        res.status(201).json(result);
    }
    catch (e) {
        res.status(400).json({ success: false, message: e.message || "Failed to submit contact enquiry." });
    }
}
export async function getAdminContactPage(req, res, next) {
    try {
        const result = await contactCmsService.getAdminContactPage();
        res.json({ success: true, data: result });
    }
    catch (e) {
        next(e);
    }
}
export async function saveContactDraft(req, res, next) {
    try {
        const result = await contactCmsService.saveContactDraft(req.body);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function publishContactPage(req, res, next) {
    try {
        const adminName = req.user?.name || "Admin";
        const result = await contactCmsService.publishContactPage(req.body, adminName);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function listContactEnquiries(req, res, next) {
    try {
        const { page, pageSize, search, status, enquiryType, priority } = req.query;
        const result = await contactCmsService.listContactEnquiries({
            page: page ? Number(page) : undefined,
            pageSize: pageSize ? Number(pageSize) : undefined,
            search: search,
            status: status,
            enquiryType: enquiryType,
            priority: priority,
        });
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
export async function getContactEnquiryById(req, res, next) {
    try {
        const result = await contactCmsService.getContactEnquiryById(req.params.id);
        res.json(result);
    }
    catch (e) {
        res.status(404).json({ success: false, message: e.message || "Enquiry not found." });
    }
}
export async function updateContactEnquiry(req, res, next) {
    try {
        const result = await contactCmsService.updateContactEnquiry(req.params.id, req.body);
        res.json(result);
    }
    catch (e) {
        next(e);
    }
}
