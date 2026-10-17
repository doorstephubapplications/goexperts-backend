import { prisma } from "../../config/database.js";
// Canonical map of all accepted verification keys → label
export const VERIFICATION_KEY_MAP = {
    // Legacy / generic keys
    email: "Email address",
    phone: "Phone number",
    // Personal document keys (shown in UI)
    pan: "PAN Card",
    aadhaar: "Aadhaar Card",
    driving: "Driving Licence",
    // Business document keys (shown in UI)
    gst: "GST Certificate",
    udyam: "MSME Regd.",
    msme: "MSME Regd.",
    startup_india: "Startup India",
    iso_27001: "ISO 27001",
    soc2_type2: "SOC 2 Type II",
    incorporation: "MCA Registered",
    mca_registered: "MCA Registered",
    business_pan: "Business PAN",
    company: "Company Registration",
    driving_licence: "Driving Licence"
};
const VALID_STATUSES = ["verified", "pending", "missing", "rejected"];
export const VERIFICATION_KEYS = [
    { key: "email", label: "Email address", required: true },
    { key: "phone", label: "Phone number", required: false },
    { key: "pan", label: "PAN Card", required: false },
    { key: "aadhaar", label: "Aadhaar Card", required: false },
    { key: "driving", label: "Driving Licence", required: false },
    { key: "gst", label: "GST Certificate", required: false },
    { key: "udyam", label: "MSME Regd.", required: false },
    { key: "msme", label: "MSME Regd.", required: false },
    { key: "startup_india", label: "Startup India", required: false },
    { key: "iso_27001", label: "ISO 27001", required: false },
    { key: "soc2_type2", label: "SOC 2 Type II", required: false },
    { key: "incorporation", label: "MCA Registered", required: false },
    { key: "mca_registered", label: "MCA Registered", required: false },
    { key: "business_pan", label: "Business PAN", required: false },
    { key: "company", label: "Company Registration", required: false },
    { key: "driving_licence", label: "Driving Licence", required: false }
];
const VALIDATORS = {
    pan: { regex: /^[a-zA-Z0-9]{10}$/, message: "Invalid PAN format (10 alphanumeric characters)" },
    business_pan: { regex: /^[a-zA-Z0-9]{10}$/, message: "Invalid PAN format (10 alphanumeric characters)" },
    aadhaar: { regex: /^[0-9]{4}\s?[0-9]{4}\s?[0-9]{4}$/, message: "Invalid Aadhaar format (12 digits)" },
    gst: { regex: /^[a-zA-Z0-9]{15}$/, message: "Invalid GST format (15 alphanumeric characters)" },
    udyam: { regex: /^[a-zA-Z0-9-]{10,25}$/, message: "Invalid Udyam format (10-25 characters)" },
    driving: { regex: /^[A-Z0-9-/\s]{10,20}$/i, message: "Invalid Driving Licence format" },
    driving_licence: { regex: /^[A-Z0-9-/\s]{10,20}$/i, message: "Invalid Driving Licence format" },
    incorporation: { regex: /^[A-Z0-9-\s]{4,30}$/i, message: "Invalid MCA/Incorporation Number format" },
    mca_registered: { regex: /^[A-Z0-9-\s]{4,30}$/i, message: "Invalid MCA/CIN Registration format" },
    msme: { regex: /^[a-zA-Z0-9-]{5,30}$/, message: "Invalid MSME registration format" },
    startup_india: { regex: /^[A-Z0-9-\s]{4,30}$/i, message: "Invalid Startup India certificate format" },
    iso_27001: { regex: /^[A-Z0-9-\s]{4,30}$/i, message: "Invalid ISO 27001 certificate format" },
    soc2_type2: { regex: /^[A-Z0-9-\s]{4,30}$/i, message: "Invalid SOC 2 Type II certificate/report format" },
    company: { regex: /^[A-Z0-9-\s]{5,25}$/i, message: "Invalid Company Registration format" },
};
const getVerificationRequirement = (role) => {
    const normalizedRole = role.toLowerCase().trim();
    if (normalizedRole === "freelancer" || normalizedRole === "talent") {
        return { personalRequired: 2, businessRequired: 0 };
    }
    return { personalRequired: 2, businessRequired: 2 };
};
export function parseVerificationJson(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
export function buildVerificationItems(user, stored) {
    const accountVerified = Boolean(user.isVerified || user.verified);
    return VERIFICATION_KEYS
        .map(({ key, label, required }) => {
        const fromStore = stored[key] || {};
        let status = fromStore.status || "missing";
        let value = String(fromStore.value || "").trim();
        const documentUrl = fromStore.documentUrl || null;
        const rejectReason = fromStore.rejectReason || null;
        const unlockRequested = Boolean(fromStore.unlockRequested);
        if (key === "email") {
            value = user.email || value || "Not set";
            status = user.email ? "verified" : "missing";
        }
        else if (key === "phone") {
            value = user.phone || value || "Not submitted";
            status = user.phone ? fromStore.status || "verified" : "missing";
        }
        else if (key === "personal_id_1" || key === "personal_id_2") {
            if (!value)
                value = "Not submitted";
        }
        else if (key === "address") {
            if (!value) {
                value = user.location || "Not submitted";
            }
        }
        else if (!value) {
            value = status === "missing" ? "Not submitted" : value || "Submitted";
        }
        return { key, label, value, status, documentUrl, rejectReason, required: Boolean(required), unlockRequested };
    });
}
// Extract verification details from a user based on role
export function getVerificationJsonForUser(user) {
    let rawJson = "{}";
    const role = String(user.role || "").toLowerCase().trim();
    if ((role === 'freelancer' || role === 'talent') && user.freelancerProfile)
        rawJson = user.freelancerProfile.verificationJson || "{}";
    if (role === 'client' && user.clientProfile)
        rawJson = user.clientProfile.verificationJson || "{}";
    if ((role === 'founder' || role === 'startup founder') && user.founderProfile)
        rawJson = user.founderProfile.verificationJson || "{}";
    if (role === 'investor' && user.investorProfile)
        rawJson = user.investorProfile.verificationJson || "{}";
    return parseVerificationJson(rawJson);
}
// Generates the overall unified response object
export function getVerificationStats(user) {
    const stored = getVerificationJsonForUser(user);
    const items = buildVerificationItems(user, stored);
    const verifiedCount = items.filter((i) => i.status === "verified").length;
    const pendingCount = items.filter((i) => i.status === "pending").length;
    const requirement = getVerificationRequirement(String(user.role || ""));
    // Group keys
    const personalKeys = ["pan", "aadhaar", "driving", "driving_licence"];
    const businessKeys = ["gst", "udyam", "msme", "startup_india", "iso_27001", "soc2_type2", "incorporation", "mca_registered", "business_pan", "company"];
    // Calculate submitted items (verified or pending)
    const personalSubmitted = items.filter(i => personalKeys.includes(i.key) && (i.status === "verified" || i.status === "pending")).length;
    const businessSubmitted = items.filter(i => businessKeys.includes(i.key) && (i.status === "verified" || i.status === "pending")).length;
    const emailItem = items.find(i => i.key === "email");
    const isEmailMissing = !emailItem || emailItem.status === "missing";
    const isEmailVerified = emailItem?.status === "verified";
    // Calculate missing counts
    const missingPersonal = Math.max(0, requirement.personalRequired - personalSubmitted);
    const missingBusiness = Math.max(0, requirement.businessRequired - businessSubmitted);
    const missingEmail = isEmailMissing ? 1 : 0;
    const missingCount = missingEmail + missingPersonal + missingBusiness;
    // Calculate verified counts for the required groups
    const personalVerified = items.filter(i => personalKeys.includes(i.key) && i.status === "verified").length;
    const businessVerified = items.filter(i => businessKeys.includes(i.key) && i.status === "verified").length;
    const requiredPersonalVerified = Math.min(requirement.personalRequired, personalVerified);
    const requiredBusinessVerified = Math.min(requirement.businessRequired, businessVerified);
    const kycApproved = personalVerified >= requirement.personalRequired && businessVerified >= requirement.businessRequired;
    const profileApproved = Boolean(user.isVerified || user.verified);
    const requiredTotal = 1 + requirement.personalRequired + requirement.businessRequired;
    const requiredVerified = (isEmailVerified ? 1 : 0)
        + requiredPersonalVerified
        + requiredBusinessVerified;
    const trustScore = Math.min(100, Math.round((requiredVerified / requiredTotal) * 100));
    return {
        items: items.filter((i) => i.status !== "missing"),
        trustScore,
        verifiedCount,
        pendingCount,
        missingCount,
        requiredVerified,
        requiredTotal,
        personalRequired: requirement.personalRequired,
        businessRequired: requirement.businessRequired,
        personalVerified,
        businessVerified,
        requiredPersonalVerified,
        requiredBusinessVerified,
        profileApproved,
        kycApproved,
        kycStatus: kycApproved
            ? "APPROVED"
            : pendingCount > 0
                ? "PENDING"
                : missingCount > 0
                    ? "MISSING"
                    : "PENDING",
        accountVerified: profileApproved || kycApproved,
        fullName: user.fullName,
        email: user.email,
    };
}
// Generic updater function that can be used globally
export async function applyVerificationUpdate(userId, body, isAdmin = false) {
    const key = String(body.key || "").trim().toLowerCase();
    if (!key || !VERIFICATION_KEYS.some((k) => k.key === key)) {
        throw new Error("Invalid verification key");
    }
    if (key === "email") {
        throw new Error("Email is verified via your account email");
    }
    const user = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        include: {
            freelancerProfile: true,
            clientProfile: true,
            founderProfile: true,
            investorProfile: true
        }
    });
    if (!user)
        throw new Error("User not found");
    const stored = getVerificationJsonForUser(user);
    const nextStatusRaw = body.status != null ? String(body.status).toLowerCase() : "pending";
    const nextStatus = ["verified", "pending", "missing", "rejected"].includes(nextStatusRaw)
        ? nextStatusRaw
        : "pending";
    const value = body.value != null ? String(body.value).trim() : (stored[key]?.value || "");
    if (value && VALIDATORS[key]) {
        if (!VALIDATORS[key].regex.test(value)) {
            throw new Error(VALIDATORS[key].message);
        }
    }
    // Enforce locking: once verified, it cannot be altered by normal user update flows.
    // If the backend tries to update a verified document to 'pending', reject it unless it's an admin.
    if (!isAdmin && stored[key]?.status === "verified" && nextStatus !== "verified") {
        throw new Error("Document is already verified and locked. Please contact support to request an update.");
    }
    stored[key] = {
        ...stored[key],
        key,
        label: VERIFICATION_KEYS.find((k) => k.key === key)?.label || key,
        value,
        status: nextStatus,
        documentUrl: body.documentUrl != null ? String(body.documentUrl).trim() || null : stored[key]?.documentUrl || null,
        rejectReason: body.reason != null
            ? String(body.reason).trim()
            : nextStatus === "rejected"
                ? stored[key]?.rejectReason || null
                : null,
        unlockRequested: body.unlockRequested !== undefined ? Boolean(body.unlockRequested) : stored[key]?.unlockRequested || false,
    };
    if (key === "phone" && body.value) {
        await prisma.user.update({
            where: { id: userId },
            data: { phone: String(body.value).trim() },
        });
        if (nextStatus === "missing")
            stored[key].status = "pending";
    }
    const verificationJson = JSON.stringify(stored);
    const role = String(user.role).toLowerCase();
    // Route to correct profile based on role
    if (role === 'freelancer' || role === 'talent') {
        await prisma.freelancerProfile.upsert({
            where: { userId },
            update: { verificationJson },
            create: { userId, verificationJson }
        });
    }
    else if (role === 'client') {
        await prisma.clientProfile.upsert({
            where: { userId },
            update: { verificationJson },
            create: { userId, verificationJson }
        });
    }
    else if (role === 'founder' || role === 'startup founder') {
        await prisma.founderProfile.upsert({
            where: { userId },
            update: { verificationJson },
            create: { userId, verificationJson }
        });
    }
    else if (role === 'investor') {
        await prisma.investorProfile.upsert({
            where: { userId },
            update: { verificationJson },
            create: { userId, verificationJson }
        });
    }
    // Reload user and return new stats
    const freshUser = await prisma.user.findFirst({
        where: { id: userId },
        include: {
            freelancerProfile: true,
            clientProfile: true,
            founderProfile: true,
            investorProfile: true
        }
    });
    return getVerificationStats(freshUser);
}
export function getApprovedTrustCredentials(...rawInputs) {
    const results = [];
    const seenKeys = new Set();
    const inputs = rawInputs.flat().filter(Boolean);
    if (inputs.length === 0)
        return [];
    for (const raw of inputs) {
        let vObj = {};
        if (typeof raw === "string") {
            try {
                vObj = JSON.parse(raw);
            }
            catch {
                continue;
            }
        }
        else if (typeof raw === "object" && raw !== null) {
            vObj = raw;
        }
        else {
            continue;
        }
        const checkAndAdd = (key, item, fallbackLabel) => {
            if (!item || typeof item !== "object")
                return;
            const st = String(item.status || "").toLowerCase();
            if (st === "verified" || st === "approved") {
                const normalizedKey = key.toLowerCase();
                if (!seenKeys.has(normalizedKey)) {
                    seenKeys.add(normalizedKey);
                    const label = item.title || item.label || VERIFICATION_KEY_MAP[normalizedKey] || fallbackLabel || key.toUpperCase();
                    const docNumber = item.docNumber || item.value || item.number || "";
                    const url = item.url || item.documentUrl || item.fileUrl || null;
                    results.push({
                        key: normalizedKey,
                        label,
                        title: label,
                        ...(docNumber ? { docNumber } : {}),
                        ...(url ? { url } : {}),
                        status: "verified"
                    });
                }
            }
        };
        // 1. Check documentsList or documents array (used by Admin KYC Center)
        const docsArray = Array.isArray(vObj.documentsList)
            ? vObj.documentsList
            : Array.isArray(vObj.documents)
                ? vObj.documents
                : Array.isArray(vObj.kycDocuments)
                    ? vObj.kycDocuments
                    : [];
        for (const doc of docsArray) {
            if (doc && (doc.key || doc.id || doc.title)) {
                const k = String(doc.key || doc.id || doc.title).toLowerCase();
                checkAndAdd(k, doc, doc.title || doc.label);
            }
        }
        // 2. Check top-level keys in vObj (e.g. vObj.pan, vObj.aadhaar, vObj.gst, vObj.msme)
        for (const [k, v] of Object.entries(vObj)) {
            if (["documentsList", "documents", "statuses", "missingCount", "kycApproved", "kycSubmitted", "kycStatus", "kycDocuments"].includes(k))
                continue;
            if (v && typeof v === "object") {
                checkAndAdd(k, v);
            }
        }
    }
    return results;
}
