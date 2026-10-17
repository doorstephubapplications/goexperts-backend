import { PrismaClient } from "@prisma/client";
import { sendEmail, shell } from "../mobile/email.service.js";
const prisma = new PrismaClient();
const FRONTEND_URL = process.env.FRONTEND_URL || "https://goexperts.in";
const SUPPORT_MAILBOX = process.env.SMTP_SUPPORT_EMAIL || process.env.SMTP_USER || "servicedesk@goexperts.in";
const PAGE_NAME = "Contact";
const PAGE_CATEGORY = "Company";
function generateContactReference() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    return `GE-CON-${dateStr}-${randomNum}`;
}
export class ContactCmsService {
    /**
     * Ensure Contact CMS page record exists in database
     */
    async getOrCreatePage() {
        let page = await prisma.cmsPage.findFirst({
            where: {
                OR: [
                    { name: { equals: "Contact" } },
                    { name: { equals: "Contact Us" } },
                ],
                deletedAt: null,
            },
            orderBy: { updatedAt: "desc" },
        });
        if (!page) {
            const initialPayload = {
                hero: {
                    eyebrow: "Let's Talk",
                    heading: "Need Help or Want to Discuss a Project?",
                    highlightText: "Discuss a Project?",
                    description: "Our dedicated team is available 24/7 to assist with platform questions, enterprise partnerships, or technical support.",
                    image: "",
                    imageAlt: "Customer Support Representative",
                    primaryCtaLabel: "Send Message",
                    primaryCtaUrl: "#contact-form",
                    secondaryCtaLabel: "Explore FAQs",
                    secondaryCtaUrl: "#contact-faq",
                    enabled: true,
                },
                contactInfo: {
                    generalEmail: "hello@goexperts.in",
                    supportEmail: "servicedesk@goexperts.in",
                    careersEmail: "careers@goexperts.in",
                    businessEmail: "enterprise@goexperts.in",
                    phone: "+91 94414 57677",
                    secondaryPhone: "+91 80 4567 8901",
                    whatsappNumber: "+91 94414 57677",
                    tollFreeNumber: "1800 123 4567",
                    mainAddress: "6-3-712/86, Ground Floor, panjagutta colony, beside Dr.Agarwal Eye Hospital, Hyderabad, Telangana 500082",
                    registeredAddress: "Go Experts Inc., 500 Howard Street, Suite 400, San Francisco, CA 94105, USA",
                    websiteUrl: "https://goexperts.in",
                },
                supportChannels: [
                    { id: "supp-1", icon: "HelpCircle", title: "Customer Support", description: "Get assistance with your account, payments, or ongoing projects.", contactEmail: "servicedesk@goexperts.in", ctaLabel: "Email Support", ctaUrl: "mailto:servicedesk@goexperts.in", order: 1, enabled: true },
                    { id: "supp-2", icon: "Building2", title: "Enterprise & Sales", description: "Learn about custom contracts, volume pricing, and dedicated account management.", contactEmail: "enterprise@goexperts.in", ctaLabel: "Contact Sales", ctaUrl: "mailto:enterprise@goexperts.in", order: 2, enabled: true },
                    { id: "supp-3", icon: "Briefcase", title: "Careers & Talent", description: "Interested in joining our team? Reach out directly to our talent acquisition team.", contactEmail: "careers@goexperts.in", ctaLabel: "View Openings", ctaUrl: "/careers", order: 3, enabled: true },
                ],
                formConfig: {
                    heading: "Send Us a Message",
                    description: "Fill out the form below and our team will get back to you within 24 hours.",
                    successMessage: "Thank you! Your enquiry has been received. Reference number: ",
                    consentText: "I agree to the Go Experts Privacy Policy and Terms of Service.",
                    privacyUrl: "/privacy",
                    recipientEmail: "contact-submissions@goexperts.in",
                    enabled: true,
                },
                officeLocations: [
                    { id: "loc-1", officeName: "Hyderabad HQ", city: "Hyderabad, India", address: "6-3-712/86, Ground Floor, panjagutta colony, beside Dr.Agarwal Eye Hospital, Hyderabad, Telangana 500082", phone: "+91 94414 57677", email: "info@goexperts.in", order: 1, enabled: true },
                    { id: "loc-2", officeName: "San Francisco Office", city: "San Francisco, USA", address: "500 Howard St, Suite 400, San Francisco, CA 94105", phone: "+1 415 555 0199", email: "us@goexperts.in", order: 2, enabled: true },
                    { id: "loc-3", officeName: "Singapore Hub", city: "Singapore", address: "Marina Bay Financial Centre, Tower 1, Singapore 018981", phone: "+65 6789 0123", email: "sg@goexperts.in", order: 3, enabled: true },
                ],
                workingHours: {
                    mondayToFriday: "9:00 AM – 6:00 PM",
                    saturday: "10:00 AM – 4:00 PM",
                    sunday: "Closed",
                    timezone: "IST / UTC+5:30",
                },
                socialLinks: [
                    { platform: "LinkedIn", url: "https://linkedin.com/company/goexperts" },
                    { platform: "Twitter", url: "https://twitter.com/goexperts" },
                    { platform: "GitHub", url: "https://github.com/goexperts" },
                ],
                faqs: [
                    { id: "faq-1", question: "What are your support operating hours?", answer: "Our customer support team is available Monday through Saturday. For urgent enterprise issues, 24/7 emergency support is provided to contracted clients.", order: 1 },
                    { id: "faq-2", question: "How fast do you respond to enquiries?", answer: "We aim to respond to all general enquiries within 24 hours. Priority support ticket SLA is under 2 hours.", order: 2 },
                    { id: "faq-3", question: "Where is Go Experts headquartered?", answer: "Go Experts is headquartered in Hyderabad, Telangana, India with global operations in San Francisco and Singapore.", order: 3 },
                ],
                seo: {
                    metaTitle: "Contact Us — Go Experts Enterprise Platform",
                    metaDescription: "Get in touch with Go Experts for support, enterprise sales, partnerships, or career inquiries.",
                    canonicalUrl: "https://goexperts.in/contact",
                    ogTitle: "Contact Go Experts Team",
                    ogDescription: "We are here to help. Reach out to our global team today.",
                },
            };
            const payloadStr = JSON.stringify(initialPayload);
            page = await prisma.cmsPage.create({
                data: {
                    name: PAGE_NAME,
                    category: PAGE_CATEGORY,
                    status: "active",
                    draftJson: payloadStr,
                    publishedJson: payloadStr,
                    version: 1,
                    publishedAt: new Date(),
                    publishedBy: "System",
                    content: payloadStr,
                },
            });
            await prisma.cmsPageRevision.create({
                data: {
                    pageId: page.id,
                    version: 1,
                    contentJson: payloadStr,
                    status: "published",
                    createdBy: "System",
                    changeSummary: "Initial Contact Page created",
                },
            });
        }
        return page;
    }
    /**
     * Public: Get Contact Page Payload
     */
    async getPublicContactPage() {
        const page = await this.getOrCreatePage();
        let contentStr = page.publishedJson || page.content || page.draftJson || "";
        let parsed = null;
        try {
            if (contentStr && contentStr.trim().startsWith("{")) {
                parsed = JSON.parse(contentStr);
            }
        }
        catch {
            parsed = null;
        }
        if (parsed) {
            return { success: true, data: parsed };
        }
        return {
            success: true,
            data: {
                contentType: "html",
                content: contentStr,
            },
        };
    }
    /**
     * Admin: Get Contact CMS Page for editing
     */
    async getAdminContactPage() {
        const page = await this.getOrCreatePage();
        let draftData = null;
        let publishedData = null;
        try {
            if (page.draftJson)
                draftData = JSON.parse(page.draftJson);
        }
        catch { }
        try {
            if (page.publishedJson)
                publishedData = JSON.parse(page.publishedJson);
        }
        catch { }
        return {
            pageId: page.id,
            name: page.name,
            category: page.category,
            status: page.status,
            version: page.version,
            updatedAt: page.updatedAt,
            publishedAt: page.publishedAt,
            draftContent: draftData,
            publishedContent: publishedData,
        };
    }
    /**
     * Admin: Save Draft Contact Page
     */
    async saveContactDraft(payload) {
        const page = await this.getOrCreatePage();
        const str = JSON.stringify(payload);
        const updated = await prisma.cmsPage.update({
            where: { id: page.id },
            data: {
                draftJson: str,
                updated: new Date().toISOString().slice(0, 10),
            },
        });
        return { success: true, pageId: updated.id, version: updated.version };
    }
    /**
     * Admin: Publish Contact Page
     */
    async publishContactPage(payload, adminName = "Admin") {
        const page = await this.getOrCreatePage();
        const str = JSON.stringify(payload);
        const newVersion = (page.version || 1) + 1;
        const updated = await prisma.cmsPage.update({
            where: { id: page.id },
            data: {
                draftJson: str,
                publishedJson: str,
                content: str,
                version: newVersion,
                status: "active",
                publishedAt: new Date(),
                publishedBy: adminName,
                updated: new Date().toISOString().slice(0, 10),
            },
        });
        await prisma.cmsPageRevision.create({
            data: {
                pageId: page.id,
                version: newVersion,
                contentJson: str,
                status: "published",
                createdBy: adminName,
                changeSummary: `Published version ${newVersion}`,
            },
        });
        return { success: true, pageId: updated.id, version: newVersion };
    }
    /**
     * Public: Submit Contact Enquiry
     */
    async submitPublicEnquiry(input) {
        // 1. Honeypot anti-spam check
        if (input.botField && input.botField.trim().length > 0) {
            console.warn(`[CONTACT SPAM BLOCKED] Honeypot field filled by IP: ${input.ipAddress}`);
            return {
                success: true,
                referenceNumber: `GE-CON-${Date.now().toString().slice(-8)}`,
                message: "Enquiry submitted successfully.",
            };
        }
        // 2. Strict input validation
        const fullName = (input.fullName || "").trim();
        const email = (input.email || "").trim().toLowerCase();
        const subject = (input.subject || "").trim();
        const message = (input.message || "").trim();
        const enquiryType = (input.enquiryType || "General Enquiry").trim();
        const phone = input.phone?.trim() || null;
        const company = input.company?.trim() || null;
        const preferredContactMethod = input.preferredContactMethod?.trim() || "Email";
        if (!fullName || fullName.length < 2 || fullName.length > 100) {
            throw new Error("Please enter a valid full name (2–100 characters).");
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            throw new Error("Please enter a valid email address.");
        }
        if (!subject || subject.length < 5 || subject.length > 150) {
            throw new Error("Subject must be between 5 and 150 characters.");
        }
        if (!message || message.length < 15 || message.length > 3000) {
            throw new Error("Message must be between 15 and 3000 characters.");
        }
        const referenceNumber = generateContactReference();
        // 3. Database Persistence
        const enquiry = await prisma.contactEnquiry.create({
            data: {
                referenceNumber,
                fullName,
                email,
                phone,
                company,
                enquiryType,
                subject,
                message,
                preferredContactMethod,
                status: "new",
                priority: "normal",
                ipAddress: input.ipAddress || null,
                userAgent: input.userAgent || null,
            },
        });
        // 4. Safe Asynchronous Transactional Email Dispatch (Non-blocking)
        (async () => {
            try {
                const page = await this.getOrCreatePage();
                let configuredSupportEmail = SUPPORT_MAILBOX;
                try {
                    const content = JSON.parse(page.publishedJson || page.content || "{}");
                    if (content.formConfig?.recipientEmail) {
                        configuredSupportEmail = content.formConfig.recipientEmail;
                    }
                    else if (content.contactInfo?.supportEmail) {
                        configuredSupportEmail = content.contactInfo.supportEmail;
                    }
                }
                catch { }
                const nowFormatted = new Date().toLocaleString("en-US", {
                    timeZone: "Asia/Kolkata",
                    dateStyle: "medium",
                    timeStyle: "short",
                });
                // EMAIL A — Internal Support Notification
                const internalSubject = `[Go Experts] New Contact Enquiry — ${enquiryType} [${referenceNumber}]`;
                const internalBody = `
          <div style="background-color:#ffffff;border-radius:12px;padding:24px;border:1px solid #e2e8f0;margin-bottom:24px;">
            <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:20px;font-weight:700;">New Contact Form Enquiry</h2>
            <p style="margin:0 0 20px 0;color:#64748b;font-size:14px;">A new enquiry was submitted through the Go Experts Contact page.</p>

            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155;">
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;width:160px;color:#64748b;">Reference Number</td>
                <td style="padding:10px 0;font-weight:700;color:#ea580c;font-family:monospace;">${referenceNumber}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">Date &amp; Time (IST)</td>
                <td style="padding:10px 0;">${nowFormatted}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">Full Name</td>
                <td style="padding:10px 0;font-weight:600;color:#0f172a;">${fullName}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">Email Address</td>
                <td style="padding:10px 0;"><a href="mailto:${email}" style="color:#2563eb;text-decoration:none;">${email}</a></td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">Phone Number</td>
                <td style="padding:10px 0;">${phone || "Not provided"}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">Company / Org</td>
                <td style="padding:10px 0;">${company || "Not provided"}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">User Role</td>
                <td style="padding:10px 0;">${input.userRole || "Guest / Unauthenticated"}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">Category</td>
                <td style="padding:10px 0;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;background-color:#eff6ff;color:#1d4ed8;font-weight:600;font-size:12px;">${enquiryType}</span></td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">Preferred Method</td>
                <td style="padding:10px 0;">${preferredContactMethod}</td>
              </tr>
              <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:10px 0;font-weight:600;color:#64748b;">Subject</td>
                <td style="padding:10px 0;font-weight:600;color:#0f172a;">${subject}</td>
              </tr>
            </table>

            <div style="margin-top:20px;padding:16px;background-color:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
              <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Message Content</div>
              <div style="color:#1e293b;font-size:14px;line-height:1.6;white-space:pre-wrap;">${message}</div>
            </div>

            <div style="margin-top:24px;text-align:center;">
              <a href="${FRONTEND_URL}/admin/contact-enquiries" style="display:inline-block;background-color:#0f172a;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;">View in Super Admin Queue →</a>
            </div>
          </div>
        `;
                await sendEmail(configuredSupportEmail, internalSubject, shell("New Contact Form Enquiry", internalBody));
                // EMAIL B — User Acknowledgement
                const firstName = fullName.split(" ")[0] || fullName;
                const userSubject = `We've received your enquiry — Go Experts [${referenceNumber}]`;
                const userBody = `
          <div style="background-color:#ffffff;border-radius:12px;padding:28px;border:1px solid #e2e8f0;margin-bottom:24px;">
            <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:20px;font-weight:700;">Hello ${firstName},</h2>
            <p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.6;">
              Thank you for contacting Go Experts. We've received your enquiry regarding:
            </p>
            <div style="padding:12px 16px;background-color:#f8fafc;border-left:4px solid #ea580c;border-radius:4px;margin-bottom:20px;font-weight:600;color:#0f172a;font-size:15px;">
              "${subject}"
            </div>
            <div style="margin-bottom:20px;padding:14px 18px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;">
              <span style="font-size:13px;color:#166534;font-weight:600;">Your Enquiry Reference Number:</span>
              <div style="font-size:18px;font-weight:800;color:#15803d;font-family:monospace;margin-top:4px;">${referenceNumber}</div>
              <p style="margin:6px 0 0 0;font-size:12px;color:#166534;">Please keep this reference if you contact our support team regarding this enquiry.</p>
            </div>
            <p style="margin:0 0 24px 0;color:#475569;font-size:14px;line-height:1.6;">
              Our dedicated support team will review your message and respond through your preferred contact channel as soon as possible.
            </p>

            <div style="text-align:center;margin:28px 0 20px 0;">
              <a href="${FRONTEND_URL}/help" style="display:inline-block;background-color:#ea580c;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;">Visit Help Center →</a>
            </div>

            <div style="border-top:1px solid #f1f5f9;margin-top:24px;padding-top:16px;font-size:12px;color:#64748b;text-align:center;">
              Quick Links: <a href="${FRONTEND_URL}/faqs" style="color:#2563eb;text-decoration:none;margin:0 8px;">Frequently Asked Questions</a> · <a href="${FRONTEND_URL}" style="color:#2563eb;text-decoration:none;margin:0 8px;">Go Experts Home</a>
            </div>
          </div>
        `;
                await sendEmail(email, userSubject, shell("We've received your enquiry", userBody));
            }
            catch (mailError) {
                console.error(`[CONTACT NOTIFICATION EMAIL FAILED] Ref: ${referenceNumber}`, mailError);
            }
        })().catch((err) => console.error("[CONTACT NOTIFICATION EXCEPTION]", err));
        return {
            success: true,
            referenceNumber: enquiry.referenceNumber,
            message: `Enquiry submitted successfully. Your reference code is ${enquiry.referenceNumber}.`,
        };
    }
    /**
     * Admin: List Contact Enquiries with pagination & filters
     */
    async listContactEnquiries(params) {
        const page = Number(params.page || 1);
        const pageSize = Number(params.pageSize || 20);
        const skip = (page - 1) * pageSize;
        const where = { deletedAt: null };
        if (params.status && params.status !== "all") {
            where.status = params.status;
        }
        if (params.enquiryType && params.enquiryType !== "all") {
            where.enquiryType = params.enquiryType;
        }
        if (params.priority && params.priority !== "all") {
            where.priority = params.priority;
        }
        if (params.search) {
            const q = params.search.trim();
            where.OR = [
                { referenceNumber: { contains: q } },
                { fullName: { contains: q } },
                { email: { contains: q } },
                { subject: { contains: q } },
                { company: { contains: q } },
            ];
        }
        const [total, rows, newCount, openCount, inProgressCount, resolvedCount] = await Promise.all([
            prisma.contactEnquiry.count({ where }),
            prisma.contactEnquiry.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: pageSize,
            }),
            prisma.contactEnquiry.count({ where: { deletedAt: null, status: "new" } }),
            prisma.contactEnquiry.count({ where: { deletedAt: null, status: "open" } }),
            prisma.contactEnquiry.count({ where: { deletedAt: null, status: "in_progress" } }),
            prisma.contactEnquiry.count({ where: { deletedAt: null, status: "resolved" } }),
        ]);
        return {
            success: true,
            rows,
            pagination: {
                page,
                pageSize,
                total,
                totalPages: Math.ceil(total / pageSize),
            },
            stats: {
                new: newCount,
                open: openCount,
                inProgress: inProgressCount,
                resolved: resolvedCount,
            },
        };
    }
    /**
     * Admin: Get Single Contact Enquiry Detail
     */
    async getContactEnquiryById(id) {
        const enquiry = await prisma.contactEnquiry.findUnique({
            where: { id },
        });
        if (!enquiry) {
            throw new Error("Contact enquiry not found.");
        }
        return { success: true, data: enquiry };
    }
    /**
     * Admin: Update Contact Enquiry (status, priority, assigned admin, internal notes)
     */
    async updateContactEnquiry(id, updates) {
        const dataToUpdate = {};
        if (updates.status) {
            dataToUpdate.status = updates.status;
            if (updates.status === "resolved" || updates.status === "closed") {
                dataToUpdate.resolvedAt = new Date();
            }
        }
        if (updates.priority)
            dataToUpdate.priority = updates.priority;
        if (updates.assignedAdminId !== undefined)
            dataToUpdate.assignedAdminId = updates.assignedAdminId;
        if (updates.assignedAdminName !== undefined)
            dataToUpdate.assignedAdminName = updates.assignedAdminName;
        if (updates.internalNotes !== undefined)
            dataToUpdate.internalNotes = updates.internalNotes;
        const updated = await prisma.contactEnquiry.update({
            where: { id },
            data: dataToUpdate,
        });
        return { success: true, data: updated };
    }
}
export const contactCmsService = new ContactCmsService();
