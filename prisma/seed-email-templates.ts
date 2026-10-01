import { prisma } from "../src/config/database.js";
import { MASTER_EMAIL_TEMPLATES } from "../src/services/settings/email-templates.master.js";
import { SETTINGS_DEFAULTS } from "../src/services/settings/settings.defaults.js";

async function main() {
  console.log("🌱 Seeding email branding & templates into MySQL database...");

  // 1. Seed email_branding
  const branding = {
    ...SETTINGS_DEFAULTS.email_branding,
    logoUrl: "http://localhost:5173/goexperts-logo.png",
    logoHeight: 34,
    showBrandText: true,
    primaryColor: "#E30613",
    headerTag: "Official Notification",
    appSectionTitle: "Get the Go Experts App",
    playStoreUrl: "https://play.google.com/store/apps/details?id=com.doorstephub.goexperts&pcampaignid=web_share",
    appleStoreUrl: "https://apps.apple.com",
    supportEmail: "servicedesk@goexperts.in",
    websiteUrl: "https://goexperts.in",
    tagline: "Working With You. For You.",
    copyrightText: "© 2026 Go Experts Technologies Private Limited. All rights reserved.",
    privacyUrl: "https://goexperts.in/privacy",
    termsUrl: "https://goexperts.in/terms",
    notificationSettingsUrl: "https://goexperts.in/settings/notifications",
  };

  const brandingPayload = JSON.stringify(branding);
  const templatesPayload = JSON.stringify(MASTER_EMAIL_TEMPLATES);

  // Seed canonical settings:section:email_branding
  await prisma.setting.upsert({
    where: { key: "settings:section:email_branding" },
    create: {
      key: "settings:section:email_branding",
      value: brandingPayload,
      category: "email_branding",
    },
    update: {
      value: brandingPayload,
      category: "email_branding",
    },
  });

  // Seed legacy section_email_branding for compatibility
  await prisma.setting.upsert({
    where: { key: "section_email_branding" },
    create: {
      key: "section_email_branding",
      value: brandingPayload,
      category: "email_branding",
    },
    update: {
      value: brandingPayload,
      category: "email_branding",
    },
  });
  console.log("✅ Seeded email branding into Setting table (canonical & legacy keys)");

  // 2. Seed email_templates
  // Seed canonical settings:section:email_templates
  await prisma.setting.upsert({
    where: { key: "settings:section:email_templates" },
    create: {
      key: "settings:section:email_templates",
      value: templatesPayload,
      category: "email_templates",
    },
    update: {
      value: templatesPayload,
      category: "email_templates",
    },
  });

  // Seed legacy section_email_templates for compatibility
  await prisma.setting.upsert({
    where: { key: "section_email_templates" },
    create: {
      key: "section_email_templates",
      value: templatesPayload,
      category: "email_templates",
    },
    update: {
      value: templatesPayload,
      category: "email_templates",
    },
  });
  console.log(`✅ Seeded ${MASTER_EMAIL_TEMPLATES.length} email templates into Setting table (canonical & legacy keys)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
