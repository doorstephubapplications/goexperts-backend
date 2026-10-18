import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Default 18 Enterprise Departments
export const DEFAULT_DEPARTMENTS = [
  { name: "Administration", code: "ADM", slug: "administration", description: "Executive leadership and overall corporate management", location: "Headquarters" },
  { name: "Human Resources", code: "HR", slug: "human-resources", description: "Talent acquisition, employee relations, and organizational culture", location: "Headquarters" },
  { name: "Customer Relationship Management", code: "CRM", slug: "crm", description: "Client relationship nurturing, lead conversion, and accounts", location: "Global / Remote" },
  { name: "Sales & Business Development", code: "SBD", slug: "sales-business-development", description: "B2B partnerships, enterprise client acquisition, and growth", location: "Headquarters" },
  { name: "Marketing & Communications", code: "MKT", slug: "marketing-communications", description: "Brand strategy, performance marketing, content, and PR", location: "Headquarters" },
  { name: "Customer Support", code: "SUP", slug: "customer-support", description: "24/7 client & freelancer help desk, ticket resolution", location: "Global / Remote" },
  { name: "Operations", code: "OPS", slug: "operations", description: "Day-to-day platform workflows, compliance, and fulfillment", location: "Headquarters" },
  { name: "Finance & Accounts", code: "FIN", slug: "finance-accounts", description: "Billing, escrow settlements, payroll, and fiscal reporting", location: "Headquarters" },
  { name: "Technology & Engineering", code: "TECH", slug: "technology-engineering", description: "Full-stack software engineering, infrastructure, and devops", location: "Headquarters" },
  { name: "Product Management", code: "PRD", slug: "product-management", description: "Product roadmap, user experience, and feature delivery", location: "Headquarters" },
  { name: "Quality Assurance", code: "QA", slug: "quality-assurance", description: "Test automation, platform QA, and release readiness", location: "Headquarters" },
  { name: "Legal & Compliance", code: "LEG", slug: "legal-compliance", description: "Regulatory compliance, IP policies, terms, and contracts", location: "Headquarters" },
  { name: "Trust & Safety", code: "TAS", slug: "trust-safety", description: "Fraud monitoring, identity verification, and community safety", location: "Headquarters" },
  { name: "Content & Community", code: "CNT", slug: "content-community", description: "Community engagement, newsletter, blog, and tutorials", location: "Global / Remote" },
  { name: "Partnerships", code: "PTN", slug: "partnerships", description: "Strategic integrations, educational partners, and affiliates", location: "Headquarters" },
  { name: "Data & Analytics", code: "DAA", slug: "data-analytics", description: "Business intelligence, machine learning, and data engineering", location: "Headquarters" },
  { name: "Information Security", code: "SEC", slug: "information-security", description: "Cybersecurity, access auditing, IAM, and infrastructure defense", location: "Headquarters" },
  { name: "Investor & Startup Relations", code: "ISR", slug: "investor-startup-relations", description: "Founder deal-flow, investor matchmaking, and pitch events", location: "Headquarters" },
];

