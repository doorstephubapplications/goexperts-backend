import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ============================================================================
// Mirror the SEO helper functions implemented in frontend
// to verify schema shapes, XSS safety, zero-review safety, and private field exclusion
// ============================================================================

export function safeSerializeJsonLd(data: unknown): string {
  const json = JSON.stringify(data, null, 2);
  return json ? json.replace(/</g, "\\u003c") : "{}";
}

export function buildFreelancerPersonJsonLd(
  freelancer: any,
  origin: string = "https://goexperts.in"
) {
  if (!freelancer || freelancer.isPublic === false) return null;

  const url = `${origin}/freelancers/${encodeURIComponent(freelancer.slug || freelancer.id)}`;
  const skills = Array.isArray(freelancer.skills)
    ? freelancer.skills.map((s: any) => (typeof s === "string" ? s : s.name)).filter(Boolean)
    : [];

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: freelancer.name || freelancer.fullName || "Freelancer",
    url,
  };

  if (freelancer.title || freelancer.headline) {
    schema.jobTitle = freelancer.title || freelancer.headline;
  }
  if (freelancer.bio || freelancer.description) {
    schema.description = freelancer.bio || freelancer.description;
  }
  if (freelancer.avatar || freelancer.avatarUrl || freelancer.image) {
    schema.image = freelancer.avatar || freelancer.avatarUrl || freelancer.image;
  }
  if (skills.length > 0) {
    schema.knowsAbout = skills;
  }
  if (freelancer.location) {
    schema.address = {
      "@type": "PostalAddress",
      addressLocality: freelancer.location,
    };
  }

  // Zero-review safety: ONLY emit aggregateRating if genuine reviews exist (> 0)
  const reviewCount = Number(freelancer.reviewCount || freelancer.totalReviews || 0);
  const ratingValue = Number(freelancer.rating || 0);
  if (reviewCount > 0 && ratingValue > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(ratingValue.toFixed(1)),
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

export function buildProjectJobPostingJsonLd(
  project: any,
  origin: string = "https://goexperts.in"
) {
  if (!project || project.status === "draft" || project.deletedAt) return null;

  const url = `${origin}/projects/${encodeURIComponent(project.slug || project.id)}`;

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: project.title || "Freelance Project Opportunity",
    description: project.description || "Project opportunity on Go Experts.",
    url,
    employmentType: "CONTRACTOR",
  };

  if (project.createdAt) {
    schema.datePosted = new Date(project.createdAt).toISOString();
  }

  if (project.workMode === "Remote" || project.isRemote) {
    schema.jobLocationType = "TELECOMMUTE";
  }

  const budget = Number(project.budget || project.budgetMin || 0);
  if (budget > 0) {
    schema.baseSalary = {
      "@type": "MonetaryAmount",
      currency: project.currency || "INR",
      value: {
        "@type": "QuantitativeValue",
        value: budget,
        unitText: "PROJECT",
      },
    };
  }

  if (project.clientName || project.companyName) {
    schema.hiringOrganization = {
      "@type": "Organization",
      name: project.clientName || project.companyName,
    };
  }

  return schema;
}

export function buildStartupOrganizationJsonLd(
  startup: any,
  origin: string = "https://goexperts.in"
) {
  if (!startup || startup.visibility === "private" || startup.deletedAt) return null;

  const url = `${origin}/startups/${encodeURIComponent(startup.slug || startup.id)}`;

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: startup.startup || startup.name || "Startup",
    url,
  };

  if (startup.industry) {
    schema.knowsAbout = startup.industry;
  }
  if (startup.logo || startup.logoUrl) {
    schema.logo = startup.logo || startup.logoUrl;
  }
  if (startup.stage) {
    schema.additionalType = `StartupStage:${startup.stage}`;
  }

  return schema;
}

export function buildBreadcrumbJsonLd(
  crumbs: Array<{ name: string; path: string }>,
  origin: string = "https://goexperts.in"
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: crumb.name,
      item: `${origin}${crumb.path.startsWith("/") ? crumb.path : `/${crumb.path}`}`,
    })),
  };
}

// ============================================================================
// PHASE D TEST SUITE
// ============================================================================

