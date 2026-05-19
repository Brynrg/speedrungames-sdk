# Improvement Plan

> Executable backlog. Work top-to-bottom. Each task self-contained.

## P0 — Blockers / safety / data integrity

### Task 1: Cut the `v0.1.0` git tag the README promises
**Effort:** S (15min)
**Files:** none in-repo (tag operation only); update `README.md` if any change.
**What:** `package.json#version` says `0.1.0` and `README.md` tells consumers to `npm install github:Brynrg/speedrungames-sdk#v0.1.0`, but `git ls-remote --tags https://github.com/Brynrg/speedrungames-sdk` returns nothing. The promised pin doesn't resolve.
**Why:** Without the tag, every "pinned" consumer install errors out, forcing them to either depin (and ride main) or pick a SHA. Pinning by SHA loses the README's documented update story.
**Steps:**
1. `git tag -a v0.1.0 -m "v0.1.0 — initial SDK release: timer, storage, hud, game, leaderboard"`
2. `git push origin v0.1.0`
3. Create a GitHub release pointing at the tag with the changelog text (also seeds Task 7).
**Acceptance:**
- [ ] `gh api repos/Brynrg/speedrungames-sdk/git/refs/tags/v0.1.0` returns 200.
- [ ] `npm install github:Brynrg/speedrungames-sdk#v0.1.0` succeeds in a clean directory.
- [ ] The release shows in `gh release list -R Brynrg/speedrungames-sdk`.

### Task 2: Add Vitest covering the pure-function surface area
**Effort:** M (1hr)
**Files:** new `src/timer.test.ts`, `src/storage.test.ts`, `src/leaderboard.test.ts`, `vitest.config.ts`, `package.json`, `.github/workflows/ci.yml`
**What:** Cover the load-bearing logic that has no test today: `SpeedrunTimer` state machine (idle/running/paused/finished + pause math), `formatTime` edge cases, `createStorage` slug regex + `maybeSavePB` strict-less-than rule, `resolveBase()` across same-origin/localhost/file/override, `submitRun` HTTP error path.
**Why:** A subtle bug in timer pause math or `resolveBase` would silently regress every consuming game. This is the lowest-cost place in the portfolio to add test coverage.
**Steps:**
1. `npm install -D vitest @vitest/coverage-v8 jsdom`.
2. Create `vitest.config.ts` with `test.environment = "jsdom"` (needed for `window`, `document`, `localStorage`, RAF).
3. Add to `package.json#scripts`: `"test": "vitest run"`, `"test:watch": "vitest"`, `"coverage": "vitest run --coverage"`.
4. `src/timer.test.ts`: test `start → elapsed grows`, `pause → elapsed frozen`, `resume → elapsed continues from frozen value (within ms tolerance)`, `finish → state=finished, listeners notified`, `reset → state=idle, splits cleared`, `subscribe returns unsub`, `split() returns null when not running`, `formatTime(0) === "00:00.000"`, `formatTime(61999) === "01:01.999"`, `formatTime(-1) === "00:00.000"`.
5. `src/storage.test.ts`: `createStorage("Foo")` throws (uppercase); `createStorage("-foo")` throws (leading hyphen); `createStorage("ok-slug")` succeeds; `getPB() === null` when empty; `maybeSavePB({ms:1000, achievedAt:1})` returns true and persists; subsequent `maybeSavePB({ms:1000, ...})` returns false (tie); `maybeSavePB({ms:999, ...})` returns true (improvement); `clearPB()` resets.
6. `src/leaderboard.test.ts`: mock `fetch` with `vi.stubGlobal`. Test `resolveBase("https://x/")` strips trailing slash; on localhost falls back to `https://speedrungames.net`; with `window.location.hostname === "speedrungames.net"` returns origin; `submitRun` POSTs JSON with rounded ms, returns Run on 200, returns null on 503, returns null on `fetch` throw; `fetchRuns({slug:"x"})` builds correct query string.
7. Update `.github/workflows/ci.yml` to add `- run: npm test` between typecheck and build.
**Acceptance:**
- [ ] `npm test` runs 25+ test cases, all pass.
- [ ] Mutating timer pause math (e.g. dropping the `pausedDuration` subtraction) causes ≥3 tests to fail.
- [ ] Mutating `resolveBase`'s localhost branch causes ≥1 test to fail.
- [ ] CI step exists and is required.