// Default Designations per Department
export const DEFAULT_DESIGNATIONS: { name: string; code: string; deptCode: string; jobGrade: string; seniority: number }[] = [
  // Administration
  { name: "Chief Executive Officer", code: "DES-ADM-CEO", deptCode: "ADM", jobGrade: "C-Level", seniority: 10 },
  { name: "Chief Operating Officer", code: "DES-ADM-COO", deptCode: "ADM", jobGrade: "C-Level", seniority: 9 },
  { name: "General Manager", code: "DES-ADM-GM", deptCode: "ADM", jobGrade: "Executive", seniority: 8 },
  { name: "Administration Executive", code: "DES-ADM-EXEC", deptCode: "ADM", jobGrade: "Associate", seniority: 4 },

  // Human Resources
  { name: "HR Manager", code: "DES-HR-MGR", deptCode: "HR", jobGrade: "Manager", seniority: 7 },
  { name: "HR Executive", code: "DES-HR-EXEC", deptCode: "HR", jobGrade: "Associate", seniority: 4 },
  { name: "Talent Acquisition Specialist", code: "DES-HR-TAS", deptCode: "HR", jobGrade: "Specialist", seniority: 5 },

  // CRM
  { name: "CRM Head", code: "DES-CRM-HEAD", deptCode: "CRM", jobGrade: "Director", seniority: 8 },
  { name: "CRM Manager", code: "DES-CRM-MGR", deptCode: "CRM", jobGrade: "Manager", seniority: 7 },
  { name: "CRM Team Lead", code: "DES-CRM-LEAD", deptCode: "CRM", jobGrade: "Lead", seniority: 6 },
  { name: "Senior CRM Executive", code: "DES-CRM-SREXEC", deptCode: "CRM", jobGrade: "Senior", seniority: 5 },
  { name: "CRM Executive", code: "DES-CRM-EXEC", deptCode: "CRM", jobGrade: "Associate", seniority: 4 },
  { name: "CRM Associate", code: "DES-CRM-ASSOC", deptCode: "CRM", jobGrade: "Junior", seniority: 2 },

  // Sales
  { name: "Sales Manager", code: "DES-SAL-MGR", deptCode: "SBD", jobGrade: "Manager", seniority: 7 },
  { name: "Business Development Manager", code: "DES-SAL-BDM", deptCode: "SBD", jobGrade: "Manager", seniority: 6 },
  { name: "Business Development Executive", code: "DES-SAL-BDE", deptCode: "SBD", jobGrade: "Associate", seniority: 4 },

  // Marketing
  { name: "Marketing Manager", code: "DES-MKT-MGR", deptCode: "MKT", jobGrade: "Manager", seniority: 7 },
  { name: "Marketing Lead", code: "DES-MKT-LEAD", deptCode: "MKT", jobGrade: "Lead", seniority: 6 },
  { name: "Digital Marketing Specialist", code: "DES-MKT-DMS", deptCode: "MKT", jobGrade: "Specialist", seniority: 5 },
  { name: "Social Media Executive", code: "DES-MKT-SME", deptCode: "MKT", jobGrade: "Associate", seniority: 4 },
  { name: "Content Strategist", code: "DES-MKT-CS", deptCode: "MKT", jobGrade: "Specialist", seniority: 5 },

  // Support
  { name: "Customer Support Manager", code: "DES-SUP-MGR", deptCode: "SUP", jobGrade: "Manager", seniority: 7 },
  { name: "Support Team Lead", code: "DES-SUP-LEAD", deptCode: "SUP", jobGrade: "Lead", seniority: 6 },
  { name: "Support Executive", code: "DES-SUP-EXEC", deptCode: "SUP", jobGrade: "Associate", seniority: 4 },
  { name: "Customer Support Executive", code: "DES-SUP-CSE", deptCode: "SUP", jobGrade: "Associate", seniority: 4 },

  // Operations
  { name: "Operations Manager", code: "DES-OPS-MGR", deptCode: "OPS", jobGrade: "Manager", seniority: 7 },
  { name: "Operations Executive", code: "DES-OPS-EXEC", deptCode: "OPS", jobGrade: "Associate", seniority: 4 },

  // Finance
  { name: "Finance Manager", code: "DES-FIN-MGR", deptCode: "FIN", jobGrade: "Manager", seniority: 7 },
  { name: "Accountant", code: "DES-FIN-ACC", deptCode: "FIN", jobGrade: "Specialist", seniority: 5 },
  { name: "Finance Executive", code: "DES-FIN-EXEC", deptCode: "FIN", jobGrade: "Associate", seniority: 4 },
  { name: "Accounts Executive", code: "DES-FIN-AEXEC", deptCode: "FIN", jobGrade: "Associate", seniority: 4 },

  // Technology
  { name: "Engineering Manager", code: "DES-ENG-MGR", deptCode: "TECH", jobGrade: "Manager", seniority: 8 },
  { name: "Technical Lead", code: "DES-ENG-TECHLEAD", deptCode: "TECH", jobGrade: "Lead", seniority: 7 },
  { name: "Backend Developer", code: "DES-ENG-BACKEND", deptCode: "TECH", jobGrade: "Specialist", seniority: 5 },
  { name: "Frontend Developer", code: "DES-ENG-FRONTEND", deptCode: "TECH", jobGrade: "Specialist", seniority: 5 },
  { name: "Mobile Developer", code: "DES-ENG-MOBILE", deptCode: "TECH", jobGrade: "Specialist", seniority: 5 },
  { name: "DevOps Engineer", code: "DES-ENG-DEVOPS", deptCode: "TECH", jobGrade: "Specialist", seniority: 6 },

  // Quality Assurance
  { name: "QA Manager", code: "DES-QA-MGR", deptCode: "QA", jobGrade: "Manager", seniority: 7 },
  { name: "QA Engineer", code: "DES-QA-ENG", deptCode: "QA", jobGrade: "Specialist", seniority: 5 },
  { name: "Manual Tester", code: "DES-QA-TESTER", deptCode: "QA", jobGrade: "Associate", seniority: 3 },

  // Product
  { name: "Product Manager", code: "DES-PRD-MGR", deptCode: "PRD", jobGrade: "Manager", seniority: 7 },
  { name: "Business Analyst", code: "DES-PRD-BA", deptCode: "PRD", jobGrade: "Specialist", seniority: 5 },
  { name: "UI/UX Designer", code: "DES-PRD-DESIGNER", deptCode: "PRD", jobGrade: "Specialist", seniority: 5 },

  // Legal & Compliance
  { name: "Compliance Officer", code: "DES-LEG-OFFICER", deptCode: "LEG", jobGrade: "Specialist", seniority: 6 },
  { name: "Legal Executive", code: "DES-LEG-EXEC", deptCode: "LEG", jobGrade: "Associate", seniority: 4 },

  // Trust & Safety
  { name: "Trust & Safety Manager", code: "DES-TAS-MGR", deptCode: "TAS", jobGrade: "Manager", seniority: 7 },
  { name: "Moderation Specialist", code: "DES-TAS-MOD", deptCode: "TAS", jobGrade: "Specialist", seniority: 4 },

  // Information Security
  { name: "Security Engineer", code: "DES-SEC-ENG", deptCode: "SEC", jobGrade: "Specialist", seniority: 6 },
  { name: "Security Analyst", code: "DES-SEC-ANALYST", deptCode: "SEC", jobGrade: "Specialist", seniority: 5 },

  // Investor & Startup Relations
  { name: "Investor Relations Manager", code: "DES-ISR-MGR", deptCode: "ISR", jobGrade: "Manager", seniority: 7 },
  { name: "Startup Relations Executive", code: "DES-ISR-EXEC", deptCode: "ISR", jobGrade: "Associate", seniority: 4 },
];

