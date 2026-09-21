const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const mo = await prisma.masterOption.findMany({
    select: { id: true, label: true, value: true }
  });
  console.log('Master options count:', mo.length);
}

run().catch(console.error).finally(() => prisma.$disconnect());
