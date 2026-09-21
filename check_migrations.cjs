const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const migrations = await prisma.$queryRaw`SELECT * FROM _prisma_migrations`;
  console.log("Migrations applied:");
  console.table(migrations);
}

main().catch(console.error).finally(() => prisma.$disconnect());
