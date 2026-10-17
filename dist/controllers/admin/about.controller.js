import { aboutCmsService } from "../../services/admin/about.service.js";
export async function getAdminAboutPage(req, res, next) {
    try {
        const data = await aboutCmsService.getAdminAboutPage();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function saveAboutDraft(req, res, next) {
    try {
        const { draftContent, expectedVersion } = req.body;
        if (!draftContent) {
            return res.status(400).json({ success: false, message: "draftContent is required" });
        }
        const adminId = req.user?.id;
        const result = await aboutCmsService.saveDraft(draftContent, expectedVersion, adminId);
        res.json(result);
    }
    catch (err) {
        if (err.message?.includes("CONCURRENCY_CONFLICT")) {
            return res.status(409).json({ success: false, message: err.message });
        }
        next(err);
    }
}
export async function publishAboutChanges(req, res, next) {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ success: false, message: "content payload is required for publish" });
        }
        const adminId = req.user?.id;
        const adminName = req.user?.fullName || req.user?.email || "Super Admin";
        const result = await aboutCmsService.publishChanges(content, adminId, adminName);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
export async function getAboutRevisions(req, res, next) {
    try {
        const data = await aboutCmsService.getRevisions();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getAboutRevisionById(req, res, next) {
    try {
        const { revisionId } = req.params;
        const data = await aboutCmsService.getRevisionById(revisionId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function restoreAboutRevision(req, res, next) {
    try {
        const { revisionId } = req.params;
        const adminId = req.user?.id;
        const result = await aboutCmsService.restoreRevisionToDraft(revisionId, adminId);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
export async function getPublicAboutPage(req, res, next) {
    try {
        const result = await aboutCmsService.getPublicAboutPage();
        res.json(result);
    }
    catch (err) {
        next(err);
    }
}
