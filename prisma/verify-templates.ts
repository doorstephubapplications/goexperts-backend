import { MASTER_EMAIL_TEMPLATES } from "../src/services/settings/email-templates.master.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  console.log("Total Master Templates:", MASTER_EMAIL_TEMPLATES.length);
  const setting = await prisma.setting.findUnique({
    where: { key: "settings:section:email_templates" },
  });
  if (!setting) {
    console.log("Setting not found in DB!");
    return;
  }
  const dbTemplates = JSON.parse(setting.value as string);
  console.log("Total DB Templates:", dbTemplates.length);

  const dbIds = new Set(dbTemplates.map((t: any) => t.id));
  const missingInDb = MASTER_EMAIL_TEMPLATES.filter((t) => !dbIds.has(t.id));
  console.log("Missing in DB count:", missingInDb.length);
  if (missingInDb.length > 0) {
    console.log("Missing IDs:", missingInDb.map((t) => t.id));
  }

  console.log("\n=== ALL MASTER TEMPLATE IDS ===");
  MASTER_EMAIL_TEMPLATES.forEach((t, i) => {
    console.log(`${i + 1}. [${t.module}] ${t.id} -> ${t.name}`);
  });
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
