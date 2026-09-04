import * as fs from "fs";
import * as path from "path";

interface TeamMemberItem {
  id: string;
  path: string;
  fileName: string;
  mime: string;
}

const MIME_MAP: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

async function main() {
  const root = process.cwd();
  const teamDir = path.resolve(root, "public/team");
  const targetDir = path.resolve(root, "public/ecell_packs");
  const targetPackPath = path.join(targetDir, "team_pack.bin");

  if (!fs.existsSync(teamDir)) {
    throw new Error(`Team directory not found at ${teamDir}`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log("📦 Discovering team images in public/team...");
  const entries = fs.readdirSync(teamDir, { withFileTypes: true });
  const items: TeamMemberItem[] = [];

  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.isDirectory()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    const mime = MIME_MAP[ext] || "image/webp";
    const id = path.basename(entry.name, ext).toLowerCase();
    items.push({
      id,
      path: `/team/${entry.name}`,
      fileName: entry.name,
      mime,
    });
  }

  // Deterministic sorting by fileName
  items.sort((a, b) => a.fileName.localeCompare(b.fileName));

  console.log(`Found ${items.length} team portrait images to pack into single binary:`);

  const manifest: { id: string; path: string; mime: string; len: number }[] = [];
  const payloads: Buffer[] = [];
  let totalPayloadBytes = 0;

  for (const item of items) {
    const filePath = path.join(teamDir, item.fileName);
    const buf = fs.readFileSync(filePath);
    payloads.push(buf);
    totalPayloadBytes += buf.length;
    manifest.push({
      id: item.id,
      path: item.path,
      mime: item.mime,
      len: buf.length,
    });
    console.log(`   + ${item.fileName.padEnd(20)} (${(buf.length / 1024).toFixed(1)} KB, ${item.mime})`);
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

  console.log(`✅ Verification successful! All ${items.length} team images match 100% byte-for-byte.`);
}

main().catch((err) => {
  console.error("Pack team error:", err);
  process.exit(1);
});
