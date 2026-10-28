/** Chain counter with a decaying window and a capped score multiplier. */
export class Combo {
  count = 0;
  private timer = 0;

  constructor(
    private readonly window = 2,
    private readonly maxMultiplier = 8,
  ) {}

  /** Register a hit; returns the multiplier to apply to it. */
  hit(): number {
    this.count++;
    this.timer = this.window;
    return this.multiplier;
  }

  get multiplier(): number {
    return Math.min(this.maxMultiplier, 1 + Math.floor(this.count / 3));
  }

  update(dt: number): void {
    if (this.count === 0) return;
    this.timer -= dt;
    if (this.timer <= 0) this.count = 0;
  }

  reset(): void {
    this.count = 0;
    this.timer = 0;
  }
}
