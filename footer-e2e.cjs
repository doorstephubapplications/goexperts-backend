const { PrismaClient } = require('@prisma/client');
const http = require('http');
const prisma = new PrismaClient();
const { FooterAdminService } = require('./src/modules/footer/footer.service.js');
const service = new FooterAdminService();

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
  const draft = await service.getDraft();
  if (!draft) throw new Error('No draft found');

  const firstColumn = draft.columns[0];
  if (!firstColumn) throw new Error('No columns in draft');

  console.log('2. Adding QA Test Footer Link to draft...');
  const link = await service.addLink(firstColumn.id, {
    label: 'QA Test Footer Link',
    href: 'https://qa.example.com',
    routeType: 'EXTERNAL',
    external: true,
    openInNewTab: true
  });
  console.log('Added Link ID:', link.id);

  console.log('3. Verifying Public API (Draft should NOT be visible)...');
  const pub1 = await fetchPublic();
  const foundInDraftOnly = pub1.data.columns.flatMap(c => c.links).find(l => l.label === 'QA Test Footer Link');
  console.log('Found in Public API before publish:', !!foundInDraftOnly);
  if (foundInDraftOnly) {
    console.error('ERROR: Draft link leaked to public API!');
    process.exit(1);
  }

  console.log('4. Publishing Draft...');
  await service.publish(draft.id, 'system-test');

  console.log('5. Verifying Public API (Published SHOULD be visible)...');
  const pub2 = await fetchPublic();
  const foundAfterPublish = pub2.data.columns.flatMap(c => c.links).find(l => l.label === 'QA Test Footer Link');
  console.log('Found in Public API after publish:', !!foundAfterPublish);
  if (!foundAfterPublish) {
    console.error('ERROR: Published link did NOT appear in public API!');
    process.exit(1);
  }

  console.log('6. Reverting Test Data (Deleting Link & Republishing)...');
  await service.deleteLink(link.id);
  await service.publish(draft.id, 'system-test');

  console.log('7. Final Verification...');
  const pub3 = await fetchPublic();
  const foundAfterRevert = pub3.data.columns.flatMap(c => c.links).find(l => l.label === 'QA Test Footer Link');
  console.log('Found in Public API after revert:', !!foundAfterRevert);
  if (foundAfterRevert) {
    console.error('ERROR: Revert failed!');
    process.exit(1);
  }

  console.log('E2E TRACE COMPLETE. ALL PASS.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
