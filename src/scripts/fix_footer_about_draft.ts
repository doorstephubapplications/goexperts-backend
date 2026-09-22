/**
 * fix_footer_draft.ts
 * Creates a DRAFT footer config by cloning the PUBLISHED one if no DRAFT exists.
 * Also creates the CmsPage record for the About page admin editor.
 */
import { prisma } from '../config/database.js';

async function main() {
  // ── FOOTER: ensure DRAFT exists ──────────────────────────────
  const published = await (prisma as any).footerConfig.findFirst({
    where: { status: 'PUBLISHED' },
    include: {
      columns: {
        orderBy: { sortOrder: 'asc' },
        include: { links: { orderBy: { sortOrder: 'asc' } } },
      },
      socialLinks: { orderBy: { sortOrder: 'asc' } },
      appLinks: true,
      legalLinks: { orderBy: { sortOrder: 'asc' } },
    },
  });

  const draft = await (prisma as any).footerConfig.findFirst({
    where: { status: 'DRAFT' },
  });

  if (!draft && published) {
    console.log('📋 No DRAFT footer found — cloning from PUBLISHED...');

    const newDraft = await (prisma as any).footerConfig.create({
      data: {
        tagline: published.tagline,
        description: published.description,
        copyrightText: published.copyrightText,
        newsletterEnabled: published.newsletterEnabled,
        newsletterTitle: published.newsletterTitle,
        newsletterDescription: published.newsletterDescription,
        newsletterPlaceholder: published.newsletterPlaceholder,
        newsletterButtonText: published.newsletterButtonText,
        status: 'DRAFT',
      },
    });

    // Clone columns + links
    for (const col of (published.columns || [])) {
      const newCol = await (prisma as any).footerColumn.create({
        data: {
          config: { connect: { id: newDraft.id } },
          title: col.title,
          key: col.key,
          sortOrder: col.sortOrder,
          isEnabled: col.isEnabled,
        },
      });
      for (const link of (col.links || [])) {
        await (prisma as any).footerLink.create({
          data: {
            column: { connect: { id: newCol.id } },
            label: link.label,
            href: link.href,
            routeType: link.routeType,
            external: link.external,
            openInNewTab: link.openInNewTab,
            sortOrder: link.sortOrder,
            isEnabled: link.isEnabled,
          },
        });
      }
    }

    // Clone social links
    for (const s of (published.socialLinks || [])) {
      await (prisma as any).footerSocialLink.create({
        data: {
          config: { connect: { id: newDraft.id } },
          platform: s.platform,
          url: s.url,
          label: s.label,
          sortOrder: s.sortOrder,
          isEnabled: s.isEnabled,
        },
      });
    }

    // Clone legal links
    for (const l of (published.legalLinks || [])) {
      await (prisma as any).footerLegalLink.create({
        data: {
          config: { connect: { id: newDraft.id } },
          label: l.label,
          href: l.href,
          sortOrder: l.sortOrder,
          isEnabled: l.isEnabled,
        },
      });
    }

    console.log('✅ Footer DRAFT created:', newDraft.id);
  } else if (draft) {
    console.log('ℹ️  Footer DRAFT already exists:', draft.id);
  } else {
    console.log('⚠️  No PUBLISHED footer found either — please run seed_footer.ts first.');
  }

  // ── ABOUT PAGE: ensure CmsPage record exists for admin editor ──
  const aboutCmsPage = await prisma.cmsPage.findUnique({
    where: { name: 'about-page' },
  });

  if (!aboutCmsPage) {
    console.log('📋 No CmsPage "about-page" found — creating empty record...');
    const page = await prisma.cmsPage.create({
      data: {
        name: 'about-page',
        category: 'content',
        status: 'draft',
        version: 1,
        updated: new Date().toLocaleString(),
      },
    });
    console.log('✅ About CmsPage created:', page.id);
  } else {
    console.log('ℹ️  About CmsPage already exists:', aboutCmsPage.id, '| status:', aboutCmsPage.status);
  }

  console.log('\n✅ All done.');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