// Default Roles Catalog
export const DEFAULT_ROLES = [
  { name: "Super Admin", code: "ROLE-SUPER-ADMIN", category: "system_protected", systemProtected: true, description: "Full system governance and unrestricted administrative authority." },
  { name: "Access Administrator", code: "ROLE-ACCESS-ADMIN", category: "system_protected", systemProtected: false, description: "Authorized to manage staff accounts, roles, and security delegations." },
  { name: "CRM Manager", code: "ROLE-CRM-MGR", deptCode: "CRM", category: "departmental", systemProtected: false, description: "Full management of CRM leads, customer relationships, and staff assignments." },
  { name: "CRM Executive", code: "ROLE-CRM-EXEC", deptCode: "CRM", category: "departmental", systemProtected: false, description: "Operational CRM lead tracking, notes, and customer interactions." },
  { name: "CRM Read Only", code: "ROLE-CRM-RO", deptCode: "CRM", category: "departmental", systemProtected: false, description: "Read-only visibility into CRM leads and inquiries without edit rights." },
  { name: "Support Agent", code: "ROLE-SUP-AGENT", deptCode: "OPS", category: "departmental", systemProtected: false, description: "Frontline customer support, ticket resolution, and live customer inquiries." },
  { name: "Support Supervisor", code: "ROLE-SUP-SUPV", deptCode: "OPS", category: "departmental", systemProtected: false, description: "Support escalation handling, ticket reassignment, and SLA oversight." },
  { name: "HR Manager", code: "ROLE-HR-MGR", deptCode: "HR", category: "departmental", systemProtected: false, description: "Human resources, job openings, applicant tracking, and staff onboarding." },
  { name: "HR Employee", code: "ROLE-HR-EMP", deptCode: "HR", category: "departmental", systemProtected: false, description: "HR operational tasks, documentation, and candidate screening." },
  { name: "Finance Viewer", code: "ROLE-FIN-VIEW", deptCode: "FIN", category: "departmental", systemProtected: false, description: "View-only access to invoices, platform subscriptions, and financial records." },
  { name: "Finance Executive", code: "ROLE-FIN-EXEC", deptCode: "FIN", category: "departmental", systemProtected: false, description: "Invoice generation, withdrawal review, and transaction reconciliation." },
  { name: "Finance Manager", code: "ROLE-FIN-MGR", deptCode: "FIN", category: "departmental", systemProtected: false, description: "Full finance control including wallet adjustments and refund approvals." },
  { name: "Marketing Manager", code: "ROLE-MKT-MGR", deptCode: "MKT", category: "departmental", systemProtected: false, description: "Marketing campaigns, push notifications, announcements, and CMS." },
  { name: "Content Manager", code: "ROLE-CNT-MGR", deptCode: "CNT", category: "departmental", systemProtected: false, description: "Blog publishing, legal policies, testimonials, and static page CMS." },
  { name: "Trust & Safety Moderator", code: "ROLE-TAS-MOD", deptCode: "TAS", category: "departmental", systemProtected: false, description: "KYC verification, account flag reviews, and moderation enforcement." },
  { name: "Operations Manager", code: "ROLE-OPS-MGR", deptCode: "OPS", category: "departmental", systemProtected: false, description: "Cross-departmental operational oversight, project dispute resolution." },
  { name: "Security Auditor", code: "ROLE-SEC-AUDIT", deptCode: "SEC", category: "system_protected", systemProtected: false, description: "Audit trail inspection, login session monitoring, and security reviews." },
];

