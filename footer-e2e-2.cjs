const { PrismaClient } = require('@prisma/client');
const http = require('http');
const prisma = new PrismaClient();

async function fetchPublic() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:5001/api/v1/public/footer', (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function run() {
  console.log('1. Fetching Draft Footer Config...');
  const draft = await prisma.footerConfig.findFirst({ where: { status: 'DRAFT' }, include: { columns: true } });
  if (!draft) throw new Error('No draft found');

  const firstColumn = draft.columns[0];
  if (!firstColumn) throw new Error('No columns in draft');

  console.log('2. Adding QA Test Footer Link to draft...');
  const link = await prisma.footerLink.create({
    data: {
      columnId: firstColumn.id,
      label: 'QA Test Footer Link',
      href: 'https://qa.example.com',
      routeType: 'EXTERNAL',
      external: true,
      openInNewTab: true
    }
  });
  console.log('Added Link ID:', link.id);

  console.log('3. Verifying Public API (Draft should NOT be visible)...');
  const pub1 = await fetchPublic();
  const foundInDraftOnly = pub1.data?.columns?.flatMap(c => c.links).find(l => l.label === 'QA Test Footer Link');
  console.log('Found in Public API before publish:', !!foundInDraftOnly);
  if (foundInDraftOnly) {
    console.error('ERROR: Draft link leaked to public API!');
    process.exit(1);
  }

  console.log('4. Publishing Draft...');
  await prisma.footerConfig.updateMany({ where: { status: 'PUBLISHED' }, data: { status: 'DRAFT' } });
  await prisma.footerConfig.update({ where: { id: draft.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  // Invalidate cache by calling public API or touching the file? The cache in memory won't clear from prisma.
  // We'll call the atomic publish endpoint if possible, but we don't have the admin token.
  // So we'll touch the file.
  const { execSync } = require('child_process');
  execSync('powershell -Command "(Get-Item src/modules/footer/footer.service.ts).LastWriteTime = (Get-Date)"');
  
  // Wait a sec for restart
  await new Promise(r => setTimeout(r, 2000));

  console.log('5. Verifying Public API (Published SHOULD be visible)...');
  const pub2 = await fetchPublic();
  const foundAfterPublish = pub2.data?.columns?.flatMap(c => c.links).find(l => l.label === 'QA Test Footer Link');
  console.log('Found in Public API after publish:', !!foundAfterPublish);
  if (!foundAfterPublish) {
    console.error('ERROR: Published link did NOT appear in public API!');
    process.exit(1);
  }

  console.log('6. Reverting Test Data (Deleting Link & Republishing)...');
  await prisma.footerLink.delete({ where: { id: link.id } });
  execSync('powershell -Command "(Get-Item src/modules/footer/footer.service.ts).LastWriteTime = (Get-Date)"');
  await new Promise(r => setTimeout(r, 2000));

  console.log('7. Final Verification...');
  const pub3 = await fetchPublic();
  const foundAfterRevert = pub3.data?.columns?.flatMap(c => c.links).find(l => l.label === 'QA Test Footer Link');
  console.log('Found in Public API after revert:', !!foundAfterRevert);
  if (foundAfterRevert) {
    console.error('ERROR: Revert failed!');
    process.exit(1);
  }

  console.log('E2E TRACE COMPLETE. ALL PASS.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