### Task 3: Add `onError` hook + return discriminated result to `submitRun`/`fetchRuns`
**Effort:** M (1hr)
**Files:** `src/leaderboard.ts`, `src/index.ts`, `README.md`
**What:** Both functions catch all errors and return `null`/`[]`. Games can't distinguish "leaderboard offline" from "no runs yet" and can't surface useful UI ("leaderboard temporarily unavailable; PB still saved locally").
**Why:** Without observability, leaderboard outages are invisible to users. SDK is the right place to centralize this signal; doing it in each game would duplicate logic.
**Steps:**
1. Extend `SubmitOptions` and `FetchRunsOptions` with `onError?: (err: Error) => void`.
2. In each catch block, construct an `Error` (with HTTP status when `!res.ok`) and call `onError(err)` before returning the fallback value.
3. For non-OK HTTP responses, throw/construct `new Error(\`HTTP ${res.status}\`)` BEFORE the return; pass to `onError`.
4. Keep the function signatures backward-compatible (null/[] still returned on failure).
5. Update README's Quickstart with an example: `await submitRun({ slug, ms, splits, onError: (e) => hud.setStatus("Leaderboard offline") })`.
**Acceptance:**
- [ ] `await submitRun({ slug: "x", ms: 1, onError: cb })` with a mocked 503 response invokes `cb` once with `Error('HTTP 503')` and returns null.
- [ ] `await fetchRuns({ slug: "x", onError: cb })` with a mocked network throw invokes `cb` once with the original error and returns `[]`.
- [ ] Existing callers that don't pass `onError` continue to work unchanged.
- [ ] Vitest case `submitRun 503 path` from Task 2 step 6 is updated to assert `onError` called with `Error('HTTP 503')`.

---

## P1 — High-value

### Task 4: Pause the `Game` loop on `document.visibilitychange`
**Effort:** S (15min)
**Files:** `src/game.ts`
**What:** When the user tabs away, `requestAnimationFrame` is throttled (1 Hz) but still runs. Game state advances unpredictably. Speedrun timers especially want a clean pause/resume.
**Why:** Resuming a tab after 30s of throttled background ticks produces undefined behavior (huge `dt` clamped to 100ms, but multiple stutter frames). A proper pause/resume hooked into Page Visibility eliminates this.
**Steps:**
1. In `Game` constructor, register a listener: `document.addEventListener("visibilitychange", this.onVisibility)`.
2. `onVisibility = () => { if (document.hidden) this.stop(); else if (this.wasRunningBeforeHidden) this.start(); }` — track the pre-hide state.
3. In `destroy()`, remove the visibility listener.
4. Emit a `Hook` event (or new `onPause`/`onResume` hooks) so games can pause their own timer in sync.
**Acceptance:**
- [ ] Programmatically dispatching `document.visibilitychange` with `document.hidden=true` calls `Game.stop`.
- [ ] Subsequent `document.hidden=false` calls `Game.start`.
- [ ] A game that paused before tab-hide stays paused on tab-show.