// Complete Permission Registry
export const PERMISSION_REGISTRY = [
  // Dashboard
  { key: "dashboard.view", name: "View Overview Dashboard", module: "Dashboard", category: "menu", action: "view", order: 10 },
  { key: "dashboard.seo.view", name: "View SEO Dashboard", module: "Dashboard", category: "submenu", action: "view", order: 20 },

  // User Management
  { key: "users.menu", name: "User Management Menu", module: "Users", category: "menu", action: "menu", order: 100 },
  { key: "users.freelancers.view", name: "View Freelancers", module: "Users", category: "submenu", action: "view", order: 110 },
  { key: "users.freelancers.edit", name: "Edit Freelancers", module: "Users", category: "action", action: "edit", order: 111 },
  { key: "users.freelancers.delete", name: "Delete Freelancers", module: "Users", category: "action", action: "delete", order: 112 },
  { key: "users.freelancers.export", name: "Export Freelancers", module: "Users", category: "action", action: "export", order: 113 },
  { key: "users.clients.view", name: "View Clients", module: "Users", category: "submenu", action: "view", order: 120 },
  { key: "users.clients.edit", name: "Edit Clients", module: "Users", category: "action", action: "edit", order: 121 },
  { key: "users.clients.delete", name: "Delete Clients", module: "Users", category: "action", action: "delete", order: 122 },
  { key: "users.investors.view", name: "View Investors", module: "Users", category: "submenu", action: "view", order: 130 },
  { key: "users.investors.edit", name: "Edit Investors", module: "Users", category: "action", action: "edit", order: 131 },
  { key: "users.founders.view", name: "View Founders", module: "Users", category: "submenu", action: "view", order: 140 },
  { key: "users.founders.edit", name: "Edit Founders", module: "Users", category: "action", action: "edit", order: 141 },
  { key: "users.connections.view", name: "View User Connections", module: "Users", category: "submenu", action: "view", order: 150 },
  { key: "users.connections.export", name: "Export User Connections", module: "Users", category: "action", action: "export", order: 151 },
  { key: "users.delete_requests.view", name: "View Delete Requests", module: "Users", category: "submenu", action: "view", order: 160 },
  { key: "users.delete_requests.approve", name: "Approve Delete Requests", module: "Users", category: "action", action: "approve", order: 161 },
  { key: "users.messaging.view", name: "View Platform Messaging", module: "Users", category: "submenu", action: "view", order: 170 },

  // CRM & Operations
  { key: "crm.menu", name: "CRM & Operations Menu", module: "CRM & Operations", category: "menu", action: "menu", order: 200 },
  { key: "crm.leads.view", name: "View CRM Leads", module: "CRM & Operations", category: "submenu", action: "view", order: 210 },
  { key: "crm.leads.create", name: "Create CRM Leads", module: "CRM & Operations", category: "action", action: "create", order: 211 },
  { key: "crm.leads.edit", name: "Edit CRM Leads", module: "CRM & Operations", category: "action", action: "edit", order: 212 },
  { key: "crm.leads.delete", name: "Delete CRM Leads", module: "CRM & Operations", category: "action", action: "delete", order: 213 },
  { key: "crm.leads.assign", name: "Assign CRM Leads", module: "CRM & Operations", category: "action", action: "assign", order: 214 },
  { key: "crm.leads.export", name: "Export CRM Leads", module: "CRM & Operations", category: "action", action: "export", order: 215 },
  { key: "crm.projects.view", name: "View Projects", module: "CRM & Operations", category: "submenu", action: "view", order: 220 },
  { key: "crm.projects.edit", name: "Edit Projects", module: "CRM & Operations", category: "action", action: "edit", order: 221 },
  { key: "crm.tasks.view", name: "View Tasks", module: "CRM & Operations", category: "submenu", action: "view", order: 230 },
  { key: "crm.startup_ideas.view", name: "View Startup Ideas", module: "CRM & Operations", category: "submenu", action: "view", order: 240 },
  { key: "crm.investments.view", name: "View Investments", module: "CRM & Operations", category: "submenu", action: "view", order: 250 },
  { key: "crm.meetings.view", name: "View Meetings", module: "CRM & Operations", category: "submenu", action: "view", order: 260 },
  { key: "crm.support_tickets.view", name: "View Support Tickets", module: "CRM & Operations", category: "submenu", action: "view", order: 270 },
  { key: "crm.support_tickets.reply", name: "Reply to Support Tickets", module: "CRM & Operations", category: "action", action: "reply", order: 271 },

  // Payments & Finance
  { key: "finance.menu", name: "Payments & Finance Menu", module: "Finance", category: "menu", action: "menu", order: 300 },
  { key: "finance.transactions.view", name: "View Invoices & Transactions", module: "Finance", category: "submenu", action: "view", order: 310 },
  { key: "finance.wallets.view", name: "View Wallets", module: "Finance", category: "submenu", action: "view", order: 320 },
  { key: "finance.wallets.adjust", name: "Initiate Wallet Adjustment", module: "Finance", category: "action", action: "adjust", order: 321 },
  { key: "finance.wallets.approve_adjustment", name: "Approve Wallet Adjustment", module: "Finance", category: "action", action: "approve", order: 322 },
  { key: "finance.withdrawals.view", name: "View Withdrawals", module: "Finance", category: "submenu", action: "view", order: 330 },
  { key: "finance.withdrawals.approve", name: "Approve/Reject Withdrawals", module: "Finance", category: "action", action: "approve", order: 331 },
  { key: "finance.subscriptions.view", name: "View Subscriptions & Plans", module: "Finance", category: "submenu", action: "view", order: 340 },
  { key: "finance.plans.edit", name: "Manage Plans", module: "Finance", category: "action", action: "edit", order: 341 },

  // Content Management
  { key: "content.menu", name: "Content Management Menu", module: "Content", category: "menu", action: "menu", order: 400 },
  { key: "content.blogs.view", name: "View Blogs", module: "Content", category: "submenu", action: "view", order: 410 },
  { key: "content.blogs.create", name: "Create Blogs", module: "Content", category: "action", action: "create", order: 411 },
  { key: "content.blogs.edit", name: "Edit Blogs", module: "Content", category: "action", action: "edit", order: 412 },
  { key: "content.blogs.publish", name: "Publish Blogs", module: "Content", category: "action", action: "publish", order: 413 },
  { key: "content.announcements.view", name: "View Announcements", module: "Content", category: "submenu", action: "view", order: 420 },
  { key: "content.cms.edit", name: "Edit CMS Pages & Policies", module: "Content", category: "submenu", action: "edit", order: 430 },
  { key: "content.advertisement.manage", name: "Manage Ads, Push, Coupons", module: "Content", category: "submenu", action: "manage", order: 440 },

  // Access Management & Staff (The Primary Engine)
  { key: "staff.menu", name: "Access Management Menu", module: "Access Management", category: "menu", action: "menu", order: 500 },
  { key: "staff.overview.view", name: "View Access Overview", module: "Access Management", category: "submenu", action: "view", order: 510 },
  { key: "staff.departments.view", name: "View Departments", module: "Access Management", category: "submenu", action: "view", order: 520 },
  { key: "staff.departments.manage", name: "Create/Edit Departments", module: "Access Management", category: "action", action: "manage", order: 521 },
  { key: "staff.designations.view", name: "View Designations", module: "Access Management", category: "submenu", action: "view", order: 530 },
  { key: "staff.designations.manage", name: "Create/Edit Designations", module: "Access Management", category: "action", action: "manage", order: 531 },
  { key: "staff.roles.view", name: "View Roles & Permissions", module: "Access Management", category: "submenu", action: "view", order: 540 },
  { key: "staff.roles.manage", name: "Create/Edit Roles", module: "Access Management", category: "action", action: "manage", order: 541 },
  { key: "staff.permissions.manage", name: "Assign Role Permissions", module: "Access Management", category: "action", action: "assign", order: 542 },
  { key: "staff.employees.view", name: "View Employees Directory", module: "Access Management", category: "submenu", action: "view", order: 550 },
  { key: "staff.employees.manage", name: "Create/Edit Employees", module: "Access Management", category: "action", action: "manage", order: 551 },
  { key: "staff.employees.assign_role", name: "Assign Employee Roles", module: "Access Management", category: "action", action: "assign", order: 552 },
  { key: "staff.sessions.view", name: "View Login Sessions", module: "Access Management", category: "submenu", action: "view", order: 560 },
  { key: "staff.sessions.revoke", name: "Revoke Active Sessions", module: "Access Management", category: "action", action: "revoke", order: 561 },
  { key: "staff.audit_logs.view", name: "View Audit & Activity Logs", module: "Access Management", category: "submenu", action: "view", order: 570 },
  { key: "staff.reports.view", name: "View Access Reports", module: "Access Management", category: "submenu", action: "view", order: 580 },
  { key: "staff.settings.manage", name: "Manage Security Policies", module: "Access Management", category: "submenu", action: "manage", order: 590 },

  // Careers & Recruitment ATS
  { key: "careers.menu", name: "Careers Management Menu", module: "Careers", category: "menu", action: "menu", order: 550 },
  { key: "careers.ats.view", name: "View ATS Dashboard", module: "Careers", category: "submenu", action: "view", order: 551 },
  { key: "careers.jobs.view", name: "View Job Openings", module: "Careers", category: "submenu", action: "view", order: 552 },
  { key: "careers.jobs.create", name: "Create Job Opening", module: "Careers", category: "action", action: "create", order: 553 },
  { key: "careers.applications.view", name: "View Candidate Applications", module: "Careers", category: "submenu", action: "view", order: 554 },
  { key: "careers.applications.stage", name: "Update Candidate Stage", module: "Careers", category: "action", action: "edit", order: 555 },
  { key: "careers.cms.view", name: "View & Edit Careers CMS", module: "Careers", category: "submenu", action: "edit", order: 556 },

  // Referrals & Affiliate Rewards
  { key: "referrals.menu", name: "Referral Program Menu", module: "Referrals", category: "menu", action: "menu", order: 570 },
  { key: "referrals.welcome_bonuses.view", name: "View Welcome Bonuses", module: "Referrals", category: "submenu", action: "view", order: 571 },
  { key: "referrals.referral_bonuses.view", name: "View Referral Bonuses", module: "Referrals", category: "submenu", action: "view", order: 572 },
  { key: "referrals.percentage_commission.view", name: "View Percentage Commission", module: "Referrals", category: "submenu", action: "view", order: 573 },

  // Advertisements, Coupons & Push Notifications
  { key: "advertisement.coupons.view", name: "View Coupons", module: "Content", category: "submenu", action: "view", order: 450 },
  { key: "advertisement.coupons.manage", name: "Create & Edit Coupons", module: "Content", category: "action", action: "manage", order: 451 },
  { key: "advertisement.push_notifications.view", name: "View Custom Push Notifications", module: "Content", category: "submenu", action: "view", order: 452 },
  { key: "advertisement.push_campaigns.view", name: "View Push Campaigns", module: "Content", category: "submenu", action: "view", order: 453 },
  { key: "advertisement.push_campaigns.manage", name: "Schedule & Send Campaigns", module: "Content", category: "action", action: "manage", order: 454 },
  { key: "advertisement.history.view", name: "View Dispatch History", module: "Content", category: "submenu", action: "view", order: 455 },

  // Help Desk & Support
  { key: "support.helpdesk.view", name: "View Support Help Desk", module: "CRM & Operations", category: "submenu", action: "view", order: 272 },
  { key: "support.contact_enquiries.view", name: "View Contact Enquiries", module: "CRM & Operations", category: "submenu", action: "view", order: 273 },

  // Extended CMS & Templates
  { key: "content.email_templates.view", name: "View Email Templates", module: "Content", category: "submenu", action: "view", order: 460 },
  { key: "content.resume_templates.view", name: "View Resume Templates", module: "Content", category: "submenu", action: "view", order: 461 },
  { key: "content.invoice_template.view", name: "View Invoice Template", module: "Content", category: "submenu", action: "view", order: 462 },
  { key: "content.legal_policies.view", name: "View Legal Policies", module: "Content", category: "submenu", action: "view", order: 463 },

  // System Settings
  { key: "system.masters.view", name: "View Master Options", module: "System", category: "submenu", action: "view", order: 610 },
  { key: "system.masters.edit", name: "Edit Master Options", module: "System", category: "action", action: "edit", order: 611 },
  { key: "system.settings.view", name: "View Platform Settings", module: "System", category: "submenu", action: "view", order: 620 },
  { key: "system.settings.edit", name: "Edit Platform Settings", module: "System", category: "action", action: "edit", order: 621 },
];

