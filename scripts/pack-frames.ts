import * as fs from "fs";
import * as path from "path";

const TOTAL_PHYSICAL_FRAMES = 840;
const FRAMES_PER_PACK = 16;
const TOTAL_PACKS = Math.ceil(TOTAL_PHYSICAL_FRAMES / FRAMES_PER_PACK); // 53

const VARIANTS = [
  { name: "1080p", sourceDir: "public/ecell_shots", targetDir: "public/ecell_packs/1080p" },
  { name: "720p", sourceDir: "public/ecell_shots_720p", targetDir: "public/ecell_packs/720p" },
  { name: "mobile_720p", sourceDir: "public/ecell_shots_mobile_720p", targetDir: "public/ecell_packs/mobile_720p" },
] as const;

async function packVariant(variant: (typeof VARIANTS)[number]) {
  const root = process.cwd();
  const sourcePath = path.resolve(root, variant.sourceDir);
  const targetPath = path.resolve(root, variant.targetDir);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source directory does not exist: ${sourcePath}`);
  }

  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true });
  }

  console.log(`\n📦 Packing variant [${variant.name}]: ${sourcePath} -> ${targetPath}`);
  console.log(`   Total physical frames: ${TOTAL_PHYSICAL_FRAMES}, Pack size: ${FRAMES_PER_PACK}, Total packs: ${TOTAL_PACKS}`);

  let totalRawBytes = 0;
  let totalPackedBytes = 0;

  for (let p = 0; p < TOTAL_PACKS; p++) {
    const startFrame = p * FRAMES_PER_PACK + 1;
    const endFrame = Math.min(TOTAL_PHYSICAL_FRAMES, (p + 1) * FRAMES_PER_PACK);
    const count = endFrame - startFrame + 1;

    const frameBuffers: Buffer[] = [];
    const frameLengths: number[] = [];
    let payloadSize = 0;

    for (let f = startFrame; f <= endFrame; f++) {
      const fileName = `${String(f).padStart(5, "0")}.webp`;
      const filePath = path.join(sourcePath, fileName);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing frame file: ${filePath}`);
      }
      const buf = fs.readFileSync(filePath);
      frameBuffers.push(buf);
      frameLengths.push(buf.length);
      payloadSize += buf.length;
      totalRawBytes += buf.length;
    }

    // Binary format: [u32 count][u32 len_0 .. u32 len_{count-1}][payloads...]
    const headerSize = 4 + count * 4;
    const totalPackSize = headerSize + payloadSize;
    const packBuffer = Buffer.alloc(totalPackSize);

    // Header: frame count
    packBuffer.writeUInt32LE(count, 0);

    // Header: frame lengths
    for (let i = 0; i < count; i++) {
      packBuffer.writeUInt32LE(frameLengths[i], 4 + i * 4);
    }

    // Body: payloads
    let offset = headerSize;
    for (let i = 0; i < count; i++) {
      frameBuffers[i].copy(packBuffer, offset);
      offset += frameLengths[i];
    }

    // Write pack file
    const packName = `pack_${String(p).padStart(3, "0")}.bin`;
    const packFilePath = path.join(targetPath, packName);
    fs.writeFileSync(packFilePath, packBuffer);
    totalPackedBytes += totalPackSize;

    // Self-verification check on the written pack
    const verifyBuf = fs.readFileSync(packFilePath);
    const verifyCount = verifyBuf.readUInt32LE(0);
    if (verifyCount !== count) {
      throw new Error(`Verification failed for ${packName}: expected count ${count}, got ${verifyCount}`);
    }
    let verifyOffset = 4 + verifyCount * 4;
    for (let i = 0; i < verifyCount; i++) {
      const len = verifyBuf.readUInt32LE(4 + i * 4);
      if (len !== frameLengths[i]) {
        throw new Error(`Verification failed for ${packName} item ${i}: length mismatch`);
      }
      const slice = verifyBuf.subarray(verifyOffset, verifyOffset + len);
      if (!slice.equals(frameBuffers[i])) {
        throw new Error(`Verification failed for ${packName} item ${i}: payload mismatch`);
      }
      verifyOffset += len;
    }

    const kb = (totalPackSize / 1024).toFixed(1);
    process.stdout.write(`\r   ✓ Generated ${packName} (frames ${startFrame}-${endFrame}, ${count} frames, ${kb} KB)`);
  }

  const rawMB = (totalRawBytes / (1024 * 1024)).toFixed(2);
  const packedMB = (totalPackedBytes / (1024 * 1024)).toFixed(2);
  const avgPackKB = (totalPackedBytes / TOTAL_PACKS / 1024).toFixed(1);
  console.log(`\n   ✅ Done: 53 packs generated (${packedMB} MB total, avg ${avgPackKB} KB/pack, raw payload ${rawMB} MB).`);
}

async function main() {
  console.log("🚀 Starting Frame Batch Pack Generation...");
  const startTime = Date.now();
  const filterArgs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const targetVariants = filterArgs.length > 0
    ? VARIANTS.filter((v) => filterArgs.includes(v.name))
    : VARIANTS;

  if (targetVariants.length === 0) {
    console.warn(`⚠️ No variants matched filter: [${filterArgs.join(", ")}]. Available: ${VARIANTS.map((v) => v.name).join(", ")}`);
    return;
  }

  for (const variant of targetVariants) {
    await packVariant(variant);
  }
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 All packs generated and verified successfully in ${duration}s!`);
}

main().catch((err) => {
  console.error("Pack generation error:", err);
  process.exit(1);
});
