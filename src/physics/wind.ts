/**
 * Wind input (TECH_SPEC §6.10, §3.3).
 *   Mean wind ramps toward the target at ≤ 2 m/s per sim second.
 *   Gusts: V = V̄ (1 + TI·n(t)), TI = 0.12, n(t) = Σ sin(2πt/P_k + φ_k) / √2 (std ≈ 1),
 *   periods 3.1, 7.3, 13.1, 29.7 s, random phases.
 */
import { GUST_PERIODS_S, GUST_TI, WIND_RAMP_M_S2 } from '@/config/controller';
import { mulberry32 } from '@/util/math';

export function rampMeanWind(current: number, target: number, dt: number): number {
  const step = WIND_RAMP_M_S2 * dt;
  return current + Math.max(-step, Math.min(step, target - current));
}

export interface Gusts {
  /** normalized gust signal n(t), std ≈ 1 */
  n(t: number): number;
}

export function createGusts(seed = 1): Gusts {
  const rnd = mulberry32(seed);
  const phases = GUST_PERIODS_S.map(() => rnd() * 2 * Math.PI);
  return {
    n(t) {
      let s = 0;
      GUST_PERIODS_S.forEach((p, k) => {
        s += Math.sin((2 * Math.PI * t) / p + (phases[k] as number));
      });
      return s / Math.SQRT2;
    },
  };
}

export function gustyWind(Vmean: number, n: number): number {
  return Math.max(Vmean * (1 + GUST_TI * n), 0);
}

const BEAUFORT: readonly (readonly [number, string])[] = [
  [0.5, 'calm'],
  [1.5, 'light air'],
  [3.3, 'light breeze'],
  [5.4, 'gentle breeze'],
  [7.9, 'moderate breeze'],
  [10.7, 'fresh breeze'],
  [13.8, 'strong breeze'],
  [17.1, 'near gale'],
  [20.7, 'gale'],
  [24.4, 'strong gale'],
  [28.4, 'storm'],
  [32.6, 'violent storm'],
];

/** Beaufort force and name (upper bounds per §3.3; ≥ 32.7 is hurricane force). */
export function beaufort(V: number): { force: number; name: string } {
  for (let k = 0; k < BEAUFORT.length; k++) {
    const [upper, name] = BEAUFORT[k] as readonly [number, string];
    if (k === 0 ? V < upper : V <= upper) return { force: k, name };
  }
  return { force: 12, name: 'hurricane force' };
}
