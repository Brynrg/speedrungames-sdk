# Completion Status

> Status doc for AI agents. Updated 2026-05-19. Refines the in-repo `COMPLETION_STATUS.md` after reading every source file.

**Score:** 76 / 100
**State:** v0.1.0 in `package.json` (no matching git tag). Stable surface, zero tests, very low adoption — only games scaffolded from the template consume it. Consumed via `npm install github:Brynrg/speedrungames-sdk` since there is no npm publish setup.
**Last commit:** 2026-05-19 (`6d769ce` Add COMPLETION_STATUS.md). Effectively 3 commits total — this is a brand-new package.
**Stack:** TypeScript 5.6+ (devDep only), zero runtime deps, ES2022/ESNext modules, `moduleResolution: bundler`, strict + verbatimModuleSyntax + noUnusedLocals + noUnusedParameters.

## Architecture
- **Five subpath exports** + a barrel: `speedrungames-sdk/{timer,storage,hud,game,leaderboard}` mapped through `package.json#exports`. Subpaths preferred for tree-shaking; barrel exists for ergonomics.
- **No runtime dependencies.** Single devDep is `typescript`. Browser-only — every module touches `window`, `performance`, `document`, or `fetch`.
- **`prepare` script builds `dist/` on `npm install`** so consumers using `github:owner/repo` style installs get a built package without committing artifacts.
- **CI** typechecks, builds, then asserts the 5 module outputs + barrel + d.ts files exist on disk.

## What works (verified by reading code)
- **`SpeedrunTimer`** — `src/timer.ts:11-103` — `performance.now()`-based, drift-immune. Pause/resume math tracks accumulated paused duration; `elapsed()` is correct in all three states (idle=0, paused=fixed point, running=live). RAF tick loop self-cancels on pause/finish/reset. `subscribe()` returns an unsub closure and fires once synchronously.
- **`formatTime`** — `src/timer.ts:105-118` — `mm:ss.SSS` with proper zero-padding, floors at 0 for negative input.
- **`createStorage`** — `src/storage.ts:19-54` — kebab-case slug regex enforced at create time, namespaced key `speedrungames:<slug>:pb`, all 3 methods (`getPB`/`maybeSavePB`/`clearPB`) wrap localStorage in try/catch (works in SSR/Private mode without throwing). `maybeSavePB` correctly returns `false` when the new time isn't an improvement (ties don't overwrite).
- **`createHUD`** — `src/hud.ts:49-97` — idempotent style injection via `<style id="speedrungames-sdk-hud-style">` (safe to call from multiple games on the same page during dev), no external CSS file, `setPB(null)` hides the PB row, `destroy()` removes the HUD element.
- **`Game`** — `src/game.ts:17-86` — minimal canvas2d loop with deltaTime (capped at 100ms to avoid huge dt on tab-resume), DPR-aware resize, separate `onUpdate`/`onDraw` hooks, clearRect before draw fns. `destroy()` removes the resize listener.
- **`submitRun`/`fetchRuns`** — `src/leaderboard.ts:50-88` — `resolveBase()` handles same-origin (when served via the portal proxy at speedrungames.net), localhost dev (falls back to production base), file:// (falls back to production base), explicit override. Both functions support `AbortSignal` and swallow all errors with `null`/`[]` fallback. `ms` is rounded to int before POST.
- **CI** — `.github/workflows/ci.yml` — runs on PR + push to main, uses Node 22, npm ci → typecheck → build → verifies 6 dist artifacts exist (`index.js`, `index.d.ts`, plus the 5 module `.js` files; does NOT verify `.d.ts` for the 5 modules).
- **README** is thorough — install via `github:` URL with tag pinning, quickstart code that compiles, per-module table, link to umbrella + template repos.

