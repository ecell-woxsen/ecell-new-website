/**
 * Cloudflare R2 Asset Loader & URL Resolver
 *
 * Resolves static media (scrollytelling frames, event photos, logo, video, docs)
 * to the Cloudflare R2 public CDN endpoint if NEXT_PUBLIC_R2_PUBLIC_URL is configured,
 * or falls back to local relative paths.
 */

export const R2_PUBLIC_BASE_URL = (
  process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
  process.env.R2_PUBLIC_URL ||
  ""
).replace(/\/+$/, "");

/**
 * Returns the full CDN URL for a given static asset path.
 *
 * @param path - Relative asset path (e.g. "/ecell-logo.png" or "/events/hult.png")
 * @returns Fully qualified CDN URL or local relative path
 */
export function getAssetUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return R2_PUBLIC_BASE_URL ? `${R2_PUBLIC_BASE_URL}${cleanPath}` : cleanPath;
}

// Wall sequence loop configuration:
// Unique physical assets exist from 1 to 840.
// Virtual frames 841 to 1262 seamlessly loop through wall frames 625 to 840 (216-frame cycle).
export const TOTAL_VIRTUAL_FRAMES = 1262;
export const TOTAL_PHYSICAL_FRAMES = 840;
export const WALL_LOOP_START = 625;
export const WALL_LOOP_END = 840;
export const WALL_LOOP_LENGTH = WALL_LOOP_END - WALL_LOOP_START + 1; // 216 frames

/**
 * Maps any virtual timeline frame (1 to 1262) to its unique physical asset frame (1 to 840).
 *
 * @param virtualFrame - Virtual scroll frame (1 to 1262)
 * @returns Physical asset frame number (1 to 840)
 */
export function getPhysicalFrameNumber(virtualFrame: number): number {
  const f = Math.round(virtualFrame);
  if (f <= TOTAL_PHYSICAL_FRAMES) {
    return Math.max(1, f);
  }
  const offset = f - (TOTAL_PHYSICAL_FRAMES + 1);
  return WALL_LOOP_START + (offset % WALL_LOOP_LENGTH);
}

/**
 * Returns the full CDN URL for a specific scrollytelling frame number.
 * Virtual frames > 840 automatically resolve to their physical loop frame (625–840).
 *
 * @param frameNum - 1-indexed virtual frame integer (1 to 1262)
 * @param variant - Resolution variant ("1080p" -> "ecell_shots", "720p" -> "ecell_shots_720p")
 * @returns Fully qualified frame URL (e.g. "https://pub-...r2.dev/ecell_shots/00001.webp")
 */
export function getFrameUrl(
  frameNum: number,
  variant: "1080p" | "720p" = "1080p"
): string {
  const physicalFrame = getPhysicalFrameNumber(frameNum);
  const padded = String(physicalFrame).padStart(5, "0");
  const folder = variant === "720p" ? "ecell_shots_720p" : "ecell_shots";
  return getAssetUrl(`/${folder}/${padded}.webp`);
}

// ---------------------------------------------------------------------------
// FRAME PACK BATCHING (Track B: 16 frames per binary pack)
// ---------------------------------------------------------------------------
export const FRAMES_PER_PACK = 16;
export const TOTAL_PACKS = Math.ceil(TOTAL_PHYSICAL_FRAMES / FRAMES_PER_PACK); // 53

/**
 * Returns the 0-indexed pack number (0 to 52) for a given physical frame (1 to 840).
 */
export function getPackIndex(physicalFrame: number): number {
  const clamped = Math.max(1, Math.min(TOTAL_PHYSICAL_FRAMES, physicalFrame));
  return Math.floor((clamped - 1) / FRAMES_PER_PACK);
}

/**
 * Returns physical frame range [start, end] and count for a 0-indexed pack.
 */
export function getPackFrameRange(packIndex: number): { start: number; end: number; count: number } {
  const start = packIndex * FRAMES_PER_PACK + 1;
  const end = Math.min(TOTAL_PHYSICAL_FRAMES, (packIndex + 1) * FRAMES_PER_PACK);
  return { start, end, count: Math.max(0, end - start + 1) };
}

/**
 * Returns full CDN or local URL for a binary frame pack.
 */
export function getPackUrl(
  packIndex: number,
  variant: "1080p" | "720p" = "1080p"
): string {
  const padded = String(packIndex).padStart(3, "0");
  return getAssetUrl(`/ecell_packs/${variant}/pack_${padded}.bin`);
}

