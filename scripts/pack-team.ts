import * as fs from "fs";
import * as path from "path";

interface TeamMemberItem {
  id: string;
  path: string;
  fileName: string;
}

/**
 * Packs the RESIZED team portraits (public/team_v2, produced by
 * scripts/resize-gallery-assets.ts) into a single binary pack.
 *
 * Manifest keys keep the original /team/<fileName> paths so the site's
 * lookups (/team/monis.webp etc.) stay unchanged, while payloads are the
 * display-resolution WebP re-encodes (browsers decode <img> at intrinsic
 * size, so the ~2000px originals cost ~17MB decoded RAM each).
 *
 * Output: public/ecell_packs/team_pack_v2.bin
 * The _v2 filename busts the immutable browser/edge CDN caches.
 */
async function main() {
  const root = process.cwd();
  const teamDir = path.resolve(root, "public/team"); // manifest membership + original paths
  const teamV2Dir = path.resolve(root, "public/team_v2"); // resized payloads
  const targetDir = path.resolve(root, "public/ecell_packs");
  const targetPackPath = path.join(targetDir, "team_pack_v2.bin");

  if (!fs.existsSync(teamDir)) {
    throw new Error(`Team directory not found at ${teamDir}`);
  }
  if (!fs.existsSync(teamV2Dir)) {
    throw new Error(`Resized team directory not found at ${teamV2Dir} — run: bun run resize:gallery`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log("📦 Discovering team images in public/team (payloads from public/team_v2)...");
  const entries = fs.readdirSync(teamDir, { withFileTypes: true });
  const items: TeamMemberItem[] = [];

  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.isDirectory()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (![".webp", ".png", ".jpg", ".jpeg"].includes(ext)) continue;
    const id = path.basename(entry.name, ext).toLowerCase();
    items.push({
      id,
      path: `/team/${entry.name}`,
      fileName: entry.name,
    });
  }

  // Deterministic sorting by fileName
  items.sort((a, b) => a.fileName.localeCompare(b.fileName));

  console.log(`Found ${items.length} team portrait images to pack into single binary:`);

  const manifest: { id: string; path: string; mime: string; len: number }[] = [];
  const payloads: Buffer[] = [];
  let totalPayloadBytes = 0;

  for (const item of items) {
    const ext = path.extname(item.fileName).toLowerCase();
    const base = path.basename(item.fileName, ext);
    const resizedPath = path.join(teamV2Dir, `${base}.webp`);
    if (!fs.existsSync(resizedPath)) {
      throw new Error(`Missing resized portrait for ${item.path}: ${resizedPath} — run: bun run resize:gallery`);
    }
    const buf = fs.readFileSync(resizedPath);
    payloads.push(buf);
    totalPayloadBytes += buf.length;
    manifest.push({
      id: item.id,
      path: item.path,
      mime: "image/webp",
      len: buf.length,
    });
    console.log(`   + ${item.fileName.padEnd(20)} (${(buf.length / 1024).toFixed(1)} KB, image/webp)`);
  }

  const manifestJson = JSON.stringify(manifest);
  const manifestBuf = Buffer.from(manifestJson, "utf-8");
  const headerSize = 4 + manifestBuf.length;
  const totalPackSize = headerSize + totalPayloadBytes;

  const packBuf = Buffer.alloc(totalPackSize);

  // 1. Write header length (u32 LE)
  packBuf.writeUInt32LE(manifestBuf.length, 0);

  // 2. Write manifest JSON bytes
  manifestBuf.copy(packBuf, 4);

  // 3. Write payload bytes
  let offset = headerSize;
  for (let i = 0; i < payloads.length; i++) {
    payloads[i].copy(packBuf, offset);
    offset += payloads[i].length;
  }

  fs.writeFileSync(targetPackPath, packBuf);
  console.log(`\n💾 Saved: ${targetPackPath} (${(totalPackSize / 1024).toFixed(1)} KB total)`);

  // Verification
  console.log("🔍 Verifying team pack integrity...");
  const verifyBuf = fs.readFileSync(targetPackPath);
  const verifyHeaderLen = verifyBuf.readUInt32LE(0);
  if (verifyHeaderLen !== manifestBuf.length) {
    throw new Error(`Header length mismatch: expected ${manifestBuf.length}, got ${verifyHeaderLen}`);
  }

  const verifyManifestText = verifyBuf.subarray(4, 4 + verifyHeaderLen).toString("utf-8");
  const verifyManifest = JSON.parse(verifyManifestText);
  if (verifyManifest.length !== items.length) {
    throw new Error(`Manifest count mismatch: expected ${items.length}, got ${verifyManifest.length}`);
  }

  let verifyOffset = 4 + verifyHeaderLen;
  for (let i = 0; i < verifyManifest.length; i++) {
    const item = verifyManifest[i];
    const slice = verifyBuf.subarray(verifyOffset, verifyOffset + item.len);
    if (!slice.equals(payloads[i])) {
      throw new Error(`Payload byte mismatch for ${item.path}`);
    }
    verifyOffset += item.len;
  }

  console.log(`✅ Verification successful! All ${items.length} resized team images match 100% byte-for-byte.`);
}

main().catch((err) => {
  console.error("Pack team error:", err);
  process.exit(1);
});
