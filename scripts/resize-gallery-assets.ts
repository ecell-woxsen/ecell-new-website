import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

/**
 * Gallery Asset RAM-Bounding Resizer
 *
 * Browsers decode an <img> at its INTRINSIC size regardless of CSS
 * constraints, so the ~2000-2400px team portraits were costing ~17MB
 * decoded RAM each while being displayed at <=400 CSS px (~250MB total
 * for the gallery wall). This script writes display-resolution copies:
 *
 *   public/team/*   -> public/team_v2/*.webp     (max-dim 800, q80)
 *   public/events/* -> public/events_v2/*.webp   (max-dim 1024, q85)
 *   ecell-logo.png  -> ecell-logo-v2.webp         (max-dim 256, q85)
 *
 * pack-team.ts / pack-events.ts consume the *_v2 directories as pack
 * payloads (manifest keys keep the original /team/... /events/... paths),
 * and the site references ecell-logo-v2.webp directly.
 *
 * Run: bun run resize:gallery
 */
const TEAM_MAX_DIM = 800;
const TEAM_QUALITY = 80;
const EVENTS_MAX_DIM = 1024;
const EVENTS_QUALITY = 85;
const LOGO_MAX_DIM = 256;
const LOGO_QUALITY = 85;
const IMAGE_EXTS = [".webp", ".png", ".jpg", ".jpeg"];

const fmtKB = (bytes: number) => `${Math.round(bytes / 1024)}KB`;

async function resizeDir(srcDir: string, outDir: string, maxDim: number, quality: number): Promise<void> {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source directory not found at ${srcDir}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  let srcBytes = 0;
  let outBytes = 0;

  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.isDirectory()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTS.includes(ext)) continue;

    const srcPath = path.join(srcDir, entry.name);
    const outName = `${path.basename(entry.name, ext)}.webp`;
    const outPath = path.join(outDir, outName);

    const before = fs.statSync(srcPath).size;
    const info = await sharp(srcPath)
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toFile(outPath);

    srcBytes += before;
    outBytes += info.size;
    console.log(
      `   + ${entry.name.padEnd(24)} -> ${outName.padEnd(24)} (${fmtKB(before)} -> ${fmtKB(info.size)}, ${info.width}x${info.height})`
    );
  }

  console.log(`   ${srcDir}: ${fmtKB(srcBytes)} -> ${fmtKB(outBytes)} (${entries.filter((e) => IMAGE_EXTS.includes(path.extname(e.name).toLowerCase())).length} files)`);
}

async function main() {
  const root = process.cwd();

  console.log("🖼️  Resizing team portraits (max-dim 800px WebP)...");
  await resizeDir(path.resolve(root, "public/team"), path.resolve(root, "public/team_v2"), TEAM_MAX_DIM, TEAM_QUALITY);

  console.log("\n🖼️  Re-encoding event photos (max-dim 1024px WebP)...");
  await resizeDir(path.resolve(root, "public/events"), path.resolve(root, "public/events_v2"), EVENTS_MAX_DIM, EVENTS_QUALITY);

  console.log("\n🖼️  Resizing logo (max-dim 256px WebP)...");
  const logoSrc = path.resolve(root, "public/ecell-logo.png");
  if (fs.existsSync(logoSrc)) {
    const before = fs.statSync(logoSrc).size;
    const info = await sharp(logoSrc)
      .resize({ width: LOGO_MAX_DIM, height: LOGO_MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: LOGO_QUALITY })
      .toFile(path.resolve(root, "public/ecell-logo-v2.webp"));
    console.log(`   + ecell-logo.png -> ecell-logo-v2.webp (${fmtKB(before)} -> ${fmtKB(info.size)}, ${info.width}x${info.height})`);
  }

  console.log("\n✅ Resized gallery assets written: public/team_v2/, public/events_v2/, public/ecell-logo-v2.webp");
  console.log("   Next: bun run pack:team && bun run pack:events && bun run upload:r2");
}

main().catch((err) => {
  console.error("Resize gallery assets error:", err);
  process.exit(1);
});
