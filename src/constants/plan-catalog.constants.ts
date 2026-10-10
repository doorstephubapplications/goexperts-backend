import { ValidityUnit, QuotaResetPolicy, formatValidityLabel } from "../utils/date-arithmetic.util.js";

export type RoleKey = "freelancer" | "client" | "investor" | "founder" | "all";
export type PlanCategory = "standard" | "add_on" | "all_access" | "trial";
export type PlanStatus = "draft" | "active" | "hidden" | "archived";

export interface PlanBenefitItem {
  title: string;
  explanation?: string;
  capabilityKey?: string;
  included: boolean;
  limit?: number;
  displayOrder: number;
}

export interface PlanQuotas {
  // Freelancer
  proposals?: number;
  savedProjects?: number;
  
  // Client
  projectPosts?: number;
  savedFreelancers?: number;
  directInvitations?: number;

  // Investor (Full form: Expressions of Interest)
  expressionsOfInterest?: number;
  savedStartups?: number;
  founderIntroRequests?: number;

  // Founder
  activePublishedStartups?: number;
  investorContactRequests?: number;
}

export interface CanonicalPlanDefinition {
  id?: string;
  name: string;
  code: string;
  role: RoleKey;
  planCategory: PlanCategory;
  shortDescription: string;
  detailedDescription?: string;
  amount: number;
  originalAmount?: number;
  currency: string;
  savedBadge?: string;

  // Admin-configurable validity
  validityValue: number;
  validityUnit: ValidityUnit;
  durationString: string; // e.g. "1_months", "1_years"

  // Quota reset configuration
  quotaResetPolicy: QuotaResetPolicy;
  quotaResetValue?: number;
  quotaResetUnit?: ValidityUnit;

  // Role-specific quotas
  quotas: PlanQuotas;

  // Structured benefits
  benefits: PlanBenefitItem[];
  featuresTextList: string[]; // text summaries for simple renders

  sortOrder: number;
  popular: boolean;
  recommended: boolean;
  visibility: "public" | "hidden";
  status: PlanStatus;
}

