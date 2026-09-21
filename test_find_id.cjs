const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const id = "0ddfb6a1-4cad-4ed9-8a62-db93ad219546"; // category ID
  const wmId = "2819d222-0af1-4f3b-b069-9a113b674837"; // workMode ID

  for (const model of Object.keys(prisma)) {
    if (typeof prisma[model]?.findFirst === 'function' && !model.startsWith('$')) {
      try {
        const row1 = await prisma[model].findFirst({ where: { id: id } });
        if (row1) console.log(`Found category ${id} in ${model}:`, row1);
        const row2 = await prisma[model].findFirst({ where: { id: wmId } });
        if (row2) console.log(`Found workMode ${wmId} in ${model}:`, row2);
      } catch (e) {
        // ignore models without 'id'
      }
    }
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
