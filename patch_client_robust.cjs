const fs = require('fs');
const file = 'c:\\Users\\LENOVO\\Desktop\\vinod\\goexperts\\Go-Experts-backend\\src\\controllers\\client\\client.controller.ts';
let content = fs.readFileSync(file, 'utf8');

const enrichLogic = `
async function enrichProjects(projects: any[]) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const allIds = new Set<string>();
  
  projects.forEach(r => {
    ['category', 'technology', 'workMode', 'industryId', 'experienceLevel', 'skills'].forEach(field => {
      const val = (r as any)[field];
      if (typeof val === 'string') {
        val.split(',').map(s => s.trim()).filter(s => uuidRegex.test(s)).forEach(id => allIds.add(id));
      }
    });
    if (r.client && uuidRegex.test(r.client)) allIds.add(r.client);
  });

  const moMap = new Map<string, string>();
  const userMap = new Map<string, string>();

  if (allIds.size > 0) {
    const idsArr = Array.from(allIds);
    const [moRes, userRes] = await Promise.all([
      (prisma as any).masterOption?.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, label: true, value: true }
      }).catch(() => []),
      prisma.user.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, fullName: true }
      }).catch(() => [])
    ]);
    
    moRes?.forEach((mo: any) => moMap.set(mo.id, mo.label || mo.value));
    userRes?.forEach((u: any) => userMap.set(u.id, u.fullName));
  }

  const mapVal = (val: any) => {
    if (typeof val !== 'string') return val;
    return val.split(',').map(s => {
      const t = s.trim();
      return moMap.get(t) || userMap.get(t) || t;
    }).join(', ');
  };

  return projects.map(r => ({
    ...r,
    category: mapVal(r.category),
    technology: mapVal(r.technology),
    workMode: mapVal(r.workMode),
    industryId: mapVal(r.industryId),
    experienceLevel: mapVal(r.experienceLevel),
    skills: mapVal((r as any).skills),
    clientName: userMap.get(r.client) || r.client,
    attachmentsParsed: (() => {
      if (!r.attachments) return [];
      try { return JSON.parse(r.attachments); } catch { return []; }
    })()
  }));
}
`;

if (!content.includes('async function enrichProjects')) {
  content += enrichLogic;
}

// 1. Update listClientProjects using substring replace
const listSearch = `    const enrichedRows = rows.map(r => {
      const br = budgetRanges.find(b => b.id === r.budgetRangeId);
      return {
        ...r,
        budgetRange: br ? { id: br.id, label: br.label, min: br.min, max: br.max, value: br.value } : null
      };
    });`;

const listReplace = `    let enrichedRows = rows.map(r => {
      const br = budgetRanges.find(b => b.id === r.budgetRangeId);
      return {
        ...r,
        budgetRange: br ? { id: br.id, label: br.label, min: br.min, max: br.max, value: br.value } : null
      };
    });
    enrichedRows = await enrichProjects(enrichedRows);`;

// Let's use a regex that ignores whitespace differences
const listRegex = /const enrichedRows = rows\.map\(r => \{[\s\S]*?budgetRange: br \? \{ id: br\.id, label: br\.label, min: br\.min, max: br\.max, value: br\.value \} : null\s*\};\s*\}\);/;
content = content.replace(listRegex, listReplace);

// 2. Update getClientProject
const getReturnRegex = /res\.json\(\{ success: true, data: \{ \.\.\.project, budgetRange, tasks, proposals, contracts \} \}\);/;
const getReturnReplace = `const enrichedProject = (await enrichProjects([{ ...project, budgetRange, tasks, proposals, contracts }]))[0];
    res.json({ success: true, data: enrichedProject });`;
content = content.replace(getReturnRegex, getReturnReplace);

fs.writeFileSync(file, content);
console.log('client.controller.ts safely patched with regex!');
