/**
 * E-Cell asset CDN — Cloudflare Worker in front of the R2 bucket.
 *
 * Replaces the rate-limited pub-*.r2.dev endpoint (HTTP/1.1, no edge cache)
 * with a production CDN: HTTP/2+, Cache API edge caching, immutable browser
 * caching, CORS for cross-origin fetch(), and Range support for mp4 seeking.
 */

// Minimal Workers/R2 type surface (self-contained; no @cloudflare/workers-types needed)
interface R2HttpMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  storageClass?: string;
}

interface R2Range {
  offset: number;
  length?: number;
  end?: number;
}

interface R2ObjectBase {
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
  httpMetadata?: R2HttpMetadata;
  range?: R2Range | { suffix: number };
}

interface R2ObjectBody extends R2ObjectBase {
  body: ReadableStream;
}

interface R2BucketLike {
  get(key: string, options?: { onlyIf?: Headers }): Promise<R2ObjectBody | R2ObjectBase | null>;
  head(key: string): Promise<R2ObjectBase | null>;
}

interface Env {
  BUCKET: R2BucketLike;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "ETag, Content-Length, Content-Range, Accept-Ranges",
};

function baseHeaders(): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(CORS_HEADERS)) h.set(k, v);
  return h;
}

/** Resolve a Content-Range `start`/`end` from any R2 range shape. */
function rangeBounds(range: R2ObjectBase["range"], size: number): { start: number; end: number } {
  if (!range) return { start: 0, end: size - 1 };
  if ("suffix" in range) {
    return { start: Math.max(0, size - range.suffix), end: size - 1 };
  }
  const r = range as R2Range;
  const start = r.offset ?? 0;
  if (typeof r.end === "number") return { start, end: r.end };
  if (typeof r.length === "number") return { start, end: start + r.length - 1 };
  return { start, end: size - 1 };
}

const assetCdnWorker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContextLike): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseHeaders() });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const h = baseHeaders();
      h.set("Allow", "GET, HEAD, OPTIONS");
      return new Response("Method Not Allowed", { status: 405, headers: h });
    }

    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ""));
    if (!key) {
      return new Response("Not Found", { status: 404, headers: baseHeaders() });
    }

    const cache = caches.default;
    const hasRange = request.headers.has("range");

    // Edge cache lookup: full GETs only (ranges/conditionals bypass).
    if (request.method === "GET" && !hasRange) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }

    // HEAD: metadata only, never cached.
    if (request.method === "HEAD") {
      const obj = await env.BUCKET.head(key);
      if (obj === null) {
        return new Response("Not Found", { status: 404, headers: baseHeaders() });
      }
      const h = baseHeaders();
      obj.writeHttpMetadata(h);
      if (!h.has("Content-Type")) h.set("Content-Type", "application/octet-stream");
      h.set("ETag", obj.httpEtag);
      h.set("Accept-Ranges", "bytes");
      h.set("Content-Length", String(obj.size));
      h.set("Cache-Control", IMMUTABLE_CACHE);
      return new Response(null, { status: 200, headers: h });
    }

    // GET: pass through conditional + range headers to R2.
    const object = await env.BUCKET.get(key, { onlyIf: request.headers });
    if (object === null) {
      return new Response("Not Found", { status: 404, headers: baseHeaders() });
    }

    const headers = baseHeaders();
    object.writeHttpMetadata(headers);
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/octet-stream");
    headers.set("ETag", object.httpEtag);
    headers.set("Accept-Ranges", "bytes");

    // Precondition failed (If-None-Match matched) -> R2 returned no body.
    if (!("body" in object) || !(object as R2ObjectBody).body) {
      return new Response(null, { status: 304, headers });
    }

    const body = (object as R2ObjectBody).body;

    // Partial content (mp4 seeking).
    if (object.range) {
      const { start, end } = rangeBounds(object.range, object.size);
      headers.set("Content-Range", `bytes ${start}-${end}/${object.size}`);
      headers.set("Content-Length", String(end - start + 1));
      return new Response(body, { status: 206, headers });
    }

    headers.set("Cache-Control", IMMUTABLE_CACHE);
    const response = new Response(body, { status: 200, headers });

    // Warm the edge cache (full 200 GETs only; waitUntil streams alongside the client).
    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};

export default assetCdnWorker;
