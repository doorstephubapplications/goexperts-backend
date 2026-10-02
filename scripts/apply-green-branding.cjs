const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("Applying new Green branding to Email Templates in the database...");

  // 1. Update email_templates
  const emailTemplatesSetting = await prisma.setting.findUnique({
    where: { key: 'settings_email_templates' }
  });

  if (emailTemplatesSetting && emailTemplatesSetting.value) {
    let templates = JSON.parse(emailTemplatesSetting.value);
    let updated = false;

    for (let t of templates) {
      if (t.body && t.body.includes('#E30613')) {
        t.body = t.body.replace(/#E30613/gi, '#38B2AC');
        updated = true;
      }
      if (t.html && t.html.includes('#E30613')) {
        t.html = t.html.replace(/#E30613/gi, '#38B2AC');
        updated = true;
      }
      
      // Specifically remove the redundant link section in verification
      const redundantHtml = /<p[^>]*>Button not working\? Copy and paste this link into your browser:<br\/>[\s\S]*?<\/a><\/p>/gi;
      if (t.body && redundantHtml.test(t.body)) {
        t.body = t.body.replace(redundantHtml, '');
        updated = true;
      }
      if (t.html && redundantHtml.test(t.html)) {
        t.html = t.html.replace(redundantHtml, '');
        updated = true;
      }
    }

    if (updated) {
      await prisma.setting.update({
        where: { key: 'settings_email_templates' },
        data: { value: JSON.stringify(templates) }
      });
      console.log("✅ Successfully updated existing Email Templates to use Green buttons and removed redundant link.");
    } else {
      console.log("✅ Email Templates are already up to date.");
    }
  } else {
    console.log("✅ No custom Email Templates found in DB. System will automatically use the new Green defaults.");
  }

  // 2. Update email_branding
  const emailBrandingSetting = await prisma.setting.findUnique({
    where: { key: 'settings_email_branding' }
  });

  if (emailBrandingSetting && emailBrandingSetting.value) {
    let branding = JSON.parse(emailBrandingSetting.value);
    if (branding.primaryColor === '#E30613') {
      branding.primaryColor = '#38B2AC';
      await prisma.setting.update({
        where: { key: 'settings_email_branding' },
        data: { value: JSON.stringify(branding) }
      });
      console.log("✅ Successfully updated Global Email Branding primary color to Green.");
    } else {
      console.log("✅ Email Branding primary color is already set.");
    }
  } else {
    console.log("✅ No custom Email Branding found in DB. System will automatically use the new Green defaults.");
  }

  console.log("Done! You can now restart your backend.");
}

main()
  .catch(e => {
    console.error("Error applying branding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
