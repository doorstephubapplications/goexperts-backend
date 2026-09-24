import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const faqs = await prisma.fAQ.findMany({
      where: {
        isPublished: true,
        role: { in: ['GENERAL', 'FREELANCER'] },
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, slug: true, icon: true, sortOrder: true }
        }
      }
    });
    console.log("SUCCESS:", faqs.length);
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
