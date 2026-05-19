// Leaderboard client — posts and fetches runs from the speedrungames.net
// leaderboard backend.
//
// Same-origin when games are loaded via the proxy at speedrungames.net/games/<slug>/.
// On localhost, falls back to https://speedrungames.net.

import type { Split } from "./timer.js";

const DEFAULT_BASE = "https://speedrungames.net";

export interface Run {
  id: string;
  slug: string;
  ms: number;
  runner?: string;
  splits?: Split[];
  achievedAt: number;
}

export interface SubmitOptions {
  slug: string;
  ms: number;
  runner?: string;
  splits?: Split[];
  /** Override base URL (default: same-origin in browser, otherwise speedrungames.net). */
  base?: string;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

export interface FetchRunsOptions {
  slug?: string;
  limit?: number;
  base?: string;
  signal?: AbortSignal;
}

function resolveBase(override?: string): string {
  if (override) return override.replace(/\/+$/, "");
  if (typeof window !== "undefined" && window.location && window.location.origin && !window.location.origin.startsWith("file:")) {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return DEFAULT_BASE;
    }
    return window.location.origin;
  }
  return DEFAULT_BASE;
}

/** Submit a finished run. Returns the stored Run, or null on failure. */
export async function submitRun(opts: SubmitOptions): Promise<Run | null> {
  const base = resolveBase(opts.base);
  try {
    const res = await fetch(`${base}/api/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: opts.slug,
        ms: Math.round(opts.ms),
        runner: opts.runner,
        splits: opts.splits,
      }),
      signal: opts.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as Run;
  } catch {
    return null;
  }
}

/** Fetch runs. Pass `slug` for per-game; omit for recent runs across all games. */
export async function fetchRuns(opts: FetchRunsOptions = {}): Promise<Run[]> {
  const base = resolveBase(opts.base);
  const params = new URLSearchParams();
  if (opts.slug) params.set("game", opts.slug);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  try {
    const res = await fetch(`${base}/api/runs${qs ? `?${qs}` : ""}`, {
      method: "GET",
      signal: opts.signal,
    });
    if (!res.ok) return [];
    return (await res.json()) as Run[];
  } catch {
    return [];
  }
}
