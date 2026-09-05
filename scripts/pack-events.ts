import * as fs from "fs";
import * as path from "path";

interface EventItem {
  id: string;
  path: string;
  fileName: string;
}

/**
 * Packs the RESIZED event photos (public/events_v2, produced by
 * scripts/resize-gallery-assets.ts) into a single binary pack.
 *
 * Manifest keys keep the original /events/<fileName> paths so the site's
 * lookups (/events/hult.png etc.) stay unchanged, while payloads are the
 * re-encoded WebP versions (all <=1024px, quality 85).
 *
 * Output: public/ecell_packs/events_pack_v2.bin
 * The _v2 filename busts the immutable browser/edge CDN caches.
 */
const EVENTS: EventItem[] = [
  {
    id: "hult",
    path: "/events/hult.png",
    fileName: "hult.png",
  },
  {
    id: "panel-discussion",
    path: "/events/panel-discussion.jpg",
    fileName: "panel-discussion.jpg",
  },
  {
    id: "game-night",
    path: "/events/game-night.jpg",
    fileName: "game-night.jpg",
  },
];

async function main() {
  const root = process.cwd();
  const eventsV2Dir = path.resolve(root, "public/events_v2"); // resized payloads
  const targetDir = path.resolve(root, "public/ecell_packs");
  const targetPackPath = path.join(targetDir, "events_pack_v2.bin");

  if (!fs.existsSync(eventsV2Dir)) {
    throw new Error(`Resized events directory not found at ${eventsV2Dir} — run: bun run resize:gallery`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log("📦 Packing resized event images into a single binary pack...");

  const manifest: { id: string; path: string; mime: string; len: number }[] = [];
  const payloads: Buffer[] = [];
  let totalPayloadBytes = 0;

  for (const item of EVENTS) {
    const ext = path.extname(item.fileName).toLowerCase();
    const base = path.basename(item.fileName, ext);
    const resizedPath = path.join(eventsV2Dir, `${base}.webp`);
    if (!fs.existsSync(resizedPath)) {
      throw new Error(`Missing resized event image for ${item.path}: ${resizedPath} — run: bun run resize:gallery`);
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
    console.log(`   + ${item.fileName.padEnd(24)} (${(buf.length / 1024).toFixed(1)} KB, image/webp)`);
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
  console.log(`\n💾 Saved: ${targetPackPath} (${(totalPackSize / 1024 / 1024).toFixed(2)} MB total)`);

  // Verification
  console.log("🔍 Verifying events pack integrity...");
  const verifyBuf = fs.readFileSync(targetPackPath);
  const verifyHeaderLen = verifyBuf.readUInt32LE(0);
  if (verifyHeaderLen !== manifestBuf.length) {
    throw new Error(`Header length mismatch: expected ${manifestBuf.length}, got ${verifyHeaderLen}`);
  }

  const verifyManifestText = verifyBuf.subarray(4, 4 + verifyHeaderLen).toString("utf-8");
  const verifyManifest = JSON.parse(verifyManifestText);
  if (verifyManifest.length !== EVENTS.length) {
    throw new Error(`Manifest count mismatch: expected ${EVENTS.length}, got ${verifyManifest.length}`);
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

  console.log("✅ Verification successful! All resized event images match 100% byte-for-byte.");
}

main().catch((err) => {
  console.error("Pack events error:", err);
  process.exit(1);
});