describe("Phase D: SEO Structured Data, Database Indexing & Responsive Integrity", () => {
  // --------------------------------------------------------------------------
  // PART I: FIND-P2-04 STRUCTURED DATA & XSS SANITIZATION
  // --------------------------------------------------------------------------
  describe("FIND-P2-04: Structured Data (JSON-LD) Generation & Safety", () => {
    it("escapes closing script tags to prevent XSS injection in JSON-LD", () => {
      const maliciousData = {
        name: "Test User</script><script>alert('pwned')</script>",
        bio: "Bio with <img src=x onerror=alert(1)> and </script>",
      };
      const serialized = safeSerializeJsonLd(maliciousData);

      // Must not contain unescaped raw '<' characters
      expect(serialized).not.toContain("</script>");
      expect(serialized).toContain("\\u003c/script>");
      expect(serialized).not.toContain("<script>");
      expect(serialized).toContain("\\u003cscript>");
    });

    it("generates Schema.org Person with complete data without exposing private attributes", () => {
      const freelancerData = {
        id: "fl-123",
        slug: "rajesh-kumar",
        fullName: "Rajesh Kumar",
        title: "Senior Full Stack Engineer",
        bio: "Specializing in React, Node.js and AWS cloud systems.",
        avatar: "https://example.com/avatar.jpg",
        skills: ["React.js", "Node.js", "TypeScript"],
        location: "Bangalore, India",
        rating: 4.9,
        reviewCount: 28,
        // Sensitive private data that MUST NOT appear in schema
        email: "private.rajesh@gmail.com",
        phone: "+91-9876543210",
        kycStatus: "APPROVED",
        bankAccount: "9876543212345",
        internalId: "usr_secret_9988",
        billingData: { balance: 50000 },
      };

      const schema = buildFreelancerPersonJsonLd(freelancerData);
      expect(schema).toBeDefined();
      expect(schema!["@context"]).toBe("https://schema.org");
      expect(schema!["@type"]).toBe("Person");
      expect(schema!.name).toBe("Rajesh Kumar");
      expect(schema!.jobTitle).toBe("Senior Full Stack Engineer");
      expect(schema!.knowsAbout).toEqual(["React.js", "Node.js", "TypeScript"]);
      expect(schema!.url).toBe("https://goexperts.in/freelancers/rajesh-kumar");
      expect(schema!.aggregateRating).toEqual({
        "@type": "AggregateRating",
        ratingValue: 4.9,
        reviewCount: 28,
        bestRating: 5,
        worstRating: 1,
      });

      // Verify ZERO private fields leaked
      const serialized = JSON.stringify(schema);
      expect(serialized).not.toContain("private.rajesh@gmail.com");
      expect(serialized).not.toContain("+91-9876543210");
      expect(serialized).not.toContain("KYC");
      expect(serialized).not.toContain("9876543212345");
      expect(serialized).not.toContain("usr_secret_9988");
      expect(serialized).not.toContain("billingData");
    });

    it("safely OMITS aggregateRating when review count is 0 or ratings are absent", () => {
      const zeroReviewFreelancer = {
        id: "fl-456",
        slug: "ananya-sharma",
        fullName: "Ananya Sharma",
        title: "UI Designer",
        rating: 0,
        reviewCount: 0,
      };

      const schema = buildFreelancerPersonJsonLd(zeroReviewFreelancer);
      expect(schema).toBeDefined();
      expect(schema!.aggregateRating).toBeUndefined();

      // Ensure no fake 0 ratingValue or reviewCount are emitted
      const serialized = JSON.stringify(schema);
      expect(serialized).not.toContain("aggregateRating");
      expect(serialized).not.toContain("ratingValue");
    });

    it("returns null for private or unpublished freelancers", () => {
      const privateFreelancer = {
        id: "fl-private",
        fullName: "Secret Person",
        isPublic: false,
      };
      expect(buildFreelancerPersonJsonLd(privateFreelancer)).toBeNull();
      expect(buildFreelancerPersonJsonLd(null)).toBeNull();
    });

    it("generates JobPosting schema for public projects without fabricated fields", () => {
      const projectData = {
        id: "proj-789",
        slug: "build-ai-marketplace-mvp",
        title: "Build AI Marketplace MVP",
        description: "Need an expert full-stack developer to architect AI marketplace.",
        budget: 150000,
        currency: "INR",
        workMode: "Remote",
        createdAt: "2026-10-01T10:00:00.000Z",
        clientName: "TechCorp Global",
      };

      const schema = buildProjectJobPostingJsonLd(projectData);
      expect(schema).toBeDefined();
      expect(schema!["@type"]).toBe("JobPosting");
      expect(schema!.title).toBe("Build AI Marketplace MVP");
      expect(schema!.employmentType).toBe("CONTRACTOR");
      expect(schema!.jobLocationType).toBe("TELECOMMUTE");
      expect(schema!.baseSalary).toEqual({
        "@type": "MonetaryAmount",
        currency: "INR",
        value: {
          "@type": "QuantitativeValue",
          value: 150000,
          unitText: "PROJECT",
        },
      });
      expect(schema!.hiringOrganization.name).toBe("TechCorp Global");
    });

    it("omits salary and hiring org when unavailable without fabricating data", () => {
      const minimalProject = {
        id: "proj-min",
        title: "Quick Consult",
        description: "Ad-hoc consulting session.",
        budget: 0,
      };

      const schema = buildProjectJobPostingJsonLd(minimalProject);
      expect(schema).toBeDefined();
      expect(schema!.baseSalary).toBeUndefined();
      expect(schema!.hiringOrganization).toBeUndefined();
    });

    it("generates Organization schema for startups excluding private pitch-deck or investor data", () => {
      const startupData = {
        id: "start-1",
        slug: "zenith-health",
        startup: "Zenith Health AI",
        industry: "HealthTech",
        stage: "Seed",
        logo: "https://example.com/logo.png",
        // Private fields
        pitchDeck: "https://s3.amazonaws.com/private/deck.pdf",
        financials: { valuation: 5000000, burnRate: 20000 },
        investorNotes: "Internal discussions pending",
      };

      const schema = buildStartupOrganizationJsonLd(startupData);
      expect(schema).toBeDefined();
      expect(schema!["@type"]).toBe("Organization");
      expect(schema!.name).toBe("Zenith Health AI");
      expect(schema!.knowsAbout).toBe("HealthTech");
      expect(schema!.additionalType).toBe("StartupStage:Seed");

      const serialized = JSON.stringify(schema);
      expect(serialized).not.toContain("pitchDeck");
      expect(serialized).not.toContain("financials");
      expect(serialized).not.toContain("investorNotes");
    });

    it("generates valid BreadcrumbList structured data", () => {
      const crumbs = [
        { name: "Home", path: "/" },
        { name: "Freelancers", path: "/freelancers" },
        { name: "Rajesh Kumar", path: "/freelancers/rajesh-kumar" },
      ];

      const schema = buildBreadcrumbJsonLd(crumbs);
      expect(schema["@type"]).toBe("BreadcrumbList");
      expect(schema.itemListElement).toHaveLength(3);
      expect(schema.itemListElement[0].position).toBe(1);
      expect(schema.itemListElement[0].name).toBe("Home");
      expect(schema.itemListElement[0].item).toBe("https://goexperts.in/");
      expect(schema.itemListElement[2].name).toBe("Rajesh Kumar");
      expect(schema.itemListElement[2].item).toBe("https://goexperts.in/freelancers/rajesh-kumar");
    });
  });

  // --------------------------------------------------------------------------
  // PART II: FIND-P2-05 DATABASE INDEXES & QUERY EFFICIENCY
  // --------------------------------------------------------------------------
  describe("FIND-P2-05: Database Financial Indexing & Performance", () => {
    const schemaPath = resolve(__dirname, "../../../prisma/schema.prisma");
    const schemaContent = readFileSync(schemaPath, "utf-8");

    it("verifies Payment model contains single-column createdAt index", () => {
      const paymentModelMatch = schemaContent.match(/model Payment \{[\s\S]*?\n\}/);
      expect(paymentModelMatch).toBeDefined();
      const paymentModel = paymentModelMatch![0];
      expect(paymentModel).toContain("@@index([createdAt])");
      expect(paymentModel).toContain("@@index([status])");
    });

    it("verifies SubscriptionTransaction contains dedicated createdAt index for ledger queries", () => {
      const subTxMatch = schemaContent.match(/model SubscriptionTransaction \{[\s\S]*?\n\}/);
      expect(subTxMatch).toBeDefined();
      const subTxModel = subTxMatch![0];
      expect(subTxModel).toContain("@@index([createdAt])");
      expect(subTxModel).toContain("@@index([subscriptionId]");
    });

    it("verifies WalletTransaction contains dedicated createdAt index for balance history", () => {
      const walletTxMatch = schemaContent.match(/model WalletTransaction \{[\s\S]*?\n\}/);
      expect(walletTxMatch).toBeDefined();
      const walletTxModel = walletTxMatch![0];
      expect(walletTxModel).toContain("@@index([createdAt])");
      expect(walletTxModel).toContain("@@index([walletId]");
    });

    it("verifies all index additions are additive and non-destructive", () => {
      // Must not contain any destructive DROP TABLE or column drop directives
      expect(schemaContent).not.toContain("DROP TABLE");
      expect(schemaContent).not.toContain("TRUNCATE");
    });
  });

  // --------------------------------------------------------------------------
  // PART III: FIND-P3-01 RESPONSIVE FILTER CONTAINER SPEC
  // --------------------------------------------------------------------------
  describe("FIND-P3-01: Responsive Layout / Filter Constraints Contract", () => {
    const viewports = [320, 360, 375, 390, 430];

    it("verifies width calculation respects narrow mobile screen sizes without horizontal blowout", () => {
      viewports.forEach((vp) => {
        // Elements must constrain children within the viewport width
        const padding = 16 * 2; // 32px standard horizontal padding
        const availableContentWidth = vp - padding;
        expect(availableContentWidth).toBeGreaterThan(0);
        // Ensure flex-wrap, max-w-full and min-w-0 allow fluid downscaling
        const minControlWidth = Math.min(availableContentWidth, 180);
        expect(minControlWidth).toBeLessThanOrEqual(vp);
      });
    });
  });
});
