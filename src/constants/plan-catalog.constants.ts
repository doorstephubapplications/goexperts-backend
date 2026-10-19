import { ValidityUnit, QuotaResetPolicy } from "../utils/date-arithmetic.util.js";

export type RoleKey = "freelancer" | "client" | "investor" | "founder" | "all";
export type PlanCategory = "standard" | "add_on" | "all_access" | "trial";
export type PlanStatus = "draft" | "active" | "hidden" | "archived";

export interface PlanBenefitItem {
  title: string;
  explanation?: string;
  capabilityKey?: string;
  included: boolean;
  limit?: number | string;
  displayOrder: number;
}

export interface PlanQuotas {
  // Primary Universal & Cross-Role Quotas
  connectionInvitations?: number;
  freelancerConnections?: number;
  tasksPerProject?: number;
  totalTasks?: number | string; // e.g. 10 or "REQUIRES_BUSINESS_CONFIRMATION"
  watchlistCapacity?: number;
  teamMembers?: number;
  teamSeats?: number;
  upgradeDiscountMax?: number;
  oneTimeReferralReward?: boolean;
  recurringCashbackEligible?: boolean;

  // Freelancer specific
  proposals?: number;
  savedProjects?: number;
  
  // Client specific
  projectPosts?: number;
  savedFreelancers?: number;
  directInvitations?: number;

  // Investor specific
  expressionsOfInterest?: number;
  savedStartups?: number;
  founderIntroRequests?: number;

  // Founder specific
  activePublishedStartups?: number;
  investorContactRequests?: number;
}

export interface NoRefundPolicyMetadata {
  statement: string;
  short: string;
  checkoutAcknowledgement: string;
  policyUrl: string;
}

export interface CanonicalPlanDefinition {
  id?: string;
  name: string;
  displayName?: string;
  fullName?: string;
  code: string;
  role: RoleKey;
  eligibleRoles?: RoleKey[];
  planCategory: PlanCategory;
  tagline?: string;
  shortDescription: string;
  detailedDescription?: string;
  amount: number;
  originalAmount?: number;
  currency: string;
  savedBadge?: string;

  // Admin-configurable validity
  validityValue: number;
  validityUnit: ValidityUnit;
  durationString: string; // e.g. "90_days", "30_days", "180_days", "365_days"

  // Quota reset configuration
  quotaResetPolicy: QuotaResetPolicy;
  quotaResetValue?: number;
  quotaResetUnit?: ValidityUnit;

  // Role-specific quotas
  quotas: PlanQuotas;

  // Structured benefits
  benefits: PlanBenefitItem[];
  featuresTextList: string[]; // text summaries for user-facing renders

  // No-refund policy specification
  noRefundPolicy?: NoRefundPolicyMetadata;

  sortOrder: number;
  popular: boolean;
  recommended: boolean;
  visibility: "public" | "hidden";
  status: PlanStatus;
}

export const STANDARD_NO_REFUND_POLICY: NoRefundPolicyMetadata = {
  statement: "No-Refund Policy: Subscription fees are non-refundable once the subscription is activated, except where a refund is required by applicable law or expressly provided under the Go Experts Refund Policy.",
  short: "Non-refundable subscription. Terms and applicable legal exceptions apply.",
  checkoutAcknowledgement: "I have reviewed and agree to the Subscription Terms and Refund Policy, including the non-refundable subscription conditions and applicable exceptions.",
  policyUrl: "/legal/refund-policy",
};

