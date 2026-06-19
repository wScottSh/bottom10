export interface ClockLike {
  now(): number;
}

export const WALL_CLOCK: ClockLike = { now: () => Date.now() };

export function createControllableClock(initialNow = 0): ClockLike & { setNow(t: number): void } {
  let time = initialNow;
  return {
    now() { return time; },
    setNow(t: number) { time = t; },
  };
}
