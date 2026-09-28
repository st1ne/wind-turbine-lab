import { describe, expect, it } from 'vitest';
import { defaultUiState } from '@/state/uiState';
import { betzSweep, tourDurationS, TOUR_STEPS, TOUR_TIME_SCALE } from '@/tour/steps';
import { chipState, CHIPS } from '@/ui/chips';

describe('guided tour (§12)', () => {
  it('six steps of 7–10 s, about 50 s in all, at ×4', () => {
    expect(TOUR_STEPS).toHaveLength(6);
    for (const s of TOUR_STEPS) {
      expect(s.durationS).toBeGreaterThanOrEqual(7);
      expect(s.durationS).toBeLessThanOrEqual(10);
    }
    expect(tourDurationS()).toBeGreaterThanOrEqual(45);
    expect(tourDurationS()).toBeLessThanOrEqual(55);
    expect(TOUR_TIME_SCALE).toBe(4);
  });
  it('step 2 sweeps b 1 → 0 → 1/3 and holds at the Betz optimum', () => {
    expect(betzSweep(0)).toBeCloseTo(1, 10);
    expect(betzSweep(0.4)).toBeCloseTo(0, 10);
    expect(betzSweep(0.75)).toBeCloseTo(1 / 3, 10);
    expect(betzSweep(1)).toBeCloseTo(1 / 3, 10);
  });
  it('each step either jumps to a steady point or ramps the wind', () => {
    for (const s of TOUR_STEPS.filter((s) => s.state.rotorMode !== 'ideal')) {
      expect(s.jump !== undefined || s.wind !== undefined).toBe(true);
    }
    // the storm must build visibly, so it ramps
    expect(TOUR_STEPS[4]?.wind).toBe(30);
  });
});

describe('camera chips (§3.8)', () => {
  it('switch modes and remember the chip', () => {
    const nacelle = CHIPS.find((c) => c.id === 'nacelle');
    expect(nacelle && chipState(nacelle, defaultUiState())).toEqual({
      view: 'cutaway',
      follow: 'power',
      camChip: 'nacelle',
    });
  });
  it('the Blade chip leaves the forced Betz chart alone in Ideal-disk mode', () => {
    const blade = CHIPS.find((c) => c.id === 'blade');
    const ideal = { ...defaultUiState(), rotorMode: 'ideal' as const };
    expect(blade && chipState(blade, ideal)).toEqual({ camChip: 'blade' });
  });
});