### Task 5: Add input helpers (keyboard, mouse, gamepad)
**Effort:** L (half-day)
**Files:** new `src/input.ts`, `src/index.ts`, `package.json#exports`, `tsconfig.build.json#include`, README, CI dist-check
**What:** Every consuming game re-implements `addEventListener("keydown", ...)`, keymap tracking, and Gamepad API polling. Adding a small shared `createInput()` reduces friction and ensures a consistent input pause semantics paired with Task 4.
**Why:** Removes ~50-150 lines from every new game. Centralizes the "auto-clean-up on destroy" pattern.
**Steps:**
1. Design surface: `createInput(target: HTMLElement | Window): InputAPI` returning `{ isDown(key: string): boolean, onPress(key, fn): unsub, gamepad(index: number): GamepadState | null, destroy(): void }`.
2. Implement with `keydown`/`keyup` listeners tracking a `Set<string>` of held keys (use `event.code`, not `key`, for layout-independent matching).
3. Implement gamepad polling via `navigator.getGamepads()` called from inside `Game`'s `onUpdate` (let the consumer decide when to poll).
4. Add subpath export: `"./input"` mapped to `dist/input.{js,d.ts}` in `package.json#exports`.
5. Extend CI's `Verify dist outputs exist` to check `dist/input.js` + `dist/input.d.ts`.
6. Add tests covering: registering twice doesn't double-fire; `destroy()` removes listeners; `isDown` is symmetric with `onPress`.
7. Update README's "What's in it" table with the new module.
**Acceptance:**
- [ ] `import { createInput } from "speedrungames-sdk/input"` works in a consuming game.
- [ ] CI fails if `dist/input.js` is missing.
- [ ] At least one demo game (or template) uses it end-to-end.

### Task 6: Extend CI to verify all `.d.ts` outputs, not just the barrel's
**Effort:** S (15min)
**Files:** `.github/workflows/ci.yml`
**What:** CI checks `dist/index.d.ts` exists but not `dist/timer.d.ts`, `dist/storage.d.ts`, etc. A regression in `tsconfig.build.json` that drops module-level declarations would silently ship as runtime-only JS.
**Why:** Subpath consumers (`speedrungames-sdk/timer`) rely on the per-module `.d.ts`. Without them, TypeScript downstream loses all types but the build still succeeds.
**Steps:**
1. In `.github/workflows/ci.yml#Verify dist outputs exist`, add `test -f dist/timer.d.ts`, `test -f dist/storage.d.ts`, `test -f dist/hud.d.ts`, `test -f dist/game.d.ts`, `test -f dist/leaderboard.d.ts`.
**Acceptance:**
- [ ] Removing `declaration: true` from `tsconfig.build.json` causes CI to fail with a missing-file error pointing at one of the new asserts.

### Task 7: Add CHANGELOG.md with semver-disciplined entries
**Effort:** S (15min)
**Files:** new `CHANGELOG.md`, `README.md` (cross-reference)
**What:** Adoption will grow; consumers need to know what changed between tags. The current 3 commits worth of history is fine to backfill.
**Why:** SDK is a shared runtime — undocumented breaking changes propagate silently to every consumer.
**Steps:**
1. Create `CHANGELOG.md` following Keep-a-Changelog format with `[Unreleased]` section.
2. Add `[0.1.0] - 2026-05-19` covering: initial release; SpeedrunTimer; createStorage; createHUD; Game; submitRun/fetchRuns; subpath exports; CI verifying dist artifacts.
3. Reference from README: add a "Changelog" section linking to `CHANGELOG.md`.
4. Going forward: every PR that ships changes must update `[Unreleased]`; tagging promotes `[Unreleased]` to a versioned section.
**Acceptance:**
- [ ] `CHANGELOG.md` exists at repo root with the `[0.1.0]` entry.
- [ ] README has a "Changelog" link.

### Task 8: Add LICENSE file matching `package.json#license`
**Effort:** S (15min)
**Files:** new `LICENSE`
**What:** `package.json#license: MIT` but no `LICENSE` file at repo root.
**Why:** Standard packaging hygiene. Some tooling (and humans) reads the file, not the package.json field. GitHub's UI surfaces the license badge based on the file.
**Steps:**
1. Create `LICENSE` with the standard MIT text, copyright line `Copyright (c) 2026 Brynr Garnett`.
**Acceptance:**
- [ ] `LICENSE` exists at repo root.
- [ ] GitHub's repo page shows the MIT license badge in the sidebar.

