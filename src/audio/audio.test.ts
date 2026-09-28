import { describe, expect, it } from 'vitest';
import { OMEGA_RATED_RAD, P_RATED_W } from '@/config/turbine';
import { humFrequencyHz, humLevel, whooshLevel, whooshPulse, windCutoffHz } from '@/audio/audio';

describe('sound mappings (§13)', () => {
  it('generator hum ≈ 39 Hz at rated (two pole pairs)', () => {
    expect(humFrequencyHz(OMEGA_RATED_RAD)).toBeCloseTo(39.1, 1);
    expect(humFrequencyHz(0)).toBe(0);
  });
  it('whoosh ∝ tip speed squared, pulsing once per blade passage', () => {
    expect(whooshLevel(OMEGA_RATED_RAD)).toBeCloseTo(1, 10);
    expect(whooshLevel(OMEGA_RATED_RAD / 2)).toBeCloseTo(0.25, 10);
    expect(whooshPulse(0)).toBe(1);
    expect(whooshPulse(0.5)).toBeCloseTo(0, 10);
    expect(whooshPulse(3)).toBeCloseTo(1, 10);
  });
  it('hum ∝ power, silent when parked; wind noise brightens with V', () => {
    expect(humLevel(0)).toBe(0);
    expect(humLevel(P_RATED_W)).toBe(1);
    expect(humLevel(-1e5)).toBe(0);
    expect(windCutoffHz(30)).toBeGreaterThan(windCutoffHz(8));
  });
});
