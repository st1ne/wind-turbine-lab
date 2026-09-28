import { describe, expect, it } from 'vitest';
import { createSim } from '@/physics/sim';
import { beaconColor } from '@/scene/fx/beacon';
import { flashEnvelope, FLASH_S, LIGHTNING_THRESHOLD } from '@/scene/fx/lightning';
import { rainSlant } from '@/scene/fx/rain';
import { treeBendDeg } from '@/scene/fx/trees';

describe('weather FX (§11)', () => {
  it('trees lean 18° · min(V², 900)/900', () => {
    expect(treeBendDeg(0)).toBe(0);
    expect(treeBendDeg(15)).toBeCloseTo(4.5, 10);
    expect(treeBendDeg(30)).toBeCloseTo(18, 10);
    expect(treeBendDeg(35)).toBeCloseTo(18, 10);
  });
  it('rain slants atan(V / 9)', () => {
    expect(rainSlant(0)).toBe(0);
    expect(rainSlant(9)).toBeCloseTo(Math.PI / 4, 10);
  });
  it('beacon: amber when shut down or parked, red on trip, off otherwise', () => {
    expect(beaconColor('RUN')).toBeNull();
    expect(beaconColor('STARTUP')).toBeNull();
    expect(beaconColor('SHUTDOWN')).toBe('amber');
    expect(beaconColor('PARKED')).toBe('amber');
    expect(beaconColor('TRIP')).toBe('red');
    expect(beaconColor('TRIPPED')).toBe('red');
  });
  it('a lightning flash is a 60 ms burst', () => {
    expect(flashEnvelope(-0.01)).toBe(0);
    expect(flashEnvelope(0.03)).toBe(1);
    expect(flashEnvelope(FLASH_S + 0.02)).toBe(0);
    expect(flashEnvelope(1)).toBe(0);
  });
  it('the Storm preset from Rated reaches full storm (and lightning) as the wind ramps', () => {
    const sim = createSim();
    sim.initSteady(11.4);
    const inputs = { windTarget: 30, gusts: false, pitchLockDeg: null, idealDisk: false };
    let tHalf = Number.NaN;
    let tLightning = Number.NaN;
    for (let k = 0; k < 120 * 15; k++) {
      sim.advance(1 / 120, inputs);
      const s = sim.snapshot();
      if (Number.isNaN(tHalf) && s.stormLevel >= 0.5) tHalf = s.t;
      if (Number.isNaN(tLightning) && s.stormLevel > LIGHTNING_THRESHOLD) tLightning = s.t;
    }
    // V̄ ramps 11.4 → 30 at 2 m/s²: s = 0.5 at V̄ = 23 (≈ 5.8 s), > 0.8 at V̄ ≈ 25.9 (≈ 7.3 s)
    expect(tHalf).toBeCloseTo(5.8, 0);
    expect(tLightning).toBeLessThan(8);
    expect(sim.snapshot().stormLevel).toBe(1);
  });
});
