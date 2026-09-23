require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');

function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'supersecret';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

const adminToken = signToken({ id: 'cmudoakka0001sotorxo92axw', role: 'SUPER_ADMIN', email: 'superadmin@goexperts.com' });
const API_BASE_ADMIN = 'http://localhost:5001/api/admin';
const API_BASE_PUBLIC = 'http://localhost:5001/api/v1/public';

async function fetchJSON(url, options = {}) {
  return new Promise((resolve, reject) => {
    const { URL } = require('url');
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function run() {
  console.log('--- ABOUT PAGE E2E TRACE ---');
  
  // 1. Fetch current draft from admin API
  console.log('1. Fetching Admin About Page...');
  const adminRes = await fetchJSON(`${API_BASE_ADMIN}/about-page`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  
  if (adminRes.status !== 200) {
    console.error('Failed to fetch admin about page', adminRes);
    process.exit(1);
  }
  
  let currentDraftVersion = adminRes.data?.meta?.draftVersion || 1;
  const sections = adminRes.data?.draft?.sections || [];
  
  // FIX INVALID ROLES SECTION
  const rolesSection = sections.find(s => s.sectionKey === 'roles');
  if (rolesSection) {
    console.log('Fixing roles section...');
    const fixedRolesContent = { ...rolesSection.content, title: 'Roles', roles: rolesSection.content.roles.map(r => ({...r, role: r.title})) };
    const res = await fetchJSON(`${API_BASE_ADMIN}/about-page/sections/${rolesSection.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentVersion: currentDraftVersion, content: fixedRolesContent })
    });
    if (res.status === 200) currentDraftVersion++;
  }

  // ENABLE AND FIX HOW_IT_WORKS SECTION
  const hiwSection = sections.find(s => s.sectionKey === 'how_it_works');
  if (hiwSection) {
    console.log('Enabling & fixing how_it_works section...');
    const hiwContent = { title: 'How it works', steps: [{ title: 'Step 1', description: 'Desc 1' }] };
    const res = await fetchJSON(`${API_BASE_ADMIN}/about-page/sections/${hiwSection.id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentVersion: currentDraftVersion, enabled: true, content: hiwContent })
    });
    if (res.status === 200) currentDraftVersion++;
  }
  
  const missionSection = sections.find(s => s.sectionKey === 'mission-vision') || sections[0];
  const originalContent = missionSection.content;

  // 2. Modify MISSION section (Save Draft)
  console.log('2. Saving Draft with QA Test Mission...');
  const updateRes = await fetchJSON(`${API_BASE_ADMIN}/about-page/sections/${missionSection.id}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentVersion: currentDraftVersion,
      content: { ...missionSection.content, title: 'QA Test Mission', missionTitle: 'QA Test Mission' }
    })
  });
  
  if (updateRes.status !== 200) {
    console.error('Failed to update draft', updateRes);
    process.exit(1);
  }
  
  currentDraftVersion++;

  // 3. Verify Public API (Draft should NOT be visible)
  console.log('3. Verifying Public API (Pre-Publish)...');
  const pub1 = await fetchJSON(`${API_BASE_PUBLIC}/about`);
  
  const pubMission1 = pub1.data?.sections?.find(s => s.sectionKey === missionSection.sectionKey);
  console.log('Public Mission Title:', pubMission1?.content?.missionTitle || pubMission1?.content?.title);
  if (pubMission1?.content?.missionTitle === 'QA Test Mission' || pubMission1?.content?.title === 'QA Test Mission') {
    console.error('ERROR: Draft content leaked to public API!');
    process.exit(1);
  }

  // 4. Publish via Nexus API
  console.log('4. Publishing Draft...');
  const publishRes = await fetchJSON(`${API_BASE_ADMIN}/about-page/publish`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentVersion: currentDraftVersion })
  });
  
  if (publishRes.status !== 200) {
    console.error('Failed to publish', publishRes);
    process.exit(1);
  }

  // 5. Verify Public API (Published SHOULD be visible)
  console.log('5. Verifying Public API (Post-Publish)...');
  const pub2 = await fetchJSON(`${API_BASE_PUBLIC}/about`);
  const pubMission2 = pub2.data?.sections?.find(s => s.sectionKey === missionSection.sectionKey);
  console.log('Public Mission Title after publish:', pubMission2?.content?.missionTitle || pubMission2?.content?.title);
  
  if (pubMission2?.content?.missionTitle !== 'QA Test Mission' && pubMission2?.content?.title !== 'QA Test Mission') {
    console.error('ERROR: Published content did not appear in public API!');
    process.exit(1);
  }

  // 6. Revert Draft & Republish
  console.log('6. Reverting Test Data...');
  const revertRes = await fetchJSON(`${API_BASE_ADMIN}/about-page/sections/${missionSection.id}`, {
    method: 'PUT',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentVersion: currentDraftVersion, content: originalContent })
  });
  
  if (revertRes.status !== 200) {
    console.error('Failed to revert', revertRes);
    process.exit(1);
  }
  currentDraftVersion++;
  
  await fetchJSON(`${API_BASE_ADMIN}/about-page/publish`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentVersion: currentDraftVersion })
  });

  const pub3 = await fetchJSON(`${API_BASE_PUBLIC}/about`);
  console.log('Final Public Mission Title:', pub3.data?.sections?.find(s => s.sectionKey === missionSection.sectionKey)?.content?.missionTitle || pub3.data?.sections?.find(s => s.sectionKey === missionSection.sectionKey)?.content?.title);

  console.log('E2E TRACE COMPLETE. ALL PASS.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
