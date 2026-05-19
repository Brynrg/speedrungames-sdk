# speedrungames-sdk

Shared runtime for games on [speedrungames.net](https://speedrungames.net). Used by repos created from [speedrungames-game-template](https://github.com/Brynrg/speedrungames-game-template).

## What's in it

| Module | Purpose |
|---|---|
| `speedrungames-sdk/timer` | `SpeedrunTimer` — ms-precision timer with pause/resume/splits/finish, `formatTime`. |
| `speedrungames-sdk/storage` | `createStorage(slug)` — slug-namespaced localStorage PB persistence. |
| `speedrungames-sdk/hud` | `createHUD(parent)` — drop-in HUD overlay (timer + PB + status). |
| `speedrungames-sdk/game` | `Game` — minimal canvas loop with dt + DPR-aware resize. |
| `speedrungames-sdk/leaderboard` | `submitRun` / `fetchRuns` — client for the speedrungames.net leaderboard backend. |

Or import everything from the barrel:

```ts
import { SpeedrunTimer, createStorage, createHUD, Game, submitRun, fetchRuns } from "speedrungames-sdk";
```

## Install

This package is consumed via git, not npm (no publishing setup required):

```bash
npm install github:Brynrg/speedrungames-sdk
# or pin to a tag:
npm install github:Brynrg/speedrungames-sdk#v0.1.0
```

The `prepare` script builds `dist/` automatically on install. Consumers don't need to do anything special.

## Quickstart

```ts
import { SpeedrunTimer } from "speedrungames-sdk/timer";
import { createStorage } from "speedrungames-sdk/storage";
import { createHUD } from "speedrungames-sdk/hud";
import { submitRun } from "speedrungames-sdk/leaderboard";

const SLUG = "my-game";
const storage = createStorage(SLUG);
const timer = new SpeedrunTimer();
const hud = createHUD(document.body);

hud.setPB(storage.getPB()?.ms ?? null);
timer.subscribe((ms, state) => hud.setTime(ms, state));

// when the run finishes:
const ms = timer.finish();
const splits = [...timer.getSplits()];
const isPB = storage.maybeSavePB({ ms, achievedAt: Date.now(), splits });
if (isPB) hud.setPB(ms);
await submitRun({ slug: SLUG, ms, splits });
```

## Versioning

Pin by tag in production (`#v0.1.0`). `main` is unstable.

## API

See per-module sources in [src/](src/) — types are exported alongside values.

## Companion

- Umbrella: [Brynrg/speedrungames](https://github.com/Brynrg/speedrungames)
- Template: [Brynrg/speedrungames-game-template](https://github.com/Brynrg/speedrungames-game-template)