export const CANONICAL_PLANS: CanonicalPlanDefinition[] = [
  // =========================================================================
  // 1. FREEDOM PLAN (Client & Investor — 90 Days)
  // =========================================================================
  {
    name: "Freedom",
    displayName: "Freedom",
    code: "freedom",
    role: "client",
    eligibleRoles: ["client", "investor"],
    planCategory: "trial",
    tagline: "START CONNECTING, COLLABORATING AND EXPLORING OPPORTUNITIES.",
    shortDescription: "Enjoy 90-day free access to essential Go Experts networking and project management tools.",
    detailedDescription: "START CONNECTING, COLLABORATING AND EXPLORING OPPORTUNITIES.",
    amount: 0,
    originalAmount: 0,
    currency: "INR",
    savedBadge: "Free 90-Day Access",
    validityValue: 90,
    validityUnit: "DAYS",
    durationString: "90_days",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      connectionInvitations: 25,
      freelancerConnections: 5,
      directInvitations: 25,
      savedFreelancers: 5,
      projectPosts: 5,
      tasksPerProject: 2,
      totalTasks: 10,
      watchlistCapacity: 10,
      teamMembers: 0,
      upgradeDiscountMax: 0,
      oneTimeReferralReward: true,
      recurringCashbackEligible: false,
    },
    benefits: [
      {
        displayOrder: 1,
        title: "90-Day Free Access",
        explanation: "Enjoy access to essential Go Experts networking and project management features for 90 days.",
        capabilityKey: "plan.validity",
        included: true,
        limit: 90,
      },
      {
        displayOrder: 2,
        title: "25 Connection Invitations",
        explanation: "Send up to 25 professional connection invitations to Freelancers, Clients, Founders and Investors during your plan period.",
        capabilityKey: "connection_invitations",
        included: true,
        limit: 25,
      },
      {
        displayOrder: 3,
        title: "Connect with 5 Freelancers",
        explanation: "Build professional connections with up to 5 freelancers, explore their profiles and access available hiring options.",
        capabilityKey: "freelancer_connections",
        included: true,
        limit: 5,
      },
      {
        displayOrder: 4,
        title: "Direct Messaging Included",
        explanation: "Chat with your eligible professional connections at no additional subscription charge.",
        capabilityKey: "direct_messaging",
        included: true,
      },
      {
        displayOrder: 5,
        title: "Post Up to 5 Projects",
        explanation: "Publish up to 5 projects to discover skilled professionals.",
        capabilityKey: "project_posts",
        included: true,
        limit: 5,
      },
      {
        displayOrder: 6,
        title: "Create Up to 10 Tasks",
        explanation: "Add up to 2 tasks per project, with a maximum of 10 tasks during your 90-day plan.",
        capabilityKey: "tasks_per_project",
        included: true,
        limit: 10,
      },
      {
        displayOrder: 7,
        title: "Email & Chat Support",
        explanation: "Get assistance from the Go Experts support team.",
        capabilityKey: "support_access",
        included: true,
      },
      {
        displayOrder: 8,
        title: "₹25 Referral Reward",
        explanation: "Earn a one-time ₹25 cashback reward when an eligible referred user successfully completes their profile.",
        capabilityKey: "referral_onetime_reward",
        included: true,
      },
      {
        displayOrder: 9,
        title: "Save Up to 10 Items",
        explanation: "Bookmark profiles, projects and startups for quick access later.",
        capabilityKey: "watchlist_capacity",
        included: true,
        limit: 10,
      },
    ],
    featuresTextList: [
      "90-Day Free Access across all 4 roles",
      "25 Connection Invitations to all professionals",
      "Connect with up to 5 Freelancers",
      "Direct Messaging with eligible connections",
      "Post Up to 5 Projects",
      "Create Up to 10 Tasks (max 2 per project)",
      "Email & Chat Support from Go Experts team",
      "₹25 One-Time Referral Reward per qualified profile",
      "Save Up to 10 Items (profiles, projects, startups)",
    ],
    noRefundPolicy: STANDARD_NO_REFUND_POLICY,
    sortOrder: 1,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 2. STARTER PLAN (Client & Investor)
  // =========================================================================
  {
    name: "Starter",
    code: "starter",
    role: "client",
    eligibleRoles: ["client", "investor"],
    planCategory: "standard",
    tagline: "GROW YOUR NETWORK AND MANAGE YOUR FIRST PROJECTS.",
    shortDescription: "Grow your network across all roles and manage your first projects with 30-day access.",
    detailedDescription: "GROW YOUR NETWORK AND MANAGE YOUR FIRST PROJECTS.",
    amount: 365,
    originalAmount: 499,
    currency: "INR",
    savedBadge: "Starter Tier",
    validityValue: 30,
    validityUnit: "DAYS",
    durationString: "30_days",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      connectionInvitations: 30,
      freelancerConnections: 10,
      directInvitations: 30,
      savedFreelancers: 10,
      projectPosts: 5,
      tasksPerProject: 2,
      totalTasks: 10,
      watchlistCapacity: 15,
      teamMembers: 0,
      upgradeDiscountMax: 50,
      oneTimeReferralReward: true,
      recurringCashbackEligible: true,
    },
    benefits: [
      {
        displayOrder: 1,
        title: "30-Day Access",
        explanation: "Enjoy 30 days of Starter Plan benefits.",
        capabilityKey: "plan.validity",
        included: true,
        limit: 30,
      },
      {
        displayOrder: 2,
        title: "30 Connection Invitations",
        explanation: "Reach out to up to 30 professionals across all four user roles.",
        capabilityKey: "connection_invitations",
        included: true,
        limit: 30,
      },
      {
        displayOrder: 3,
        title: "Connect with 10 Freelancers",
        explanation: "Discover freelancer profiles, build connections and explore hiring opportunities.",
        capabilityKey: "freelancer_connections",
        included: true,
        limit: 10,
      },
      {
        displayOrder: 4,
        title: "Direct Messaging Included",
        explanation: "Communicate with eligible professional connections without additional chat charges.",
        capabilityKey: "direct_messaging",
        included: true,
      },
      {
        displayOrder: 5,
        title: "Post Up to 5 Projects",
        explanation: "Publish projects and connect with suitable talent.",
        capabilityKey: "project_posts",
        included: true,
        limit: 5,
      },
      {
        displayOrder: 6,
        title: "Create Up to 10 Tasks",
        explanation: "Organize your projects with up to 2 tasks per project and 10 total tasks during the plan.",
        capabilityKey: "tasks_per_project",
        included: true,
        limit: 10,
      },
      {
        displayOrder: 7,
        title: "Email & Chat Support",
        explanation: "Access assistance from the Go Experts team.",
        capabilityKey: "support_access",
        included: true,
      },
      {
        displayOrder: 8,
        title: "Exclusive Upgrade Offers",
        explanation: "Receive eligible upgrade or switching discounts of up to 50% when available.",
        capabilityKey: "upgrade_discount",
        included: true,
        limit: 50,
      },
      {
        displayOrder: 9,
        title: "Recurring Referral Rewards",
        explanation: "Earn recurring referral cashback of 5% based on your own eligible paid subscription price excluding GST, prorated for the qualifying subscription period.",
        capabilityKey: "referral_recurring_cashback",
        included: true,
      },
      {
        displayOrder: 10,
        title: "Save Up to 15 Items",
        explanation: "Bookmark professionals, projects and startup opportunities.",
        capabilityKey: "watchlist_capacity",
        included: true,
        limit: 15,
      },
    ],
    featuresTextList: [
      "30-Day Access to Starter Plan benefits",
      "30 Connection Invitations across all 4 roles",
      "Connect with up to 10 Freelancers",
      "Direct Messaging Included",
      "Post Up to 5 Projects",
      "Create Up to 10 Tasks (max 2 per project)",
      "Email & Chat Support",
      "Exclusive Upgrade Offers of up to 50%",
      "5% Recurring Referral Cashback on base plan price",
      "Save Up to 15 Items (professionals, projects, startups)",
    ],
    noRefundPolicy: STANDARD_NO_REFUND_POLICY,
    sortOrder: 2,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 3. STANDARD PLAN (Client & Investor — 180 Days)
  // =========================================================================
  {
    name: "Standard",
    displayName: "Standard",
    code: "standard-client-investor",
    role: "client",
    eligibleRoles: ["client", "investor"],
    planCategory: "standard",
    tagline: "EXPAND YOUR PROFESSIONAL NETWORK AND COLLABORATE WITH YOUR TEAM.",
    shortDescription: "Expand your professional network and collaborate with team members for 180 days.",
    detailedDescription: "EXPAND YOUR PROFESSIONAL NETWORK AND COLLABORATE WITH YOUR TEAM.",
    amount: 1499,
    originalAmount: 1999,
    currency: "INR",
    savedBadge: "Most Popular",
    validityValue: 180,
    validityUnit: "DAYS",
    durationString: "180_days",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      connectionInvitations: 90,
      freelancerConnections: 45,
      directInvitations: 90,
      savedFreelancers: 45,
      projectPosts: 12,
      tasksPerProject: 2,
      totalTasks: "REQUIRES_BUSINESS_CONFIRMATION", // Flagged ambiguity: 10 vs 24
      watchlistCapacity: 45,
      teamMembers: 2,
      upgradeDiscountMax: 50,
      oneTimeReferralReward: true,
      recurringCashbackEligible: true,
    },
    benefits: [
      {
        displayOrder: 1,
        title: "180-Day Access",
        explanation: "Get six months of Standard Plan benefits.",
        capabilityKey: "plan.validity",
        included: true,
        limit: 180,
      },
      {
        displayOrder: 2,
        title: "90 Connection Invitations",
        explanation: "Connect with professionals across Freelancer, Client, Founder and Investor communities.",
        capabilityKey: "connection_invitations",
        included: true,
        limit: 90,
      },
      {
        displayOrder: 3,
        title: "Connect with 45 Freelancers",
        explanation: "Explore profiles, build your talent network and identify suitable professionals.",
        capabilityKey: "freelancer_connections",
        included: true,
        limit: 45,
      },
      {
        displayOrder: 4,
        title: "Direct Messaging Included",
        explanation: "Stay connected through Go Experts messaging.",
        capabilityKey: "direct_messaging",
        included: true,
      },
      {
        displayOrder: 5,
        title: "Post Up to 12 Projects",
        explanation: "Publish more opportunities and reach suitable professionals.",
        capabilityKey: "project_posts",
        included: true,
        limit: 12,
      },
      {
        displayOrder: 6,
        title: "Project Task Management",
        explanation: "Create up to 2 tasks per project, subject to your plan's overall task allowance.",
        capabilityKey: "tasks_per_project",
        included: true,
        limit: 2,
      },
      {
        displayOrder: 7,
        title: "Team Access for Up to 2 Members",
        explanation: "Invite and manage up to 2 team members with role-based access.",
        capabilityKey: "team_members",
        included: true,
        limit: 2,
      },
      {
        displayOrder: 8,
        title: "Email & Chat Support",
        explanation: "Receive assistance from the Go Experts team.",
        capabilityKey: "support_access",
        included: true,
      },
      {
        displayOrder: 9,
        title: "Exclusive Upgrade Offers",
        explanation: "Access eligible upgrade or switching discounts of up to 50%.",
        capabilityKey: "upgrade_discount",
        included: true,
        limit: 50,
      },
      {
        displayOrder: 10,
        title: "Recurring Referral Rewards",
        explanation: "Earn recurring referral cashback of 5% based on your own eligible paid subscription price excluding GST, prorated for the qualifying subscription period.",
        capabilityKey: "referral_recurring_cashback",
        included: true,
      },
      {
        displayOrder: 11,
        title: "Save Up to 45 Items",
        explanation: "Organize bookmarked profiles, projects and startups.",
        capabilityKey: "watchlist_capacity",
        included: true,
        limit: 45,
      },
    ],
    featuresTextList: [
      "180-Day Access (6 Months of benefits)",
      "90 Connection Invitations across all 4 roles",
      "Connect with up to 45 Freelancers",
      "Direct Messaging Included",
      "Post Up to 12 Projects",
      "Project Task Management (max 2 per project)",
      "Team Access for Up to 2 Members",
      "Email & Chat Support",
      "Exclusive Upgrade Offers of up to 50%",
      "5% Recurring Referral Cashback on base plan price",
      "Save Up to 45 Items (profiles, projects, startups)",
    ],
    noRefundPolicy: STANDARD_NO_REFUND_POLICY,
    sortOrder: 3,
    popular: true,
    recommended: true,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 4. BUSINESS PLAN (Client & Investor)
  // =========================================================================
  {
    name: "Business",
    code: "business",
    role: "client",
    eligibleRoles: ["client", "investor"],
    planCategory: "standard",
    tagline: "BUILD LONG-TERM PROFESSIONAL RELATIONSHIPS AND MANAGE MORE PROJECTS.",
    shortDescription: "Build long-term professional relationships and manage a large project portfolio for a full year.",
    detailedDescription: "BUILD LONG-TERM PROFESSIONAL RELATIONSHIPS AND MANAGE MORE PROJECTS.",
    amount: 3650,
    originalAmount: 4999,
    currency: "INR",
    savedBadge: "Best Enterprise Value",
    validityValue: 365,
    validityUnit: "DAYS",
    durationString: "365_days",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      connectionInvitations: 365,
      freelancerConnections: 100,
      directInvitations: 365,
      savedFreelancers: 100,
      projectPosts: 50,
      tasksPerProject: 5,
      totalTasks: "REQUIRES_BUSINESS_CONFIRMATION", // Flagged ambiguity: 10 vs 250
      watchlistCapacity: 100,
      teamMembers: 5,
      upgradeDiscountMax: 50,
      oneTimeReferralReward: true,
      recurringCashbackEligible: true,
    },
    benefits: [
      {
        displayOrder: 1,
        title: "365-Day Access",
        explanation: "Enjoy a full year of Business Plan benefits.",
        capabilityKey: "plan.validity",
        included: true,
        limit: 365,
      },
      {
        displayOrder: 2,
        title: "365 Connection Invitations",
        explanation: "Expand your network across all four Go Experts user roles.",
        capabilityKey: "connection_invitations",
        included: true,
        limit: 365,
      },
      {
        displayOrder: 3,
        title: "Connect with 100 Freelancers",
        explanation: "Build a larger professional talent network and explore hiring opportunities.",
        capabilityKey: "freelancer_connections",
        included: true,
        limit: 100,
      },
      {
        displayOrder: 4,
        title: "Direct Messaging Included",
        explanation: "Communicate with eligible professional connections without additional chat charges.",
        capabilityKey: "direct_messaging",
        included: true,
      },
      {
        displayOrder: 5,
        title: "Post Up to 50 Projects",
        explanation: "Manage a larger portfolio of opportunities throughout your annual subscription.",
        capabilityKey: "project_posts",
        included: true,
        limit: 50,
      },
      {
        displayOrder: 6,
        title: "Advanced Task Management",
        explanation: "Create up to 5 tasks per project, subject to your overall task allowance.",
        capabilityKey: "tasks_per_project",
        included: true,
        limit: 5,
      },
      {
        displayOrder: 7,
        title: "Team Access for Up to 5 Members",
        explanation: "Invite team members and manage their access according to assigned permissions.",
        capabilityKey: "team_members",
        included: true,
        limit: 5,
      },
      {
        displayOrder: 8,
        title: "Email & Chat Support",
        explanation: "Access support from the Go Experts team.",
        capabilityKey: "support_access",
        included: true,
      },
      {
        displayOrder: 9,
        title: "Exclusive Upgrade Offers",
        explanation: "Receive eligible plan upgrade or switching discounts of up to 50%.",
        capabilityKey: "upgrade_discount",
        included: true,
        limit: 50,
      },
      {
        displayOrder: 10,
        title: "Recurring Referral Rewards",
        explanation: "Earn recurring referral cashback of 5% based on your own eligible paid subscription price excluding GST, prorated for the qualifying subscription period.",
        capabilityKey: "referral_recurring_cashback",
        included: true,
      },
      {
        displayOrder: 11,
        title: "Save Up to 100 Items",
        explanation: "Keep important professionals, projects and startup opportunities organized.",
        capabilityKey: "watchlist_capacity",
        included: true,
        limit: 100,
      },
    ],
    featuresTextList: [
      "365-Day Access (Full Year of benefits)",
      "365 Connection Invitations across all 4 roles",
      "Connect with up to 100 Freelancers",
      "Direct Messaging Included",
      "Post Up to 50 Projects",
      "Advanced Task Management (max 5 per project)",
      "Team Access for Up to 5 Members",
      "Email & Chat Support",
      "Exclusive Upgrade Offers of up to 50%",
      "5% Recurring Referral Cashback on base plan price",
      "Save Up to 100 Items (profiles, projects, startups)",
    ],
    noRefundPolicy: STANDARD_NO_REFUND_POLICY,
    sortOrder: 4,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 5. FREEDOM PLAN (Freelancer & Startup Founder — 60 Days)
  // =========================================================================
  {
    name: "Freedom (Freelancer & Founder)",
    displayName: "Freedom",
    code: "freedom-freelancer-founder",
    role: "freelancer",
    eligibleRoles: ["freelancer", "founder"],
    planCategory: "trial",
    tagline: "Explore opportunities, build connections and get started with Go Experts.",
    shortDescription: "Explore essential Go Experts networking, collaboration and project management features for 60 days.",
    detailedDescription: "Explore opportunities, build connections and get started with Go Experts.",
    amount: 0,
    originalAmount: 0,
    currency: "INR",
    savedBadge: "Free 60-Day Access",
    validityValue: 60,
    validityUnit: "DAYS",
    durationString: "60_days",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      connectionInvitations: 25,
      freelancerConnections: 5,
      directInvitations: 25,
      savedFreelancers: 5,
      projectPosts: 5,
      tasksPerProject: 2,
      totalTasks: 10,
      watchlistCapacity: 10,
      teamMembers: 0,
      upgradeDiscountMax: 0,
      oneTimeReferralReward: true,
      recurringCashbackEligible: false,
    },
    benefits: [
      {
        displayOrder: 1,
        title: "60-Day Free Access",
        explanation: "Explore essential Go Experts networking, collaboration and project management features for 60 days.",
        capabilityKey: "plan.validity",
        included: true,
        limit: 60,
      },
      {
        displayOrder: 2,
        title: "25 Connection Invitations",
        explanation: "Send up to 25 invitations to professionals across all four user roles.",
        capabilityKey: "connection_invitations",
        included: true,
        limit: 25,
      },
      {
        displayOrder: 3,
        title: "Connect with 5 Freelancers",
        explanation: "Build connections with up to 5 freelancers and explore their professional profiles.",
        capabilityKey: "freelancer_connections",
        included: true,
        limit: 5,
      },
      {
        displayOrder: 4,
        title: "Direct Messaging Included",
        explanation: "Chat with eligible professional connections at no additional subscription charge.",
        capabilityKey: "direct_messaging",
        included: true,
      },
      {
        displayOrder: 5,
        title: "Post Up to 5 Projects",
        explanation: "Publish projects and discover skilled professionals.",
        capabilityKey: "project_posts",
        included: true,
        limit: 5,
      },
      {
        displayOrder: 6,
        title: "Create Up to 10 Tasks",
        explanation: "Add up to 2 tasks per project, with 10 task creations available during your plan.",
        capabilityKey: "tasks_per_project",
        included: true,
        limit: 10,
      },
      {
        displayOrder: 7,
        title: "Email & Chat Support",
        explanation: "Get assistance from the Go Experts support team.",
        capabilityKey: "support_access",
        included: true,
      },
      {
        displayOrder: 8,
        title: "₹25 One-Time Referral Reward",
        explanation: "Earn ₹25 when a directly referred user successfully completes their profile.",
        capabilityKey: "referral_onetime_reward",
        included: true,
      },
      {
        displayOrder: 9,
        title: "Save Up to 10 Items",
        explanation: "Bookmark profiles, projects and startup opportunities.",
        capabilityKey: "watchlist_capacity",
        included: true,
        limit: 10,
      },
    ],
    featuresTextList: [
      "60-Day Free Access to essential networking & collaboration features",
      "25 Connection Invitations across all four user roles",
      "Connect with up to 5 Freelancers",
      "Direct Messaging Included at no additional subscription charge",
      "Post Up to 5 Projects to discover skilled professionals",
      "Create Up to 10 Tasks (max 2 per project)",
      "Email & Chat Support from Go Experts team",
      "₹25 One-Time Referral Reward per qualified profile completion",
      "Save Up to 10 Items (profiles, projects, startup opportunities)",
    ],
    noRefundPolicy: STANDARD_NO_REFUND_POLICY,
    sortOrder: 5,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 6. BEGINNER PLAN (Freelancer & Startup Founder — 30 Days)
  // =========================================================================
  {
    name: "Beginner",
    displayName: "Beginner",
    code: "beginner",
    role: "freelancer",
    eligibleRoles: ["freelancer", "founder"],
    planCategory: "standard",
    tagline: "Start building your professional network and turn opportunities into meaningful collaborations.",
    shortDescription: "Enjoy a full month of Beginner Plan benefits with 30-day access.",
    detailedDescription: "Start building your professional network and turn opportunities into meaningful collaborations.",
    amount: 499,
    originalAmount: 699,
    currency: "INR",
    savedBadge: "Beginner Tier",
    validityValue: 30,
    validityUnit: "DAYS",
    durationString: "30_days",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      connectionInvitations: 30,
      freelancerConnections: 30,
      directInvitations: 30,
      savedFreelancers: 30,
      projectPosts: 5,
      tasksPerProject: 2,
      totalTasks: 10,
      watchlistCapacity: 10,
      teamMembers: 0,
      upgradeDiscountMax: 50,
      oneTimeReferralReward: true,
      recurringCashbackEligible: true,
    },
    benefits: [
      {
        displayOrder: 1,
        title: "30-Day Access",
        explanation: "Enjoy a full month of Beginner Plan benefits.",
        capabilityKey: "plan.validity",
        included: true,
        limit: 30,
      },
      {
        displayOrder: 2,
        title: "30 Connection Invitations",
        explanation: "Reach out to up to 30 professionals across Freelancer, Client, Founder and Investor communities.",
        capabilityKey: "connection_invitations",
        included: true,
        limit: 30,
      },
      {
        displayOrder: 3,
        title: "Connect with 30 Freelancers",
        explanation: "Discover professional profiles and build connections with up to 30 freelancers.",
        capabilityKey: "freelancer_connections",
        included: true,
        limit: 30,
      },
      {
        displayOrder: 4,
        title: "Direct Messaging Included",
        explanation: "Communicate with eligible connections through Go Experts messaging.",
        capabilityKey: "direct_messaging",
        included: true,
      },
      {
        displayOrder: 5,
        title: "Post Up to 5 Projects",
        explanation: "Publish projects to discover talent and collaboration opportunities.",
        capabilityKey: "project_posts",
        included: true,
        limit: 5,
      },
      {
        displayOrder: 6,
        title: "Create Up to 10 Tasks",
        explanation: "Organize your work with up to 2 tasks per project and 10 total task creations.",
        capabilityKey: "tasks_per_project",
        included: true,
        limit: 10,
      },
      {
        displayOrder: 7,
        title: "Email & Chat Support",
        explanation: "Get assistance from the Go Experts team whenever you need help.",
        capabilityKey: "support_access",
        included: true,
      },
      {
        displayOrder: 8,
        title: "Exclusive Upgrade & Role-Switch Offers",
        explanation: "Access eligible discounts of up to 50% on plan upgrades or role-switching offers.",
        capabilityKey: "upgrade_discount",
        included: true,
        limit: 50,
      },
      {
        displayOrder: 9,
        title: "Save Up to 10 Items",
        explanation: "Bookmark professionals, projects and startups for easy access.",
        capabilityKey: "watchlist_capacity",
        included: true,
        limit: 10,
      },
      {
        displayOrder: 10,
        title: "Recurring Referral Cashback",
        explanation: "Earn ₹25 once for each successful direct referral, plus eligible 5% recurring cashback based on your own paid subscription price excluding GST.",
        capabilityKey: "referral_recurring_cashback",
        included: true,
      },
    ],
    featuresTextList: [
      "30-Day Access to Beginner Plan benefits",
      "30 Connection Invitations across all 4 roles",
      "Connect with up to 30 Freelancers",
      "Direct Messaging Included",
      "Post Up to 5 Projects to discover talent",
      "Create Up to 10 Tasks (max 2 per project)",
      "Email & Chat Support from Go Experts team",
      "Exclusive Upgrade & Role-Switch Offers up to 50%",
      "Save Up to 10 Items (profiles, projects, startups)",
      "₹25 Direct Referral + 5% Recurring Referral Cashback",
    ],
    noRefundPolicy: STANDARD_NO_REFUND_POLICY,
    sortOrder: 6,
    popular: false,
    recommended: false,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 7. STANDARD PLAN (Freelancer & Startup Founder — 180 Days)
  // =========================================================================
  {
    name: "Standard (Freelancer & Founder)",
    displayName: "Standard",
    code: "standard-freelancer-founder",
    role: "freelancer",
    eligibleRoles: ["freelancer", "founder"],
    planCategory: "standard",
    tagline: "Grow your professional network, manage more projects and collaborate with your team.",
    shortDescription: "Enjoy six months of professional networking and project management benefits.",
    detailedDescription: "Grow your professional network, manage more projects and collaborate with your team.",
    amount: 2299,
    originalAmount: 2999,
    currency: "INR",
    savedBadge: "Most Popular",
    validityValue: 180,
    validityUnit: "DAYS",
    durationString: "180_days",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      connectionInvitations: 100,
      freelancerConnections: 200,
      directInvitations: 100,
      savedFreelancers: 100,
      projectPosts: 15,
      tasksPerProject: 3,
      totalTasks: 45,
      watchlistCapacity: 100,
      teamMembers: 2,
      upgradeDiscountMax: 50,
      oneTimeReferralReward: true,
      recurringCashbackEligible: true,
    },
    benefits: [
      {
        displayOrder: 1,
        title: "180-Day Access",
        explanation: "Enjoy six months of professional networking and project management benefits.",
        capabilityKey: "plan.validity",
        included: true,
        limit: 180,
      },
      {
        displayOrder: 2,
        title: "100 Connection Invitations",
        explanation: "Send up to 100 professional invitations across all four Go Experts roles.",
        capabilityKey: "connection_invitations",
        included: true,
        limit: 100,
      },
      {
        displayOrder: 3,
        title: "Connect with Up to 200 Professionals",
        explanation: "Build your network with Freelancers, Clients, Founders and Investors.",
        capabilityKey: "freelancer_connections",
        included: true,
        limit: 200,
      },
      {
        displayOrder: 4,
        title: "Direct Messaging Included",
        explanation: "Stay connected through Go Experts messaging without additional chat subscription charges.",
        capabilityKey: "direct_messaging",
        included: true,
      },
      {
        displayOrder: 5,
        title: "Post Up to 15 Projects",
        explanation: "Publish projects and explore more professional opportunities.",
        capabilityKey: "project_posts",
        included: true,
        limit: 15,
      },
      {
        displayOrder: 6,
        title: "Create Up to 45 Tasks",
        explanation: "Organize projects with up to 3 tasks per project and 45 task creations during your subscription.",
        capabilityKey: "tasks_per_project",
        included: true,
        limit: 45,
      },
      {
        displayOrder: 7,
        title: "Team Access for 2 Members",
        explanation: "Invite up to 2 team members and manage their access permissions.",
        capabilityKey: "team_members",
        included: true,
        limit: 2,
      },
      {
        displayOrder: 8,
        title: "Email & Chat Support",
        explanation: "Receive assistance from the Go Experts support team.",
        capabilityKey: "support_access",
        included: true,
      },
      {
        displayOrder: 9,
        title: "Exclusive Upgrade & Role-Switch Offers",
        explanation: "Access eligible discounts of up to 50%.",
        capabilityKey: "upgrade_discount",
        included: true,
        limit: 50,
      },
      {
        displayOrder: 10,
        title: "Save Up to 100 Items",
        explanation: "Bookmark profiles, projects and startup opportunities in one convenient place.",
        capabilityKey: "watchlist_capacity",
        included: true,
        limit: 100,
      },
      {
        displayOrder: 11,
        title: "Recurring Referral Cashback",
        explanation: "Earn ₹25 for each successful direct referral, plus eligible 5% recurring cashback throughout your active paid subscription period.",
        capabilityKey: "referral_recurring_cashback",
        included: true,
      },
    ],
    featuresTextList: [
      "180-Day Access (6 Months of benefits)",
      "100 Connection Invitations across all 4 roles",
      "Connect with Up to 200 Professionals across all communities",
      "Direct Messaging Included",
      "Post Up to 15 Projects",
      "Create Up to 45 Tasks (max 3 per project)",
      "Team Access for 2 Members",
      "Email & Chat Support",
      "Exclusive Upgrade & Role-Switch Offers up to 50%",
      "Save Up to 100 Items (profiles, projects, startups)",
      "₹25 Direct Referral + 5% Recurring Referral Cashback",
    ],
    noRefundPolicy: STANDARD_NO_REFUND_POLICY,
    sortOrder: 7,
    popular: true,
    recommended: false,
    visibility: "public",
    status: "active",
  },

  // =========================================================================
  // 8. PRO PLAN (Freelancer & Startup Founder — 365 Days)
  // =========================================================================
  {
    name: "Pro",
    displayName: "Pro",
    code: "pro",
    role: "freelancer",
    eligibleRoles: ["freelancer", "founder"],
    planCategory: "standard",
    tagline: "Unlock more opportunities, manage larger workloads and grow your professional network throughout the year.",
    shortDescription: "Enjoy a full year of Pro Plan benefits with extensive project, task, and team limits.",
    detailedDescription: "Unlock more opportunities, manage larger workloads and grow your professional network throughout the year.",
    amount: 3650,
    originalAmount: 4999,
    currency: "INR",
    savedBadge: "Best Value",
    validityValue: 365,
    validityUnit: "DAYS",
    durationString: "365_days",
    quotaResetPolicy: "FULL_TERM",
    quotas: {
      connectionInvitations: 200,
      freelancerConnections: 200,
      directInvitations: 200,
      savedFreelancers: 100,
      projectPosts: 36,
      tasksPerProject: 4,
      totalTasks: 144,
      watchlistCapacity: 100,
      teamMembers: 6,
      upgradeDiscountMax: 50,
      oneTimeReferralReward: true,
      recurringCashbackEligible: true,
    },
    benefits: [
      {
        displayOrder: 1,
        title: "365-Day Access",
        explanation: "Enjoy a full year of Pro Plan benefits.",
        capabilityKey: "plan.validity",
        included: true,
        limit: 365,
      },
      {
        displayOrder: 2,
        title: "200 Connection Invitations",
        explanation: "Send up to 200 professional invitations across all four user roles.",
        capabilityKey: "connection_invitations",
        included: true,
        limit: 200,
      },
      {
        displayOrder: 3,
        title: "Connect with Up to 200 Professionals",
        explanation: "Expand your network across Freelancers, Clients, Founders and Investors.",
        capabilityKey: "freelancer_connections",
        included: true,
        limit: 200,
      },
      {
        displayOrder: 4,
        title: "Direct Messaging Included",
        explanation: "Communicate with eligible professional connections through Go Experts messaging.",
        capabilityKey: "direct_messaging",
        included: true,
      },
      {
        displayOrder: 5,
        title: "Post Up to 36 Projects",
        explanation: "Publish more projects and manage a wider range of professional opportunities.",
        capabilityKey: "project_posts",
        included: true,
        limit: 36,
      },
      {
        displayOrder: 6,
        title: "Create Up to 144 Tasks",
        explanation: "Organize work with up to 4 tasks per project and 144 total task creations during your annual subscription.",
        capabilityKey: "tasks_per_project",
        included: true,
        limit: 144,
      },
      {
        displayOrder: 7,
        title: "Team Access for 6 Members",
        explanation: "Invite up to 6 team members and manage their access through assigned permissions.",
        capabilityKey: "team_members",
        included: true,
        limit: 6,
      },
      {
        displayOrder: 8,
        title: "Email & Chat Support",
        explanation: "Access support from the Go Experts team.",
        capabilityKey: "support_access",
        included: true,
      },
      {
        displayOrder: 9,
        title: "Exclusive Upgrade & Role-Switch Offers",
        explanation: "Receive eligible plan upgrade or role-switching discounts of up to 50%.",
        capabilityKey: "upgrade_discount",
        included: true,
        limit: 50,
      },
      {
        displayOrder: 10,
        title: "Save Up to 100 Items",
        explanation: "Keep important professionals, projects and startups organized.",
        capabilityKey: "watchlist_capacity",
        included: true,
        limit: 100,
      },
      {
        displayOrder: 11,
        title: "Recurring Referral Cashback",
        explanation: "Earn ₹25 once for every successful direct referral, plus eligible 5% recurring cashback based on your own paid subscription.",
        capabilityKey: "referral_recurring_cashback",
        included: true,
      },
    ],
    featuresTextList: [
      "365-Day Access (Full Year of Pro benefits)",
      "200 Connection Invitations across all 4 roles",
      "Connect with Up to 200 Professionals across all communities",
      "Direct Messaging Included",
      "Post Up to 36 Projects",
      "Create Up to 144 Tasks (max 4 per project)",
      "Team Access for 6 Members",
      "Email & Chat Support",
      "Exclusive Upgrade & Role-Switch Offers up to 50%",
      "Save Up to 100 Items (profiles, projects, startups)",
      "₹25 Direct Referral + 5% Recurring Referral Cashback",
    ],
    noRefundPolicy: STANDARD_NO_REFUND_POLICY,
    sortOrder: 8,
    popular: false,
    recommended: true,
    visibility: "public",
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

  // Find canonical blueprint by name, code, or displayName + role
  const blueprint = CANONICAL_PLANS.find(
    (p) =>
      p.name.toLowerCase() === dbPlan.name?.toLowerCase() ||
      p.code === dbPlan.name?.toLowerCase().replace(/\s+/g, "-") ||
      (p.displayName && p.displayName.toLowerCase() === dbPlan.name?.toLowerCase() && (p.role === dbPlan.role || p.eligibleRoles?.includes(dbPlan.role as any)))
  );

  const validityValue = Number(limitsObj.validityValue ?? blueprint?.validityValue ?? 30);
  const validityUnit = (limitsObj.validityUnit ?? blueprint?.validityUnit ?? "DAYS") as ValidityUnit;
  const quotaResetPolicy = (limitsObj.quotaResetPolicy ?? blueprint?.quotaResetPolicy ?? "FULL_TERM") as QuotaResetPolicy;

  const quotas: PlanQuotas = {
    connectionInvitations: limitsObj.connectionInvitations ?? blueprint?.quotas?.connectionInvitations ?? 25,
    freelancerConnections: limitsObj.freelancerConnections ?? blueprint?.quotas?.freelancerConnections ?? 5,
    directInvitations: limitsObj.directInvitations ?? blueprint?.quotas?.directInvitations ?? 25,
    savedFreelancers: limitsObj.savedFreelancers ?? blueprint?.quotas?.savedFreelancers ?? 5,
    projectPosts: dbPlan.projectsLimit ?? limitsObj.projectPosts ?? blueprint?.quotas?.projectPosts ?? 5,
    tasksPerProject: limitsObj.tasksPerProject ?? blueprint?.quotas?.tasksPerProject ?? 2,
    totalTasks: limitsObj.totalTasks ?? blueprint?.quotas?.totalTasks ?? 10,
    watchlistCapacity: limitsObj.watchlistCapacity ?? blueprint?.quotas?.watchlistCapacity ?? 10,
    teamMembers: limitsObj.teamMembers ?? blueprint?.quotas?.teamMembers ?? 0,
    upgradeDiscountMax: limitsObj.upgradeDiscountMax ?? blueprint?.quotas?.upgradeDiscountMax ?? 0,
    oneTimeReferralReward: limitsObj.oneTimeReferralReward ?? blueprint?.quotas?.oneTimeReferralReward ?? true,
    recurringCashbackEligible: limitsObj.recurringCashbackEligible ?? blueprint?.quotas?.recurringCashbackEligible ?? (dbPlan.amount > 0),
    proposals: dbPlan.proposalsLimit ?? limitsObj.proposals ?? blueprint?.quotas?.proposals ?? 3,
    savedProjects: limitsObj.savedProjects ?? blueprint?.quotas?.savedProjects ?? 0,
    expressionsOfInterest: limitsObj.expressionsOfInterest ?? blueprint?.quotas?.expressionsOfInterest ?? 0,
    savedStartups: limitsObj.savedStartups ?? blueprint?.quotas?.savedStartups ?? 0,
    founderIntroRequests: limitsObj.founderIntroRequests ?? blueprint?.quotas?.founderIntroRequests ?? 0,
    activePublishedStartups: limitsObj.activePublishedStartups ?? blueprint?.quotas?.activePublishedStartups ?? 0,
    investorContactRequests: limitsObj.investorContactRequests ?? blueprint?.quotas?.investorContactRequests ?? 0,
  };

  const benefits: PlanBenefitItem[] = limitsObj.benefits ?? blueprint?.benefits ?? [];
  const displayName = limitsObj.displayName ?? blueprint?.displayName ?? (dbPlan.name.includes(" (") ? dbPlan.name.split(" (")[0] : dbPlan.name);

  return {
    id: dbPlan.id,
    name: displayName,
    displayName,
    fullName: dbPlan.name,
    code: blueprint?.code ?? dbPlan.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    role: dbPlan.role,
    eligibleRoles: limitsObj.eligibleRoles ?? blueprint?.eligibleRoles ?? (dbPlan.role === "all" ? ["freelancer", "client", "founder", "investor"] : [dbPlan.role]),
    planCategory: (dbPlan.planType as any) ?? blueprint?.planCategory ?? "standard",
    tagline: limitsObj.tagline ?? blueprint?.tagline,
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
    noRefundPolicy: limitsObj.noRefundPolicy ?? blueprint?.noRefundPolicy ?? STANDARD_NO_REFUND_POLICY,
    sortOrder: dbPlan.sortOrder ?? blueprint?.sortOrder ?? 0,
    popular: Boolean(dbPlan.popular ?? blueprint?.popular),
    recommended: Boolean(dbPlan.recommended ?? blueprint?.recommended),
    visibility: dbPlan.visibility ?? blueprint?.visibility ?? "public",
    status: (dbPlan.status as any) ?? blueprint?.status ?? "active",
  };
}
