import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Updating EmailTemplates...");
  const templates = await prisma.emailTemplate.findMany();
  
  for (const template of templates) {
    let updatedBody = template.body.replace(/#E30613/gi, '#38B2AC');
    
    // Specifically remove the redundant link section
    updatedBody = updatedBody.replace(/<p style="font-size: 13px; color: #718096; margin-top: 24px; line-height: 1\.5;">Button not working\? Copy and paste this link into your browser:<br\/>.*?<\/a><\/p>/gi, '');
    
    // In case the DB holds exactly what was in master template
    updatedBody = updatedBody.replace(/Button not working\? Copy and paste this link into your browser:\\n\\n{{verification_link}}\\n\\n/g, '');

    if (updatedBody !== template.body) {
      await prisma.emailTemplate.update({
        where: { id: template.id },
        data: { body: updatedBody }
      });
      console.log(`Updated template: ${template.name}`);
    }
  }

  console.log("Updating GlobalSettings...");
  const settings = await prisma.globalSettings.findFirst();
  if (settings && settings.emailBranding) {
    let brandingObj: any = settings.emailBranding;
    if (typeof brandingObj === 'string') {
        try {
            brandingObj = JSON.parse(brandingObj);
        } catch(e) {}
    }
    
    if (brandingObj && brandingObj.primaryColor === '#E30613') {
      brandingObj.primaryColor = '#38B2AC';
      await prisma.globalSettings.update({
        where: { id: settings.id },
        data: { emailBranding: JSON.stringify(brandingObj) } // Or just object if JSON field
      });
      console.log("Updated GlobalSettings emailBranding primaryColor to #38B2AC");
    }
  }

  console.log("Database update complete.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
