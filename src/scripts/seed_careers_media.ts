import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { UPLOADS_DIR } from "../config/uploads.js";

const prisma = new PrismaClient();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We assume the agent will copy the images to a temporary source directory,
// or we can just specify their source paths from the .gemini artifacts dir.
const SOURCE_DIR = "C:/Users/LENOVO/.gemini/antigravity-ide/brain/8c635146-e6c9-4268-b8c4-e8700ea16183";
const DEST_DIR = path.join(UPLOADS_DIR, "careers");

const IMAGES = [
  { file: "careers_hero_1790083234592.jpg", name: "Hero Image" },
  { file: "careers_why_1790083249589.jpg", name: "Why Go Experts" },
  { file: "careers_life_large_1790083411102.jpg", name: "Life Large" },
  { file: "careers_life_small1_1790083374903.jpg", name: "Life Small 1" },
  { file: "careers_life_small2_1790083389020.jpg", name: "Life Small 2" },
  { file: "careers_people_1790083428807.jpg", name: "People" },
];

async function seed() {
  if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
  }

  for (const img of IMAGES) {
    const srcPath = path.join(SOURCE_DIR, img.file);
    if (!fs.existsSync(srcPath)) {
      console.warn(`Source file not found: ${srcPath}`);
      continue;
    }

    // Copy to uploads
    const destFileName = `careers_${Date.now()}_${img.file}`;
    const destPath = path.join(DEST_DIR, destFileName);
    fs.copyFileSync(srcPath, destPath);

    const relativeUrl = `/uploads/careers/${destFileName}`;
    const stats = fs.statSync(destPath);

    // Insert to DB
    await prisma.mediaFile.create({
      data: {
        filename: destFileName,
        originalName: img.name,
        filepath: relativeUrl,
        filesize: stats.size,
        filetype: "image",
        mimeType: "image/jpeg",
        uploadedBy: "System",
        status: "active",
      },
    });

    console.log(`Seeded ${img.name}: ${relativeUrl}`);
  }

  console.log("Done.");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
