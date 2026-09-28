/** Derived loads, formatting and Beaufort (TECH_SPEC §6.8, §7.6, §3.3). */
import { describe, expect, it } from 'vitest';
import {
  baseMomentNm,
  lockedFlatThrustN,
  massFlowKgS,
  runawayRpm,
  runawayTipMach,
  tipSpeedMs,
  towerTopDeflectionM,
  windPowerW,
} from '@/physics/loads';
import { OMEGA_RATED_RAD } from '@/config/turbine';
import { ctAt, scheduleAt } from '@/physics/tables';
import { beaufort } from '@/physics/wind';
import { fixed, fmtKN, fmtMW, fmtMs } from '@/physics/format';

describe('loads (§6.8, §7.6)', () => {
  it('rated thrust 725 kN → 0.45 m tower deflection, 65 MN·m base moment', () => {
    expect(towerTopDeflectionM(725e3)).toBeCloseTo(0.45, 2);
    expect(baseMomentNm(725e3) / 1e6).toBeCloseTo(65.25, 2);
  });
  it('power in the wind: 3.91 MW at 8 m/s, 61 MW at 20', () => {
    expect(windPowerW(8) / 1e6).toBeCloseTo(3.91, 2);
    expect(Math.round(windPowerW(20) / 1e6)).toBe(61);
  });
  it('tip speed 79.8 m/s at rated', () => {
    expect(tipSpeedMs(OMEGA_RATED_RAD)).toBeCloseTo(79.8, 1);
  });
  it('runaway at 25 m/s: 63 rpm, Mach 1.22', () => {
    expect(Math.round(runawayRpm(25))).toBe(63);
    expect(runawayTipMach(25)).toBeCloseTo(1.22, 2);
  });
  it('mass flow ≈ 90 t/s at 8 m/s', () => {
    expect(massFlowKgS(8, (1 - Math.sqrt(1 - 0.779)) / 2) / 1e3).toBeCloseTo(90, -1);
  });
  it('parked thrust: feathered 19 / 28 / 37 kN, flat 357 / 515 / 701 kN', () => {
    const q = (V: number): number => 0.5 * 1.225 * Math.PI * 63 * 63 * V * V;
    for (const [V, feathered, flat] of [
      [25, 19, 357],
      [30, 28, 515],
      [35, 37, 701],
    ] as const) {
      expect(Math.abs((ctAt(0, 90) * q(V)) / 1e3 - feathered)).toBeLessThan(1.5);
      expect(Math.abs(lockedFlatThrustN(V) / 1e3 - flat)).toBeLessThan(3);
    }
  });
  it('schedule interpolation', () => {
    expect(scheduleAt(12).pitch).toBeCloseTo(3.51, 2);
    expect(scheduleAt(40).pitch).toBeCloseTo(23.19, 2);
  });
});

describe('formatting and Beaufort', () => {
  it('fixed decimals, no negative zero', () => {
    expect(fixed(-0.001, 1)).toBe('0.0');
    expect(fixed(-3.14, 1)).toBe('−3.1');
    // a no-break space keeps number and unit on one line
    expect(fmtMW(5e6)).toBe('5.00\u00a0MW');
    expect(fmtKN(725e3)).toBe('725\u00a0kN');
    expect(fmtMs(11.4)).toBe('11.4\u00a0m/s');
  });
  it('Beaufort scale', () => {
    expect(beaufort(0.2)).toEqual({ force: 0, name: 'calm' });
    expect(beaufort(8).force).toBe(5);
    expect(beaufort(11.4)).toEqual({ force: 6, name: 'strong breeze' });
    expect(beaufort(30).force).toBe(11);
    expect(beaufort(33).force).toBe(12);
  });
});
