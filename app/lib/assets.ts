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

/**
 * Returns the full CDN URL for a specific scrollytelling frame number.
 *
 * @param frameNum - 1-indexed frame integer (1 to 1262)
 * @param variant - Resolution variant ("1080p" -> "ecell_shots", "720p" -> "ecell_shots_720p")
 * @returns Fully qualified frame URL (e.g. "https://pub-...r2.dev/ecell_shots/00001.webp")
 */
export function getFrameUrl(
  frameNum: number,
  variant: "1080p" | "720p" = "1080p"
): string {
  const clamped = Math.min(1262, Math.max(1, frameNum));
  const padded = String(clamped).padStart(5, "0");
  const folder = variant === "720p" ? "ecell_shots_720p" : "ecell_shots";
  return getAssetUrl(`/${folder}/${padded}.webp`);
}
