import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function cleanOrphans() {
  console.log("🧹 Checking and cleaning orphaned database records before migration...");

  const userDependentTables = [
    "freelancer_services",
    "freelancer_achievements",
    "freelancer_languages",
    "freelancer_educations",
    "freelancer_certifications",
    "freelancer_experiences",
    "freelancer_portfolios",
  ];

  for (const table of userDependentTables) {
    try {
      const count = await prisma.$executeRawUnsafe(
        `DELETE FROM \`${table}\` WHERE \`user_id\` NOT IN (SELECT \`id\` FROM \`users\`)`
      );
      if (count > 0) {
        console.log(`✅ Removed ${count} orphaned record(s) from table \`${table}\`.`);
      }
    } catch (err: any) {
      // If table doesn't exist yet, ignore
    }
  }

  console.log("✨ Database cleanup complete. Ready for prisma db push!");
}

cleanOrphans()
  .catch((err) => {
    console.error("Cleanup error:", err);
  })
  .finally(() => prisma.$disconnect());
