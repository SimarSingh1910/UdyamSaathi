/**
 * Sliding-window limit kept in memory. Good enough for one server; with several
 * instances each keeps its own count, so the real limit is per instance.
 */
export function rateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => t > now - windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.set(key, recent);
    // Keep the map from growing without bound.
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.every((t) => t <= now - windowMs)) hits.delete(k);
    return true;
  };
}

/** The caller's IP as seen through the proxy (Render, Docker, Vercel set x-forwarded-for). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
