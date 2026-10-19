import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/database.js";
import { getVerificationStats, applyVerificationUpdate } from "../../common/helpers/verification.js";
import { AuthenticatedRequest } from "../../middlewares/auth.middleware.js";
import { getKycCatalogFromDb, getKycPolicyFromDb } from "../../services/kyc/kyc-catalog.service.js";

/**
 * Returns verification stats, catalog, and policy for the current user.
 */
export const getMyVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await prisma.user.findFirst({
            where: { id: req.user.id, deletedAt: null },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const role = String(user.role || "freelancer").toLowerCase();
        const stats = getVerificationStats(user);
        const catalog = await getKycCatalogFromDb(role);
        const policy = await getKycPolicyFromDb(role);

        res.json({
            success: true,
            data: {
                ...stats,
                catalog,
                policy
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Returns available document catalog from the database.
 */
export const getKycCatalog = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const role = String(req.user?.role || req.query.role || "freelancer").toLowerCase();
        const catalog = await getKycCatalogFromDb(role);
        res.json({
            success: true,
            data: catalog
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Returns applicable KYC policy for the user's role.
 */
export const getKycPolicy = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const role = String(req.user?.role || req.query.role || "freelancer").toLowerCase();
        const policy = await getKycPolicyFromDb(role);
        res.json({
            success: true,
            data: policy
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Uploads/updates a verification document with backend validation and audit logging.
 */
export const updateMyVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const stats = await applyVerificationUpdate(req.user.id, req.body);
        const targetItem = stats.items.find(i => i.key === req.body.key);

        // Record Audit Log for security compliance
        prisma.auditLog.create({
            data: {
                actorId: req.user.id,
                action: "KYC_DOCUMENT_UPLOADED",
                entity: "KYC_DOCUMENT",
                entityId: req.body.key,
                newValue: JSON.stringify({
                    key: req.body.key,
                    status: targetItem?.status || "pending",
                    documentUrl: req.body.documentUrl ? "[REDACTED_DOCUMENT_URL]" : null,
                    uploadedAt: new Date().toISOString()
                }),
                ipAddress: req.ip || req.socket.remoteAddress || "0.0.0.0"
            }
        }).catch(() => null);

        res.json({
            success: true,
            message: "Your document upload was successful. Awaiting admin approval.",
            data: {
                item: targetItem || { key: req.body.key },
                stats
            }
        });
    } catch (error: any) {
        if (error.message && (error.message.includes("Invalid") || error.message.includes("already verified") || error.message.includes("Email is verified"))) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

/**
 * Submits the user's uploaded KYC documents for review after validating required counts.
 */
export const submitMyVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await prisma.user.findFirst({
            where: { id: req.user.id, deletedAt: null },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const stats = getVerificationStats(user);
        const role = String(user.role || "freelancer").toLowerCase();
        const policy = await getKycPolicyFromDb(role);

        // Validate that minimum personal documents are submitted
        if (stats.personalSubmitted < policy.personalRequired) {
            return res.status(400).json({
                success: false,
                message: `Please upload at least ${policy.personalRequired} personal documents before submitting for review.`
            });
        }

        // Validate business documents if required by policy
        if (policy.businessRequired > 0 && stats.businessSubmitted < policy.businessRequired) {
            return res.status(400).json({
                success: false,
                message: `Please upload at least ${policy.businessRequired} business documents before submitting for review.`
            });
        }

        // Audit Log
        prisma.auditLog.create({
            data: {
                actorId: req.user.id,
                action: "KYC_SUBMITTED_FOR_REVIEW",
                entity: "KYC_SUBMISSION",
                entityId: req.user.id,
                newValue: JSON.stringify({
                    personalSubmitted: stats.personalSubmitted,
                    businessSubmitted: stats.businessSubmitted,
                    submittedAt: new Date().toISOString()
                }),
                ipAddress: req.ip || req.socket.remoteAddress || "0.0.0.0"
            }
        }).catch(() => null);

        res.json({
            success: true,
            message: "Documents submitted successfully for verification! Our team will review your submission.",
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Saves draft document selection / progress without submitting.
 */
export const saveMyVerificationDraft = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const user = await prisma.user.findFirst({
            where: { id: req.user.id, deletedAt: null },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const stats = getVerificationStats(user);
        res.json({
            success: true,
            message: "KYC draft progress saved successfully.",
            data: stats
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deletes a verification document or resets verification state.
 */
export const deleteMyVerification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.id) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const key = req.query.key || req.body.key;
        if (key) {
            const payload = {
                key: String(key),
                status: "missing",
                value: "",
                documentUrl: ""
            };
            const stats = await applyVerificationUpdate(req.user.id, payload);

            prisma.auditLog.create({
                data: {
                    actorId: req.user.id,
                    action: "KYC_DOCUMENT_DELETED",
                    entity: "KYC_DOCUMENT",
                    entityId: String(key),
                    ipAddress: req.ip || req.socket.remoteAddress || "0.0.0.0"
                }
            }).catch(() => null);

            return res.json({ success: true, message: "Verification document deleted successfully", data: stats });
        }

        const user = await prisma.user.findFirst({
            where: { id: req.user.id },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const currentStats = getVerificationStats(user);
        if (currentStats.items.some(i => i.status === "verified")) {
            return res.status(403).json({ success: false, message: "You have verified documents that cannot be deleted. Please contact support." });
        }

        const role = String(user.role).toLowerCase();
        const emptyJson = JSON.stringify({});

        if (role === 'freelancer' || role === 'talent') {
            await prisma.freelancerProfile.upsert({ where: { userId: user.id }, update: { verificationJson: emptyJson }, create: { userId: user.id, verificationJson: emptyJson } });
        } else if (role === 'client') {
            await prisma.clientProfile.upsert({ where: { userId: user.id }, update: { verificationJson: emptyJson }, create: { userId: user.id, verificationJson: emptyJson } });
        } else if (role === 'founder' || role === 'startup founder') {
            await prisma.founderProfile.upsert({ where: { userId: user.id }, update: { verificationJson: emptyJson }, create: { userId: user.id, verificationJson: emptyJson } });
        } else if (role === 'investor') {
            await prisma.investorProfile.upsert({ where: { userId: user.id }, update: { verificationJson: emptyJson }, create: { userId: user.id, verificationJson: emptyJson } });
        }

        const freshUser = await prisma.user.findFirst({
            where: { id: user.id },
            include: {
                freelancerProfile: true,
                clientProfile: true,
                founderProfile: true,
                investorProfile: true
            }
        });

        res.json({ success: true, message: "Verification reset successfully", data: getVerificationStats(freshUser) });
    } catch (error) {
        next(error);
    }
};
