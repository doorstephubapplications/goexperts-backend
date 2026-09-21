const fs = require('fs');
const file = 'c:\\Users\\LENOVO\\Desktop\\vinod\\goexperts\\Go-Experts-backend\\src\\controllers\\client\\client.controller.ts';
let content = fs.readFileSync(file, 'utf8');

const enrichLogicNew = `
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

  if (allIds.size > 0) {
    const idsArr = Array.from(allIds);
    const [moRes, userRes, industryRes, workModeRes, skillRes, categoryRes] = await Promise.all([
      (prisma as any).masterOption?.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, label: true, value: true }
      }).catch(() => []),
      prisma.user.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, fullName: true }
      }).catch(() => []),
      prisma.industry.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, name: true }
      }).catch(() => []),
      (prisma as any).workMode?.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, name: true }
      }).catch(() => []),
      prisma.skill.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, name: true }
      }).catch(() => []),
      prisma.skillCategory.findMany({
        where: { id: { in: idsArr } },
        select: { id: true, name: true }
      }).catch(() => [])
    ]);
    
    moRes?.forEach((mo: any) => moMap.set(mo.id, mo.label || mo.value));
    userRes?.forEach((u: any) => moMap.set(u.id, u.fullName));
    industryRes?.forEach((i: any) => moMap.set(i.id, i.name));
    workModeRes?.forEach((w: any) => moMap.set(w.id, w.name));
    skillRes?.forEach((s: any) => moMap.set(s.id, s.name));
    categoryRes?.forEach((c: any) => moMap.set(c.id, c.name));
  }

  const mapVal = (val: any) => {
    if (typeof val !== 'string') return val;
    return val.split(',').map(s => {
      const t = s.trim();
      // Handle prefix fallbacks for experience level if needed
      if (t === 'mo_experience_level_intermediate') return 'Intermediate';
      if (t === 'mo_experience_level_expert') return 'Expert';
      if (t === 'mo_experience_level_beginner') return 'Beginner';
      return moMap.get(t) || t;
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
    clientName: moMap.get(r.client) || r.client,
    attachmentsParsed: (() => {
      if (!r.attachments) return [];
      try { return JSON.parse(r.attachments); } catch { return []; }
    })()
  }));
}
`;

// Replace the old enrichProjects function block entirely
const startIdx = content.indexOf('async function enrichProjects(projects: any[]) {');
if (startIdx !== -1) {
  const endIdx = content.indexOf('}', content.indexOf('  attachmentsParsed: (() => {', startIdx)) + 9;
  // find the end of the enrichProjects function properly
  // Since it ends with a closing brace after attachmentsParsed:
  let realEndIdx = content.indexOf('}', content.indexOf('attachmentsParsed:', startIdx));
  realEndIdx = content.indexOf('}', realEndIdx + 1); // end of map return
  realEndIdx = content.indexOf(')', realEndIdx + 1); // end of .map()
  realEndIdx = content.indexOf(';', realEndIdx + 1); // end of statement
  realEndIdx = content.indexOf('}', realEndIdx + 1); // end of function

  content = content.substring(0, startIdx) + enrichLogicNew + content.substring(realEndIdx + 1);
  fs.writeFileSync(file, content);
  console.log('Successfully updated enrichProjects!');
} else {
  console.log('enrichProjects not found, something is wrong.');
}
