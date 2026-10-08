import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillUserRoles() {
  console.log('Starting Legacy UserRole Backfill...');

  // 1. Fetch all users and their profiles
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    include: {
      freelancerProfile: { select: { id: true, titleHeadline: true } },
      clientProfile: { select: { id: true, companyName: true } },
      founderProfile: { select: { id: true, companyName: true } },
      investorProfile: { select: { id: true, firmName: true } },
      userRoles: true,
      subscriptions: { where: { status: 'active' } }
    },
  });

  console.log(`Found ${users.length} active users.`);

  let createdCount = 0;
  let skippedCount = 0;
  let ambiguousCount = 0;
  let dryRunCount = 0;

  const isDryRun = process.argv.includes('--execute') === false;

  if (isDryRun) {
    console.log('--- DRY RUN MODE ENABLED ---');
    console.log('To execute database writes, run with: --execute');
  } else {
    console.warn('!!! EXECUTE MODE ENABLED - MODIFYING DATABASE !!!');
  }

  for (const user of users) {
    const rolesToCreate = new Set<string>();

    // Rule 1: Primary role is always considered active (even if no subscription)
    if (user.role) {
      rolesToCreate.add(user.role);
    }

    // Rule 2: ZERO AUTOMATIC LEGACY ACTIVATION
    // As per strictly enforced business rules, a paid subscription or completed profile
    // does not constitute reliable, independently verifiable evidence of prior activation.
    // Therefore, ALL additional profiles discovered during backfill are considered AMBIGUOUS
    // and must be skipped for manual reconciliation.
    
    let ambiguous = false;
    if (user.freelancerProfile && user.role !== 'freelancer') ambiguous = true;
    if (user.clientProfile && user.role !== 'client' && user.role !== 'business') ambiguous = true;
    if (user.founderProfile && user.role !== 'founder' && user.role !== 'startup') ambiguous = true;
    if (user.investorProfile && user.role !== 'investor') ambiguous = true;

    if (ambiguous) {
      ambiguousCount++;
      console.warn(`[SKIPPED - AMBIGUOUS] User ${user.email} (${user.id}) has additional profiles. Skipping automatic activation due to ZERO AUTOMATIC LEGACY ACTIVATION rule. Manual reconciliation required.`);
    }

    // Insert UserRoles idempotently
    for (const role of rolesToCreate) {
      const exists = user.userRoles.some((ur: any) => ur.role === role);
      if (!exists) {
        if (isDryRun) {
          dryRunCount++;
          console.log(`[DRY RUN] Would create UserRole '${role}' for ${user.email}`);
        } else {
          await prisma.userRole.create({
            data: {
              userId: user.id,
              role: role,
              status: 'active',
            }
          });
          createdCount++;
          console.log(`- Created UserRole '${role}' for ${user.email}`);
        }
      } else {
        skippedCount++;
      }
    }
  }

  console.log('--- Backfill Complete ---');
  if (isDryRun) console.log(`[DRY RUN] Planned records to create: ${dryRunCount}`);
  console.log(`Created records (executed): ${createdCount}`);
  console.log(`Skipped existing valid records: ${skippedCount}`);
  console.log(`Ambiguous legacy accounts skipped (needs manual check): ${ambiguousCount}`);
}

backfillUserRoles()
  .catch((e) => {
    console.error('Backfill failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
