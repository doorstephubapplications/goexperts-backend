import { prisma } from "../config/database.js";
let userFaqTableEnsured = false;
export async function ensureUserFaqTable() {
    if (userFaqTableEnsured)
        return;
    try {
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`user_profile_faqs\` (
        \`id\` VARCHAR(191) NOT NULL,
        \`user_id\` VARCHAR(191) NOT NULL,
        \`role\` VARCHAR(191) NOT NULL DEFAULT 'freelancer',
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`category\` VARCHAR(191) NOT NULL DEFAULT 'General',
        \`industry_level\` VARCHAR(191) NULL,
        \`is_custom_category\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        INDEX \`user_profile_faqs_user_id_idx\`(\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `).catch(() => { });
        userFaqTableEnsured = true;
    }
    catch {
        userFaqTableEnsured = true;
    }
}
export const getMyProfileFaqs = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        await ensureUserFaqTable();
        // 1. Try DB table
        let rows = [];
        try {
            rows = await prisma.$queryRawUnsafe("SELECT id, title, description, category, industry_level as industryLevel, is_custom_category as isCustomCategory, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt FROM `user_profile_faqs` WHERE `user_id` = ? ORDER BY `sort_order` ASC, `created_at` ASC", userId);
        }
        catch {
            rows = [];
        }
        // 2. Fallback to settings table if DB table empty
        if (!rows || rows.length === 0) {
            const settingRow = await prisma.setting.findUnique({
                where: { key: `user_faqs:${userId}` },
            }).catch(() => null);
            if (settingRow?.value) {
                try {
                    const parsed = JSON.parse(settingRow.value);
                    if (Array.isArray(parsed))
                        rows = parsed;
                }
                catch { }
            }
        }
        return res.json({ success: true, data: rows || [], faqs: rows || [] });
    }
    catch (err) {
        next(err);
    }
};
export const saveMyProfileFaqs = async (req, res, next) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        await ensureUserFaqTable();
        const { role = "freelancer", faqs = [] } = req.body;
        const faqList = Array.isArray(faqs) ? faqs : [];
        // 1. Save in settings as resilient backup
        await prisma.setting.upsert({
            where: { key: `user_faqs:${userId}` },
            create: { key: `user_faqs:${userId}`, value: JSON.stringify(faqList) },
            update: { value: JSON.stringify(faqList) },
        }).catch(() => { });
        // 2. Replace in user_profile_faqs table
        try {
            await prisma.$executeRawUnsafe("DELETE FROM `user_profile_faqs` WHERE `user_id` = ?", userId);
            for (let i = 0; i < faqList.length; i++) {
                const item = faqList[i];
                if (!item.title && !item.question)
                    continue;
                const id = item.id || `faq_${Date.now()}_${i}`;
                const title = item.title || item.question || "";
                const desc = item.description || item.answer || "";
                const cat = item.category || "General";
                const ind = item.industryLevel || null;
                const isCustom = Boolean(item.isCustomCategory);
                await prisma.$executeRawUnsafe("INSERT INTO `user_profile_faqs` (`id`, `user_id`, `role`, `title`, `description`, `category`, `industry_level`, `is_custom_category`, `sort_order`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", id, userId, role, title, desc, cat, ind, isCustom, i);
            }
        }
        catch {
            // Table insert error handled; setting backup is intact
        }
        return res.json({ success: true, message: "Profile FAQs saved successfully.", data: faqList });
    }
    catch (err) {
        next(err);
    }
};
export const getPublicUserFaqs = async (req, res, next) => {
    try {
        const id = req.params.userId || req.params.id;
        if (!id) {
            return res.json({ success: true, data: [], faqs: [] });
        }
        await ensureUserFaqTable();
        // Resolve target userId if given a slug
        let targetUserId = id;
        const cleanSearch = id.replace(/[-_]+/g, ' ').trim();
        const userRow = await prisma.user.findFirst({
            where: {
                OR: [
                    { id },
                    { username: id },
                    { email: id },
                    { slug: id },
                    { freelancerProfile: { id } },
                    { freelancerProfile: { slug: id } },
                    { fullName: { contains: cleanSearch } },
                    { clientProfile: { is: { company: { contains: cleanSearch } } } },
                ],
            },
            select: { id: true },
        }).catch(() => null);
        if (userRow?.id)
            targetUserId = userRow.id;
        // 1. Try DB table
        let rows = [];
        try {
            rows = await prisma.$queryRawUnsafe("SELECT id, title, description, category, industry_level as industryLevel, is_custom_category as isCustomCategory, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt FROM `user_profile_faqs` WHERE `user_id` = ? ORDER BY `sort_order` ASC, `created_at` ASC", targetUserId);
        }
        catch {
            rows = [];
        }
        // 2. Fallback to settings table
        if (!rows || rows.length === 0) {
            const settingRow = await prisma.setting.findUnique({
                where: { key: `user_faqs:${targetUserId}` },
            }).catch(() => null);
            if (settingRow?.value) {
                try {
                    const parsed = JSON.parse(settingRow.value);
                    if (Array.isArray(parsed))
                        rows = parsed;
                }
                catch { }
            }
        }
        return res.json({ success: true, data: rows || [], faqs: rows || [] });
    }
    catch (err) {
        next(err);
    }
};
