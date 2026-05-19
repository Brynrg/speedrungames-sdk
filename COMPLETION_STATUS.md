# Completion Status

> Status doc for AI agents working on this repo. Updated 2026-05-19.

**Score:** 78 / 100 — Cleanest code in the portfolio; missing tests and a real tag
**State:** v0.1.0. Stable. Consumed via `npm install github:Brynrg/speedrungames-sdk#vX.Y.Z`
**Stack:** TypeScript-only, no runtime deps

## What works
- Five subpath exports: `timer`, `storage`, `hud`, `game`, `leaderboard`, plus a barrel
- `SpeedrunTimer` uses `performance.now()` (drift-immune)
- `createStorage` validates slugs against a kebab-case regex
- `leaderboard.resolveBase()` handles same-origin proxy vs. localhost fallback
- HUD ships scoped CSS via idempotent `<style id="speedrungames-sdk-hud-style">`
- CI: builds, typechecks, verifies all expected `dist/*.js` and `*.d.ts` exist
- Thorough README

## Known gaps
- **Zero unit tests.** `SpeedrunTimer` pause/resume math, `resolveBase()`, `maybeSavePB` are pure functions — easy targets
- `submitRun` / `fetchRuns` swallow all errors with `catch { return null/[] }` — no logger hook, so games can't show "leaderboard offline" UX
- README pins consumers to `#v0.1.0` but **no `v0.1.0` git tag exists yet** — consumer installs may not resolve as expected
- `prepare` script runs `tsc` on every install — a TS install error in a downstream game blocks the install

## Priority improvements
1. **Add Vitest** for `SpeedrunTimer`, `resolveBase`, `maybeSavePB`
2. **Tag `v0.1.0`** (`git tag v0.1.0 && git push origin v0.1.0`) so README install pin actually works
3. **Add `onError?: (err) => void` option** to `submitRun` / `fetchRuns` so games can react to leaderboard offline
4. Consider committing `dist/` so consumers don't run `tsc` on install

## Notes for AI agents
- This is a **shared runtime** consumed by games on speedrungames.net. Breaking changes are very expensive — bump the major and tag.
- The two largest games (tower-wars, the umbrella's pokemon page) don't consume the SDK yet. Adoption is a portfolio-wide priority.
- **Related repos**: `speedrungames` (umbrella + leaderboard API), `speedrungames-game-template`
