import sharp from "sharp";
import path from "path";
import fs from "fs";

/**
 * Generates an optimized, transparent Woxsen University logo
 * tailored specifically for high-contrast dark themes and minimal browser RAM.
 *
 * - Source: public/Woxsen_University_Registered.jpg (1280x682, ~3.5MB uncompressed in RAM)
 * - Target: public/woxsen-logo.webp (220x101, ~6KB, ~88KB decoded in RAM)
 * - White background stripped to complete transparency.
 * - Text rendered in crisp white (#ffffff) with official Woxsen Red (#ee495c) emblem.
 */
async function generateWoxsenLogo() {
  const sourcePath = path.resolve(process.cwd(), "public/Woxsen_University_Registered.jpg");
  const targetPath = path.resolve(process.cwd(), "public/woxsen-logo.webp");

  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source image not found: ${sourcePath}`);
    process.exit(1);
  }

  console.log("🎨 Processing Woxsen University logo...");

  // 1. Trim surrounding white space margins
  const trimmedBuffer = await sharp(sourcePath)
    .trim({ background: { r: 255, g: 255, b: 255 }, threshold: 15 })
    .toBuffer();

  // 2. High-quality Lanczos3 resize to 360x166 (2x retina for prominent display)
  const resized = sharp(trimmedBuffer).resize(360, 166, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
    kernel: sharp.kernel.lanczos3,
  });

  const { data, info } = await resized.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // 3. Process pixels: Remove white background and convert dark charcoal typography to white
  const processed = Buffer.from(data);
  for (let i = 0; i < processed.length; i += 4) {
    const r = processed[i];
    const g = processed[i + 1];
    const b = processed[i + 2];

    const isWhiteBg = r > 235 && g > 235 && b > 235;
    const isRedMark = r > 160 && g < 100 && b < 130;

    if (isWhiteBg) {
      // Solid white background becomes 100% transparent
      processed[i + 3] = 0;
    } else if (isRedMark) {
      // Woxsen Red: standardise to official #ee495c
      processed[i] = 238;
      processed[i + 1] = 73;
      processed[i + 2] = 92;
      // Preserve smooth anti-aliased edge alpha
      const redAlpha = Math.min(255, Math.round(((r - Math.max(g, b)) / 100) * 255));
      processed[i + 3] = Math.max(processed[i + 3], redAlpha);
    } else {
      // Dark typography & halftone sphere:
      // Convert darkness to white luminance for crisp dark-mode legibility
      const darkness = 255 - ((r + g + b) / 3);
      if (darkness > 25) {
        processed[i] = 255;
        processed[i + 1] = 255;
        processed[i + 2] = 255;
        processed[i + 3] = Math.min(255, Math.round(darkness * 1.35));
      } else {
        processed[i + 3] = 0;
      }
    }
  }

  // 4. Save as optimized WebP
  await sharp(processed, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .webp({ quality: 95, effort: 6 })
    .toFile(targetPath);

  const stats = fs.statSync(targetPath);
  console.log(`✅ Generated: ${targetPath}`);
  console.log(`📏 Dimensions: ${info.width}x${info.height}`);
  console.log(`💾 File size: ${(stats.size / 1024).toFixed(2)} KB (Decoded RAM: ~${((info.width * info.height * 4) / 1024).toFixed(0)} KB)`);
}

generateWoxsenLogo().catch((err) => {
  console.error("❌ Failed to generate Woxsen logo:", err);
  process.exit(1);
});
