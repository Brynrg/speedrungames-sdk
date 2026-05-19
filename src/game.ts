// Minimal canvas game loop with deltaTime and DPR-aware resize.

export interface GameContext {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** Seconds since the previous frame. */
  readonly dt: number;
  /** performance.now() at frame start. */
  readonly t: number;
  /** CSS-pixel width/height of the canvas. */
  readonly width: number;
  readonly height: number;
}

export type Hook = (g: GameContext) => void;

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private updateFns: Hook[] = [];
  private drawFns: Hook[] = [];
  private rafId = 0;
  private running = false;
  private lastT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire 2d canvas context");
    this.ctx = ctx;
    this.resize();
    window.addEventListener("resize", this.resize);
  }

  onUpdate(fn: Hook): void {
    this.updateFns.push(fn);
  }

  onDraw(fn: Hook): void {
    this.drawFns.push(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  destroy(): void {
    this.stop();
    window.removeEventListener("resize", this.resize);
  }

  private resize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private loop = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.1, (now - this.lastT) / 1000);
    this.lastT = now;
    const g: GameContext = {
      canvas: this.canvas,
      ctx: this.ctx,
      dt,
      t: now,
      width: this.canvas.clientWidth,
      height: this.canvas.clientHeight,
    };
    for (const fn of this.updateFns) fn(g);
    this.ctx.clearRect(0, 0, g.width, g.height);
    for (const fn of this.drawFns) fn(g);
    this.rafId = requestAnimationFrame(this.loop);
  };
}
