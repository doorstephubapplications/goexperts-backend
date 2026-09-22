import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function patchPricingLinks() {
  console.log('Patching existing Pricing footer links...');

  const updates = [
    { key: 'freelancers', href: '/pricing?role=freelancer' },
    { key: 'clients', href: '/pricing?role=client' },
    { key: 'investors', href: '/pricing?role=investor' },
    { key: 'founders', href: '/pricing?role=founder' },
  ];

  for (const { key, href } of updates) {
    const columns = await (prisma as any).footerColumn.findMany({
      where: { key },
      include: { links: true },
    });

    for (const col of columns) {
      const pricingLink = col.links.find((l: any) => l.label === 'Pricing');
      if (pricingLink) {
        await (prisma as any).footerLink.update({
          where: { id: pricingLink.id },
          data: { href },
        });
        console.log(`Updated Pricing link in column ${key} to ${href}`);
      }
    }
  }
  console.log('Done!');
}

patchPricingLinks()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