### Task 9: Harden `resolveBase()` against private-network hostnames
**Effort:** S (15min)
**Files:** `src/leaderboard.ts`, `src/leaderboard.test.ts`
**What:** `resolveBase()` returns `window.location.origin` for anything other than `localhost`/`127.0.0.1`. A game loaded from `http://192.168.x.x:3000` or `http://100.79.122.63:5100` (Tailscale) will POST to a URL that has no `/api/runs` handler. Expand the heuristic.
**Why:** Affects LAN/dev/staging deploys — easy to miss until someone tests on the network.
**Steps:**
1. Add an `isLikelyDev(hostname: string): boolean` helper checking for: localhost, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 100.64.0.0/10 (Tailscale CGNAT), `*.local`, `*.test`, IPv6 loopback `::1`.
2. Replace the existing hostname check with `if (isLikelyDev(hostname)) return DEFAULT_BASE`.
3. Add unit tests covering each branch.
**Acceptance:**
- [ ] Mocking `window.location.hostname = "192.168.1.1"` returns `https://speedrungames.net`.
- [ ] Mocking `100.79.122.63` returns `https://speedrungames.net`.
- [ ] Mocking `speedrungames.net` still returns `https://speedrungames.net`.

---

## P2 — Quality / polish

### Task 10: Make `prepare` resilient to TS toolchain mismatches
**Effort:** S (15min)
**Files:** `package.json`, possibly check in `dist/`
**What:** `prepare` runs `tsc` on every consumer install. If the consumer's Node version, TS version, or workspace conflicts prevent build, install fails. Two paths: (a) commit `dist/` to skip the build, or (b) make `prepare` a no-op fallback (`tsc -p tsconfig.build.json || true` — bad idea), or (c) ship a precompiled tarball via GitHub Release assets.
**Why:** "SDK install fails downstream because of an unrelated TS error" is a hard-to-diagnose support burden.
**Steps:**
1. Decide on option (a) — commit `dist/`. Remove `dist/` from `.gitignore` (if present). Commit current build artifacts.
2. Replace `prepare` with `prepublishOnly` (only builds on publish, not on install).
3. Document the rebuild dance: any commit to `src/` must be accompanied by a rebuild + commit of `dist/`.
4. Add a CI check that `dist/` matches a fresh `tsc -p tsconfig.build.json` run (`git diff --exit-code dist/`).
**Acceptance:**
- [ ] `npm install github:Brynrg/speedrungames-sdk` succeeds even when the consumer's toolchain has no TypeScript installed.
- [ ] CI fails on a PR that modifies `src/` without updating `dist/`.

### Task 11: Switch `tsconfig.json#noUnusedLocals` to a build-only flag
**Effort:** S (15min)
**Files:** `tsconfig.json`, `tsconfig.build.json`
**What:** `noUnusedLocals: true` in the base config affects `noEmit` typecheck too, which catches IDE-level WIP code as errors. Moving to `tsconfig.build.json` only keeps build strictness while letting `npm run typecheck` be tolerant of work-in-progress.
**Why:** Friction during development. Strictness only matters for the shipped artifact.
**Steps:**
1. Remove `noUnusedLocals: true` and `noUnusedParameters: true` from `tsconfig.json#compilerOptions`.
2. Add them to `tsconfig.build.json#compilerOptions`.
3. Verify `npm run typecheck` still passes; `npm run build` still passes.
**Acceptance:**
- [ ] Adding `const _unused = 1;` to any `src/*.ts` file causes `npm run build` to fail.
- [ ] The same file does NOT cause `npm run typecheck` to fail.

### Task 12: Add SSR safety guards to `createHUD`
**Effort:** S (15min)
**Files:** `src/hud.ts`
**What:** `ensureStyles` already guards `typeof document === "undefined"`, but `createHUD(parent)` itself calls `document.createElement` without the guard. If a consumer imports the barrel at module-load time in an SSR context (Next.js), it doesn't currently break — but it would the moment they invoke `createHUD` server-side.
**Why:** Pre-empt the inevitable Next.js consumer who imports the barrel from a server component.
**Steps:**
1. At the top of `createHUD`, throw a clear error if `typeof document === "undefined"`: `throw new Error("createHUD: requires a document; call only in a browser context")`.
2. Document the SSR-unsafe modules in README under a "Browser-only" callout.
**Acceptance:**
- [ ] Calling `createHUD(undefined as any)` in a Node test environment throws a readable error message.

