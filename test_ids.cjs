const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const ids = [
    "0ddfb6a1-4cad-4ed9-8a62-db93ad219546",
    "dc78baaa-d559-4186-a07a-2dc0400d3206",
    "bfd1e894-8a99-4bc6-8c63-ef2a56b8b414",
    "2819d222-0af1-4f3b-b069-9a113b674837"
  ];
  const mo = await prisma.masterOption.findMany({
    where: { id: { in: ids } }
  });
  console.log('Master options found:', mo.length);
  console.log(mo);

  const categories = await prisma.category.findMany({
    where: { id: { in: ids } }
  }).catch(() => []);
  console.log('Categories found:', categories.length);
  console.log(categories);

  const skills = await prisma.skill.findMany({
    where: { id: { in: ids } }
  }).catch(() => []);
  console.log('Skills found:', skills.length);
  console.log(skills);
}

run().catch(console.error).finally(() => prisma.$disconnect());