export async function seedAccessManagement() {
  console.log("🚀 Starting Idempotent Enterprise Access Management Seeding...");

  // 1. Seed Departments
  console.log("🏢 Seeding Departments...");
  const deptMap = new Map<string, string>();
  for (const dept of DEFAULT_DEPARTMENTS) {
    const record = await prisma.department.upsert({
      where: { name: dept.name },
      update: {
        code: dept.code,
        slug: dept.slug,
        description: dept.description,
        location: dept.location,
        status: "active",
      },
      create: {
        name: dept.name,
        code: dept.code,
        slug: dept.slug,
        description: dept.description,
        location: dept.location,
        status: "active",
      },
    });
    deptMap.set(dept.code, record.id);
  }
  console.log(`✅ Seeded ${deptMap.size} departments.`);

  // 2. Seed Designations
  console.log("👔 Seeding Designations...");
  const desigMap = new Map<string, string>();
  for (const desig of DEFAULT_DESIGNATIONS) {
    const deptId = deptMap.get(desig.deptCode);
    if (!deptId) continue;

    const record = await prisma.designation.upsert({
      where: { code: desig.code },
      update: {
        name: desig.name,
        departmentId: deptId,
        jobGrade: desig.jobGrade,
        seniority: desig.seniority,
        status: "active",
      },
      create: {
        name: desig.name,
        code: desig.code,
        departmentId: deptId,
        jobGrade: desig.jobGrade,
        seniority: desig.seniority,
        status: "active",
      },
    });
    desigMap.set(desig.code, record.id);
  }
  console.log(`✅ Seeded ${desigMap.size} designations.`);

  // 3. Seed Permissions Registry
  console.log("🔐 Seeding Permissions Registry...");
  const permMap = new Map<string, string>();
  for (const perm of PERMISSION_REGISTRY) {
    const specificModule = perm.category === "menu" ? perm.module : `${perm.module} - ${perm.key.split(".")[1] || "General"}`;
    const record = await prisma.permission.upsert({
      where: { key: perm.key },
      update: {
        action: perm.action,
        module: specificModule,
        name: perm.name,
        category: perm.category,
        order: perm.order,
      },
      create: {
        key: perm.key,
        action: perm.action,
        module: specificModule,
        name: perm.name,
        category: perm.category,
        order: perm.order,
        description: `${perm.name} in ${perm.module}`,
      },
    });
    permMap.set(perm.key, record.id);
  }
  console.log(`✅ Seeded ${permMap.size} permission registry entries.`);

  // 4. Seed Roles
  console.log("🛡️ Seeding Roles...");
  const roleMap = new Map<string, string>();
  for (const role of DEFAULT_ROLES) {
    const deptId = role.deptCode ? deptMap.get(role.deptCode) : null;
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        code: role.code,
        description: role.description,
        category: role.category,
        departmentId: deptId,
        systemProtected: role.systemProtected,
        status: "active",
      },
      create: {
        name: role.name,
        code: role.code,
        description: role.description,
        category: role.category,
        departmentId: deptId,
        systemProtected: role.systemProtected,
        status: "active",
      },
    });
    roleMap.set(role.name, record.id);
  }
  console.log(`✅ Seeded ${roleMap.size} roles.`);

  // 5. Assign Permissions to Roles
  console.log("📋 Assigning default permissions to roles...");

  // Super Admin receives ALL permissions with Full Access & All Scope
  const superAdminRoleId = roleMap.get("Super Admin");
  if (superAdminRoleId) {
    for (const [permKey, permId] of permMap.entries()) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRoleId,
            permissionId: permId,
          },
        },
        update: {
          scope: "all",
          actions: ["menu", "view", "create", "edit", "delete", "export", "import", "approve", "assign", "full_access"],
        },
        create: {
          roleId: superAdminRoleId,
          permissionId: permId,
          scope: "all",
          actions: ["menu", "view", "create", "edit", "delete", "export", "import", "approve", "assign", "full_access"],
        },
      });
    }
  }

  // CRM Manager role permissions
  const crmMgrRoleId = roleMap.get("CRM Manager");
  if (crmMgrRoleId) {
    const crmPermKeys = [
      "crm.menu", "crm.leads.view", "crm.leads.create", "crm.leads.edit", "crm.leads.assign", "crm.leads.export",
      "crm.projects.view", "crm.tasks.view", "crm.meetings.view", "crm.support_tickets.view",
      "users.menu", "users.freelancers.view", "users.clients.view", "users.connections.view",
    ];
    for (const key of crmPermKeys) {
      const permId = permMap.get(key);
      if (permId) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: crmMgrRoleId, permissionId: permId } },
          update: { scope: "department", actions: ["view", "create", "edit", "assign", "export"] },
          create: { roleId: crmMgrRoleId, permissionId: permId, scope: "department", actions: ["view", "create", "edit", "assign", "export"] },
        });
      }
    }
  }

  // 6. Seed/Verify Default Super Administrator Account
  console.log("👑 Seeding/Verifying Super Administrator...");
  const isProduction = process.env.NODE_ENV === "production";
  const superAdminInitialPassword = process.env.SUPER_ADMIN_PASSWORD || "Admin@123";

  if (isProduction && superAdminInitialPassword === "Admin@123") {
    console.warn(
      "⚠️ SECURITY NOTICE: Default password used for Super Admin initialization. Please rotate this credential in the admin panel."
    );
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(superAdminInitialPassword, salt);

  const adminDeptId = deptMap.get("ADM");
  const ceoDesigId = desigMap.get("DES-ADM-CEO");

  const superAdminUser = await prisma.adminUser.upsert({
    where: { email: "superadmin@goexperts.com" },
    update: {
      fullName: "Super Admin",
      roleId: superAdminRoleId!,
      departmentId: adminDeptId,
      designationId: ceoDesigId,
      employeeCode: "EMP-001",
      officeLocation: "New Delhi, India",
      accessLevel: "full_access",
      employmentStatus: "active",
      status: "active",
    },
    create: {
      email: "superadmin@goexperts.com",
      password: hashedPassword,
      fullName: "Super Admin",
      roleId: superAdminRoleId!,
      departmentId: adminDeptId,
      designationId: ceoDesigId,
      employeeCode: "EMP-001",
      officeLocation: "New Delhi, India",
      accessLevel: "full_access",
      employmentStatus: "active",
      status: "active",
    },
  });

  // 7. Seed Initial Security Policy
  console.log("🔒 Initializing Security Policy...");
  const existingPolicy = await prisma.adminSecurityPolicy.findFirst();
  if (!existingPolicy) {
    await prisma.adminSecurityPolicy.create({
      data: {
        sessionTimeoutMinutes: 60,
        maxConcurrentSessions: 5,
        requireMfa: false,
        defaultDataScope: "assigned",
      },
    });
  }

  console.log("🎉 Enterprise Access Management Seed Completed Successfully!");
}

if (process.argv[1]?.endsWith("seed-access-management.ts")) {
  seedAccessManagement()
    .catch((e) => {
      console.error("❌ Seed Failed:", e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
