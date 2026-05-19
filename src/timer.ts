// SpeedrunTimer — millisecond-precision timer with pause/resume and splits.
// Uses performance.now() so it doesn't drift if the system clock changes.

export type TimerState = "idle" | "running" | "paused" | "finished";

export interface Split {
  label: string;
  ms: number;
}

export class SpeedrunTimer {
  private startedAt = 0;
  private pausedAt = 0;
  private pausedDuration = 0;
  private state: TimerState = "idle";
  private splits: Split[] = [];
  private listeners = new Set<(ms: number, state: TimerState) => void>();
  private rafId = 0;

  start(): void {
    this.startedAt = performance.now();
    this.pausedDuration = 0;
    this.splits = [];
    this.state = "running";
    this.tick();
  }

  pause(): void {
    if (this.state !== "running") return;
    this.pausedAt = performance.now();
    this.state = "paused";
    cancelAnimationFrame(this.rafId);
    this.notify();
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.pausedDuration += performance.now() - this.pausedAt;
    this.state = "running";
    this.tick();
  }

  finish(): number {
    const ms = this.elapsed();
    this.state = "finished";
    cancelAnimationFrame(this.rafId);
    this.notify();
    return ms;
  }

  reset(): void {
    this.state = "idle";
    this.startedAt = 0;
    this.pausedDuration = 0;
    this.splits = [];
    cancelAnimationFrame(this.rafId);
    this.notify();
  }

  split(label: string): Split | null {
    if (this.state !== "running") return null;
    const s: Split = { label, ms: this.elapsed() };
    this.splits.push(s);
    return s;
  }

  elapsed(): number {
    if (this.state === "idle") return 0;
    if (this.state === "paused") {
      return this.pausedAt - this.startedAt - this.pausedDuration;
    }
    return performance.now() - this.startedAt - this.pausedDuration;
  }

  getSplits(): readonly Split[] {
    return this.splits;
  }

  getState(): TimerState {
    return this.state;
  }

  /** Subscribe to ms+state ticks. Returns an unsubscribe fn. */
  subscribe(fn: (ms: number, state: TimerState) => void): () => void {
    this.listeners.add(fn);
    fn(this.elapsed(), this.state);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private tick = (): void => {
    this.notify();
    if (this.state === "running") {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private notify(): void {
    const ms = this.elapsed();
    for (const fn of this.listeners) fn(ms, this.state);
  }
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms));
  const minutes = Math.floor(total / 60000);
  const seconds = Math.floor((total % 60000) / 1000);
  const millis = total % 1000;
  return `${pad2(minutes)}:${pad2(seconds)}.${pad3(millis)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function pad3(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}
