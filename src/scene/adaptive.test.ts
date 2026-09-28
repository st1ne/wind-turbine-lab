import { describe, expect, it } from 'vitest';
import { createAdaptiveQuality } from '@/scene/adaptive';

const run = (q: ReturnType<typeof createAdaptiveQuality>, ms: number, seconds: number) => {
  let changed = 0;
  for (let t = 0; t < seconds; t += ms / 1000) if (q.frame(ms / 1000)) changed++;
  return changed;
};

describe('adaptive resolution (§15)', () => {
  it('steps 2 → 1.5 → 1.25 → 1 while frames take > 18 ms, bloom at half', () => {
    const q = createAdaptiveQuality(2);
    expect(q.quality).toEqual({ dpr: 2, bloomScale: 1 });
    run(q, 25, 2.1);
    expect(q.quality).toEqual({ dpr: 1.5, bloomScale: 0.5 });
    run(q, 25, 10);
    expect(q.quality.dpr).toBe(1);
  });
  it('recovers below 10 ms and holds in between', () => {
    const q = createAdaptiveQuality(2);
    run(q, 25, 4.2);
    expect(q.quality.dpr).toBe(1.25);
    expect(run(q, 14, 6)).toBe(0);
    run(q, 7, 10);
    expect(q.quality).toEqual({ dpr: 2, bloomScale: 1 });
  });
  it('never goes above the device pixel ratio', () => {
    const q = createAdaptiveQuality(1);
    expect(q.quality.dpr).toBe(1);
    run(q, 7, 10);
    expect(q.quality.dpr).toBe(1);
    const retina = createAdaptiveQuality(3);
    expect(retina.quality.dpr).toBe(2);
  });
});
