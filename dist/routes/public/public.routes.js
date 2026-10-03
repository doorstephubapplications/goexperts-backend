import { Router } from "express";
import { prisma } from "../../config/database.js";
import { sendAccountDeletedEmail } from "../../services/mobile/email.service.js";
import { SETTINGS_DEFAULTS } from "../../services/settings/settings.defaults.js";
import { getHomeCmsContent, getHomePagePayload, getPublicCategories, getPublicPlatformStats, getPublicSkills, } from "../../services/public/home.service.js";
import { parseCatalogListBody, parseFreelancersListBody, parseSkillsListBody } from "../../common/helpers/catalog-body.js";
import { getPublicFreelancerFilters, listPublicExperienceLevels, listPublicFreelancers, } from "../../services/public/freelancers.service.js";
import { getPostProjectPagePayload, listPublicProjects, } from "../../services/public/projects.service.js";
import { getSettingsSection } from "../../services/settings/settings.service.js";
import { getHowItWorksPage } from "../../controllers/public/how-it-works.controller.js";
import { sendDeleteAccountOtp, verifyDeleteAccountOtp } from "../../controllers/auth/auth.controller.js";
import { getCountries, getStates, getSkills, getIndustries, getBudgetRanges, getTeamSizes, getFounderTypes, getBusinessTypes, getInvestorTypes, getTicketSizes, getWorkModes, getHiringGoals, getInvestorStages, getPlatformGoals, getCompanySizes, getExperienceLevels, getDesignations, } from "../../modules/mobile/public/public.controller.js";
const router = Router();
router.get("/countries", getCountries);
router.get("/states", getStates);
router.get("/skills", getSkills);
router.get("/industries", getIndustries);
// How It Works Dynamic Page
router.get("/how-it-works", getHowItWorksPage);
router.get("/budget-ranges", getBudgetRanges);
router.get("/hiring-budgets", getBudgetRanges);
router.get("/hiring-budget-ranges", getBudgetRanges);
router.get("/project-budgets", getBudgetRanges);
router.get("/project-budget-ranges", getBudgetRanges);
router.get("/team-sizes", getTeamSizes);
router.get("/team_sizes", getTeamSizes);
router.get("/founder-types", getFounderTypes);
router.get("/business-types", getBusinessTypes);
router.get("/investor-types", getInvestorTypes);
router.get("/investor_types", getInvestorTypes);
router.get("/ticket-sizes", getTicketSizes);
router.get("/work-modes", getWorkModes);
router.get("/hiring-goals", getHiringGoals);
router.get("/hiring_goals", getHiringGoals);
router.get("/investor-stages", getInvestorStages);
router.get("/investment-stages", getInvestorStages);
router.get("/investment_stages", getInvestorStages);
router.get("/platform-goals", getPlatformGoals);
router.get("/company-sizes", getCompanySizes);
router.get("/company_sizes", getCompanySizes);
router.get("/experience-levels", getExperienceLevels);
router.get("/designations", getDesignations);
router.get("/accredited-statuses", async (_req, res, next) => {
    try {
        const options = await prisma.masterOption.findMany({
            where: { type: 'accredited_status', status: 'active' },
            orderBy: { label: 'asc' },
            select: { id: true, label: true, value: true },
        }).catch(() => []);
        res.json({ success: true, data: options, rows: options });
    }
    catch (err) {
        next(err);
    }
});
router.get("/accredited_statuses", async (_req, res, next) => {
    try {
        const options = await prisma.masterOption.findMany({
            where: { type: 'accredited_status', status: 'active' },
            orderBy: { label: 'asc' },
            select: { id: true, label: true, value: true },
        }).catch(() => []);
        res.json({ success: true, data: options, rows: options });
    }
    catch (err) {
        next(err);
    }
});
router.get("/settings/branding", async (req, res) => {
    const result = await getSettingsSection("branding");
    res.json(result);
});
router.get("/settings/role-color", async (req, res) => {
    const role = String(req.query.role || "").trim().toLowerCase();
    const DEFAULT_COLOR = "#0f172a";
    if (!role)
        return res.json({ success: true, color: DEFAULT_COLOR });
    try {
        const setting = await prisma.setting.findUnique({ where: { key: "settings:industry_colors" } });
        const colors = setting?.value ? JSON.parse(setting.value) : SETTINGS_DEFAULTS.industry_colors;
        let matchedColor = DEFAULT_COLOR;
        for (const [key, color] of Object.entries(colors)) {
            if (key.toLowerCase() === role || key.toLowerCase() === role + 's') {
                matchedColor = String(color);
                break;
            }
        }
        res.json({ success: true, color: matchedColor });
    }
    catch (err) {
        res.json({ success: true, color: "#E30613" });
    }
});
router.get("/settings/general", async (req, res) => {
    const result = await getSettingsSection("general");
    res.json(result);
});
router.get("/settings/splash", async (req, res) => {
    const result = await getSettingsSection("splash", req);
    res.json({
        success: true,
        section: result.section,
        data: result.data,
    });
});
router.get("/settings/mobile-app-links", async (req, res) => {
    const result = await getSettingsSection("mobile_app_links");
    res.json({
        success: true,
        data: result.data || result,
    });
});
const COUNTRY_INFO_MAP = {
    "india": { code: "IN", phoneCode: "+91", flag: "🇮🇳", currencyCode: "INR" },
    "usa": { code: "US", phoneCode: "+1", flag: "🇺🇸", currencyCode: "USD" },
    "uk": { code: "GB", phoneCode: "+44", flag: "🇬🇧", currencyCode: "GBP" },
    "uae": { code: "AE", phoneCode: "+971", flag: "🇦🇪", currencyCode: "AED" },
    "canada": { code: "CA", phoneCode: "+1", flag: "🇨🇦", currencyCode: "CAD" },
    "australia": { code: "AU", phoneCode: "+61", flag: "🇦🇺", currencyCode: "AUD" },
    "germany": { code: "DE", phoneCode: "+49", flag: "🇩🇪", currencyCode: "EUR" },
    "france": { code: "FR", phoneCode: "+33", flag: "🇫🇷", currencyCode: "EUR" },
    "singapore": { code: "SG", phoneCode: "+65", flag: "🇸🇬", currencyCode: "SGD" },
    "japan": { code: "JP", phoneCode: "+81", flag: "🇯🇵", currencyCode: "JPY" },
};
router.get("/countries", async (_req, res, next) => {
    try {
        const countries = await prisma.country.findMany({
            where: { status: "active" },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        });
        const enriched = countries.map((row) => {
            const normName = (row.name || "").trim().toLowerCase();
            const info = COUNTRY_INFO_MAP[normName];
            return {
                ...row,
                code: row.code || info?.code || null,
                phoneCode: row.phoneCode || info?.phoneCode || null,
                flag: row.flag || info?.flag || null,
                currencyCode: row.currencyCode || info?.currencyCode || null,
            };
        });
        res.json({ success: true, count: enriched.length, data: enriched });
    }
    catch (err) {
        next(err);
    }
});
router.get("/states", async (req, res, next) => {
    try {
        const rawParam = String(req.query.countryCode || req.query.countryId || req.query.country || "IN").trim();
        let isoCode = rawParam.toUpperCase();
        if (rawParam.length > 3) {
            const dbRow = await prisma.country.findFirst({
                where: { OR: [{ id: rawParam }, { name: rawParam }] },
            }).catch(() => null);
            if (dbRow?.code) {
                isoCode = dbRow.code.toUpperCase();
            }
            else if (dbRow?.name) {
                const info = COUNTRY_INFO_MAP[dbRow.name.trim().toLowerCase()];
                if (info?.code)
                    isoCode = info.code;
            }
        }
        let states = [];
        try {
            // @ts-ignore
            const csc = await import("country-state-city");
            if (csc?.State) {
                states = csc.State.getStatesOfCountry(isoCode).map((s) => ({
                    id: s.isoCode,
                    code: s.isoCode,
                    name: s.name,
                    countryCode: s.countryCode,
                }));
            }
        }
        catch (e) {
            console.error("Failed to dynamically import country-state-city in public.routes:", e);
        }
        res.json({ success: true, count: states.length, data: states, rows: states });
    }
    catch (err) {
        next(err);
    }
});
router.get("/cities", async (req, res, next) => {
    try {
        const rawCountry = String(req.query.countryId || req.query.country || req.query.countryCode || "").trim();
        const search = String(req.query.search || "").trim().toLowerCase();
        if (!rawCountry) {
            return res.json({ success: true, count: 0, data: [], rows: [] });
        }
        const cities = await prisma.city?.findMany({
            where: {
                countryId: rawCountry,
                status: "active",
                ...(search ? { name: { contains: search } } : {}),
            },
            orderBy: { name: "asc" }
        }) || [];
        if (cities.length > 0) {
            return res.json({ success: true, count: cities.length, data: cities, rows: cities });
        }
        const country = await prisma.country.findFirst({
            where: {
                OR: [
                    { id: rawCountry },
                    { name: rawCountry },
                    { code: rawCountry.toUpperCase() },
                ],
            },
        }).catch(() => null);
        let isoCode = (country?.code || "").trim().toUpperCase();
        if (!isoCode && rawCountry.length === 2)
            isoCode = rawCountry.toUpperCase();
        if (!isoCode && country?.name) {
            try {
                // @ts-ignore
                const csc = await import("country-state-city");
                const matchedCountry = csc?.Country?.getAllCountries?.().find((item) => String(item.name || "").trim().toLowerCase() === String(country.name || "").trim().toLowerCase());
                isoCode = matchedCountry?.isoCode || "";
            }
            catch {
                isoCode = "";
            }
        }
        if (!isoCode) {
            return res.json({ success: true, count: 0, data: [], rows: [] });
        }
        let fallbackCities = [];
        try {
            // @ts-ignore
            const csc = await import("country-state-city");
            fallbackCities = (csc?.City?.getCitiesOfCountry?.(isoCode) || [])
                .map((city) => ({
                id: `${isoCode}-${city.stateCode || "NA"}-${city.name}`,
                name: city.name,
                stateCode: city.stateCode || null,
                countryCode: isoCode,
                countryId: country?.id || rawCountry,
                status: "active",
            }))
                .filter((city) => !search || String(city.name || "").toLowerCase().includes(search));
        }
        catch {
            fallbackCities = [];
        }
        res.json({ success: true, count: fallbackCities.length, data: fallbackCities, rows: fallbackCities });
    }
    catch (err) {
        next(err);
    }
});
router.get("/currencies", async (_req, res, next) => {
    try {
        const currencies = await prisma.currency.findMany({
            where: { status: "active" },
            orderBy: [{ isBase: "desc" }, { name: "asc" }],
        });
        res.json({ success: true, count: currencies.length, data: currencies });
    }
    catch (err) {
        next(err);
    }
});
router.get("/technologies", async (_req, res, next) => {
    try {
        const technologies = await prisma.masterOption.findMany({
            where: { type: "technology", status: "active" },
            orderBy: { label: "asc" },
            select: { id: true, label: true, value: true },
        });
        res.json({ success: true, count: technologies.length, data: technologies });
    }
    catch (err) {
        next(err);
    }
});
router.get("/detect-location", async (req, res, next) => {
    try {
        const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
        const headerCountry = (req.headers["cf-ipcountry"] || req.headers["x-country-code"]);
        let countryCode = (headerCountry && headerCountry.length === 2 ? headerCountry : "").toUpperCase();
        // Look up country by header country code or default country setting
        let matchedCountry = null;
        if (countryCode) {
            matchedCountry = await prisma.country.findFirst({
                where: { code: countryCode, status: "active" },
            });
        }
        if (!matchedCountry) {
            matchedCountry = await prisma.country.findFirst({
                where: { isDefault: true, status: "active" },
            });
        }
        if (!matchedCountry) {
            matchedCountry = await prisma.country.findFirst({
                where: { status: "active" },
            });
        }
        // Match currency for country
        let matchedCurrency = null;
        if (matchedCountry?.currencyCode) {
            matchedCurrency = await prisma.currency.findFirst({
                where: { code: matchedCountry.currencyCode, status: "active" },
            });
        }
        if (!matchedCurrency) {
            matchedCurrency = await prisma.currency.findFirst({
                where: { isDefault: true, status: "active" },
            });
        }
        res.json({
            success: true,
            ip: clientIp,
            detectedCountry: matchedCountry?.name || "India",
            countryCode: matchedCountry?.code || "IN",
            phoneCode: matchedCountry?.phoneCode || "+91",
            flag: matchedCountry?.flag || "🇮🇳",
            currencyCode: matchedCurrency?.code || "INR",
            currencySymbol: matchedCurrency?.symbol || "₹",
            currency: matchedCurrency,
            country: matchedCountry,
        });
    }
    catch (err) {
        next(err);
    }
});
router.get("/google-maps-config", async (_req, res, next) => {
    try {
        const gmapsSettings = await getSettingsSection("google_maps");
        const data = gmapsSettings?.data || {};
        res.json({
            success: true,
            data: {
                apiKey: data.apiKey || "",
                enablePlacesAutocomplete: Boolean(data.enablePlacesAutocomplete ?? true),
                enableGeocoding: Boolean(data.enableGeocoding ?? true),
                defaultLatitude: Number(data.defaultLatitude ?? 20.5937),
                defaultLongitude: Number(data.defaultLongitude ?? 78.9629),
                defaultZoom: Number(data.defaultZoom ?? 5),
                countryRestriction: data.countryRestriction || "IN",
            },
        });
    }
    catch (err) {
        next(err);
    }
});
router.get("/fix-db", async (req, res) => {
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE freelancer_profiles ADD COLUMN verification_json TEXT;`);
    }
    catch (e) {
        console.log(e.message);
    }
    try {
        await prisma.$executeRawUnsafe(`ALTER TABLE freelancer_profiles ADD COLUMN portfolio_json TEXT;`);
    }
    catch (e) {
        console.log(e.message);
    }
    return res.json({ success: true, message: "Database fields added! The editing error should be resolved." });
});
function parseListParams(req) {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const search = req.query.search || undefined;
    const orderBy = req.query.orderBy || undefined;
    const ascending = req.query.ascending === "true" || req.query.ascending === undefined;
    let filters = {};
    if (req.query.filters) {
        try {
            filters = JSON.parse(req.query.filters);
        }
        catch {
            filters = {};
        }
    }
    return { page, pageSize, search, orderBy, ascending, filters };
}
function parseFreelancerQueryFilters(req) {
    const { page, pageSize, search, orderBy, ascending, filters } = parseListParams(req);
    const experienceFromQuery = typeof req.query.experience === "string"
        ? req.query.experience.split(",").map((value) => value.trim()).filter(Boolean)
        : undefined;
    const skillsFromQuery = typeof req.query.skills === "string"
        ? req.query.skills.split(",").map((value) => value.trim()).filter(Boolean)
        : undefined;
    const rateMin = Number(req.query.rateMin);
    const rateMax = Number(req.query.rateMax);
    return parseFreelancersListBody({
        page,
        pageSize,
        search,
        orderBy,
        ascending: ascending === true,
        categoryId: req.query.categoryId,
        industryId: req.query.industryId,
        experience: experienceFromQuery?.length
            ? experienceFromQuery
            : filters?.freelancerProfile?.experience?.in,
        skills: skillsFromQuery,
        rateMin: Number.isFinite(rateMin) ? rateMin : filters?.freelancerProfile?.hourlyRate?.gte,
        rateMax: Number.isFinite(rateMax) ? rateMax : filters?.freelancerProfile?.hourlyRate?.lte,
    });
}
function getPrismaDelegate(modelName) {
    const camelCase = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    return prisma[camelCase] ?? prisma[modelName];
}
async function listModel({ req, res, next, modelName, searchColumns, include, defaultWhere, forceWhere, defaultOrderBy, }) {
    try {
        const { page, pageSize, search, orderBy, ascending, filters } = parseListParams(req);
        // Start with filters from client, then apply defaults/overrides.
        const where = { ...(filters || {}), ...(defaultWhere || {}) };
        if (forceWhere)
            Object.assign(where, forceWhere);
        // Search columns (OR contains) if provided.
        if (search && searchColumns.length > 0) {
            where.OR = searchColumns.map((col) => ({
                [col]: { contains: search },
            }));
        }
        const db = getPrismaDelegate(modelName);
        if (!db) {
            throw new Error(`Model ${String(modelName)} does not exist in Prisma Client.`);
        }
        // Exclude soft deleted rows when the model supports deletedAt.
        const modelFields = prisma._dmmf?.modelMap?.[modelName]?.fields || [];
        const hasDeletedAt = modelFields.some((f) => f.name === "deletedAt");
        if (hasDeletedAt && where.deletedAt === undefined) {
            where.deletedAt = null;
        }
        const total = await db.count({ where });
        const rows = await db.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: orderBy
                ? { [orderBy]: ascending ? "asc" : "desc" }
                : (defaultOrderBy || { createdAt: "desc" }),
            ...(include ? { include } : {}),
        });
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
}
import { authenticateOptional } from "../../middleware/auth.js";
import { getJsonSetting } from "../../common/helpers/portal-shared.js";
router.get("/freelancers", authenticateOptional, async (req, res, next) => {
    try {
        const body = parseFreelancerQueryFilters(req);
        let { rows, total, degraded, categoryId } = await listPublicFreelancers(body);
        const userId = req.user?.id;
        if (userId) {
            const savedRows = await getJsonSetting(userId, 'savedFreelancers', []);
            const savedIds = new Set(savedRows.map((r) => typeof r === 'string' ? r : (r.freelancerId || r.id)).filter(Boolean));
            rows = rows.map((r) => ({ ...r, isSaved: savedIds.has(r.id) }));
        }
        res.json({ success: true, rows, total, degraded, categoryId });
    }
    catch (err) {
        next(err);
    }
});
router.post("/freelancers", authenticateOptional, async (req, res, next) => {
    try {
        const body = parseFreelancersListBody(req.body ?? {});
        let { rows, total, degraded, categoryId } = await listPublicFreelancers(body);
        const userId = req.user?.id;
        if (userId) {
            const savedRows = await getJsonSetting(userId, 'savedFreelancers', []);
            const savedIds = new Set(savedRows.map((r) => typeof r === 'string' ? r : (r.freelancerId || r.id)).filter(Boolean));
            rows = rows.map((r) => ({ ...r, isSaved: savedIds.has(r.id) }));
        }
        res.json({ success: true, rows, total, degraded, categoryId });
    }
    catch (err) {
        next(err);
    }
});
router.post("/experience_levels", async (req, res, next) => {
    try {
        const body = parseCatalogListBody(req.body ?? {});
        const { rows, total } = await listPublicExperienceLevels(body.pageSize ?? 50);
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
router.get("/experience_levels", async (req, res, next) => {
    try {
        const pageSize = parseInt(req.query.pageSize) || 50;
        const { rows, total } = await listPublicExperienceLevels(pageSize);
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
const listPublicEducationLevels = async (_req, res, next) => {
    try {
        const dbLevels = await prisma.masterOption.findMany({
            where: { type: "education_level", status: "active" },
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        });
        if (dbLevels.length > 0) {
            const rows = dbLevels.map((l) => ({ id: l.id, label: l.label, value: l.value }));
            return res.json({ success: true, rows, total: rows.length });
        }
        // Fallback: seed defaults into DB and return them
        const defaults = [
            { label: "High School / Secondary", value: "High School" },
            { label: "Diploma / Vocational", value: "Diploma" },
            { label: "Bachelor's Degree", value: "Bachelor" },
            { label: "Master's Degree", value: "Master" },
            { label: "MBA", value: "MBA" },
            { label: "Doctorate / PhD", value: "PhD" },
            { label: "Self-taught / Bootcamp", value: "Self-taught" },
            { label: "Other", value: "Other" },
        ];
        const created = await Promise.all(defaults.map((d, i) => prisma.masterOption.create({
            data: {
                type: 'education_level',
                label: d.label,
                value: d.value,
                sortOrder: i,
                status: 'active',
            },
        })));
        const rows = created.map((l) => ({ id: l.id, label: l.label, value: l.value }));
        return res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        return next(err);
    }
};
router.get("/education_levels", listPublicEducationLevels);
router.get("/education-levels", listPublicEducationLevels);
router.get("/freelancers/filters", async (_req, res, next) => {
    try {
        const data = await getPublicFreelancerFilters();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
router.post("/freelancers/filters", async (_req, res, next) => {
    try {
        const data = await getPublicFreelancerFilters();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
router.get("/home", async (_req, res, next) => {
    try {
        const data = await getHomePagePayload();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
router.get("/cms_pages", async (req, res, next) => {
    await listModel({
        req,
        res,
        next,
        modelName: "CmsPage",
        searchColumns: ["name", "category"],
        defaultWhere: { status: "active" },
    });
});
router.get("/cms_pages/:name", async (req, res, next) => {
    try {
        const row = await prisma.cmsPage.findFirst({
            where: {
                name: req.params.name,
                status: "active",
                deletedAt: null,
            },
        });
        if (!row) {
            if (req.params.name === "home") {
                const cms = await getHomeCmsContent();
                return res.json({ success: true, data: { name: "home", content: cms } });
            }
            return res.status(404).json({ success: false, message: "CMS page not found" });
        }
        let content = null;
        if (row.content) {
            try {
                content = JSON.parse(row.content);
            }
            catch {
                content = row.content;
            }
        }
        res.json({ success: true, data: { ...row, content } });
    }
    catch (e) {
        next(e);
    }
});
function sanitizeCmsContent(content) {
    if (typeof content !== "string")
        return content;
    let cleaned = content.replace(/<p[^>]*>(?:(?!<\/p>)[\s\S])*?(?:Effective Date:\s*\[Insert Effective Date\]|Last Updated:\s*\[Insert Last Updated Date\])[\s\S]*?<\/p>/gi, "");
    cleaned = cleaned.replace(/(?:<strong[^>]*>)?\s*Effective Date:\s*(?:<\/strong>)?\s*\[Insert Effective Date\](?:\s*<br\s*\/?>)?/gi, "");
    cleaned = cleaned.replace(/(?:<strong[^>]*>)?\s*Last Updated:\s*(?:<\/strong>)?\s*\[Insert Last Updated Date\](?:\s*<br\s*\/?>)?/gi, "");
    return cleaned;
}
const getPageHandler = (pageName) => async (req, res, next) => {
    try {
        const row = await prisma.cmsPage.findFirst({
            where: {
                name: pageName,
                status: "active",
                deletedAt: null,
            },
        });
        if (!row) {
            return res.status(404).json({ success: false, message: `${pageName} page not found` });
        }
        let content = null;
        if (row.content) {
            try {
                content = JSON.parse(row.content);
            }
            catch {
                content = sanitizeCmsContent(row.content);
            }
        }
        res.json({ success: true, data: { ...row, content } });
    }
    catch (e) {
        next(e);
    }
};
router.get("/legal", getPageHandler("Legal"));
router.get("/privacy", getPageHandler("Privacy"));
router.get("/refund", getPageHandler("Refund Policy"));
router.get("/page-by-slug/:slug", async (req, res, next) => {
    try {
        const slug = req.params.slug;
        const pages = await prisma.cmsPage.findMany({
            where: { status: "active", deletedAt: null }
        });
        let matchedPage = null;
        for (const page of pages) {
            const jsonToParse = page.publishedJson || page.draftJson;
            if (jsonToParse) {
                try {
                    const parsed = typeof jsonToParse === "string" ? JSON.parse(jsonToParse) : jsonToParse;
                    let pageSlug = parsed?.seo?.canonicalUrl || "";
                    pageSlug = pageSlug.trim();
                    if (pageSlug.includes("/")) {
                        const parts = pageSlug.split("/").filter(Boolean);
                        pageSlug = parts[parts.length - 1];
                    }
                    if (pageSlug === slug) {
                        matchedPage = page;
                        break;
                    }
                }
                catch (e) { }
            }
        }
        if (!matchedPage) {
            const fallbackMap = { "terms-condition": "Legal", "terms-conditions": "Legal", "terms": "Legal", "privacy": "Privacy", "privacy-policy": "Privacy Policy", "refund-policy": "Refund Policy" };
            if (fallbackMap[slug])
                matchedPage = pages.find(p => p.name === fallbackMap[slug]) || null;
        }
        if (!matchedPage)
            return res.status(404).json({ success: false, message: "Page not found" });
        const sanitizedData = {
            ...matchedPage,
            content: matchedPage.content ? sanitizeCmsContent(matchedPage.content) : matchedPage.content,
        };
        res.json({ success: true, data: sanitizedData });
    }
    catch (e) {
        next(e);
    }
});
router.get("/cms_pages", async (req, res, next) => {
    try {
        const pageName = req.query.name;
        if (!pageName) {
            return res.status(400).json({ success: false, message: "Query parameter 'name' is required" });
        }
        const row = await prisma.cmsPage.findFirst({
            where: {
                name: String(pageName),
                status: "active",
                deletedAt: null,
            },
        });
        if (!row) {
            return res.status(404).json({ success: false, message: `Page '${pageName}' not found` });
        }
        let content = null;
        if (row.content) {
            try {
                content = JSON.parse(row.content);
            }
            catch {
                content = sanitizeCmsContent(row.content);
            }
        }
        res.json({ success: true, data: { ...row, content } });
    }
    catch (e) {
        next(e);
    }
});
import { AboutController } from "../../controllers/about.controller.js";
const newAboutController = new AboutController();
import { getPublicContactPage, submitContactEnquiry } from "../../controllers/admin/contact.controller.js";
import { getPublicCareersPage, listPublicJobs, getPublicJobBySlug, submitCareerApplication } from "../../controllers/admin/careers.controller.js";
import { faqPublicRouter } from "./faq.routes.js";
import footerPublicRouter from "./footer.routes.js";
router.get("/about", newAboutController.getPublicAbout.bind(newAboutController));
router.use("/faqs", faqPublicRouter);
router.use("/footer", footerPublicRouter);
router.get("/contact-page", getPublicContactPage);
router.get("/contact", getPublicContactPage);
router.post("/contact", submitContactEnquiry);
router.get("/careers-page", getPublicCareersPage);
router.get("/careers", getPublicCareersPage);
import { documentUpload, handleUploadError } from "../../middleware/upload.js";
router.get("/jobs", listPublicJobs);
router.get("/jobs/:slug", getPublicJobBySlug);
router.post("/jobs/:jobId/apply", submitCareerApplication);
router.post("/jobs/upload-resume", documentUpload.single("file"), handleUploadError, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const relativePath = req.file.path.split("uploads")[1]?.replace(/\\/g, "/") || "";
    res.json({
        success: true,
        data: {
            url: `/uploads${relativePath}`,
            name: req.file.originalname,
            size: req.file.size,
        },
    });
});
const getPublicHelpCenter = async (req, res, next) => {
    try {
        // 1. Load Help Center page settings from CmsPage
        const pageConfig = await prisma.cmsPage.findFirst({
            where: { name: "Help Center", status: "active" }
        });
        let settings = {
            heroEyebrow: "GO EXPERTS HELP CENTER",
            heroTitle: "How can we help you?",
            heroHighlighted: "help you",
            heroDescription: "Find answers, guides and step-by-step solutions for everything in Go Experts.",
            searchPlaceholder: "Search for articles, guides and FAQs...",
            searchSupporting: "Popular: Profile Setup · Payments · Projects · Security",
            popularSearches: "Profile Setup, Payments, Projects, Security",
            backgroundStyle: "mesh",
            heroMedia: "",
            heroMediaAlt: "",
            heroEnabled: true
        };
        if (pageConfig?.content) {
            try {
                const parsed = typeof pageConfig.content === "string"
                    ? JSON.parse(pageConfig.content)
                    : pageConfig.content;
                settings = { ...settings, ...parsed };
            }
            catch (e) {
                // Fallback to default if JSON parse fails
            }
        }
        // 2. Load Categories (only active ones) along with active article counts
        const categories = await prisma.helpCategory?.findMany({
            where: { enabled: true },
            orderBy: { order: "asc" },
            include: {
                _count: {
                    select: {
                        articles: {
                            where: { status: "published" }
                        }
                    }
                }
            }
        }).catch(() => []);
        // 3. Load Popular/Featured Articles
        const popularArticles = await prisma.helpArticle?.findMany({
            where: { status: "published", OR: [{ featured: true }, { popular: true }] },
            orderBy: { order: "asc" },
            take: 6,
            include: {
                category: {
                    select: { name: true, slug: true }
                }
            }
        }).catch(() => []);
        // 4. Load Video Guides (only enabled ones)
        const videoGuides = await prisma.helpVideoGuide?.findMany({
            where: { enabled: true },
            orderBy: { order: "asc" },
            take: 6,
            include: {
                category: {
                    select: { name: true, slug: true }
                }
            }
        }).catch(() => []);
        // 5. Load General FAQs
        const faqs = await prisma.fAQ?.findMany({
            where: { isPublished: true },
            take: 10
        }).catch(() => []);
        res.json({
            success: true,
            data: {
                settings,
                categories: (categories || []).map((cat) => ({
                    ...cat,
                    shortDescription: cat.shortDescription,
                    articleCount: cat._count?.articles || 0
                })),
                popularArticles: popularArticles || [],
                videoGuides: videoGuides || [],
                faqs: faqs || []
            }
        });
    }
    catch (err) {
        next(err);
    }
};
const getPublicFaq = async (req, res, next) => {
    try {
        const categories = await prisma.fAQCategory?.findMany({
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: {
                faqs: {
                    where: { isPublished: true }
                }
            }
        }).catch(() => []);
        const popularFaqs = await prisma.fAQ?.findMany({
            where: { isPublished: true },
            take: 6
        }).catch(() => []);
        res.json({
            success: true,
            data: {
                categories: (categories || []).filter((c) => c.fAQs && c.fAQs.length > 0),
                popularFaqs: popularFaqs || []
            }
        });
    }
    catch (err) {
        next(err);
    }
};
router.get("/help_center", getPublicHelpCenter);
router.get("/help-center", getPublicHelpCenter);
router.get("/legal", getPageHandler("Legal"));
router.get("/privacy", getPageHandler("Privacy"));
router.get("/refund", getPageHandler("Refund Policy"));
router.get("/refund-policy", getPageHandler("Refund Policy"));
router.get("/faq", getPublicFaq);
router.post("/delete-account/send-otp", sendDeleteAccountOtp);
router.post("/delete-account/verify", verifyDeleteAccountOtp);
router.get("/delete-requests", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 10;
        const search = req.query.search || "";
        let roleFilter = "";
        let statusFilter = "";
        if (req.query.filters) {
            try {
                const filters = JSON.parse(req.query.filters);
                if (filters.role && filters.role !== "all")
                    roleFilter = filters.role;
                if (filters.status && filters.status !== "all")
                    statusFilter = filters.status;
            }
            catch (e) { }
        }
        const whereClause = {
            AND: [
                {
                    OR: [
                        { status: "pending_deletion" },
                        { status: "deleted" },
                        { status: "inactive" },
                        { deletedAt: { not: null } },
                    ],
                }
            ]
        };
        if (search) {
            whereClause.AND.push({
                OR: [
                    { fullName: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } }
                ]
            });
        }
        if (roleFilter) {
            whereClause.AND.push({ role: roleFilter });
        }
        if (statusFilter) {
            if (statusFilter === "deleted") {
                // Just the ones completely deleted
                whereClause.AND.push({ status: "deleted" });
            }
            else {
                whereClause.AND.push({ status: statusFilter });
            }
        }
        const [rows, total] = await Promise.all([
            prisma.user.findMany({
                where: whereClause,
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    role: true,
                    status: true,
                    avatarUrl: true,
                    createdAt: true,
                    updatedAt: true,
                    deletedAt: true,
                },
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.user.count({ where: whereClause })
        ]);
        res.json({ success: true, rows, total, data: rows, page, pageSize });
    }
    catch (err) {
        next(err);
    }
});
router.post("/delete-requests/:id/approve", async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.update({
            where: { id },
            data: {
                status: "deleted",
                deletedAt: new Date(),
            },
        });
        if (user.email) {
            sendAccountDeletedEmail(user.email, user.fullName || 'User').catch(console.error);
        }
        res.json({ success: true, message: `Account deletion approved for ${user.email}. User has been deactivated.`, user });
    }
    catch (err) {
        next(err);
    }
});
router.post("/delete-requests/:id/reject", async (req, res, next) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.update({
            where: { id },
            data: {
                status: "active",
                deletedAt: null,
            },
        });
        res.json({ success: true, message: `Account deletion request rejected for ${user.email}. Account restored to active.`, user });
    }
    catch (err) {
        next(err);
    }
});
router.post("/delete-requests/:id/permanent-delete", async (req, res, next) => {
    try {
        const { id } = req.params;
        // Clean up dependent child profiles and relations to satisfy foreign key constraints
        await prisma.clientProfile.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.founderProfile.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.freelancerProfile.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.investorProfile.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.authIdentity.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.resumeShare.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.userResumeConfig.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.deviceToken.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.notificationLog.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.notificationPreference.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.wallet.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.subscription.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.payment.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.invoice.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.clientTeamMember.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.clientTeamMember.deleteMany({ where: { clientId: id } }).catch(() => { });
        await prisma.conversationState.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.messageReaction.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.report.deleteMany({ where: { reportedUserId: id } }).catch(() => { });
        await prisma.contract.deleteMany({ where: { clientId: id } }).catch(() => { });
        await prisma.contract.deleteMany({ where: { freelancerId: id } }).catch(() => { });
        await prisma.project.deleteMany({ where: { client: id } }).catch(() => { });
        await prisma.referral.deleteMany({ where: { referrerId: id } }).catch(() => { });
        await prisma.referral.deleteMany({ where: { refereeId: id } }).catch(() => { });
        // Permanently remove the user from database
        const user = await prisma.user.delete({
            where: { id },
        });
        res.json({ success: true, message: `Account for ${user.email} has been PERMANENTLY deleted from the database.`, user });
    }
    catch (err) {
        // If we still hit a foreign key constraint, force delete at DB level
        if (err.code === 'P2003' || /Foreign key constraint/i.test(err.message)) {
            try {
                await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=0;`);
                await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id = '${req.params.id}';`);
                await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=1;`);
                return res.json({ success: true, message: `Account has been PERMANENTLY deleted from the database (Forced).` });
            }
            catch (e) {
                await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=1;`).catch(() => { });
                return next(e);
            }
        }
        next(err);
    }
});
router.delete("/delete-requests/:id", async (req, res, next) => {
    try {
        const { id } = req.params;
        // Clean up dependent child profiles and relations to satisfy foreign key constraints
        await prisma.clientProfile.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.founderProfile.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.freelancerProfile.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.investorProfile.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.authIdentity.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.resumeShare.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.userResumeConfig.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.deviceToken.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.notificationLog.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.notificationPreference.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.notification.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.wallet.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.subscription.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.payment.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.invoice.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.clientTeamMember.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.clientTeamMember.deleteMany({ where: { clientId: id } }).catch(() => { });
        await prisma.conversationState.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.messageReaction.deleteMany({ where: { userId: id } }).catch(() => { });
        await prisma.report.deleteMany({ where: { reportedUserId: id } }).catch(() => { });
        await prisma.contract.deleteMany({ where: { clientId: id } }).catch(() => { });
        await prisma.contract.deleteMany({ where: { freelancerId: id } }).catch(() => { });
        await prisma.project.deleteMany({ where: { client: id } }).catch(() => { });
        await prisma.referral.deleteMany({ where: { referrerId: id } }).catch(() => { });
        await prisma.referral.deleteMany({ where: { refereeId: id } }).catch(() => { });
        const user = await prisma.user.delete({
            where: { id },
        });
        res.json({ success: true, message: `Account for ${user.email} has been PERMANENTLY deleted from the database.`, user });
    }
    catch (err) {
        if (err.code === 'P2003' || /Foreign key constraint/i.test(err.message)) {
            try {
                await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=0;`);
                await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id = '${req.params.id}';`);
                await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=1;`);
                return res.json({ success: true, message: `Account has been PERMANENTLY deleted from the database (Forced).` });
            }
            catch (e) {
                await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS=1;`).catch(() => { });
                return next(e);
            }
        }
        next(err);
    }
});
router.get("/industries", async (req, res, next) => {
    try {
        const rows = await prisma.industry.findMany({
            where: { status: "active" },
            orderBy: { name: "asc" }
        });
        res.json({ success: true, rows, total: rows.length });
    }
    catch (err) {
        next(err);
    }
});
router.post("/categories", async (req, res, next) => {
    try {
        const body = parseCatalogListBody(req.body ?? {});
        const industryId = (req.body?.industryId || req.body?.industry_id || req.body?.industry);
        const { rows, total } = await getPublicCategories({ ...body, industryId });
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
router.get("/categories", async (req, res, next) => {
    try {
        const pageSize = parseInt(req.query.pageSize) || 50;
        const page = parseInt(req.query.page) || 1;
        const search = (req.query.search || req.query.q);
        const industryId = (req.query.industryId || req.query.industry_id || req.query.industry);
        const { rows, total } = await getPublicCategories({ page, pageSize, search, industryId });
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
router.post("/skills", async (req, res, next) => {
    try {
        const body = parseSkillsListBody(req.body ?? {});
        const { rows, total, degraded, industry, categoryId } = await getPublicSkills(body);
        res.json({
            success: true,
            rows,
            total,
            degraded,
            categoryId: categoryId ?? null,
            industry: industry ?? null,
        });
    }
    catch (err) {
        next(err);
    }
});
router.get("/skills", async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 50;
        const search = req.query.search || undefined;
        let categoryId = req.query.categoryId || req.query.industryId || undefined;
        let industry;
        if (req.query.filters) {
            try {
                const filters = JSON.parse(req.query.filters);
                categoryId = categoryId || filters.categoryId || filters.industryId;
                industry = filters.industry ?? filters.category;
            }
            catch {
                industry = undefined;
            }
        }
        const { rows, total, degraded, industry: resolvedIndustry, categoryId: resolvedCategoryId } = await getPublicSkills({
            page,
            pageSize,
            search,
            categoryId,
            industry,
        });
        res.json({
            success: true,
            rows,
            total,
            degraded,
            categoryId: resolvedCategoryId ?? null,
            industry: resolvedIndustry ?? null,
        });
    }
    catch (err) {
        next(err);
    }
});
router.get("/stats", async (_req, res, next) => {
    try {
        const stats = await getPublicPlatformStats();
        res.json({ success: true, stats });
    }
    catch (err) {
        next(err);
    }
});
router.get("/post-project", async (_req, res, next) => {
    try {
        const data = await getPostProjectPagePayload();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
router.post("/post-project", async (_req, res, next) => {
    try {
        const data = await getPostProjectPagePayload();
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
});
router.get("/projects", authenticateOptional, async (req, res, next) => {
    try {
        const body = parseCatalogListBody({
            page: req.query.page,
            pageSize: req.query.pageSize,
            search: req.query.search,
        });
        const category = typeof req.query.category === "string" ? req.query.category : undefined;
        let { rows, total } = await listPublicProjects({
            page: body.page,
            pageSize: body.pageSize,
            search: body.search,
            category,
            excludeClientId: req.user?.id,
        });
        const userId = req.user?.id;
        if (userId) {
            const savedRows = await getJsonSetting(userId, 'saved-projects', []);
            const savedIds = new Set(savedRows);
            const appliedProposals = await prisma.proposal.findMany({
                where: {
                    freelancerId: userId,
                    projectId: { in: rows.map((r) => r.id) },
                    deletedAt: null
                },
                select: { projectId: true, id: true }
            });
            const appliedMap = new Map(appliedProposals.map((p) => [p.projectId, p.id]));
            rows = rows.map((r) => ({
                ...r,
                isSaved: savedIds.has(r.id),
                isApplied: appliedMap.has(r.id),
                proposalId: appliedMap.get(r.id) || null
            }));
        }
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
router.post("/projects", authenticateOptional, async (req, res, next) => {
    try {
        const body = parseCatalogListBody(req.body ?? {});
        const category = typeof req.body?.category === "string"
            ? req.body.category
            : undefined;
        const categoryId = typeof req.body?.categoryId === "string"
            ? req.body.categoryId
            : undefined;
        let { rows, total } = await listPublicProjects({
            page: body.page,
            pageSize: body.pageSize,
            search: body.search,
            category,
            categoryId,
            excludeClientId: req.user?.id,
            excludeRole: req.query.excludeRole || req.body.excludeRole,
        });
        const userId = req.user?.id;
        if (userId) {
            const savedRows = await getJsonSetting(userId, 'saved-projects', []);
            const savedIds = new Set(savedRows);
            const appliedProposals = await prisma.proposal.findMany({
                where: {
                    freelancerId: userId,
                    projectId: { in: rows.map((r) => r.id) },
                    deletedAt: null
                },
                select: { projectId: true, id: true }
            });
            const appliedMap = new Map(appliedProposals.map((p) => [p.projectId, p.id]));
            rows = rows.map((r) => ({
                ...r,
                isSaved: savedIds.has(r.id),
                isApplied: appliedMap.has(r.id),
                proposalId: appliedMap.get(r.id) || null
            }));
        }
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
router.get("/projects/:slug", authenticateOptional, async (req, res, next) => {
    try {
        const { slug } = req.params;
        if (slug === 'saved') {
            const { savedProjects } = await import("../../modules/mobile/freelancer/controllers/projects.controller.js");
            const { authenticate } = await import("../../middlewares/auth.js");
            return authenticate(req, res, () => savedProjects(req, res, next));
        }
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
        let project = null;
        if (isUUID) {
            project = await prisma.project.findFirst({
                where: {
                    id: slug,
                    deletedAt: null,
                },
            });
        }
        else {
            // 1. Try matching trailing 8-hex id (e.g. title-slug-bff7fdf9)
            const hexMatch = slug.match(/-([0-9a-f]{8})$/i);
            if (hexMatch) {
                const prefix = hexMatch[1];
                project = await prisma.project.findFirst({
                    where: {
                        id: { startsWith: prefix },
                        deletedAt: null,
                    },
                });
            }
            // 2. If not found, match by slugified title
            if (!project) {
                const candidates = await prisma.project.findMany({
                    where: { deletedAt: null },
                    select: { id: true, title: true },
                    take: 200,
                });
                const slugify = (t) => t.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
                const matched = candidates.find((c) => {
                    const baseSlug = slugify(c.title || "");
                    return baseSlug === slug || `${baseSlug}-${c.id.slice(0, 8)}` === slug;
                });
                if (matched) {
                    project = await prisma.project.findFirst({
                        where: { id: matched.id, deletedAt: null },
                    });
                }
            }
        }
        if (!project) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }
        // Resolve owning client user & profile
        let clientInfo = {
            id: project.client,
            fullName: "Verified Client",
            companyName: "Go Experts Partner",
            avatarUrl: null,
            country: null,
            verified: true,
            rating: 4.9,
            reviewsCount: 12,
            projectsPosted: 1,
            hiringSuccess: 95,
            memberSince: "2024",
        };
        if (project.client) {
            const clientUser = await prisma.user.findFirst({
                where: { id: project.client, deletedAt: null },
                select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true,
                    country: true,
                    isVerified: true,
                    verified: true,
                    createdAt: true,
                },
            });
            if (!clientUser) {
                return res.status(404).json({ success: false, message: "Project not found" });
            }
            const clientProfile = await prisma.clientProfile.findFirst({
                where: { userId: project.client },
                select: {
                    company: true,
                    websiteUrl: true,
                    companySize: true,
                    industry: true,
                    projectsPosted: true,
                },
            }).catch(() => null);
            const projectsPostedCount = clientProfile?.projectsPosted ||
                (await prisma.project.count({
                    where: { client: project.client, deletedAt: null },
                }).catch(() => 1));
            clientInfo = {
                id: clientUser.id,
                fullName: clientUser.fullName || "Verified Client",
                companyName: clientProfile?.company || clientUser.fullName || "Client Organization",
                avatarUrl: clientUser.avatarUrl || null,
                country: clientUser.country || "India",
                verified: Boolean(clientUser.isVerified || clientUser.verified),
                rating: 4.9,
                reviewsCount: Math.max(1, projectsPostedCount * 3),
                projectsPosted: projectsPostedCount,
                hiringSuccess: 94,
                memberSince: clientUser.createdAt
                    ? new Date(clientUser.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                    : "2024",
                about: "",
                website: clientProfile?.websiteUrl || "",
                industry: clientProfile?.industry || "",
            };
        }
        // Resolve category & subcategory names
        let resolvedCategory = project.category || "General";
        if (project.category) {
            const [ind, sc] = await Promise.all([
                prisma.industry.findFirst({ where: { id: project.category }, select: { name: true } }).catch(() => null),
                prisma.skillCategory.findFirst({ where: { id: project.category }, select: { name: true } }).catch(() => null),
            ]);
            if (ind?.name)
                resolvedCategory = ind.name;
            else if (sc?.name)
                resolvedCategory = sc.name;
        }
        // Resolve technology / required skills names
        const rawTechs = project.technology
            ? project.technology.split(",").map((s) => s.trim()).filter(Boolean)
            : [];
        let resolvedSkills = [];
        if (rawTechs.length > 0) {
            const skills = await prisma.skill.findMany({
                where: { id: { in: rawTechs } },
                select: { id: true, name: true },
            }).catch(() => []);
            const skillMap = new Map();
            skills.forEach((s) => skillMap.set(s.id, s.name));
            resolvedSkills = rawTechs.map((t) => skillMap.get(t) || t);
        }
        // Resolve work mode
        let resolvedWorkMode = "Remote";
        if (project.workMode) {
            const wm = await prisma.workMode.findFirst({
                where: { id: project.workMode },
                select: { name: true },
            }).catch(() => null);
            if (wm?.name)
                resolvedWorkMode = wm.name;
            else if (project.workMode.toLowerCase().includes("site"))
                resolvedWorkMode = "On-Site";
            else if (project.workMode.toLowerCase().includes("hybrid"))
                resolvedWorkMode = "Hybrid";
            else
                resolvedWorkMode = "Remote";
        }
        // Generate canonical slug
        const slugBase = (project.title || "project")
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "");
        const canonicalSlug = `${slugBase}-${project.id.slice(0, 8)}`;
        // Proposals count
        const proposalsCount = await prisma.proposal.count({
            where: { projectId: project.id, deletedAt: null },
        }).catch(() => 0);
        let isApplied = false;
        let proposalId = null;
        let isSaved = false;
        const userId = req.user?.id;
        if (userId) {
            const savedRows = await getJsonSetting(userId, "saved-projects", []);
            isSaved = new Set(savedRows).has(project.id);
            const proposal = await prisma.proposal.findFirst({
                where: {
                    freelancerId: userId,
                    projectId: project.id,
                    deletedAt: null,
                },
                select: { id: true },
            });
            if (proposal) {
                isApplied = true;
                proposalId = proposal.id;
            }
        }
        // Similar projects query (same category or active projects, excluding current)
        const similarRaw = await prisma.project.findMany({
            where: {
                id: { not: project.id },
                deletedAt: null,
                status: { in: ["open", "approved", "active", "Published", "Open"] },
            },
            take: 4,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                title: true,
                budget: true,
                budgetMin: true,
                budgetMax: true,
                workMode: true,
                category: true,
                createdAt: true,
            },
        }).catch(() => []);
        const similarProjects = similarRaw.map((p) => {
            const simSlugBase = (p.title || "project")
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, "")
                .replace(/[\s_-]+/g, "-")
                .replace(/^-+|-+$/g, "");
            return {
                id: p.id,
                slug: `${simSlugBase}-${p.id.slice(0, 8)}`,
                title: p.title,
                budgetMin: p.budgetMin || p.budget * 0.8,
                budgetMax: p.budgetMax || p.budget * 1.2,
                workMode: p.workMode || "Remote",
                category: resolvedCategory,
            };
        });
        res.json({
            success: true,
            data: {
                ...project,
                slug: canonicalSlug,
                categoryName: resolvedCategory,
                category: resolvedCategory,
                resolvedSkills,
                workMode: resolvedWorkMode,
                clientInfo,
                proposalsCount,
                similarProjects,
                isApplied,
                proposalId,
                isSaved,
            },
        });
    }
    catch (err) {
        next(err);
    }
});
router.get("/pricing_plans", async (req, res, next) => {
    try {
        const industryId = req.query.industryId;
        const role = req.query.role;
        const whereCondition = { status: "active" };
        if (role) {
            whereCondition.role = role;
        }
        let includeFree = false;
        if (industryId) {
            const industry = await prisma.industry.findUnique({
                where: { id: industryId },
            });
            if (industry && industry.isFreePlanEnabled) {
                includeFree = true;
            }
        }
        if (!includeFree) {
            whereCondition.amount = { gt: 0 };
            whereCondition.duration = { not: "90_days" };
        }
        const plans = await prisma.subscriptionPlan.findMany({
            where: whereCondition,
            orderBy: { amount: "asc" },
        });
        return res.json({ success: true, data: plans || [], rows: plans || [], total: plans?.length || 0 });
    }
    catch (err) {
        next(err);
    }
});
function deduplicateMasterOptions(items) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        const norm = (item.value || item.label || "").trim().toLowerCase();
        if (norm && !seen.has(norm)) {
            seen.add(norm);
            result.push(item);
        }
    }
    return result;
}
function sortNumericalOptions(items) {
    return items.sort((a, b) => {
        const extractMin = (val) => {
            if (!val)
                return 0;
            const match = val.match(/\d+/);
            return match ? parseInt(match[0], 10) : 0;
        };
        return extractMin(a.label || a.value) - extractMin(b.label || b.value);
    });
}
async function fetchMasterOptions(type) {
    try {
        const types = Array.isArray(type) ? type : [type];
        const rows = await prisma.masterOption.findMany({
            where: { type: { in: types }, status: "active" },
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            select: { id: true, label: true, value: true }
        });
        let resultRows = deduplicateMasterOptions(rows || []);
        if (types.includes("team_size") || types.includes("company_size")) {
            resultRows = sortNumericalOptions(resultRows);
        }
        return resultRows;
    }
    catch {
        const types = Array.isArray(type) ? type : [type];
        const typeStr = types.map(t => `'${t}'`).join(',');
        const rawRows = await prisma.$queryRawUnsafe(`SELECT id, label, value FROM master_options WHERE type IN (${typeStr}) AND status = 'active' ORDER BY sort_order ASC, label ASC`).catch(() => []);
        let resultRows = deduplicateMasterOptions(rawRows || []);
        if (types.includes("team_size") || types.includes("company_size")) {
            resultRows = sortNumericalOptions(resultRows);
        }
        return resultRows;
    }
}
router.get("/business-types", async (_req, res) => {
    const types = await fetchMasterOptions("business_type");
    return res.json({ success: true, data: types });
});
router.get("/business_types", async (_req, res) => {
    const types = await fetchMasterOptions("business_type");
    return res.json({ success: true, data: types });
});
router.get("/team-sizes", async (_req, res) => {
    const sizes = await fetchMasterOptions("team_size");
    return res.json({ success: true, data: sizes });
});
router.get("/team_sizes", async (_req, res) => {
    const sizes = await fetchMasterOptions("team_size");
    return res.json({ success: true, data: sizes });
});
router.get("/founder-types", async (_req, res) => {
    const types = await fetchMasterOptions("founder_type");
    return res.json({ success: true, data: types });
});
router.get("/founder_types", async (_req, res) => {
    const types = await fetchMasterOptions("founder_type");
    return res.json({ success: true, data: types });
});
router.get("/startup-stages", async (_req, res) => {
    const stages = await fetchMasterOptions("startup_stage");
    return res.json({ success: true, data: stages });
});
router.get("/startup_stages", async (_req, res) => {
    const stages = await fetchMasterOptions("startup_stage");
    return res.json({ success: true, data: stages });
});
router.get("/client-goals", async (_req, res) => {
    const goals = await fetchMasterOptions("client_goal");
    return res.json({ success: true, data: goals });
});
router.get("/client_goals", async (_req, res) => {
    const goals = await fetchMasterOptions("client_goal");
    return res.json({ success: true, data: goals });
});
router.get("/expansion-goals", async (_req, res) => {
    const goals = await fetchMasterOptions("expansion_goal");
    return res.json({ success: true, data: goals });
});
router.get("/expansion_goals", async (_req, res) => {
    const goals = await fetchMasterOptions("expansion_goal");
    return res.json({ success: true, data: goals, rows: goals });
});
router.get("/founder-roles", async (_req, res) => {
    const roles = await fetchMasterOptions("founder_role");
    return res.json({ success: true, data: roles, rows: roles, total: roles.length });
});
router.get("/founder_roles", async (_req, res) => {
    const roles = await fetchMasterOptions("founder_role");
    return res.json({ success: true, data: roles, rows: roles, total: roles.length });
});
router.get("/founder-goals", async (_req, res) => {
    const goals = await fetchMasterOptions("founder_goal");
    return res.json({ success: true, data: goals, rows: goals });
});
router.get("/founder_goals", async (_req, res) => {
    const goals = await fetchMasterOptions("founder_goal");
    return res.json({ success: true, data: goals, rows: goals });
});
router.get("/investment-modes", async (_req, res) => {
    const modes = await fetchMasterOptions("investment_mode");
    return res.json({ success: true, data: modes, rows: modes });
});
router.get("/investment_modes", async (_req, res) => {
    const modes = await fetchMasterOptions("investment_mode");
    return res.json({ success: true, data: modes, rows: modes });
});
router.get("/investor-goals", async (_req, res) => {
    const goals = await fetchMasterOptions("investor_goal");
    return res.json({ success: true, data: goals, rows: goals });
});
router.get("/investor_goals", async (_req, res) => {
    const goals = await fetchMasterOptions("investor_goal");
    return res.json({ success: true, data: goals, rows: goals });
});
router.get("/startup_ideas", async (req, res, next) => {
    try {
        const { page, pageSize, search, orderBy, ascending } = parseListParams(req);
        // Fetch only non-deleted founder user IDs to filter out deleted founders' ideas
        const activeFounders = await prisma.user.findMany({
            where: { deletedAt: null, role: "founder" },
            select: { id: true },
        });
        const activeFounderIds = activeFounders.map((u) => u.id);
        const where = {
            deletedAt: null,
            status: "active",
            visibility: "Public",
        };
        const category = req.query.category || req.query.categoryId;
        const industry = req.query.industry || req.query.industryId;
        const stage = req.query.stage || req.query.stageId;
        if (req.query.id)
            where.id = String(req.query.id);
        if (category)
            where.category = category;
        if (industry)
            where.industry = industry;
        if (stage)
            where.stage = stage;
        if (search) {
            where.OR = [
                { startup: { contains: search } },
                { industry: { contains: search } },
                { category: { contains: search } },
            ];
        }
        const db = prisma.startupIdea;
        const total = await db.count({ where });
        const rows = await db.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: orderBy ? { [orderBy]: ascending ? "asc" : "desc" } : { createdAt: "desc" },
        });
        res.json({ success: true, rows, total });
    }
    catch (err) {
        next(err);
    }
});
router.get("/startup_ideas/:id", async (req, res, next) => {
    try {
        const idOrSlug = String(req.params.id || "").trim();
        const row = await prisma.startupIdea.findFirst({
            where: {
                deletedAt: null,
                status: "active",
                OR: [
                    { id: idOrSlug },
                    { startup: { equals: idOrSlug } },
                ],
            },
        });
        if (!row) {
            return res.status(404).json({ success: false, message: "Startup not found" });
        }
        await prisma.startupIdea.update({
            where: { id: row.id },
            data: { views: { increment: 1 } },
        }).catch(() => { });
        res.json({ success: true, data: row });
    }
    catch (err) {
        next(err);
    }
});
router.get("/blogs", async (req, res, next) => {
    await listModel({
        req,
        res,
        next,
        modelName: "Blog",
        searchColumns: ["title", "category", "author"],
        defaultWhere: {
            status: "PUBLISHED",
            deletedAt: null,
            publishedAt: { lte: new Date() }
        },
        defaultOrderBy: [
            { featured: "desc" },
            { publishedAt: "desc" }
        ]
    });
});
router.get("/blogs/:id", async (req, res, next) => {
    try {
        const key = String(req.params.id || "").trim();
        // First try by ID, then by slug
        let row = await prisma.blog.findFirst({
            where: {
                OR: [
                    { id: key },
                    {
                        slug: key,
                        status: "PUBLISHED",
                        publishedAt: { lte: new Date() }
                    }
                ],
                deletedAt: null,
            },
        });
        if (!row) {
            return res.status(404).json({ success: false, message: "Blog post not found" });
        }
        // Increment view count safely
        await prisma.blog.update({
            where: { id: row.id },
            data: { views: { increment: 1 } }
        }).catch(() => { });
        res.json({ success: true, data: row });
    }
    catch (err) {
        next(err);
    }
});
router.get("/search", async (req, res, next) => {
    try {
        const q = String(req.query.q || req.query.search || "").trim();
        if (!q) {
            return res.json({ success: true, data: { freelancers: [], projects: [], startups: [], blogs: [] } });
        }
        const [freelancers, projects, startups, blogs] = await Promise.all([
            prisma.user.findMany({
                where: {
                    role: "freelancer",
                    deletedAt: null,
                    OR: [
                        { fullName: { contains: q } },
                        { bio: { contains: q } },
                        { freelancerProfile: { skills: { contains: q } } },
                    ],
                },
                take: 10,
                include: { freelancerProfile: true },
            }),
            prisma.project.findMany({
                where: {
                    deletedAt: null,
                    client: {
                        in: await prisma.user
                            .findMany({ where: { deletedAt: null, role: "client" }, select: { id: true } })
                            .then((us) => us.map((u) => u.id)),
                    },
                    OR: [
                        { title: { contains: q } },
                        { category: { contains: q } },
                        { technology: { contains: q } },
                    ],
                },
                take: 10,
            }),
            prisma.startupIdea.findMany({
                where: {
                    deletedAt: null,
                    status: "active",
                    founder: {
                        in: await prisma.user
                            .findMany({ where: { deletedAt: null, role: "founder" }, select: { id: true } })
                            .then((us) => us.map((u) => u.id)),
                    },
                    OR: [
                        { startup: { contains: q } },
                        { founder: { contains: q } },
                        { industry: { contains: q } },
                    ],
                },
                take: 10,
            }),
            prisma.blog.findMany({
                where: {
                    deletedAt: null,
                    status: "active",
                    OR: [{ title: { contains: q } }, { category: { contains: q } }, { author: { contains: q } }],
                },
                take: 10,
            }),
        ]);
        res.json({ success: true, data: { freelancers, projects, startups, blogs, q } });
    }
    catch (err) {
        next(err);
    }
});
router.post("/projects/create", async (req, res, next) => {
    try {
        // Prefer authenticated client; allow header Authorization via optional check
        const authHeader = req.headers.authorization;
        let clientLabel = String(req.body?.client || "Anonymous").trim();
        let userId = null;
        if (authHeader?.startsWith("Bearer ")) {
            try {
                const jwt = await import("jsonwebtoken");
                const { env } = await import("../../config/env.js");
                const decoded = jwt.default.verify(authHeader.split(" ")[1], env.JWT_SECRET);
                if (decoded.type === "portal" || decoded.role) {
                    const user = await prisma.user.findFirst({ where: { id: decoded.id, deletedAt: null } });
                    if (user) {
                        if (String(user.role).toLowerCase() !== "client") {
                            return res.status(403).json({ success: false, message: "Only clients can create projects" });
                        }
                        userId = user.id;
                        clientLabel = user.fullName || user.email;
                        const profile = await prisma.clientProfile.findUnique({ where: { userId: user.id } });
                        if (profile?.company)
                            clientLabel = profile.company;
                    }
                }
            }
            catch {
                return res.status(401).json({ success: false, message: "Invalid or expired token" });
            }
        }
        else {
            return res.status(401).json({ success: false, message: "Authentication required to create a project" });
        }
        const title = String(req.body?.title || "").trim();
        if (!title) {
            return res.status(400).json({ success: false, message: "Project title is required" });
        }
        const project = await prisma.project.create({
            data: {
                title,
                client: clientLabel,
                category: String(req.body?.category || req.body?.industry || "General"),
                technology: String(req.body?.skills || req.body?.technology || ""),
                budgetMin: Number(req.body?.budgetMin ?? req.body?.budget ?? 0) || 0,
                budgetMax: Number(req.body?.budgetMax ?? req.body?.budget ?? 0) || 0,
                timeline: String(req.body?.timeline || req.body?.duration || ""),
                status: "pending",
                description: String(req.body?.description || ""),
            },
        });
        if (userId) {
            await prisma.clientProfile.updateMany({
                where: { userId },
                data: { projectsPosted: { increment: 1 } },
            }).catch(() => { });
        }
        if (userId) {
            const emailUser = await prisma.user.findUnique({ where: { id: userId } });
            if (emailUser) {
                const { sendProjectCreatedEmail } = await import("../../services/mobile/email.service.js");
                await sendProjectCreatedEmail(emailUser.email, emailUser.fullName, project.title, `${process.env.FRONTEND_URL || 'https://goexperts.in'}/dashboard/projects`).catch(e => console.error("Failed to send project created email:", e));
            }
        }
        res.status(201).json({ success: true, data: project, message: "Project created" });
    }
    catch (err) {
        next(err);
    }
});
router.get("/faqs", async (req, res, next) => {
    await listModel({
        req,
        res,
        next,
        modelName: "Faq",
        searchColumns: ["question", "answer", "category"],
        defaultWhere: { status: "active" },
    });
});
router.get("/testimonials", async (req, res, next) => {
    await listModel({
        req,
        res,
        next,
        modelName: "Testimonial",
        searchColumns: ["name", "role", "content"],
        defaultWhere: { status: "active" },
    });
});
// Contact / hire forms submit support tickets publicly.
router.post("/support_tickets", async (req, res, next) => {
    try {
        const body = req.body ?? {};
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim() : "";
        const company = typeof body.company === "string" ? body.company.trim() : "";
        const message = typeof body.message === "string" ? body.message.trim() : "";
        const subject = (typeof body.subject === "string" && body.subject.trim()) ||
            (message ? message.slice(0, 120) : "Website inquiry");
        const user = (typeof body.user === "string" && body.user.trim()) ||
            [name && email ? `${name} <${email}>` : name || email, company, message]
                .filter(Boolean)
                .join(" | ") ||
            "Guest";
        const created = await prisma.supportTicket.create({
            data: {
                subject,
                requesterId: "guest",
                requesterRole: "guest",
                categoryId: (typeof body.category === "string" && body.category.trim()) || "Website Guest Inquiry",
                priority: (typeof body.priority === "string" && body.priority.trim()) || "Normal",
                status: "OPEN",
            },
        });
        res.status(201).json({ success: true, data: created });
    }
    catch (err) {
        next(err);
    }
});
// Public Help Center Custom Route defined above
// Help Center Unified Live Search Suggestions
router.get("/help-center/search", async (req, res, next) => {
    try {
        const query = String(req.query.q || "").trim();
        if (!query) {
            return res.json({ success: true, data: [] });
        }
        // Search published articles
        const articles = await prisma.helpArticle?.findMany({
            where: {
                status: "published",
                OR: [
                    { title: { contains: query } },
                    { excerpt: { contains: query } },
                    { content: { contains: query } }
                ]
            },
            include: {
                category: { select: { name: true, slug: true } }
            },
            take: 5
        }).catch(() => []);
        // Search active FAQs
        const faqs = await prisma.fAQ?.findMany({
            where: {
                status: "active",
                OR: [
                    { question: { contains: query } },
                    { answer: { contains: query } }
                ]
            },
            take: 3
        }).catch(() => []);
        // Combine and rank suggestions
        const results = [
            ...(articles || []).map((art) => ({
                id: art.id,
                title: art.title,
                slug: art.slug,
                category: art.category?.name || "General",
                categorySlug: art.category?.slug || "",
                excerpt: art.excerpt || art.content.slice(0, 100) + "...",
                type: "article"
            })),
            ...(faqs || []).map((f) => ({
                id: f.id,
                title: f.question,
                slug: `faq-${f.id}`,
                category: "FAQ",
                categorySlug: "faq",
                excerpt: f.answer.slice(0, 100) + "...",
                type: "faq"
            }))
        ];
        // Simple priority rank matching title prefix first
        results.sort((a, b) => {
            const aTitleLower = a.title.toLowerCase();
            const bTitleLower = b.title.toLowerCase();
            const queryLower = query.toLowerCase();
            const aStartsWith = aTitleLower.startsWith(queryLower);
            const bStartsWith = bTitleLower.startsWith(queryLower);
            if (aStartsWith && !bStartsWith)
                return -1;
            if (!aStartsWith && bStartsWith)
                return 1;
            return 0;
        });
        res.json({ success: true, data: results });
    }
    catch (err) {
        next(err);
    }
});
// Category Detail
router.get("/help-center/categories/:slug", async (req, res, next) => {
    try {
        const { slug } = req.params;
        const category = await prisma.helpCategory?.findUnique({
            where: { slug },
            include: {
                articles: {
                    where: { status: "published" },
                    orderBy: { order: "asc" }
                },
                videoGuides: { where: { enabled: true }, orderBy: { order: "asc" } }
            }
        }).catch(() => null);
        if (category?.enabled) {
            return res.json({ success: true, data: category });
        }
        const faqCategory = await prisma.fAQCategory?.findUnique({
            where: { slug },
            include: {
                faqs: {
                    where: { isPublished: true },
                    orderBy: { sortOrder: "asc" }
                }
            }
        }).catch(() => null);
        if (!faqCategory || !faqCategory.isActive) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        res.json({
            success: true,
            data: {
                ...faqCategory,
                articles: [],
                categoryType: "faq"
            }
        });
    }
    catch (err) {
        next(err);
    }
});
// Article Detail
router.get("/help-center/articles/:slug", async (req, res, next) => {
    try {
        const { slug } = req.params;
        const article = await prisma.helpArticle?.findUnique({
            where: { slug },
            include: {
                category: {
                    include: {
                        articles: {
                            where: { status: "published" },
                            select: { title: true, slug: true, order: true },
                            orderBy: { order: "asc" }
                        }
                    }
                }
            }
        }).catch(() => null);
        if (!article || article.status !== "published") {
            return res.status(404).json({ success: false, message: "Article not found" });
        }
        res.json({ success: true, data: article });
    }
    catch (err) {
        next(err);
    }
});
// Public Investors List
router.get("/investors", async (req, res, next) => {
    try {
        const { page = 1, pageSize = 12 } = req.query;
        const skip = (Number(page) - 1) * Number(pageSize);
        const take = Number(pageSize);
        let filters = {};
        if (req.query.filters) {
            try {
                filters = JSON.parse(req.query.filters);
            }
            catch { }
        }
        const where = { role: { in: ["investor", "Investor"] }, deletedAt: null };
        if (filters.industry && filters.industry.in && filters.industry.in.length > 0) {
            where.investorProfile = { ...where.investorProfile, focusAreas: { contains: filters.industry.in[0] } };
        }
        if (filters.stage && filters.stage.in) {
            where.investorProfile = { ...where.investorProfile, preferredStage: { in: filters.stage.in } };
        }
        if (req.query.search) {
            where.OR = [
                { fullName: { contains: String(req.query.search) } },
                { investorProfile: { firm: { contains: String(req.query.search) } } }
            ];
        }
        const users = await prisma.user.findMany({
            where,
            include: { investorProfile: true },
            skip,
            take,
            orderBy: { createdAt: "desc" }
        });
        const total = await prisma.user.count({ where });
        const allIndustries = await prisma.industry.findMany().catch(() => []);
        const allStages = await prisma.startupStage.findMany().catch(() => []);
        const allCountries = await prisma.country.findMany().catch(() => []);
        const allSkillCats = await prisma.skillCategory.findMany().catch(() => []);
        const allSkills = await prisma.skill.findMany().catch(() => []);
        const allOptions = [...allIndustries, ...allStages, ...allCountries, ...allSkillCats, ...allSkills];
        const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
        const resolveNames = (idsStr, list) => {
            if (!idsStr)
                return "";
            return idsStr.split(",").map(id => {
                const trimmed = id.trim();
                const found = list.find(x => x.id === trimmed);
                if (found)
                    return found.name;
                if (isUUID(trimmed))
                    return null; // If it's a UUID but not found, hide it
                return trimmed; // If it's a regular string like "Multi-sector", keep it
            }).filter(Boolean).join(", ");
        };
        const rows = users.map((u) => {
            const p = u.investorProfile;
            return {
                id: u.id,
                name: p?.firm || u.fullName || "Unnamed Investor",
                pitch: u.bio || "Investment firm focused on early stage startups.",
                industry: resolveNames(p?.focusAreas || "", allOptions) || "Multi-sector",
                stage: resolveNames(p?.preferredStage || "", allStages) || "Seed",
                location: resolveNames(u.country || "", allOptions) || u.country || "Remote",
                funding: (p?.ticketMin && p?.ticketMax) ? `$${p.ticketMin.toLocaleString()} - $${p.ticketMax.toLocaleString()}` : "Undisclosed",
                verified: true
            };
        });
        res.json({ success: true, rows, total, page: Number(page), pageSize: Number(pageSize) });
    }
    catch (err) {
        next(err);
    }
});
// Public Single Investor Details
router.get("/investors/:id", async (req, res, next) => {
    try {
        const rawId = String(req.params.id || "").trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);
        let user = null;
        if (isUUID) {
            user = await prisma.user.findUnique({
                where: { id: rawId },
                include: { investorProfile: true },
            });
        }
        if (!user) {
            // Find by matching slug or name or firm
            const normalized = rawId.replace(/-/g, " ").toLowerCase();
            user = await prisma.user.findFirst({
                where: {
                    role: "investor",
                    deletedAt: null,
                    OR: [
                        { fullName: { equals: normalized } },
                        { fullName: { contains: normalized } },
                        { investorProfile: { firm: { equals: normalized } } },
                        { investorProfile: { firm: { contains: normalized } } },
                    ],
                },
                include: { investorProfile: true },
            });
        }
        if (!user || user.role?.toLowerCase() !== "investor") {
            return res.status(404).json({ success: false, message: "Investor not found" });
        }
        const p = user.investorProfile;
        // Load extra details if available
        let extra = {};
        try {
            const setting = await prisma.setting.findFirst({
                where: { key: `user:${user.id}:investor-profile-details` },
            });
            if (setting?.value)
                extra = JSON.parse(setting.value);
        }
        catch { }
        const focusAreas = p?.focusAreas
            ? p.focusAreas.split(",").map((s) => s.trim()).filter(Boolean)
            : Array.isArray(extra?.focusAreas)
                ? extra.focusAreas
                : [];
        const preferredStage = p?.preferredStage
            ? p.preferredStage.split(",").map((s) => s.trim()).filter(Boolean)
            : Array.isArray(extra?.preferredStage)
                ? extra.preferredStage
                : [];
        const location = [user.city, user.country].filter(Boolean).join(", ") || extra?.location || user.country || "";
        const isAccreditedDeclared = p?.isAccredited === "Yes" ||
            p?.isAccredited === "true" ||
            p?.isAccredited === true ||
            extra?.isAccredited === "Yes" ||
            extra?.isAccredited === "true";
        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.fullName || "Unnamed Investor",
                firmName: p?.firm || extra?.firm || "Ventures",
                investorType: p?.investorType || extra?.investorType || "Angel Investor",
                pitch: user.bio || "Investment firm focused on early stage startups.",
                bio: user.bio || "",
                avatarUrl: user.avatarUrl || null,
                coverUrl: user.coverImageUrl || null,
                location,
                country: user.country || null,
                city: user.city || null,
                website: extra?.website || null,
                linkedin: extra?.linkedin || null,
                ticketMin: p?.ticketMin ?? null,
                ticketMax: p?.ticketMax ?? null,
                focusAreas,
                preferredStage,
                isAccreditedDeclared,
                // Semantic verification badges:
                identityVerified: Boolean(user.isVerified || user.verified),
                status: user.status || "active",
            },
        });
    }
    catch (err) {
        next(err);
    }
});
// Public Founders List
router.get("/founders", async (req, res, next) => {
    try {
        const { page = 1, pageSize = 12 } = req.query;
        const skip = (Number(page) - 1) * Number(pageSize);
        const take = Number(pageSize);
        const where = { role: { in: ["founder", "Founder"] }, deletedAt: null };
        if (req.query.search) {
            const q = String(req.query.search).trim();
            where.OR = [
                { fullName: { contains: q } },
                { founderProfile: { startupName: { contains: q } } },
                { founderProfile: { industry: { contains: q } } },
            ];
        }
        const users = await prisma.user.findMany({
            where,
            include: { founderProfile: true },
            skip,
            take,
            orderBy: { createdAt: "desc" },
        });
        const total = await prisma.user.count({ where });
        const rows = users.map((u) => {
            const fp = u.founderProfile;
            return {
                id: u.id,
                name: u.fullName || "Founder",
                role: fp?.founderRole || "Founder",
                startupName: fp?.startupName || "",
                industry: fp?.industry || "Technology",
                stage: fp?.stage || "MVP",
                location: [u.city, u.country].filter(Boolean).join(", ") || u.country || "",
                avatarUrl: u.avatarUrl || null,
                coverUrl: u.coverImageUrl || null,
                identityVerified: Boolean(u.isVerified || u.verified),
                status: u.status || "active",
            };
        });
        res.json({ success: true, rows, total, page: Number(page), pageSize: Number(pageSize) });
    }
    catch (err) {
        next(err);
    }
});
// Public Single Founder Details
router.get("/founders/:id", async (req, res, next) => {
    try {
        const rawId = String(req.params.id || "").trim();
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);
        let user = null;
        if (isUUID) {
            user = await prisma.user.findUnique({
                where: { id: rawId },
                include: { founderProfile: true },
            });
        }
        if (!user) {
            // Find by matching slug or name or startupName
            const normalized = rawId.replace(/-/g, " ").toLowerCase();
            user = await prisma.user.findFirst({
                where: {
                    role: { in: ["founder", "Founder"] },
                    deletedAt: null,
                    OR: [
                        { fullName: { equals: normalized } },
                        { fullName: { contains: normalized } },
                        { founderProfile: { startupName: { equals: normalized } } },
                        { founderProfile: { startupName: { contains: normalized } } },
                    ],
                },
                include: { founderProfile: true },
            });
        }
        // Also support finding founder by their associated startup idea ID or startup idea slug
        if (!user) {
            const startupMatch = await prisma.startupIdea.findFirst({
                where: {
                    deletedAt: null,
                    OR: [
                        { id: rawId },
                        { startup: { equals: rawId.replace(/-/g, " ") } },
                        { startup: { contains: rawId.replace(/-/g, " ") } },
                    ],
                },
            });
            if (startupMatch && startupMatch.founder) {
                user = await prisma.user.findFirst({
                    where: {
                        role: { in: ["founder", "Founder"] },
                        deletedAt: null,
                        OR: [
                            { id: startupMatch.founder },
                            { fullName: startupMatch.founder },
                            { email: startupMatch.founder },
                        ],
                    },
                    include: { founderProfile: true },
                });
            }
        }
        if (!user || (user.role?.toLowerCase() !== "founder" && user.role?.toLowerCase() !== "admin")) {
            return res.status(404).json({ success: false, message: "Founder not found" });
        }
        const fp = user.founderProfile;
        // Load extra details if available from setting
        let extra = {};
        try {
            const setting = await prisma.setting.findFirst({
                where: { key: `user:${user.id}:founder-profile-details` },
            });
            if (setting?.value)
                extra = JSON.parse(setting.value);
        }
        catch { }
        // Resolve associated startup
        const needles = [user.id, user.fullName, user.email, fp?.startupName].filter(Boolean);
        let startup = null;
        if (needles.length > 0) {
            startup = await prisma.startupIdea.findFirst({
                where: {
                    deletedAt: null,
                    OR: needles.map((n) => ({ founder: { contains: n } })),
                },
                orderBy: { createdAt: "desc" },
            });
        }
        const location = [user.city, user.country].filter(Boolean).join(", ") || extra?.location || user.country || "";
        const cleanSlug = (title, id) => {
            const base = String(title || "startup").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
            return id ? `${base}-${id.slice(0, 8)}` : base;
        };
        res.json({
            success: true,
            data: {
                id: user.id,
                name: user.fullName || "Founder",
                founderRole: fp?.founderRole || extra?.founderRole || "Founder",
                bio: user.bio || fp?.founderBio || "",
                avatarUrl: user.avatarUrl || null,
                coverUrl: user.coverImageUrl || null,
                location,
                country: user.country || null,
                city: user.city || null,
                website: extra?.website || null,
                linkedin: extra?.linkedin || null,
                skills: Array.isArray(extra?.skills) ? extra.skills : (extra?.skills ? String(extra.skills).split(",").map((s) => s.trim()) : (fp?.industry ? [fp.industry] : [])),
                experience: extra?.experience || null,
                education: extra?.education || null,
                educationLevel: extra?.educationLevel || null,
                identityVerified: Boolean(user.isVerified || user.verified),
                status: user.status || "active",
                startup: startup ? {
                    id: startup.id,
                    name: startup.startup,
                    slug: cleanSlug(startup.startup, startup.id),
                    industry: startup.industry,
                    category: startup.category,
                    stage: startup.stage,
                    funding: startup.funding,
                    equity: startup.equity,
                    pitch: startup.pitch || startup.oneLinePitch || startup.description,
                    logo: startup.logo,
                    coverUrl: startup.coverUrl,
                    status: startup.status,
                    isPublished: startup.status === "active" || startup.visibility === "Public",
                } : (fp?.startupName ? {
                    id: null,
                    name: fp.startupName,
                    slug: cleanSlug(fp.startupName, ""),
                    industry: fp.industry || "Technology",
                    stage: fp.stage || "MVP",
                    funding: fp.targetRaise || 0,
                    equity: null,
                    pitch: fp.pitch || "",
                    logo: null,
                    coverUrl: null,
                    status: "draft",
                    isPublished: false,
                } : null),
            },
        });
    }
    catch (err) {
        next(err);
    }
});
export default router;
