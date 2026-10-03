const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  const campaigns = await prisma.pushCampaign.findMany();
  
  if (campaigns.length === 0) {
    console.log("No campaigns found in local database.");
    return;
  }

  let sql = 'INSERT INTO `push_campaigns` (`id`, `title`, `description`, `image_url`, `target_role`, `category`, `offer`, `deep_link`, `status`, `schedule_slot`, `created_at`, `updated_at`, `send_count`, `click_count`) VALUES\n';
  
  const values = campaigns.map(c => {
    const escapeStr = (str) => str ? `'${str.replace(/'/g, "''")}'` : 'NULL';
    
    // Format dates correctly for MySQL
    const formatDt = (dt) => {
      if (!dt) return 'NULL';
      const d = new Date(dt);
      return `'${d.toISOString().slice(0, 19).replace('T', ' ')}'`;
    };

    return `('${c.id}', ${escapeStr(c.title)}, ${escapeStr(c.description)}, ${escapeStr(c.imageUrl)}, ${escapeStr(c.targetRole)}, ${escapeStr(c.category)}, ${escapeStr(c.offer)}, ${escapeStr(c.deepLink)}, ${escapeStr(c.status)}, ${escapeStr(c.scheduleSlot)}, ${formatDt(c.createdAt)}, ${formatDt(c.updatedAt)}, ${c.sendCount || 0}, ${c.clickCount || 0})`;
  });

  sql += values.join(',\n') + ';\n';
  fs.writeFileSync('exact_local_dump.sql', sql);
  console.log('Dumped exactly ' + campaigns.length + ' records from local DB to exact_local_dump.sql');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