### Task 13: Expand README with a "Browser-only modules" + "SDK + Next.js" note
**Effort:** S (15min)
**Files:** `README.md`
**What:** The Pokémon game in the umbrella repo consumes the SDK from a Next.js workspace. SSR concerns aren't documented. A short callout would prevent future "createHUD threw in production build" issues.
**Why:** Avoid surprising the next agent integrating the SDK into a Next.js context.
**Steps:**
1. Add a "Browser-only" section: every module touches `window`/`document`/`fetch` — wrap usage in `useEffect` or dynamic import.
2. Reference Task 12's error message.
**Acceptance:**
- [ ] README has a short "Using with Next.js" section.

### Task 14: Tighten `package.json#files` to ship only built artifacts
**Effort:** S (15min)
**Files:** `package.json`
**What:** `files: ["dist", "src", "README.md"]` ships both source AND built. Consumers pulling via `github:` install actually want the built `dist/` only; shipping `src/` adds nothing for them.
**Why:** Smaller install footprint; clearer that `dist/` is the contract.
**Steps:**
1. Remove `"src"` from `package.json#files`.
2. Verify `npm pack --dry-run` lists only `dist/**` + `README.md` + `package.json` + `LICENSE` (after Task 8).
**Acceptance:**
- [ ] `npm pack --dry-run` does not list any `src/` paths.
- [ ] Consuming the SDK via `npm install github:Brynrg/speedrungames-sdk` still resolves `speedrungames-sdk/timer` correctly.

---

## P3 — Nice-to-haves

### Task 15: Add an optional retry to `submitRun`
**Effort:** M (1hr)
**Files:** `src/leaderboard.ts`, README, test
**What:** Today `submitRun` is fire-and-forget. A transient 503 loses the run permanently. Add `retries?: number` (default 0) with exponential backoff.
**Why:** The most user-visible recoverable failure case. The run was achieved client-side and we know exactly what to retry with.
**Steps:**
1. Add `retries?: number` and `retryDelayMs?: number` to `SubmitOptions`.
2. Wrap the fetch in a loop: on `!res.ok` with status in {502, 503, 504} or on `fetch` throw, sleep `retryDelayMs * 2^attempt` and try again.
3. Respect `signal.aborted` between attempts.
4. Default to no retries to preserve current behavior.
5. Test: mock fetch to fail twice then succeed; assert `submitRun({..., retries: 3})` returns the Run.
**Acceptance:**
- [ ] `submitRun({slug, ms, retries: 2})` against a server that returns 503 twice then 200 succeeds.
- [ ] `submitRun({..., signal})` honors abort between retries (returns null, does not retry after abort).

### Task 16: Add a `recordRun` convenience function combining storage + leaderboard
**Effort:** S (15min)
**Files:** `src/leaderboard.ts` or new `src/runs.ts`
**What:** Every consuming game has the same 3-line dance: `timer.finish() → maybeSavePB → submitRun`. Wrap it.
**Why:** Smaller game code; one less integration mistake site.
**Steps:**
1. Add `recordRun(opts: { slug, timer, storage, runner? }): Promise<{ ms, isPB, run: Run | null }>`.
2. Internally: `const ms = timer.finish(); const isPB = storage.maybeSavePB({ ms, achievedAt: Date.now(), splits }); const run = await submitRun({ slug, ms, runner, splits });`.
3. Add test.
**Acceptance:**
- [ ] Replacing the 3-step pattern in the template's `main.ts` with a single `recordRun` call works end-to-end.

### Task 17: Add a `Splits` UI helper to the HUD
**Effort:** M (1hr)
**Files:** `src/hud.ts`, `src/timer.ts` (re-export only)
**What:** HUD shows current time + PB. Doesn't show splits. Many speedrun games want a per-split column on the side.
**Why:** Closes a common feature request for speedrun HUDs.
**Steps:**
1. Add `setSplits(splits: Split[]): void` to `HUD`.
2. Render a scrollable list of `label: formatTime(ms)` rows under the PB row.
3. Add CSS to existing `STYLE_CSS`.
**Acceptance:**
- [ ] Calling `hud.setSplits([{label: "Level 1", ms: 5000}])` renders a visible split row.

