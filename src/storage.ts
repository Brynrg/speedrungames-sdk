// PB persistence — localStorage with a namespaced key per game.
// Call createStorage("<slug>") once and use the returned helpers.

import type { Split } from "./timer.js";

export interface PersonalBest {
  ms: number;
  achievedAt: number;
  splits?: Split[];
}

export interface StorageAPI {
  getPB(): PersonalBest | null;
  /** Saves only if the new time beats the existing PB. Returns true if it did. */
  maybeSavePB(pb: PersonalBest): boolean;
  clearPB(): void;
}

export function createStorage(slug: string): StorageAPI {
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]?$/.test(slug)) {
    throw new Error(`speedrungames-sdk: invalid slug "${slug}". Must be kebab-case.`);
  }
  const key = `speedrungames:${slug}:pb`;

  return {
    getPB() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as PersonalBest) : null;
      } catch {
        return null;
      }
    },

    maybeSavePB(pb) {
      const existing = this.getPB();
      if (existing && existing.ms <= pb.ms) return false;
      try {
        localStorage.setItem(key, JSON.stringify(pb));
        return true;
      } catch {
        return false;
      }
    },

    clearPB() {
      try {
        localStorage.removeItem(key);
      } catch {
        /* noop */
      }
    },
  };
}