## Known gaps
- **Zero unit tests.** No `vitest.config.*`, no `*.test.ts`, no test runner installed. Pure functions begging for coverage: `formatTime`, `SpeedrunTimer.elapsed()` across all state transitions, `resolveBase()` URL-handling cases, `maybeSavePB` improvement logic, `sanitizeSplits` (server-side, but same shape).
- **`tsconfig.json` includes `noUnusedLocals: true`** but `src/timer.ts:79` declares `getState()` that's only used by external consumers. This works because the build excludes test files only (no internal-unused detection in this case), but the compiler flag risks false positives if helpers get added without callers.
- **README says "pin to a tag: `#v0.1.0`"** but there is no `v0.1.0` git tag. `git ls-remote --tags https://github.com/Brynrg/speedrungames-sdk` returns nothing. Consumers running `npm install github:Brynrg/speedrungames-sdk#v0.1.0` get an unresolved-ref error.
- **`prepare` script runs `tsc` on every install.** If a downstream game's TS install errors out (incompatible toolchain, missing peer types), the SDK install also fails. `dist/` is NOT committed (it IS in `package.json#files` but appears gitignored — the `.gitignore` from the file listing wasn't read, but the absence of `dist/` files in the tree confirms it).
- **`submitRun`/`fetchRuns` swallow errors silently.** `src/leaderboard.ts:64,84` — `catch { return null/[] }` with no logger hook. Games can't tell "leaderboard offline" from "no runs yet" and can't show users an appropriate message. No `onError` callback option.
- **No `onSuccess`/retry hook either.** `submitRun` is fire-and-forget — if the network flapped, the run is lost.
- **`resolveBase()` doesn't handle the case** where `window.location.origin` is set but `window.location.hostname` is something like `192.168.x.x` or a Tailscale IP (e.g. URIM's `100.79.122.63`). Those would fall through to `return window.location.origin` and POST to a URL that has no `/api/runs`. Likely fine for production but a footgun for local development on the LAN.
- **No `.npmignore` and `files` excludes nothing under `src/` or `dist/`** — the package ships both. Fine, but means consumers have access to the source as well as the built artifact. Intentional or not, worth being explicit about.
- **`Game` class doesn't pause the loop on `document.visibilitychange`** — when the user tabs away, the loop keeps running (RAF browsers throttle to 1 Hz, but updates still happen). Speedrun timing wants paused-on-blur.
- **`Game` has no input helpers.** Every consuming game has to re-implement keyboard / mouse / touch / gamepad bindings. Out of scope for v0.1.0 but called out as roadmap.
- **No CHANGELOG.md.** Hard to communicate breaking changes when adoption grows.
- **No LICENSE file** despite `package.json#license: MIT`. Adding the file is the conventional pairing.
- **CI `Verify dist outputs exist`** asserts `.js` for the 5 modules but only checks `.d.ts` for the barrel (`dist/index.d.ts`). A regression that drops `dist/timer.d.ts` would not fail CI.
- **No `peerDependencies` declared.** That's correct for v0.1.0 (no React/Phaser deps), but worth re-checking when input helpers land — if those use React, peerDeps should declare it.

## Hot paths
- `src/timer.ts` — most touched module; pause/resume math is the load-bearing logic.
- `src/leaderboard.ts` — the only network code; behavior across same-origin vs. localhost vs. file:// is subtle.
- `src/storage.ts` — slug validation is a portfolio-wide convention; changes here ripple into the umbrella's `/api/runs` allowlist.
- `package.json#exports` — adding a new subpath requires syncing the exports map AND the CI dist-check.

## Notes for AI agents
- **Shared runtime.** Any breaking change requires a major bump AND a tag. Consumers pin by ref (`#v0.1.0`), so bumping the version in `package.json` alone does nothing — the **tag** is what `npm install github:...` resolves.
- **Tag-before-merge convention:** since there's no npm publish, the only way consumers receive a new version is by tag. Cut the tag at the same SHA as the PR merge.
- **Two largest games (tower-wars, the umbrella's pokemon page) don't consume this SDK yet.** Adoption is a portfolio-wide priority called out by the umbrella repo. See `speedrungames` IMPROVEMENT_PLAN Task 18.
- **Related repos:** `Brynrg/speedrungames` (umbrella + leaderboard API), `Brynrg/speedrungames-game-template` (only template that wires this SDK in by default).
- **Do not** add runtime dependencies without a strong case. The "TypeScript-only, no deps" property is load-bearing for both bundle size in consuming games and `npm install` reliability.
- **Do not** ship a browser-only API without a `typeof window === "undefined"` guard if it could be touched at module-load time. SSR-safety matters for consumers that bundle the SDK into Next.js apps (Pokémon path).