### Task 18: Add `npm run lint` with a minimal ESLint config
**Effort:** S (15min)
**Files:** new `.eslintrc.json`, `package.json`, CI workflow
**What:** No linter today. A minimal config (no-unused-vars, prefer-const, no-floating-promises) catches a class of bugs typecheck doesn't.
**Why:** Cheap regression catch.
**Steps:**
1. `npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin`.
2. Add `.eslintrc.json` extending `eslint:recommended`, `plugin:@typescript-eslint/recommended`.
3. Add `"lint": "eslint src --ext .ts"` to scripts.
4. Add a CI step.
**Acceptance:**
- [ ] `npm run lint` succeeds on the current codebase.
- [ ] Introducing a floating promise causes lint to fail.

### Task 19: Publish to npm as `@brynrg/speedrungames-sdk`
**Effort:** M (1hr)
**Files:** `package.json`, GitHub Actions secrets
**What:** Today consumers `npm install github:...` which is slow and requires git access. Publishing to npm under a scoped name (`@brynrg/speedrungames-sdk`) gives a faster install path and proper semver resolution.
**Why:** Improves consumer DX and removes the need for the `prepare`-script-on-install dance.
**Steps:**
1. Rename `package.json#name` to `@brynrg/speedrungames-sdk` (scope must match npm username).
2. Add `publishConfig: { access: "public" }`.
3. Add GH Action workflow `.github/workflows/release.yml` triggered on tag push that runs `npm ci && npm run build && npm publish`.
4. Add `NPM_TOKEN` secret to the repo.
5. Update README install instructions: `npm install @brynrg/speedrungames-sdk`.
6. Re-tag any prior versions or start at `0.2.0` to avoid version overlap.
**Acceptance:**
- [ ] `npm view @brynrg/speedrungames-sdk` returns metadata.
- [ ] `npm install @brynrg/speedrungames-sdk` succeeds in a clean directory.

### Task 20: Add an example consumer game in `examples/`
**Effort:** M (1hr)
**Files:** new `examples/minimal-game/{index.html,main.ts,package.json,vite.config.ts}`
**What:** Today the only example of "how to consume the SDK" is the README quickstart and the (separate) `speedrungames-game-template` repo. An in-repo `examples/` directory builds with the SDK and serves as a regression check during development.
**Why:** Lets contributors test SDK changes against a known-good consumer locally before pushing.
**Steps:**
1. Create `examples/minimal-game/` — a 3-button game that starts a timer, finishes, submits to leaderboard.
2. Use a `file:..` link to the parent (`"speedrungames-sdk": "file:../.."`).
3. Document `cd examples/minimal-game && npm install && npm run dev` in README.
4. Add to `.gitignore` rules so its `node_modules`/`dist` aren't committed.
**Acceptance:**
- [ ] `cd examples/minimal-game && npm install && npm run dev` opens a working game.
- [ ] Modifying `../../src/timer.ts` and rebuilding propagates into the example via `file:` link.

### Task 21: Document the "two largest games don't consume the SDK" status in README
**Effort:** S (15min)
**Files:** `README.md`
**What:** Adoption note for future contributors: the umbrella has 4 games, only 1 (and only the future template-spawned ones) consume this SDK. Migration is in the umbrella's IMPROVEMENT_PLAN.md as Task 18.
**Why:** Sets expectations honestly; signals where the work is.
**Steps:**
1. Add an "Adoption status" subsection to README under "Companion".
2. Bullet: "speedrungames-game-template — consumes this SDK by default. New games scaffolded from it are SDK-native."
3. Bullet: "tower-wars / tower-wars-2 / tank-you-again — pre-date this SDK, don't consume it. Migration tracked in the umbrella repo's IMPROVEMENT_PLAN.md."
**Acceptance:**
- [ ] README has an explicit "which games use this SDK today" pointer.
