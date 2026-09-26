const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [
          '1cae8fda-9440-4237-8a4b-e70df1b9e6e2',
          '60098b3f-3d43-4408-b226-efa4a968a836',
          'd8d2de71-4ea0-49a9-bf24-4f292c549cfd'
        ]
      }
    }
  });
  console.log('Found users:', users.map(u => u.id));
}
main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
