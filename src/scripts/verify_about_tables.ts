import { prisma } from '../config/database.js';

async function main() {
  console.log('Verifying About tables...');
  const count = await prisma.aboutPage.count();
  console.log('✅ aboutPage table exists. Row count:', count);

  const seoCount = await prisma.aboutSeo.count();
  console.log('✅ aboutSeo table exists. Row count:', seoCount);

  const sectionCount = await prisma.aboutSection.count();
  console.log('✅ aboutSection table exists. Row count:', sectionCount);

  const revisionCount = await prisma.aboutRevision.count();
  console.log('✅ aboutRevision table exists. Row count:', revisionCount);

  await prisma.$disconnect();
  console.log('All About tables verified successfully.');
}

main().catch((e) => {
  console.error('❌ Verification failed:', e.message);
  process.exit(1);
});
