import { prisma } from "../../config/database.js";
// Helper: Require authenticated user ID
function requireUser(req, res) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
        return null;
    }
    return userId;
}
// ─────────────────────────────────────────────────────────────────────────────
// DATABASE RESILIENCE: Auto-ensure tables exist
// ─────────────────────────────────────────────────────────────────────────────
let tablesEnsured = false;
export async function ensureFreelancerTables() {
    if (tablesEnsured)
        return;
    try {
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`freelancer_achievements\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`user_id\` VARCHAR(191) NOT NULL,
        \`title\` VARCHAR(191) NOT NULL,
        \`achievement_type\` VARCHAR(191) NOT NULL,
        \`organization\` VARCHAR(191) NULL,
        \`achievement_date\` VARCHAR(191) NOT NULL,
        \`category_id\` VARCHAR(191) NULL,
        \`description\` TEXT NULL,
        \`evidence_url\` VARCHAR(191) NULL,
        \`attachment_reference\` VARCHAR(191) NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX \`freelancer_achievements_user_id_idx\`(\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`freelancer_services\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`user_id\` VARCHAR(191) NOT NULL,
        \`title\` VARCHAR(191) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`category_id\` VARCHAR(191) NULL,
        \`skills\` TEXT NULL,
        \`thumbnail_url\` VARCHAR(191) NULL,
        \`rate_amount\` DOUBLE NULL,
        \`rate_unit\` VARCHAR(191) NULL,
        \`currency\` VARCHAR(191) NULL DEFAULT 'INR',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX \`freelancer_services_user_id_idx\`(\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`freelancer_languages\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`user_id\` VARCHAR(191) NOT NULL,
        \`language_code\` VARCHAR(191) NOT NULL,
        \`language_name\` VARCHAR(191) NOT NULL,
        \`proficiency\` VARCHAR(191) NOT NULL,
        \`is_native\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        UNIQUE INDEX \`freelancer_languages_user_id_language_code_key\`(\`user_id\`, \`language_code\`),
        INDEX \`freelancer_languages_user_id_idx\`(\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`freelancer_availabilities\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`user_id\` VARCHAR(191) NOT NULL,
        \`status\` VARCHAR(191) NOT NULL DEFAULT 'available',
        \`start_date\` VARCHAR(191) NULL,
        \`end_date\` VARCHAR(191) NULL,
        \`reason_code\` VARCHAR(191) NULL,
        \`custom_reason\` VARCHAR(191) NULL,
        \`private_notes\` TEXT NULL,
        \`reason_public_visibility\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX \`freelancer_availabilities_user_id_idx\`(\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
        // Ensure extra columns on freelancer_certificates
        const alterQueries = [
            "ALTER TABLE `freelancer_certificates` ADD COLUMN `expiration_date` VARCHAR(191) NULL",
            "ALTER TABLE `freelancer_certificates` ADD COLUMN `does_not_expire` BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE `freelancer_certificates` ADD COLUMN `credential_id` VARCHAR(191) NULL",
            "ALTER TABLE `freelancer_certificates` ADD COLUMN `credential_url` VARCHAR(191) NULL",
            "ALTER TABLE `freelancer_certificates` ADD COLUMN `category_id` VARCHAR(191) NULL",
            "ALTER TABLE `freelancer_certificates` ADD COLUMN `description` TEXT NULL",
            "ALTER TABLE `freelancer_certificates` ADD COLUMN `attachment_reference` VARCHAR(191) NULL"
        ];
        for (const q of alterQueries) {
            await prisma.$executeRawUnsafe(q).catch(() => { });
        }
        tablesEnsured = true;
    }
    catch (err) {
        // Non-fatal if tables already exist
        tablesEnsured = true;
    }
}
// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: PROFILE AVAILABILITY (Active / Inactive / Scheduled / Auto-Reactivate)
// ─────────────────────────────────────────────────────────────────────────────
function computeEffectiveAvailability(record) {
    if (!record || record.status === "available" || !record.startDate || !record.endDate) {
        return {
            effectiveStatus: "available",
            isAvailable: true,
            isScheduled: false,
            isOffline: false,
            statusLabel: "Available for Work",
            periodText: null,
            autoReactivated: false,
        };
    }
    // Get current YYYY-MM-DD
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const startStr = String(record.startDate).slice(0, 10);
    const endStr = String(record.endDate).slice(0, 10);
    if (todayStr < startStr) {
        // Future scheduled inactivity
        return {
            effectiveStatus: "scheduled",
            isAvailable: true, // Still active until start date
            isScheduled: true,
            isOffline: false,
            statusLabel: "Available (Inactivity Scheduled)",
            periodText: `Scheduled offline from ${startStr} to ${endStr}`,
            autoReactivated: false,
        };
    }
    else if (todayStr >= startStr && todayStr <= endStr) {
        // Currently within inactive range
        return {
            effectiveStatus: "unavailable",
            isAvailable: false,
            isScheduled: false,
            isOffline: true,
            statusLabel: "Currently Unavailable",
            periodText: `Unavailable from ${startStr} through ${endStr}`,
            autoReactivated: false,
        };
    }
    else {
        // End date has passed -> automatically reactivated!
        return {
            effectiveStatus: "available",
            isAvailable: true,
            isScheduled: false,
            isOffline: false,
            statusLabel: "Available for Work",
            periodText: null,
            autoReactivated: true,
        };
    }
}
export const getFreelancerAvailability = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const record = await prisma.freelancerAvailability.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        const computed = computeEffectiveAvailability(record);
        res.json({
            success: true,
            data: {
                record: record || null,
                ...computed,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const setFreelancerAvailability = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const { status = "unavailable", startDate, endDate, reasonCode, customReason, privateNotes, reasonPublicVisibility = true, } = req.body;
        if (status === "available") {
            // Direct reactivation
            await prisma.freelancerAvailability.deleteMany({ where: { userId } });
            await prisma.freelancerProfile.updateMany({
                where: { userId },
                data: { availability: "Available for work" },
            });
            return res.json({
                success: true,
                message: "Profile availability set to Active (Available for work).",
                data: {
                    effectiveStatus: "available",
                    isAvailable: true,
                    statusLabel: "Available for Work",
                },
            });
        }
        // Validation for Inactivity
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: "Both starting date and end date are required." });
        }
        if (new Date(endDate) < new Date(startDate)) {
            return res.status(400).json({ success: false, message: "End date must be on or after starting date." });
        }
        if (!reasonCode || String(reasonCode).trim() === "") {
            return res.status(400).json({ success: false, message: "Please select a reason for unavailability." });
        }
        if (reasonCode === "Other" && (!customReason || String(customReason).trim() === "")) {
            return res.status(400).json({ success: false, message: "Please provide your custom reason." });
        }
        const trimmedCustom = customReason ? String(customReason).slice(0, 200).trim() : null;
        const trimmedNotes = privateNotes ? String(privateNotes).slice(0, 500).trim() : null;
        // Delete existing active records for this user to avoid conflicts
        await prisma.freelancerAvailability.deleteMany({ where: { userId } });
        const created = await prisma.freelancerAvailability.create({
            data: {
                userId,
                status: "unavailable",
                startDate: String(startDate).slice(0, 10),
                endDate: String(endDate).slice(0, 10),
                reasonCode: String(reasonCode),
                customReason: trimmedCustom,
                privateNotes: trimmedNotes,
                reasonPublicVisibility: Boolean(reasonPublicVisibility),
            },
        });
        const computed = computeEffectiveAvailability(created);
        // Sync summary onto freelancer profile without disabling account
        const summaryText = computed.isOffline
            ? `Unavailable until ${created.endDate}`
            : `Available (Unavailable starting ${created.startDate})`;
        await prisma.freelancerProfile.updateMany({
            where: { userId },
            data: { availability: summaryText },
        });
        res.json({
            success: true,
            message: computed.isScheduled ? "Unavailability schedule saved." : "Profile is now set as Unavailable for new work.",
            data: {
                record: created,
                ...computed,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
export const reactivateFreelancerAvailability = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        await prisma.freelancerAvailability.deleteMany({ where: { userId } });
        await prisma.freelancerProfile.updateMany({
            where: { userId },
            data: { availability: "Available for work" },
        });
        res.json({
            success: true,
            message: "Profile successfully reactivated. You are now Available for new work.",
            data: {
                effectiveStatus: "available",
                isAvailable: true,
                statusLabel: "Available for Work",
            },
        });
    }
    catch (err) {
        next(err);
    }
};
async function resolveFreelancerUserId(idOrSlug) {
    if (!idOrSlug)
        return idOrSlug;
    try {
        const userRow = await prisma.user.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { username: idOrSlug },
                    { email: idOrSlug },
                    { slug: idOrSlug },
                    { freelancerProfile: { id: idOrSlug } },
                    { freelancerProfile: { slug: idOrSlug } },
                ],
            },
            select: { id: true },
        }).catch(() => null);
        if (userRow?.id)
            return userRow.id;
        const fp = await prisma.freelancerProfile.findFirst({
            where: {
                OR: [
                    { id: idOrSlug },
                    { userId: idOrSlug },
                    { slug: idOrSlug },
                ],
            },
            select: { userId: true },
        }).catch(() => null);
        if (fp?.userId)
            return fp.userId;
    }
    catch {
        // fallback
    }
    return idOrSlug;
}
export const getPublicFreelancerAvailability = async (req, res, next) => {
    try {
        const { id } = req.params;
        await ensureFreelancerTables();
        const targetUserId = await resolveFreelancerUserId(id);
        const record = await prisma.freelancerAvailability.findFirst({
            where: { userId: targetUserId },
            orderBy: { createdAt: "desc" },
        });
        const computed = computeEffectiveAvailability(record);
        res.json({
            success: true,
            data: {
                effectiveStatus: computed.effectiveStatus,
                isAvailable: computed.isAvailable,
                statusLabel: computed.statusLabel,
                periodText: computed.periodText,
                startDate: computed.isOffline || computed.isScheduled ? record?.startDate : null,
                endDate: computed.isOffline || computed.isScheduled ? record?.endDate : null,
                reason: (record?.reasonPublicVisibility && (computed.isOffline || computed.isScheduled))
                    ? (record.reasonCode === "Other" ? record.customReason : record.reasonCode)
                    : null,
            },
        });
    }
    catch (err) {
        next(err);
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: CERTIFICATIONS & ACHIEVEMENTS
// ─────────────────────────────────────────────────────────────────────────────
export const listFreelancerCertifications = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const rows = await prisma.freelancerCertificate.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: rows, total: rows.length });
    }
    catch (err) {
        next(err);
    }
};
export const createFreelancerCertification = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const { name, issuer, issued, expirationDate, doesNotExpire = false, credentialId, credentialUrl, categoryId, description, skillsUsed, fileUrl, } = req.body;
        if (!name || String(name).trim() === "") {
            return res.status(400).json({ success: false, message: "Certification name is required." });
        }
        if (!issuer || String(issuer).trim() === "") {
            return res.status(400).json({ success: false, message: "Issuing organization is required." });
        }
        if (!issued || String(issued).trim() === "") {
            return res.status(400).json({ success: false, message: "Issue date is required." });
        }
        if (!doesNotExpire && expirationDate && new Date(expirationDate) < new Date(issued)) {
            return res.status(400).json({ success: false, message: "Expiration date cannot be before issue date." });
        }
        const created = await prisma.freelancerCertificate.create({
            data: {
                userId,
                name: String(name).slice(0, 120).trim(),
                issuer: String(issuer).slice(0, 120).trim(),
                issued: String(issued).trim(),
                expirationDate: doesNotExpire ? null : (expirationDate ? String(expirationDate).trim() : null),
                doesNotExpire: Boolean(doesNotExpire),
                credentialId: credentialId ? String(credentialId).slice(0, 100).trim() : null,
                credentialUrl: credentialUrl ? String(credentialUrl).trim() : null,
                categoryId: categoryId ? String(categoryId).trim() : null,
                description: description ? String(description).slice(0, 350).trim() : null,
                skillsUsed: Array.isArray(skillsUsed) ? skillsUsed.join(", ") : (skillsUsed ? String(skillsUsed) : null),
                url: credentialUrl ? String(credentialUrl).trim() : null,
                number: credentialId ? String(credentialId).trim() : "",
                fileUrl: fileUrl ? String(fileUrl).trim() : null,
            },
        });
        res.status(201).json({ success: true, message: "Certification added successfully.", data: created });
    }
    catch (err) {
        next(err);
    }
};
export const updateFreelancerCertification = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        const existing = await prisma.freelancerCertificate.findFirst({ where: { id, userId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Certification not found or access denied." });
        }
        const { name, issuer, issued, expirationDate, doesNotExpire, credentialId, credentialUrl, categoryId, description, skillsUsed, fileUrl, } = req.body;
        const updated = await prisma.freelancerCertificate.update({
            where: { id },
            data: {
                name: name !== undefined ? String(name).slice(0, 120).trim() : existing.name,
                issuer: issuer !== undefined ? String(issuer).slice(0, 120).trim() : existing.issuer,
                issued: issued !== undefined ? String(issued).trim() : existing.issued,
                expirationDate: doesNotExpire ? null : (expirationDate !== undefined ? String(expirationDate).trim() : existing.expirationDate),
                doesNotExpire: doesNotExpire !== undefined ? Boolean(doesNotExpire) : existing.doesNotExpire,
                credentialId: credentialId !== undefined ? String(credentialId).slice(0, 100).trim() : existing.credentialId,
                credentialUrl: credentialUrl !== undefined ? String(credentialUrl).trim() : existing.credentialUrl,
                categoryId: categoryId !== undefined ? String(categoryId).trim() : existing.categoryId,
                description: description !== undefined ? String(description).slice(0, 350).trim() : existing.description,
                skillsUsed: skillsUsed !== undefined ? (Array.isArray(skillsUsed) ? skillsUsed.join(", ") : String(skillsUsed)) : existing.skillsUsed,
                url: credentialUrl !== undefined ? String(credentialUrl).trim() : existing.url,
                fileUrl: fileUrl !== undefined ? String(fileUrl).trim() : existing.fileUrl,
            },
        });
        res.json({ success: true, message: "Certification updated.", data: updated });
    }
    catch (err) {
        next(err);
    }
};
export const deleteFreelancerCertification = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        await prisma.freelancerCertificate.deleteMany({ where: { id, userId } });
        res.json({ success: true, message: "Certification deleted." });
    }
    catch (err) {
        next(err);
    }
};
// ACHIEVEMENTS
export const listFreelancerAchievements = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const rows = await prisma.freelancerAchievement.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: rows, total: rows.length });
    }
    catch (err) {
        next(err);
    }
};
export const createFreelancerAchievement = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const { title, achievementType = "Professional Award", organization, achievementDate, categoryId, description, evidenceUrl, attachmentReference, } = req.body;
        if (!title || String(title).trim() === "") {
            return res.status(400).json({ success: false, message: "Achievement title is required." });
        }
        if (!achievementDate || String(achievementDate).trim() === "") {
            return res.status(400).json({ success: false, message: "Achievement date is required." });
        }
        const created = await prisma.freelancerAchievement.create({
            data: {
                userId,
                title: String(title).slice(0, 120).trim(),
                achievementType: String(achievementType),
                organization: organization ? String(organization).slice(0, 120).trim() : null,
                achievementDate: String(achievementDate).trim(),
                categoryId: categoryId ? String(categoryId).trim() : null,
                description: description ? String(description).slice(0, 350).trim() : null,
                evidenceUrl: evidenceUrl ? String(evidenceUrl).trim() : null,
                attachmentReference: attachmentReference ? String(attachmentReference).trim() : null,
            },
        });
        res.status(201).json({ success: true, message: "Achievement added successfully.", data: created });
    }
    catch (err) {
        next(err);
    }
};
export const updateFreelancerAchievement = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        const existing = await prisma.freelancerAchievement.findFirst({ where: { id, userId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Achievement not found or access denied." });
        }
        const { title, achievementType, organization, achievementDate, categoryId, description, evidenceUrl, attachmentReference, } = req.body;
        const updated = await prisma.freelancerAchievement.update({
            where: { id },
            data: {
                title: title !== undefined ? String(title).slice(0, 120).trim() : existing.title,
                achievementType: achievementType !== undefined ? String(achievementType) : existing.achievementType,
                organization: organization !== undefined ? String(organization).slice(0, 120).trim() : existing.organization,
                achievementDate: achievementDate !== undefined ? String(achievementDate).trim() : existing.achievementDate,
                categoryId: categoryId !== undefined ? String(categoryId).trim() : existing.categoryId,
                description: description !== undefined ? String(description).slice(0, 350).trim() : existing.description,
                evidenceUrl: evidenceUrl !== undefined ? String(evidenceUrl).trim() : existing.evidenceUrl,
                attachmentReference: attachmentReference !== undefined ? String(attachmentReference).trim() : existing.attachmentReference,
            },
        });
        res.json({ success: true, message: "Achievement updated.", data: updated });
    }
    catch (err) {
        next(err);
    }
};
export const deleteFreelancerAchievement = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        await prisma.freelancerAchievement.deleteMany({ where: { id, userId } });
        res.json({ success: true, message: "Achievement deleted." });
    }
    catch (err) {
        next(err);
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: PROFESSIONAL SERVICES (My Services)
// ─────────────────────────────────────────────────────────────────────────────
export const listFreelancerServices = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const rows = await prisma.freelancerService.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, data: rows, total: rows.length });
    }
    catch (err) {
        next(err);
    }
};
export const getFreelancerServiceById = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        const row = await prisma.freelancerService.findFirst({
            where: { id, userId },
        });
        if (!row) {
            return res.status(404).json({ success: false, message: "Service not found." });
        }
        res.json({ success: true, data: row });
    }
    catch (err) {
        next(err);
    }
};
export const createFreelancerService = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const { title, description, categoryId, skills, thumbnailUrl, rateAmount, rateUnit = "per_hour", currency = "INR", } = req.body;
        if (!title || String(title).trim().length < 3) {
            return res.status(400).json({ success: false, message: "Service title must be at least 3 characters (max 100)." });
        }
        if (!description || String(description).trim().length < 10) {
            return res.status(400).json({ success: false, message: "Service description must be at least 10 characters (max 350)." });
        }
        const numRate = (rateAmount != null && String(rateAmount) !== "") ? parseFloat(String(rateAmount)) : null;
        const created = await prisma.freelancerService.create({
            data: {
                userId,
                title: String(title).slice(0, 100).trim(),
                description: String(description).slice(0, 350).trim(),
                categoryId: categoryId ? String(categoryId).trim() : null,
                skills: Array.isArray(skills) ? skills.join(", ") : (skills ? String(skills) : null),
                thumbnailUrl: thumbnailUrl ? String(thumbnailUrl).trim() : null,
                rateAmount: Number.isFinite(numRate) ? numRate : null,
                rateUnit: String(rateUnit || "per_hour"),
                currency: String(currency || "INR"),
            },
        });
        res.status(201).json({ success: true, message: "Professional service created.", data: created });
    }
    catch (err) {
        next(err);
    }
};
export const updateFreelancerService = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        const existing = await prisma.freelancerService.findFirst({ where: { id, userId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Service not found or access denied." });
        }
        const { title, description, categoryId, skills, thumbnailUrl, rateAmount, rateUnit, currency, } = req.body;
        const numRate = (rateAmount != null && String(rateAmount) !== "") ? parseFloat(String(rateAmount)) : null;
        const updated = await prisma.freelancerService.update({
            where: { id },
            data: {
                title: title !== undefined ? String(title).slice(0, 100).trim() : existing.title,
                description: description !== undefined ? String(description).slice(0, 350).trim() : existing.description,
                categoryId: categoryId !== undefined ? String(categoryId).trim() : existing.categoryId,
                skills: skills !== undefined ? (Array.isArray(skills) ? skills.join(", ") : String(skills)) : existing.skills,
                thumbnailUrl: thumbnailUrl !== undefined ? (thumbnailUrl ? String(thumbnailUrl).trim() : null) : existing.thumbnailUrl,
                rateAmount: rateAmount !== undefined ? (Number.isFinite(numRate) ? numRate : null) : existing.rateAmount,
                rateUnit: rateUnit !== undefined ? String(rateUnit) : existing.rateUnit,
                currency: currency !== undefined ? String(currency) : existing.currency,
            },
        });
        res.json({ success: true, message: "Service updated.", data: updated });
    }
    catch (err) {
        next(err);
    }
};
export const deleteFreelancerService = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        await prisma.freelancerService.deleteMany({ where: { id, userId } });
        res.json({ success: true, message: "Service deleted." });
    }
    catch (err) {
        next(err);
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: LANGUAGES
// ─────────────────────────────────────────────────────────────────────────────
const VALID_PROFICIENCY_LEVELS = [
    "basic",
    "conversational",
    "professional_working",
    "fluent",
    "native_bilingual",
];
export const listFreelancerLanguages = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const rows = await prisma.freelancerLanguage.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });
        res.json({ success: true, data: rows, total: rows.length });
    }
    catch (err) {
        next(err);
    }
};
export const createFreelancerLanguage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        await ensureFreelancerTables();
        const { languageCode, languageName, proficiency = "professional_working", isNative = false } = req.body;
        if (!languageCode || !languageName) {
            return res.status(400).json({ success: false, message: "Language code and language name are required." });
        }
        const cleanCode = String(languageCode).toLowerCase().trim();
        const cleanProf = String(proficiency).toLowerCase().trim();
        if (!VALID_PROFICIENCY_LEVELS.includes(cleanProf)) {
            return res.status(400).json({
                success: false,
                message: `Invalid proficiency. Must be one of: ${VALID_PROFICIENCY_LEVELS.join(", ")}`,
            });
        }
        // Check duplicate
        const existing = await prisma.freelancerLanguage.findFirst({
            where: { userId, languageCode: cleanCode },
        });
        if (existing) {
            return res.status(409).json({ success: false, message: "You have already added this language." });
        }
        const created = await prisma.freelancerLanguage.create({
            data: {
                userId,
                languageCode: cleanCode,
                languageName: String(languageName).trim(),
                proficiency: cleanProf,
                isNative: Boolean(isNative || cleanProf === "native_bilingual"),
            },
        });
        res.status(201).json({ success: true, message: "Language added.", data: created });
    }
    catch (err) {
        next(err);
    }
};
export const updateFreelancerLanguage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        const existing = await prisma.freelancerLanguage.findFirst({ where: { id, userId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Language not found or access denied." });
        }
        const { proficiency, isNative } = req.body;
        const cleanProf = proficiency ? String(proficiency).toLowerCase().trim() : existing.proficiency;
        if (!VALID_PROFICIENCY_LEVELS.includes(cleanProf)) {
            return res.status(400).json({ success: false, message: "Invalid proficiency level." });
        }
        const updated = await prisma.freelancerLanguage.update({
            where: { id },
            data: {
                proficiency: cleanProf,
                isNative: isNative !== undefined ? Boolean(isNative) : (cleanProf === "native_bilingual" ? true : existing.isNative),
            },
        });
        res.json({ success: true, message: "Language updated.", data: updated });
    }
    catch (err) {
        next(err);
    }
};
export const deleteFreelancerLanguage = async (req, res, next) => {
    try {
        const userId = requireUser(req, res);
        if (!userId)
            return;
        const { id } = req.params;
        await ensureFreelancerTables();
        await prisma.freelancerLanguage.deleteMany({ where: { id, userId } });
        res.json({ success: true, message: "Language removed." });
    }
    catch (err) {
        next(err);
    }
};
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC READ-ONLY ENDPOINTS (Safe exposure, no private notes)
// ─────────────────────────────────────────────────────────────────────────────
export const getPublicFreelancerModulesData = async (req, res, next) => {
    try {
        const { id } = req.params;
        await ensureFreelancerTables();
        const targetUserId = await resolveFreelancerUserId(id);
        const [availRecord, certificates, achievements, services, languages, experiences] = await Promise.all([
            prisma.freelancerAvailability.findFirst({ where: { userId: targetUserId }, orderBy: { createdAt: "desc" } }).catch(() => null),
            prisma.freelancerCertificate.findMany({ where: { userId: targetUserId }, orderBy: { createdAt: "desc" } }).catch(() => []),
            prisma.freelancerAchievement.findMany({ where: { userId: targetUserId }, orderBy: { createdAt: "desc" } }).catch(() => []),
            prisma.freelancerService.findMany({ where: { userId: targetUserId }, orderBy: { createdAt: "desc" } }).catch(() => []),
            prisma.freelancerLanguage.findMany({ where: { userId: targetUserId }, orderBy: { createdAt: "asc" } }).catch(() => []),
            prisma.freelancerExperience.findMany({ where: { userId: targetUserId }, orderBy: { createdAt: "desc" } }).catch(() => []),
        ]);
        const availability = computeEffectiveAvailability(availRecord);
        res.json({
            success: true,
            data: {
                availability: {
                    effectiveStatus: availability.effectiveStatus,
                    isAvailable: availability.isAvailable,
                    statusLabel: availability.statusLabel,
                    periodText: availability.periodText,
                    startDate: (availability.isOffline || availability.isScheduled) ? availRecord?.startDate : null,
                    endDate: (availability.isOffline || availability.isScheduled) ? availRecord?.endDate : null,
                    reason: (availRecord?.reasonPublicVisibility && (availability.isOffline || availability.isScheduled))
                        ? (availRecord.reasonCode === "Other" ? availRecord.customReason : availRecord.reasonCode)
                        : null,
                },
                certificates: certificates.map((c) => ({
                    id: c.id,
                    name: c.name,
                    issuer: c.issuer,
                    issued: c.issued,
                    expirationDate: c.expirationDate,
                    doesNotExpire: c.doesNotExpire,
                    credentialUrl: c.credentialUrl || c.url,
                    credentialId: c.credentialId || c.number,
                    description: c.description,
                    skillsUsed: c.skillsUsed,
                    fileUrl: c.fileUrl,
                })),
                achievements: achievements.map((a) => ({
                    id: a.id,
                    title: a.title,
                    achievementType: a.achievementType,
                    organization: a.organization,
                    achievementDate: a.achievementDate,
                    description: a.description,
                    evidenceUrl: a.evidenceUrl,
                })),
                services: services.map((s) => ({
                    id: s.id,
                    title: s.title,
                    description: s.description,
                    categoryId: s.categoryId,
                    skills: s.skills,
                    thumbnailUrl: s.thumbnailUrl,
                    rateAmount: s.rateAmount,
                    rateUnit: s.rateUnit,
                    currency: s.currency || "INR",
                })),
                languages: languages.map((l) => ({
                    id: l.id,
                    languageCode: l.languageCode,
                    languageName: l.languageName,
                    proficiency: l.proficiency,
                    isNative: l.isNative,
                })),
                experiences: experiences.map((e) => ({
                    id: e.id,
                    role: e.title || "Experience",
                    title: e.title || "Experience",
                    company: e.company || "",
                    location: e.location || "",
                    startDate: e.startDate || "",
                    endDate: e.endDate || "",
                    isCurrent: Boolean(e.isCurrent),
                    description: e.description || "",
                    skillsUsed: e.skillsUsed ? (Array.isArray(e.skillsUsed) ? e.skillsUsed : String(e.skillsUsed).split(",").map((s) => s.trim()).filter(Boolean)) : [],
                    skills: e.skillsUsed ? (Array.isArray(e.skillsUsed) ? e.skillsUsed : String(e.skillsUsed).split(",").map((s) => s.trim()).filter(Boolean)) : [e.title || "Experience"],
                })),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
