import { prisma } from "../config/database.js";

const roles = ["freelancer", "client", "investor", "founder"] as const;

/**
 * Idempotent seed function for canonical subscription plans.
 * CRITICAL RULE: Preserves custom admin pricing if a plan already exists in production.
 */
export async function seedCanonicalSubscriptionPlans() {
  console.log("Seeding / Verifying Canonical Go Experts Subscription Plans...");

  // Helper to safely upsert while preserving admin-configured prices
  async function safeUpsertPlan(data: {
    name: string;
    role: string;
    planType: string;
    amount: number;
    originalAmount?: number;
    savedBadge?: string;
    currency: string;
    duration: string;
    proposalsLimit: number;
    projectsLimit: number;
    sortOrder: number;
    popular?: boolean;
    recommended?: boolean;
    features: string[];
  }) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { name: data.name },
    });

    if (!existing) {
      console.log(`Creating missing canonical plan: ${data.name}`);
      return prisma.subscriptionPlan.create({
        data: {
          name: data.name,
          role: data.role,
          planType: data.planType,
          amount: data.amount,
          originalAmount: data.originalAmount,
          savedBadge: data.savedBadge,
          currency: data.currency,
          duration: data.duration,
          proposalsLimit: data.proposalsLimit,
          projectsLimit: data.projectsLimit,
          sortOrder: data.sortOrder,
          popular: data.popular ?? false,
          recommended: data.recommended ?? false,
          visibility: "public",
          status: "active",
          features: JSON.stringify(data.features),
        },
      });
    } else {
      // PRESERVE existing.amount, existing.originalAmount, existing.currency
      // Only update schema metadata (planType, limits, sortOrder) without overwriting commercial prices!
      console.log(`Preserving existing plan and admin pricing for: ${data.name} (Amount: ₹${existing.amount})`);
      return prisma.subscriptionPlan.update({
        where: { id: existing.id },
        data: {
          role: data.role,
          planType: (existing as any).planType || data.planType,
          proposalsLimit: (existing as any).proposalsLimit ?? data.proposalsLimit,
          projectsLimit: (existing as any).projectsLimit ?? data.projectsLimit,
          sortOrder: data.sortOrder,
          status: existing.status || "active",
        },
      });
    }
  }

  // 1. 6-Month Free Trial Plan (Universal across all roles)
  await safeUpsertPlan({
    name: "6-Month Free Access",
    role: "all",
    planType: "trial",
    amount: 0,
    originalAmount: 2394,
    savedBadge: "100% Free For 6 Months",
    currency: "INR",
    duration: "180_days",
    proposalsLimit: 36,
    projectsLimit: 36,
    sortOrder: 1,
    popular: false,
    recommended: false,
    features: [
      "6 calendar months full platform access",
      "Valid across all 4 roles (Freelancer, Client, Founder, Investor)",
      "Up to 36 proposal submissions",
      "Up to 36 project postings",
      "Verified badge & basic directory discovery",
      "Community & standard platform support"
    ],
  });

  // 2. Single-Role Monthly (₹399) & Annual (₹3,650) for each role
  for (const r of roles) {
    const roleCapitalized = r.charAt(0).toUpperCase() + r.slice(1);

    // Monthly: ₹399
    await safeUpsertPlan({
      name: `${roleCapitalized} Monthly`,
      role: r,
      planType: "single_role",
      amount: 399,
      originalAmount: 499,
      savedBadge: "Standard Monthly Tier",
      currency: "INR",
      duration: "monthly",
      proposalsLimit: 3,
      projectsLimit: 3,
      sortOrder: 2,
      popular: false,
      recommended: false,
      features: [
        `Dedicated ${roleCapitalized} workspace access`,
        r === "freelancer" ? "Up to 3 proposals / month" : r === "client" ? "Post up to 3 projects / month" : "Direct network access & messaging",
        "Standard search visibility",
        "Real-time notifications & messaging",
        "In-app support",
      ],
    });

    // Annual: ₹3,650 (₹10/day)
    await safeUpsertPlan({
      name: `${roleCapitalized} Annual`,
      role: r,
      planType: "single_role",
      amount: 3650,
      originalAmount: 4788,
      savedBadge: "Just ₹10/day • Save 24%",
      currency: "INR",
      duration: "yearly",
      proposalsLimit: 36,
      projectsLimit: 36,
      sortOrder: 3,
      popular: false,
      recommended: true,
      features: [
        `Full 1-year ${roleCapitalized} workspace access`,
        r === "freelancer" ? "36 proposals / year quota" : r === "client" ? "36 project posts / year" : "Direct investor connects & data room access",
        "Priority search directory boost",
        "Verified trust badge",
        "Save 24% vs monthly billing",
        "Priority customer support",
      ],
    });
  }

  // 3. Additional Role Add-on Plans (₹149/mo, ₹1,499/yr)
  await safeUpsertPlan({
    name: "Additional Role Add-on Monthly",
    role: "all",
    planType: "add_on",
    amount: 149,
    originalAmount: 199,
    savedBadge: "Add any 2nd role",
    currency: "INR",
    duration: "monthly",
    proposalsLimit: 3,
    projectsLimit: 3,
    sortOrder: 4,
    popular: false,
    recommended: false,
    features: [
      "Unlock 1 additional role workspace",
      "Shared account and billing profile",
      "+3 proposals or +3 project posts / month",
      "Full role dashboard and features",
    ],
  });

  await safeUpsertPlan({
    name: "Additional Role Add-on Annual",
    role: "all",
    planType: "add_on",
    amount: 1499,
    originalAmount: 1788,
    savedBadge: "Save ₹289/yr on extra role",
    currency: "INR",
    duration: "yearly",
    proposalsLimit: 36,
    projectsLimit: 36,
    sortOrder: 5,
    popular: false,
    recommended: false,
    features: [
      "Unlock 1 additional role workspace for a full year",
      "Shared account and billing profile",
      "+36 proposals or +36 project posts / year",
      "Priority directory placement for the added role",
    ],
  });

  // 4. Go Experts All Access Plans (₹699/mo, ₹6,999/yr)
  await safeUpsertPlan({
    name: "Go Experts All Access Monthly",
    role: "all",
    planType: "all_access",
    amount: 699,
    originalAmount: 899,
    savedBadge: "All 4 Roles Included",
    currency: "INR",
    duration: "monthly",
    proposalsLimit: -1,
    projectsLimit: -1,
    sortOrder: 6,
    popular: true,
    recommended: false,
    features: [
      "Complete access to all 4 roles (Freelancer, Client, Founder, Investor)",
      "Switch workspaces anytime seamlessly",
      "Unlimited proposal submissions & project postings",
      "Priority search placement & directory boost",
      "VIP trust badge across all profiles",
      "Dedicated concierge & priority support",
    ],
  });

  await safeUpsertPlan({
    name: "Go Experts All Access Annual",
    role: "all",
    planType: "all_access",
    amount: 6999,
    originalAmount: 8388,
    savedBadge: "Best Value • Save ₹1,389/yr",
    currency: "INR",
    duration: "yearly",
    proposalsLimit: -1,
    projectsLimit: -1,
    sortOrder: 7,
    popular: false,
    recommended: true,
    features: [
      "Complete access to all 4 roles for 1 full year",
      "Switch workspaces anytime seamlessly",
      "Unlimited proposals & project posts",
      "1st-page search ranking & verified VIP trust badge",
      "Deal room access, warm introductions, & SLA support",
      "Save ₹1,389 vs monthly All Access billing",
    ],
  });

  console.log("Canonical subscription plans seeded / verified successfully!");
}

// Allow direct CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  seedCanonicalSubscriptionPlans()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
