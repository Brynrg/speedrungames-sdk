// Convenience barrel — also importable via subpath:
//   import { SpeedrunTimer } from "speedrungames-sdk/timer";
// Subpaths are preferred for tree-shaking; this barrel exists for ergonomics.

export {
  SpeedrunTimer,
  formatTime,
  type Split,
  type TimerState,
} from "./timer.js";

export {
  createStorage,
  type PersonalBest,
  type StorageAPI,
} from "./storage.js";

export {
  createHUD,
  type HUD,
} from "./hud.js";

export {
  Game,
  type GameContext,
  type Hook,
} from "./game.js";

export {
  submitRun,
  fetchRuns,
  type Run,
  type SubmitOptions,
  type FetchRunsOptions,
} from "./leaderboard.js";
