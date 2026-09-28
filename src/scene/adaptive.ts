/**
 * Adaptive resolution (TECH_SPEC §15): if the rolling 2 s average frame time is above 18 ms,
 * step the pixel ratio down 2 → 1.5 → 1.25 → 1 and render bloom at half resolution; when it
 * drops below 10 ms, step back up. One step per 2 s window, so it never oscillates frame to
 * frame.
 */

export const DPR_STEPS = [2, 1.5, 1.25, 1] as const;
export const WINDOW_S = 2;
export const SLOW_MS = 18;
export const FAST_MS = 10;

export interface Quality {
  readonly dpr: number;
  /** 1 = full-resolution bloom, 0.5 = half */
  readonly bloomScale: number;
}

export interface AdaptiveQuality {
  readonly quality: Quality;
  /** feed one frame's duration; returns true when the quality changed */
  frame(dtS: number): boolean;
}

export function createAdaptiveQuality(deviceDpr: number): AdaptiveQuality {
  // start at the device's own ratio (capped at 2), then the fixed steps below it
  const top = Math.min(Math.max(deviceDpr, 1), 2);
  const steps: number[] = [top, ...DPR_STEPS.filter((d) => d < top)];
  let level = 0;
  let sumMs = 0;
  let n = 0;
  let windowS = 0;
  const quality = (): Quality => ({
    dpr: steps[level] as number,
    bloomScale: level > 0 ? 0.5 : 1,
  });
  let current = quality();
  return {
    get quality() {
      return current;
    },
    frame(dtS) {
      sumMs += dtS * 1000;
      n++;
      windowS += dtS;
      if (windowS < WINDOW_S) return false;
      const avg = sumMs / n;
      sumMs = 0;
      n = 0;
      windowS = 0;
      const before = level;
      if (avg > SLOW_MS && level < steps.length - 1) level++;
      else if (avg < FAST_MS && level > 0) level--;
      if (level === before) return false;
      current = quality();
      return true;
    },
  };
}