export const CANONICAL_PLANS: CanonicalPlanDefinition[] = [
  // =========================================================================
  // 1. FREELANCER PACKAGES
  // =========================================================================
  {
    name: "Freelancer Starter",
    code: "freelancer-starter",
    role: "freelancer",
    planCategory: "standard",
    shortDescription: "Start freelancing with essential project discovery and proposal tools.",
    detailedDescription: "Entry-tier freelancer workspace with essential tools to discover client projects and submit verified proposals.",
    amount: 399,
    originalAmount: 499,
    currency: "INR",
    savedBadge: "Starter Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      proposals: 3,
      savedProjects: 0,
    },
    benefits: [
      { title: "3 proposals per month", capabilityKey: "freelancer.proposal.submit", included: true, limit: 3, displayOrder: 1 },
      { title: "Public project discovery", capabilityKey: "freelancer.project.browse", included: true, displayOrder: 2 },
      { title: "Basic freelancer profile", capabilityKey: "freelancer.portfolio.manage", included: true, displayOrder: 3 },
      { title: "Proposal status tracking", capabilityKey: "freelancer.proposal.track", included: true, displayOrder: 4 },
      { title: "Saved projects", capabilityKey: "freelancer.project.save", included: false, displayOrder: 5 },
      { title: "Workspace analytics", capabilityKey: "freelancer.analytics.view", included: false, displayOrder: 6 },
    ],
    featuresTextList: [
      "3 proposals per month",
      "Public project discovery",
      "Basic freelancer profile",
      "Proposal status tracking",
      "In-app client messaging upon response",
    ],
    sortOrder: 1,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },
  {
    name: "Freelancer Pro",
    code: "freelancer-pro",
    role: "freelancer",
    planCategory: "standard",
    shortDescription: "Expand your opportunities with more proposals and project management tools.",
    detailedDescription: "Professional freelancer package offering 12 proposals per month, saved projects, and portfolio visibility.",
    amount: 799,
    originalAmount: 999,
    currency: "INR",
    savedBadge: "Save ₹200/mo",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      proposals: 12,
      savedProjects: 50,
    },
    benefits: [
      { title: "12 proposals per month", capabilityKey: "freelancer.proposal.submit", included: true, limit: 12, displayOrder: 1 },
      { title: "Saved projects", capabilityKey: "freelancer.project.save", included: true, displayOrder: 2 },
      { title: "Portfolio visibility boost", capabilityKey: "freelancer.portfolio.manage", included: true, displayOrder: 3 },
      { title: "Enhanced proposal tracking", capabilityKey: "freelancer.proposal.track", included: true, displayOrder: 4 },
      { title: "Basic workspace metrics", capabilityKey: "freelancer.analytics.view", included: true, displayOrder: 5 },
    ],
    featuresTextList: [
      "12 proposals per month",
      "Saved projects bookmarking",
      "Portfolio visibility boost",
      "Enhanced proposal tracking",
      "Standard customer support",
    ],
    sortOrder: 2,
    popular: false,
    recommended: true,
    visibility: "public",
    status: "active",
  },
  {
    name: "Freelancer Elite",
    code: "freelancer-elite",
    role: "freelancer",
    planCategory: "standard",
    shortDescription: "Handle higher proposal volumes with enhanced freelancer workspace tools.",
    detailedDescription: "High-volume tier for established consultants with 30 proposals per month and workspace analytics.",
    amount: 1499,
    originalAmount: 1899,
    currency: "INR",
    savedBadge: "High Volume",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      proposals: 30,
      savedProjects: 200,
    },
    benefits: [
      { title: "30 proposals per month", capabilityKey: "freelancer.proposal.submit", included: true, limit: 30, displayOrder: 1 },
      { title: "Advanced discovery filters", capabilityKey: "freelancer.project.browse", included: true, displayOrder: 2 },
      { title: "Workspace metrics & analytics", capabilityKey: "freelancer.analytics.view", included: true, displayOrder: 3 },
      { title: "Priority client visibility", capabilityKey: "freelancer.portfolio.manage", included: true, displayOrder: 4 },
      { title: "Priority email & chat support", capabilityKey: "support.priority", included: true, displayOrder: 5 },
    ],
    featuresTextList: [
      "30 proposals per month",
      "Advanced project discovery",
      "Workspace metrics & analytics",
      "Priority client visibility",
      "Priority support",
    ],
    sortOrder: 3,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },
  {
    name: "Freelancer Annual",
    code: "freelancer-annual",
    role: "freelancer",
    planCategory: "standard",
    shortDescription: "Enjoy year-long Freelancer access with an annual proposal allocation.",
    detailedDescription: "Full 1-year Freelancer workspace access with an annual pool of 36 proposals. Verified trust badge upon independent KYC.",
    amount: 3650,
    originalAmount: 4788,
    currency: "INR",
    savedBadge: "Just ₹10/day • Save 24%",
    validityValue: 1,
    validityUnit: "YEARS",
    durationString: "1_years",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      proposals: 36,
      savedProjects: 100,
    },
    benefits: [
      { title: "36 proposals per year pool", capabilityKey: "freelancer.proposal.submit", included: true, limit: 36, displayOrder: 1 },
      { title: "Full 1-year workspace access", capabilityKey: "freelancer.project.browse", included: true, displayOrder: 2 },
      { title: "Portfolio tools & visibility", capabilityKey: "freelancer.portfolio.manage", included: true, displayOrder: 3 },
      { title: "Verified trust badge upon KYC", capabilityKey: "profile.verified_badge", included: true, displayOrder: 4 },
      { title: "Save 24% vs monthly Starter", capabilityKey: "pricing.savings", included: true, displayOrder: 5 },
    ],
    featuresTextList: [
      "36 proposals per year pool",
      "Full 1-year workspace access",
      "Verified trust badge (upon KYC)",
      "Portfolio presentation tools",
      "Save 24% vs 12 months of Starter",
    ],
    sortOrder: 4,
    popular: true,
    recommended: true,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 2. CLIENT / BUSINESS PACKAGES
  // =========================================================================
  {
    name: "Client Starter",
    code: "client-starter",
    role: "client",
    planCategory: "standard",
    shortDescription: "Post projects and discover freelancers for your business requirements.",
    detailedDescription: "Entry-tier client workspace enabling up to 3 project posts per month and direct freelancer discovery.",
    amount: 499,
    originalAmount: 699,
    currency: "INR",
    savedBadge: "Starter Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      projectPosts: 3,
      savedFreelancers: 10,
    },
    benefits: [
      { title: "3 project posts per month", capabilityKey: "client.project.publish", included: true, limit: 3, displayOrder: 1 },
      { title: "Freelancer directory discovery", capabilityKey: "client.freelancer.browse", included: true, displayOrder: 2 },
      { title: "Basic project workspace", capabilityKey: "client.project.manage", included: true, displayOrder: 3 },
      { title: "Direct candidate messaging", capabilityKey: "client.messaging", included: true, displayOrder: 4 },
    ],
    featuresTextList: [
      "3 project posts per month",
      "Freelancer directory discovery",
      "Basic project workspace",
      "Direct applicant messaging",
    ],
    sortOrder: 5,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },
  {
    name: "Client Growth",
    code: "client-growth",
    role: "client",
    planCategory: "standard",
    shortDescription: "Manage more hiring opportunities and connect with suitable freelancers.",
    detailedDescription: "Growing business package supporting 10 project posts per month and talent shortlisting.",
    amount: 999,
    originalAmount: 1499,
    currency: "INR",
    savedBadge: "Growth Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      projectPosts: 10,
      savedFreelancers: 50,
      directInvitations: 20,
    },
    benefits: [
      { title: "10 project posts per month", capabilityKey: "client.project.publish", included: true, limit: 10, displayOrder: 1 },
      { title: "Saved freelancers & shortlists", capabilityKey: "client.freelancer.save", included: true, displayOrder: 2 },
      { title: "Direct candidate invitations", capabilityKey: "client.freelancer.invite", included: true, displayOrder: 3 },
      { title: "Enhanced project management", capabilityKey: "client.project.manage", included: true, displayOrder: 4 },
    ],
    featuresTextList: [
      "10 project posts per month",
      "Saved talent shortlists",
      "Direct candidate invitations",
      "Enhanced project workspace",
      "Standard hiring support",
    ],
    sortOrder: 6,
    popular: false,
    recommended: true,
    visibility: "public",
    status: "active",
  },
  {
    name: "Client Business",
    code: "client-business",
    role: "client",
    planCategory: "standard",
    shortDescription: "Support higher-volume project hiring with enhanced workspace tools.",
    detailedDescription: "High-volume recruitment package supporting 25 project posts per month and team collaboration tools.",
    amount: 1999,
    originalAmount: 2499,
    currency: "INR",
    savedBadge: "Business Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      projectPosts: 25,
      savedFreelancers: 200,
      directInvitations: 100,
    },
    benefits: [
      { title: "25 project posts per month", capabilityKey: "client.project.publish", included: true, limit: 25, displayOrder: 1 },
      { title: "Freelancer shortlists & tagging", capabilityKey: "client.freelancer.save", included: true, displayOrder: 2 },
      { title: "Hiring metrics & workspace analytics", capabilityKey: "client.analytics.view", included: true, displayOrder: 3 },
      { title: "Team collaboration (where supported)", capabilityKey: "team.collaborate", included: true, displayOrder: 4 },
    ],
    featuresTextList: [
      "25 project posts per month",
      "Freelancer shortlists & tagging",
      "Hiring metrics & analytics",
      "Team invitation support",
      "Priority customer support",
    ],
    sortOrder: 7,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },
  {
    name: "Client Annual",
    code: "client-annual",
    role: "client",
    planCategory: "standard",
    shortDescription: "Manage your business hiring requirements with an annual project-post allocation.",
    detailedDescription: "Full 1-year Client workspace access with an annual quota pool of 36 project posts. Save 39% vs monthly Starter.",
    amount: 3650,
    originalAmount: 5988,
    currency: "INR",
    savedBadge: "Save 39% • ₹10/day",
    validityValue: 1,
    validityUnit: "YEARS",
    durationString: "1_years",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      projectPosts: 36,
      savedFreelancers: 100,
      directInvitations: 50,
    },
    benefits: [
      { title: "36 project posts per year pool", capabilityKey: "client.project.publish", included: true, limit: 36, displayOrder: 1 },
      { title: "Full 1-year client workspace access", capabilityKey: "client.freelancer.browse", included: true, displayOrder: 2 },
      { title: "Freelancer discovery & shortlists", capabilityKey: "client.freelancer.save", included: true, displayOrder: 3 },
      { title: "Verified employer trust badge", capabilityKey: "profile.verified_badge", included: true, displayOrder: 4 },
      { title: "Save 39% vs monthly Starter", capabilityKey: "pricing.savings", included: true, displayOrder: 5 },
    ],
    featuresTextList: [
      "36 project posts per year pool",
      "Full 1-year workspace access",
      "Freelancer discovery & shortlists",
      "Verified employer trust badge",
      "Save 39% vs 12 months of Starter",
    ],
    sortOrder: 8,
    popular: true,
    recommended: true,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 3. INVESTOR PACKAGES (Full form: Expressions of Interest)
  // =========================================================================
  {
    name: "Investor Discover",
    code: "investor-discover",
    role: "investor",
    planCategory: "standard",
    shortDescription: "Explore promising startups and begin expressing investment interest.",
    detailedDescription: "Entry-level investor tier offering startup directory discovery and 1 Expression of Interest per month.",
    amount: 299,
    originalAmount: 399,
    currency: "INR",
    savedBadge: "Discover Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      expressionsOfInterest: 1,
      savedStartups: 5,
      founderIntroRequests: 0,
    },
    benefits: [
      { title: "1 Expression of Interest per month", capabilityKey: "investor.interest.express", included: true, limit: 1, displayOrder: 1 },
      { title: "5 saved startups watchlist", capabilityKey: "investor.startup.save", included: true, limit: 5, displayOrder: 2 },
      { title: "Sector & stage startup discovery", capabilityKey: "investor.startup.browse", included: true, displayOrder: 3 },
      { title: "Direct founder introductions", capabilityKey: "investor.founder.contact", included: false, displayOrder: 4 },
    ],
    featuresTextList: [
      "1 Expression of Interest per month",
      "5 saved startups watchlist",
      "Sector & stage startup discovery",
      "Browse verified public pitches",
    ],
    sortOrder: 9,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },
  {
    name: "Investor Connect",
    code: "investor-connect",
    role: "investor",
    planCategory: "standard",
    shortDescription: "Connect with startup founders through structured interest requests.",
    detailedDescription: "Active angel investor package supporting 5 Expressions of Interest and 5 founder intro requests per month.",
    amount: 399,
    originalAmount: 599,
    currency: "INR",
    savedBadge: "Connect Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      expressionsOfInterest: 5,
      savedStartups: 20,
      founderIntroRequests: 5,
    },
    benefits: [
      { title: "5 Expressions of Interest per month", capabilityKey: "investor.interest.express", included: true, limit: 5, displayOrder: 1 },
      { title: "5 founder intro requests per month", capabilityKey: "investor.founder.contact", included: true, limit: 5, displayOrder: 2 },
      { title: "20 saved startups watchlist", capabilityKey: "investor.startup.save", included: true, limit: 20, displayOrder: 3 },
      { title: "Startup shortlisting & alerts", capabilityKey: "investor.pipeline.manage", included: true, displayOrder: 4 },
    ],
    featuresTextList: [
      "5 Expressions of Interest per month",
      "5 founder intro requests per month",
      "20 saved startups watchlist",
      "Startup shortlisting & alerts",
      "Permitted founder messaging",
    ],
    sortOrder: 10,
    popular: false,
    recommended: true,
    visibility: "public",
    status: "active",
  },
  {
    name: "Investor Premium",
    code: "investor-premium",
    role: "investor",
    planCategory: "standard",
    shortDescription: "Evaluate more startups with expanded interest and investor tracking tools.",
    detailedDescription: "Comprehensive investor package offering 20 Expressions of Interest, 20 founder intro requests, and unlimited watchlists.",
    amount: 2999,
    originalAmount: 3999,
    currency: "INR",
    savedBadge: "Premium Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      expressionsOfInterest: 20,
      savedStartups: -1, // unlimited
      founderIntroRequests: 20,
    },
    benefits: [
      { title: "20 Expressions of Interest per month", capabilityKey: "investor.interest.express", included: true, limit: 20, displayOrder: 1 },
      { title: "20 founder intro requests per month", capabilityKey: "investor.founder.contact", included: true, limit: 20, displayOrder: 2 },
      { title: "Unlimited saved startups", capabilityKey: "investor.startup.save", included: true, displayOrder: 3 },
      { title: "Investment pipeline tracking", capabilityKey: "investor.pipeline.manage", included: true, displayOrder: 4 },
      { title: "Priority investor support", capabilityKey: "support.priority", included: true, displayOrder: 5 },
    ],
    featuresTextList: [
      "20 Expressions of Interest per month",
      "20 founder intro requests per month",
      "Unlimited saved startups",
      "Investment pipeline tracking",
      "Priority customer support",
    ],
    sortOrder: 11,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },
  {
    name: "Investor Annual",
    code: "investor-annual",
    role: "investor",
    planCategory: "standard",
    shortDescription: "Discover and connect with startups using an annual interest allocation.",
    detailedDescription: "Full 1-year Investor workspace access with 36 Expressions of Interest and 36 founder intro requests per year.",
    amount: 3650,
    originalAmount: 4788,
    currency: "INR",
    savedBadge: "Save 24% • ₹10/day",
    validityValue: 1,
    validityUnit: "YEARS",
    durationString: "1_years",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      expressionsOfInterest: 36,
      savedStartups: -1,
      founderIntroRequests: 36,
    },
    benefits: [
      { title: "36 Expressions of Interest per year pool", capabilityKey: "investor.interest.express", included: true, limit: 36, displayOrder: 1 },
      { title: "36 founder intro requests per year pool", capabilityKey: "investor.founder.contact", included: true, limit: 36, displayOrder: 2 },
      { title: "Unlimited saved startups", capabilityKey: "investor.startup.save", included: true, displayOrder: 3 },
      { title: "Verified investor badge upon accreditation", capabilityKey: "profile.verified_badge", included: true, displayOrder: 4 },
      { title: "Save 24% vs monthly Connect", capabilityKey: "pricing.savings", included: true, displayOrder: 5 },
    ],
    featuresTextList: [
      "36 Expressions of Interest per year pool",
      "36 founder intro requests per year pool",
      "Unlimited saved startups",
      "Full 1-year investor workspace access",
      "Verified investor trust badge",
    ],
    sortOrder: 12,
    popular: true,
    recommended: true,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 4. FOUNDER / STARTUP PACKAGES
  // =========================================================================
  {
    name: "Founder Starter",
    code: "founder-starter",
    role: "founder",
    planCategory: "standard",
    shortDescription: "Introduce your startup to investors with essential profile and pitch tools.",
    detailedDescription: "Entry-tier founder package allowing 1 active published startup pitch and pitch deck upload.",
    amount: 499,
    originalAmount: 699,
    currency: "INR",
    savedBadge: "Starter Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      activePublishedStartups: 1,
      investorContactRequests: 0,
    },
    benefits: [
      { title: "1 active published startup", capabilityKey: "founder.startup.publish", included: true, limit: 1, displayOrder: 1 },
      { title: "Basic startup profile presentation", capabilityKey: "founder.startup.manage", included: true, displayOrder: 2 },
      { title: "Pitch deck presentation upload", capabilityKey: "founder.pitchdeck.manage", included: true, displayOrder: 3 },
      { title: "Direct investor contact requests", capabilityKey: "founder.investor.contact", included: false, displayOrder: 4 },
    ],
    featuresTextList: [
      "1 active published startup pitch",
      "Basic startup profile",
      "Pitch deck presentation upload",
      "Receive inbound investor inquiries",
    ],
    sortOrder: 13,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },
  {
    name: "Founder Launchpad",
    code: "founder-launchpad",
    role: "founder",
    planCategory: "standard",
    shortDescription: "Present more startup opportunities and expand your investor outreach.",
    detailedDescription: "Fundraising founder package supporting 2 active published startups and 5 investor contact requests per month.",
    amount: 999,
    originalAmount: 1499,
    currency: "INR",
    savedBadge: "Launchpad Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      activePublishedStartups: 2,
      investorContactRequests: 5,
    },
    benefits: [
      { title: "2 active published startups", capabilityKey: "founder.startup.publish", included: true, limit: 2, displayOrder: 1 },
      { title: "5 investor contact requests per month", capabilityKey: "founder.investor.contact", included: true, limit: 5, displayOrder: 2 },
      { title: "Investor directory discovery", capabilityKey: "founder.investor.browse", included: true, displayOrder: 3 },
      { title: "Opportunity view analytics", capabilityKey: "founder.analytics.view", included: true, displayOrder: 4 },
    ],
    featuresTextList: [
      "2 active published startups",
      "5 investor contact requests per month",
      "Investor directory discovery",
      "Opportunity view analytics",
      "Standard customer support",
    ],
    sortOrder: 14,
    popular: false,
    recommended: true,
    visibility: "public",
    status: "active",
  },
  {
    name: "Founder Growth",
    code: "founder-growth",
    role: "founder",
    planCategory: "standard",
    shortDescription: "Manage multiple startup opportunities and organize investor connections.",
    detailedDescription: "High-volume founder package supporting up to 5 active published startups and 15 investor contact requests per month.",
    amount: 1999,
    originalAmount: 2499,
    currency: "INR",
    savedBadge: "Growth Tier",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      activePublishedStartups: 5,
      investorContactRequests: 15,
    },
    benefits: [
      { title: "5 active published startups", capabilityKey: "founder.startup.publish", included: true, limit: 5, displayOrder: 1 },
      { title: "15 investor contact requests per month", capabilityKey: "founder.investor.contact", included: true, limit: 15, displayOrder: 2 },
      { title: "Enhanced startup presentation", capabilityKey: "founder.startup.manage", included: true, displayOrder: 3 },
      { title: "Investor pipeline analytics", capabilityKey: "founder.analytics.view", included: true, displayOrder: 4 },
    ],
    featuresTextList: [
      "5 active published startups",
      "15 investor contact requests per month",
      "Enhanced startup presentation",
      "Investor pipeline analytics",
      "Priority customer support",
    ],
    sortOrder: 15,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },
  {
    name: "Founder Annual",
    code: "founder-annual",
    role: "founder",
    planCategory: "standard",
    shortDescription: "Maintain your startup presence throughout the year with an annual investor outreach allocation.",
    detailedDescription: "Full 1-year Founder workspace access with 1 active startup and an annual pool of 36 investor contact requests.",
    amount: 3650,
    originalAmount: 5988,
    currency: "INR",
    savedBadge: "Save 39% • ₹10/day",
    validityValue: 1,
    validityUnit: "YEARS",
    durationString: "1_years",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      activePublishedStartups: 1,
      investorContactRequests: 36,
    },
    benefits: [
      { title: "1 active published startup", capabilityKey: "founder.startup.publish", included: true, limit: 1, displayOrder: 1 },
      { title: "36 investor contact requests per year pool", capabilityKey: "founder.investor.contact", included: true, limit: 36, displayOrder: 2 },
      { title: "Full 1-year founder workspace access", capabilityKey: "founder.investor.browse", included: true, displayOrder: 3 },
      { title: "Verified founder trust badge", capabilityKey: "profile.verified_badge", included: true, displayOrder: 4 },
      { title: "Save 39% vs monthly Starter", capabilityKey: "pricing.savings", included: true, displayOrder: 5 },
    ],
    featuresTextList: [
      "1 active published startup pitch",
      "36 investor contact requests per year pool",
      "Full 1-year founder workspace access",
      "Verified founder trust badge",
      "Save 39% vs 12 months of Starter",
    ],
    sortOrder: 16,
    popular: true,
    recommended: true,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 5. FREE INTRO (Universal Primary Workspace)
  // =========================================================================
  {
    name: "6-Month Free Intro",
    code: "free-intro-6m",
    role: "all",
    planCategory: "trial",
    shortDescription: "Explore your primary Go Experts workspace during the introductory access period.",
    detailedDescription: "6 calendar months of platform access in your primary workspace with up to 36 proposals or 36 project posts.",
    amount: 0,
    originalAmount: 2394,
    currency: "INR",
    savedBadge: "100% Free For 6 Months",
    validityValue: 6,
    validityUnit: "MONTHS",
    durationString: "6_months",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      proposals: 36,
      projectPosts: 36,
      expressionsOfInterest: 5,
      activePublishedStartups: 1,
    },
    benefits: [
      { title: "6 calendar months primary workspace access", capabilityKey: "portal.access", included: true, displayOrder: 1 },
      { title: "Up to 36 proposals or 36 project posts", capabilityKey: "freelancer.proposal.submit", included: true, limit: 36, displayOrder: 2 },
      { title: "Verified badge upon KYC completion", capabilityKey: "profile.verified_badge", included: true, displayOrder: 3 },
      { title: "Requires KYC & 90% profile completeness", capabilityKey: "gate.kyc_profile", included: true, displayOrder: 4 },
    ],
    featuresTextList: [
      "6 calendar months primary workspace access",
      "Up to 36 proposals or 36 project posts",
      "Basic directory discovery & messaging",
      "Community & standard platform support",
    ],
    sortOrder: 0,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 6. SHARED ADD-ON PACKAGES (DASHBOARD ONLY — NOT ON PUBLIC PRICING)
  // =========================================================================
  {
    name: "Additional Role Add-on Monthly",
    code: "addon-monthly",
    role: "all",
    planCategory: "add_on",
    shortDescription: "Expand your Go Experts experience with paid benefits for one eligible secondary role.",
    detailedDescription: "Unlocks monthly quota in 1 explicitly activated secondary workspace. Does not automatically activate the role.",
    amount: 149,
    originalAmount: 199,
    currency: "INR",
    savedBadge: "Add Any 2nd Role",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      proposals: 3,
      projectPosts: 3,
      expressionsOfInterest: 3,
      savedStartups: 5,
      activePublishedStartups: 1,
      investorContactRequests: 5,
    },
    benefits: [
      { title: "Unlock 1 activated secondary workspace", capabilityKey: "addon.workspace_quota", included: true, displayOrder: 1 },
      { title: "+3 proposals (Freelancer) or +3 posts (Client)", capabilityKey: "addon.freelancer_client_quota", included: true, limit: 3, displayOrder: 2 },
      { title: "+3 Expressions of Interest (Investor)", capabilityKey: "investor.interest.express", included: true, limit: 3, displayOrder: 3 },
      { title: "+1 startup & +5 investor contacts (Founder)", capabilityKey: "founder.startup.publish", included: true, limit: 1, displayOrder: 4 },
    ],
    featuresTextList: [
      "Unlock 1 activated secondary workspace",
      "Shared account & billing profile",
      "Target role monthly quota added",
      "Requires explicit workspace activation",
    ],
    sortOrder: 17,
    popular: false,
    recommended: false,
    visibility: "hidden", // Hidden from public pricing!
    status: "active",
  },
  {
    name: "Additional Role Add-on Annual",
    code: "addon-annual",
    role: "all",
    planCategory: "add_on",
    shortDescription: "Expand your Go Experts experience with paid benefits for one eligible secondary role.",
    detailedDescription: "Unlocks 1 full year of quota in 1 explicitly activated secondary workspace. Save vs monthly add-on.",
    amount: 1499,
    originalAmount: 1788,
    currency: "INR",
    savedBadge: "Save ₹289/yr on 2nd Role",
    validityValue: 1,
    validityUnit: "YEARS",
    durationString: "1_years",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      proposals: 36,
      projectPosts: 36,
      expressionsOfInterest: 36,
      savedStartups: 50,
      activePublishedStartups: 1,
      investorContactRequests: 36,
    },
    benefits: [
      { title: "Unlock 1 activated secondary workspace for 1 year", capabilityKey: "addon.workspace_quota", included: true, displayOrder: 1 },
      { title: "+36 proposals (Freelancer) or +36 posts (Client)", capabilityKey: "addon.freelancer_client_quota", included: true, limit: 36, displayOrder: 2 },
      { title: "+36 Expressions of Interest (Investor)", capabilityKey: "investor.interest.express", included: true, limit: 36, displayOrder: 3 },
      { title: "+1 startup & +36 investor contacts (Founder)", capabilityKey: "founder.startup.publish", included: true, limit: 1, displayOrder: 4 },
    ],
    featuresTextList: [
      "Unlock 1 activated secondary workspace for 1 year",
      "Shared account & billing profile",
      "Target role annual quota pool added",
      "Requires explicit workspace activation",
    ],
    sortOrder: 18,
    popular: false,
    recommended: false,
    visibility: "hidden", // Hidden from public pricing!
    status: "active",
  },

  // =========================================================================
  // 7. ALL ACCESS (Model A: Retained as Working Design — Pending Sign-off)
  // =========================================================================
  {
    name: "Go Experts All Access Monthly",
    code: "all-access-monthly",
    role: "all",
    planCategory: "all_access",
    shortDescription: "Manage eligible workspaces through a single multi-role subscription bundle.",
    detailedDescription: "Commercial bundle granting modest starter quotas across all four roles upon explicit workspace activation. Does not bypass KYC.",
    amount: 699,
    originalAmount: 899,
    currency: "INR",
    savedBadge: "4 Workspaces Included",
    validityValue: 1,
    validityUnit: "MONTHS",
    durationString: "1_months",
    quotaResetPolicy: "CALENDAR_MONTHLY",
    quotas: {
      proposals: 6,
      projectPosts: 5,
      expressionsOfInterest: 3,
      savedStartups: 10,
      activePublishedStartups: 1,
      investorContactRequests: 5,
    },
    benefits: [
      { title: "Access across all 4 workspaces upon activation", capabilityKey: "all_access.workspaces", included: true, displayOrder: 1 },
      { title: "6 proposals per month (Freelancer)", capabilityKey: "freelancer.proposal.submit", included: true, limit: 6, displayOrder: 2 },
      { title: "5 project posts per month (Client)", capabilityKey: "client.project.publish", included: true, limit: 5, displayOrder: 3 },
      { title: "3 Expressions of Interest & 10 saved (Investor)", capabilityKey: "investor.interest.express", included: true, limit: 3, displayOrder: 4 },
      { title: "1 active startup & 5 investor contacts (Founder)", capabilityKey: "founder.startup.publish", included: true, limit: 1, displayOrder: 5 },
    ],
    featuresTextList: [
      "Multi-role starter access bundle",
      "6 proposals & 5 project posts / mo",
      "3 Expressions of Interest & 10 saved startups / mo",
      "1 active startup & 5 investor contacts / mo",
      "Requires explicit role activation",
    ],
    sortOrder: 19,
    popular: false,
    recommended: false,
    visibility: "hidden", // Hidden from public pricing until authorized!
    status: "active",
  },
  {
    name: "Go Experts All Access Annual",
    code: "all-access-annual",
    role: "all",
    planCategory: "all_access",
    shortDescription: "Manage eligible workspaces through a single multi-role subscription bundle.",
    detailedDescription: "Annual version of All Access Model A providing 1 full year of starter quotas across all four explicitly activated roles.",
    amount: 6999,
    originalAmount: 8388,
    currency: "INR",
    savedBadge: "Best Cross-Role Value",
    validityValue: 1,
    validityUnit: "YEARS",
    durationString: "1_years",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      proposals: 72,
      projectPosts: 60,
      expressionsOfInterest: 36,
      savedStartups: 120,
      activePublishedStartups: 1,
      investorContactRequests: 60,
    },
    benefits: [
      { title: "Access across all 4 workspaces for 1 full year", capabilityKey: "all_access.workspaces", included: true, displayOrder: 1 },
      { title: "72 proposals per year (Freelancer)", capabilityKey: "freelancer.proposal.submit", included: true, limit: 72, displayOrder: 2 },
      { title: "60 project posts per year (Client)", capabilityKey: "client.project.publish", included: true, limit: 60, displayOrder: 3 },
      { title: "36 Expressions of Interest & 120 saved (Investor)", capabilityKey: "investor.interest.express", included: true, limit: 36, displayOrder: 4 },
      { title: "1 active startup & 60 investor contacts (Founder)", capabilityKey: "founder.startup.publish", included: true, limit: 1, displayOrder: 5 },
    ],
    featuresTextList: [
      "Full 1-year multi-role access",
      "72 proposals & 60 project posts / yr",
      "36 Expressions of Interest / yr",
      "1 active startup & 60 investor contacts / yr",
      "Save ₹1,389 vs monthly billing",
    ],
    sortOrder: 20,
    popular: false,
    recommended: false,
    visibility: "hidden", // Hidden from public pricing!
    status: "active",
  },
];

