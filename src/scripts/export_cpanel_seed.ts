import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function escapeSqlString(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return "'" + str.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function escapeSqlJson(obj: any): string {
  if (obj === null || obj === undefined) return 'NULL';
  return "'" + JSON.stringify(obj).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function escapeSqlBoolean(bool: boolean): string {
  return bool ? '1' : '0';
}

function escapeSqlDate(date: Date | null | undefined): string {
  if (!date) return 'NULL';
  return "'" + date.toISOString().slice(0, 19).replace('T', ' ') + "'";
}

async function exportTableToSql(modelName: string, dbName: string, data: any[]): Promise<string> {
  if (data.length === 0) return '';
  
  const columns = Object.keys(data[0]);
  let sql = `-- Dumping ${data.length} rows for model ${modelName} -> table ${dbName}\n`;
  sql += `INSERT INTO \`${dbName}\` (\`${columns.join('`, `')}\`) VALUES\n`;
  
  const rows = data.map(row => {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return escapeSqlBoolean(val);
      if (val instanceof Date) return escapeSqlDate(val);
      if (typeof val === 'object') return escapeSqlJson(val);
      if (typeof val === 'number') return val.toString();
      return escapeSqlString(val.toString());
    });
    return `  (${values.join(', ')})`;
  });
  
  sql += rows.join(',\n') + ';\n\n';
  return sql;
}

async function main() {
  console.log('Generating cPanel SQL seed dump dynamically...');
  let sqlDump = '-- Go Experts Seed Data for cPanel / phpMyAdmin\n';
  sqlDump += '-- Generated on: ' + new Date().toISOString() + '\n\n';
  sqlDump += 'SET FOREIGN_KEY_CHECKS = 0;\n\n';

  // Get all models from Prisma DMMF
  const models = Prisma.dmmf.datamodel.models;
  
  // Filter for models related to About, Faq, Footer
  const targetModels = models.filter(m => 
    m.name.toLowerCase().includes('about') || 
    m.name.toLowerCase().includes('faq') || 
    m.name.toLowerCase().includes('footer')
  );

  console.log(`Found ${targetModels.length} matching models:`, targetModels.map(m => m.name).join(', '));

  for (const model of targetModels) {
    // Determine the prisma client property name (usually camelCase of model name)
    const propertyName = model.name.charAt(0).toLowerCase() + model.name.slice(1);
    const dbName = model.dbName || model.name;

    try {
      if ((prisma as any)[propertyName]) {
        const data = await (prisma as any)[propertyName].findMany();
        console.log(`Extracted ${data.length} records from ${model.name}`);
        if (data.length > 0) {
          sqlDump += await exportTableToSql(model.name, dbName, data);
        }
      } else {
        console.warn(`Warning: Could not find prisma.${propertyName}`);
      }
    } catch (err: any) {
      console.error(`Error querying ${model.name}:`, err.message);
    }
  }

  sqlDump += 'SET FOREIGN_KEY_CHECKS = 1;\n';

  const outputPath = path.join(process.cwd(), 'cpanel_seed_data.sql');
  fs.writeFileSync(outputPath, sqlDump, 'utf8');
  console.log(`✅ SQL Dump generated successfully at:\n${outputPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
