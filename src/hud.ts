// HUD overlay — timer + PB display, no external CSS required.
// Inlines its own scoped styles via <style> tag (idempotent).

import { formatTime, type TimerState } from "./timer.js";

export interface HUD {
  setTime(ms: number, state: TimerState): void;
  setPB(ms: number | null): void;
  setStatus(text: string | null): void;
  destroy(): void;
}

const STYLE_ID = "speedrungames-sdk-hud-style";
const STYLE_CSS = `
.srg-hud {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.55);
  color: #eaeaf0;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  min-width: 13ch;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  z-index: 10;
}
.srg-hud-row { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
.srg-hud-label { font-size: 0.7rem; opacity: 0.6; letter-spacing: 0.1em; }
.srg-hud-time { font-size: 1.4rem; font-weight: 600; }
.srg-hud-time[data-state="finished"] { color: #ffcc00; }
.srg-hud-pb { margin-top: 0.25rem; opacity: 0.85; }
.srg-hud-pb .srg-hud-time { font-size: 1rem; color: #ffcc00; }
.srg-hud-status { margin-top: 0.5rem; font-size: 0.8rem; opacity: 0.7; text-align: center; }
`;

function ensureStyles(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE_CSS;
  document.head.appendChild(style);
}

export function createHUD(parent: HTMLElement): HUD {
  ensureStyles();
  const hud = document.createElement("div");
  hud.className = "srg-hud";
  hud.innerHTML = `
    <div class="srg-hud-row">
      <div class="srg-hud-label">TIME</div>
      <div class="srg-hud-time" data-role="time">00:00.000</div>
    </div>
    <div class="srg-hud-row srg-hud-pb" data-role="pb-row" hidden>
      <div class="srg-hud-label">PB</div>
      <div class="srg-hud-time" data-role="pb">—</div>
    </div>
    <div class="srg-hud-status" data-role="status" hidden></div>
  `;
  parent.appendChild(hud);

  const timeEl = hud.querySelector<HTMLElement>('[data-role="time"]')!;
  const pbRow = hud.querySelector<HTMLElement>('[data-role="pb-row"]')!;
  const pbEl = hud.querySelector<HTMLElement>('[data-role="pb"]')!;
  const statusEl = hud.querySelector<HTMLElement>('[data-role="status"]')!;

  return {
    setTime(ms, state) {
      timeEl.textContent = formatTime(ms);
      timeEl.dataset.state = state;
    },
    setPB(ms) {
      if (ms == null) {
        pbRow.hidden = true;
        return;
      }
      pbRow.hidden = false;
      pbEl.textContent = formatTime(ms);
    },
    setStatus(text) {
      if (!text) {
        statusEl.hidden = true;
        statusEl.textContent = "";
        return;
      }
      statusEl.hidden = false;
      statusEl.textContent = text;
    },
    destroy() {
      hud.remove();
    },
  };
}
