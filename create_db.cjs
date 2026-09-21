const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('CREATE DATABASE expertsportal_baseline_test;');
  console.log('Database created');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
