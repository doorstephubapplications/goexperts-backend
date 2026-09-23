const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
  console.log('--- FAQ SCHEMA AUDIT ---');
  const helpCategoriesCount = await prisma.helpCategory.count();
  const faqCategoriesCount = await (prisma.fAQCategory ? prisma.fAQCategory.count() : prisma.faqCategory?.count() || 0);
  const legacyFaqCount = await prisma.faq.count();
  const newFaqCount = await (prisma.fAQ ? prisma.fAQ.count() : prisma.fAQ?.count() || 0);
  
  console.log('HelpCategory count: ' + helpCategoriesCount);
  console.log('FAQCategory count: ' + faqCategoriesCount);
  console.log('Legacy Faq count: ' + legacyFaqCount);
  console.log('New FAQ count: ' + newFaqCount);
  
  console.log('\n--- HelpCategory Samples ---');
  console.log(await prisma.helpCategory.findMany({ select: { id: true, name: true, slug: true, icon: true } }));
  
  console.log('\n--- FAQCategory Samples ---');
  if (prisma.fAQCategory) console.log(await prisma.fAQCategory.findMany({ select: { id: true, name: true, slug: true, icon: true } }));
  
  console.log('\n--- Legacy Faq Category Mappings ---');
  const legacyFaqs = await prisma.faq.findMany({ select: { id: true, category: true, categoryId: true } });
  const mapped = {};
  legacyFaqs.forEach(f => {
    if (!mapped[f.category]) mapped[f.category] = 0;
    mapped[f.category]++;
  });
  console.log(mapped);
  
  await prisma.$disconnect();
}

audit().catch(console.error);
