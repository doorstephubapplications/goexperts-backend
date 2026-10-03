import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const roles = ['FREELANCER', 'CLIENT', 'FOUNDER', 'INVESTOR'];
const categories = ['Promotion', 'Update', 'Event', 'Security', 'System', 'Account'];
const scheduleSlots = ['SLOT_1', 'SLOT_2', 'SLOT_3'];
const images = [
  'https://images.unsplash.com/photo-1558655146-d09347e92766?w=600&auto=format&fit=crop',
  null
];
const offers = [
  'WELCOME50',
  'HOLIDAY10',
  'SPECIAL_DEAL',
  'FLASH24',
  null,
  'SAVE20'
];

let sql = 'INSERT INTO `push_campaigns` (`id`, `title`, `description`, `image_url`, `target_role`, `category`, `offer`, `deep_link`, `status`, `schedule_slot`, `created_at`, `updated_at`, `send_count`, `click_count`) VALUES\n';

const records = [];
for (let i = 1; i <= 120; i++) {
  const id = uuidv4();
  const role = roles[(i - 1) % 4];
  const category = categories[(i - 1) % categories.length];
  const title = `Targeted Notification ${i} for ${role}`;
  const description = `This is an automated campaign description for record ${i}. It highlights new updates and features for ${role} users on our platform.`;
  const image = images[i % 2] ? `'${images[i % 2]}'` : 'NULL';
  const offer = offers[i % offers.length] ? `'${offers[i % offers.length]}'` : 'NULL';
  const link = i % 3 === 0 ? '/dashboard' : '/profile';
  const status = i % 4 === 0 ? 'PAUSED' : 'ACTIVE';
  const slot = scheduleSlots[(i - 1) % 3];

  records.push(`('${id}', '${title}', '${description}', ${image}, '${role}', '${category}', ${offer}, '${link}', '${status}', '${slot}', NOW(), NOW(), 0, 0)`);
}

sql += records.join(',\n') + ';\n';
fs.writeFileSync('120_campaigns_seed.sql', sql);
console.log('Done');
