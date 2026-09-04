/**
 * E-Cell asset CDN — Cloudflare Worker in front of the R2 bucket.
 *
 * Serves the bucket on https://<name>.<account-subdomain>.workers.dev with:
 *  - HTTP/2+ (no pub-*.r2.dev HTTP/1.1 6-connection cap)
 *  - Edge caching via the Cache API (full 200 GETs only)
 *  - Immutable browser caching + CORS + Range support (mp4 seeking)
 *
 * RANGE HANDLING NOTE (the bug this rewrite fixes):
 * The previous version called `BUCKET.get(key, { onlyIf: request.headers })`.
 * In the current Workers runtime that pattern populates `object.range` with a
 * broken `{ offset: NaN, ... }` even for plain GETs with no Range header, and
 * never applies real Range headers to the body — every response was a
 * malformed `206` with `Content-Range: bytes NaN-…`, which crashed the site's
 * video element and defeated all caching. This version:
 *  - NEVER passes `onlyIf: Headers`
 *  - Parses the Range header itself and passes an explicit, validated range
 *    option to `get()`
 *  - Guards every computed header value with Number.isFinite — a NaN can
 *    never reach a response header; any invalid parse falls back to a full 200
 *  - Handles If-None-Match via head() + manual etag comparison
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

interface R2RangeOption {
  offset?: number;
  length?: number;
  end?: number;
  suffix?: number;
}

interface R2ObjectBase {
  size: number;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
  httpMetadata?: R2HttpMetadata;
  range?: R2RangeOption;
}

interface R2ObjectBody extends R2ObjectBase {
  body: ReadableStream;
}

interface R2BucketLike {
  get(key: string, options?: { range?: R2RangeOption }): Promise<R2ObjectBody | null>;
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

function applyObjectHeaders(headers: Headers, obj: R2ObjectBase): void {
  obj.writeHttpMetadata(headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/octet-stream");
  headers.set("ETag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
}

/** RFC 7232 If-None-Match comparison (handles lists, W/ prefixes, and *). */
function etagMatches(headerValue: string, etag: string): boolean {
  return headerValue
    .split(",")
    .map((t) => t.trim())
    .some((t) => t === "*" || t === etag || t.replace(/^W\//, "") === etag);
}

/**
 * Syntactic-only Range header parser. Returns an explicit R2 range option or
 * null when the header is absent/invalid. Size clamping happens via R2 and is
 * re-validated against the returned object — no assumptions, no NaN.
 *
 * NOTE: emits `{offset, length}` (not `{offset, end}`) — verified live that
 * this runtime applies offset/length/suffix but silently IGNORES `end`,
 * turning `bytes=500-999` into `bytes=500-<EOF>`.
 */
function parseRangeHeader(header: string): R2RangeOption | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, startStr, endStr] = m;
  if (startStr === "" && endStr === "") return null; // "bytes=-" — malformed
  if (startStr === "") {
    const suffix = parseInt(endStr, 10);
    return Number.isFinite(suffix) && suffix > 0 ? { suffix } : null;
  }
  const start = parseInt(startStr, 10);
  if (!Number.isFinite(start) || start < 0) return null;
  if (endStr === "") return { offset: start };
  const end = parseInt(endStr, 10);
  if (!Number.isFinite(end) || end < start) return null;
  return { offset: start, length: end - start + 1 };
}

/**
 * Derives finite [start, end] bounds from the range R2 actually applied.
 * Returns null unless every value is finite and consistent with the object —
 * in which case the caller serves a full 200 instead of risking a bad header.
 */
function appliedBounds(obj: R2ObjectBase): { start: number; end: number } | null {
  const r = obj.range;
  if (!r || typeof r !== "object") return null;
  let start = NaN;
  let end = NaN;
  if (typeof r.suffix === "number" && Number.isFinite(r.suffix) && r.suffix > 0) {
    start = Math.max(0, obj.size - r.suffix);
    end = obj.size - 1;
  } else {
    if (typeof r.offset === "number" && Number.isFinite(r.offset)) {
      start = r.offset;
      if (typeof r.end === "number" && Number.isFinite(r.end)) end = r.end;
      else if (typeof r.length === "number" && Number.isFinite(r.length)) end = start + r.length - 1;
      else end = obj.size - 1;
    }
  }
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    end > obj.size - 1 ||
    obj.size <= 0
  ) {
    return null;
  }
  return { start, end };
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
    const rangeHeader = request.headers.get("range");

    // Edge cache lookup: full GETs only (ranges/conditionals bypass).
    if (request.method === "GET" && !rangeHeader) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }

    // Conditional requests: manual etag comparison via head(). No onlyIf.
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch) {
      const meta = await env.BUCKET.head(key);
      if (meta === null) {
        return new Response("Not Found", { status: 404, headers: baseHeaders() });
      }
      if (etagMatches(ifNoneMatch, meta.httpEtag)) {
        const h = baseHeaders();
        applyObjectHeaders(h, meta);
        h.set("Cache-Control", IMMUTABLE_CACHE);
        return new Response(null, { status: 304, headers: h });
      }
    }

    // HEAD: metadata only, never cached.
    if (request.method === "HEAD") {
      const obj = await env.BUCKET.head(key);
      if (obj === null) {
        return new Response("Not Found", { status: 404, headers: baseHeaders() });
      }
      const h = baseHeaders();
      applyObjectHeaders(h, obj);
      h.set("Content-Length", String(obj.size));
      h.set("Cache-Control", IMMUTABLE_CACHE);
      return new Response(null, { status: 200, headers: h });
    }

    // GET with a Range header: explicit validated range option. If R2 rejects
    // the range (unsatisfiable) or returns anything we can't verify, fall
    // through to a plain full-200 GET — never emit a malformed header.
    if (rangeHeader) {
      const parsed = parseRangeHeader(rangeHeader);
      if (parsed) {
        let rangeObj: R2ObjectBody | null = null;
        try {
          rangeObj = await env.BUCKET.get(key, { range: parsed });
        } catch {
          rangeObj = null; // R2 rejected the range — serve full content below
        }
        if (rangeObj) {
          const bounds = appliedBounds(rangeObj);
          if (bounds) {
            const h = baseHeaders();
            applyObjectHeaders(h, rangeObj);
            h.set("Content-Range", `bytes ${bounds.start}-${bounds.end}/${rangeObj.size}`);
            h.set("Content-Length", String(bounds.end - bounds.start + 1));
            return new Response(rangeObj.body, { status: 206, headers: h });
          }
          // Range not verifiable — the body may be the full object; serve 200.
          const h = baseHeaders();
          applyObjectHeaders(h, rangeObj);
          h.set("Cache-Control", IMMUTABLE_CACHE);
          const fullResponse = new Response(rangeObj.body, { status: 200, headers: h });
          if (request.method === "GET") {
            ctx.waitUntil(cache.put(request, fullResponse.clone()));
          }
          return fullResponse;
        }
      }
    }

    // Plain GET: full object, 200, immutable, edge-cached.
    const object = await env.BUCKET.get(key);
    if (object === null) {
      return new Response("Not Found", { status: 404, headers: baseHeaders() });
    }

    const headers = baseHeaders();
    applyObjectHeaders(headers, object);
    headers.set("Cache-Control", IMMUTABLE_CACHE);
    const response = new Response(object.body, { status: 200, headers });

    // Warm the edge cache (full 200 GETs only; waitUntil streams alongside the client).
    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};

export default assetCdnWorker;
