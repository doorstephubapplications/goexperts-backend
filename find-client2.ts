import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({
    where: { role: { in: ['client', 'business'] } }
  });
  if (user) {
    console.log("Client Email:", user.email);
    console.log("Password: Use the common default (e.g. Password123) or reset it via Prisma Studio.");
  }
  await prisma.$disconnect();
}
main();