/**
 * Hydrates a Prisma SubscriptionPlan record into a rich canonical plan object.
 * Parses limits (JSON) and features (JSON).
 */
export function hydratePlanFromDb(dbPlan: any): CanonicalPlanDefinition {
  let limitsObj: any = {};
  if (typeof dbPlan.limits === "string") {
    try {
      limitsObj = JSON.parse(dbPlan.limits);
    } catch {
      limitsObj = {};
    }
  } else if (typeof dbPlan.limits === "object" && dbPlan.limits !== null) {
    limitsObj = dbPlan.limits;
  }

  let featuresList: string[] = [];
  if (typeof dbPlan.features === "string") {
    try {
      featuresList = JSON.parse(dbPlan.features);
    } catch {
      featuresList = [];
    }
  } else if (Array.isArray(dbPlan.features)) {
    featuresList = dbPlan.features;
  }

  // Find canonical blueprint if exists
  const blueprint = CANONICAL_PLANS.find(
    (p) => p.name.toLowerCase() === dbPlan.name?.toLowerCase() || p.code === dbPlan.name?.toLowerCase().replace(/\s+/g, "-")
  );

  const validityValue = Number(limitsObj.validityValue ?? blueprint?.validityValue ?? 1);
  const validityUnit = (limitsObj.validityUnit ?? blueprint?.validityUnit ?? "MONTHS") as ValidityUnit;
  const quotaResetPolicy = (limitsObj.quotaResetPolicy ?? blueprint?.quotaResetPolicy ?? "CALENDAR_MONTHLY") as QuotaResetPolicy;

  const quotas: PlanQuotas = {
    proposals: dbPlan.proposalsLimit ?? limitsObj.proposals ?? blueprint?.quotas?.proposals ?? 3,
    savedProjects: limitsObj.savedProjects ?? blueprint?.quotas?.savedProjects ?? 0,
    projectPosts: dbPlan.projectsLimit ?? limitsObj.projectPosts ?? blueprint?.quotas?.projectPosts ?? 3,
    savedFreelancers: limitsObj.savedFreelancers ?? blueprint?.quotas?.savedFreelancers ?? 0,
    directInvitations: limitsObj.directInvitations ?? blueprint?.quotas?.directInvitations ?? 0,
    expressionsOfInterest: limitsObj.expressionsOfInterest ?? blueprint?.quotas?.expressionsOfInterest ?? 0,
    savedStartups: limitsObj.savedStartups ?? blueprint?.quotas?.savedStartups ?? 0,
    founderIntroRequests: limitsObj.founderIntroRequests ?? blueprint?.quotas?.founderIntroRequests ?? 0,
    activePublishedStartups: limitsObj.activePublishedStartups ?? blueprint?.quotas?.activePublishedStartups ?? 0,
    investorContactRequests: limitsObj.investorContactRequests ?? blueprint?.quotas?.investorContactRequests ?? 0,
  };

  const benefits: PlanBenefitItem[] = limitsObj.benefits ?? blueprint?.benefits ?? [];

  return {
    id: dbPlan.id,
    name: dbPlan.name,
    code: blueprint?.code ?? dbPlan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    role: dbPlan.role,
    planCategory: (dbPlan.planType as any) ?? blueprint?.planCategory ?? "standard",
    shortDescription: limitsObj.shortDescription ?? blueprint?.shortDescription ?? "Access to Go Experts platform workspace.",
    detailedDescription: limitsObj.detailedDescription ?? blueprint?.detailedDescription,
    amount: dbPlan.amount,
    originalAmount: dbPlan.originalAmount ?? blueprint?.originalAmount,
    currency: dbPlan.currency || "INR",
    savedBadge: dbPlan.savedBadge ?? blueprint?.savedBadge,
    validityValue,
    validityUnit,
    durationString: dbPlan.duration || blueprint?.durationString || `${validityValue}_${validityUnit.toLowerCase()}`,
    quotaResetPolicy,
    quotaResetValue: limitsObj.quotaResetValue ?? blueprint?.quotaResetValue,
    quotaResetUnit: limitsObj.quotaResetUnit ?? blueprint?.quotaResetUnit,
    quotas,
    benefits,
    featuresTextList: featuresList.length > 0 ? featuresList : (blueprint?.featuresTextList ?? []),
    sortOrder: dbPlan.sortOrder ?? blueprint?.sortOrder ?? 0,
    popular: Boolean(dbPlan.popular ?? blueprint?.popular),
    recommended: Boolean(dbPlan.recommended ?? blueprint?.recommended),
    visibility: dbPlan.visibility ?? blueprint?.visibility ?? "public",
    status: (dbPlan.status as any) ?? blueprint?.status ?? "active",
  };
}
