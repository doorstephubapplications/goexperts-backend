import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const project = await prisma.project.findFirst();

  if (project) {
    const user = await prisma.user.findFirst({
      where: { id: project.client }
    });

    if (user) {
      console.log("=== FOUND CLIENT WITH PROJECTS ===");
      console.log("Email:", user.email);
      console.log("Role:", user.role);
      console.log("Project Title:", project.title);
      console.log("==================================");
    } else {
      console.log("Project found, but user with ID", project.client, "not found.");
    }
  } else {
    // If no project found, let's just find any client user
    const user = await prisma.user.findFirst({
      where: { role: { in: ['CLIENT', 'BUSINESS', 'client', 'business'] } }
    });
    if (user) {
      console.log("=== NO PROJECTS, BUT FOUND CLIENT ===");
      console.log("Email:", user.email);
      console.log("Role:", user.role);
      console.log("=====================================");
    } else {
      console.log("No client found at all.");
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
