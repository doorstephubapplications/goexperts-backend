import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.footerLink.findMany({ where: { label: 'Careers' }, select: { label: true, href: true } })
  .then(r => { console.log(JSON.stringify(r, null, 2)); })
  .catch(console.error)
  .finally(() => p.$disconnect());
