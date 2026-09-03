import { S3Client } from "bun";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env
const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      let value = match[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[match[1]] = value;
    }
  }
}

const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY_ID;
const endpoint = process.env.R2_ENDPOINT;
const bucket = process.env.R2_BUCKET_NAME || "ecell-main-website";
const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL;

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error("❌ Missing required R2 credentials in .env (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY_ID, R2_ENDPOINT)");
  process.exit(1);
}

const s3 = new S3Client({
  accessKeyId,
  secretAccessKey,
  endpoint,
  bucket,
});

const MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".txt": "text/plain",
};

interface FileUploadTask {
  localPath: string;
  r2Key: string;
  size: number;
  mimeType: string;
}

function getAllFiles(dirPath: string, rootPath: string = dirPath): FileUploadTask[] {
  const tasks: FileUploadTask[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      tasks.push(...getAllFiles(fullPath, rootPath));
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      const relativeKey = path.relative(rootPath, fullPath).replace(/\\/g, "/");
      const stat = fs.statSync(fullPath);
      const mimeType = MIME_TYPES[ext] || "application/octet-stream";

      tasks.push({
        localPath: fullPath,
        r2Key: relativeKey,
        size: stat.size,
        mimeType,
      });
    }
  }

  return tasks;
}

async function uploadFile(task: FileUploadTask, retries = 3): Promise<boolean> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const buffer = fs.readFileSync(task.localPath);
      const s3File = s3.file(task.r2Key);
      await s3File.write(buffer, {
        type: task.mimeType,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
      return true;
    } catch (err: any) {
      if (attempt === retries) {
        console.error(`\n❌ Failed to upload ${task.r2Key} after ${retries} attempts: ${err.message}`);
        return false;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  return false;
}

async function main() {
  console.log("🚀 Starting Cloudflare R2 Static Asset Migration...");
  console.log(`📦 Target Bucket: ${bucket}`);
  console.log(`🌐 Public URL: ${publicUrl || "Not specified"}`);
  console.log(`🔗 Endpoint: ${endpoint}\n`);

  const publicDir = path.resolve(process.cwd(), "public");
  if (!fs.existsSync(publicDir)) {
    console.error(`❌ 'public' directory not found at ${publicDir}`);
    process.exit(1);
  }

  const tasks = getAllFiles(publicDir);
  const totalFiles = tasks.length;
  const totalBytes = tasks.reduce((sum, t) => sum + t.size, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);

  console.log(`📋 Discovered ${totalFiles} assets (${totalMB} MB) to upload.`);

  const CONCURRENCY = 40;
  let completed = 0;
  let failed = 0;
  let transferredBytes = 0;
  const startTime = Date.now();

  let taskIndex = 0;

  async function worker() {
    while (taskIndex < tasks.length) {
      const currentIndex = taskIndex++;
      const task = tasks[currentIndex];

      const success = await uploadFile(task);
      if (success) {
        completed++;
        transferredBytes += task.size;
      } else {
        failed++;
      }

      const percent = ((completed + failed) / totalFiles * 100).toFixed(1);
      const currentMB = (transferredBytes / (1024 * 1024)).toFixed(1);
      process.stdout.write(
        `\r⏳ [${completed + failed}/${totalFiles}] (${percent}%) | Uploaded: ${currentMB}/${totalMB} MB | Uploading: ${task.r2Key.padEnd(35).slice(0, 35)}`
      );
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker());
  await Promise.all(workers);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n\n✨ Upload Finished in ${durationSec}s!`);
  console.log(`✅ Successfully uploaded: ${completed} files`);
  if (failed > 0) {
    console.error(`⚠️ Failed uploads: ${failed} files`);
  }

  // Quick Verification Probe
  if (publicUrl) {
    console.log("\n🔍 Running live CDN verification probe...");
    const sampleKeys = [
      "ecell-logo.png",
      "still_shot.mp4",
      "events/hult.png",
      "ecell_shots/00001.webp",
      "ecell_shots/00840.webp",
    ];

    for (const key of sampleKeys) {
      const testUrl = `${publicUrl.replace(/\/+$/, "")}/${key}`;
      try {
        const res = await fetch(testUrl, { method: "HEAD" });
        const contentType = res.headers.get("content-type");
        const cacheControl = res.headers.get("cache-control");
        console.log(`  ✓ [HTTP ${res.status}] ${key} -> Type: ${contentType}, Cache: ${cacheControl || "none"}`);
      } catch (e: any) {
        console.error(`  ✗ Error probing ${testUrl}: ${e.message}`);
      }
    }
  }

  console.log("\n🎉 All static assets are uploaded and verified on Cloudflare R2!");
}

main().catch((err) => {
  console.error("Unhandled upload error:", err);
  process.exit(1);
});
