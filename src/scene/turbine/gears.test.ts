/** Gearbox kinematics (TECH_SPEC §5.4): 3 stages multiply to 97.0 : 1. */
import { describe, expect, it } from 'vitest';
import { GEAR_RATIO } from '@/config/turbine';
import { HSS_RATIO, INTERMEDIATE_RATIO, SUN_RATIO, TEETH } from '@/scene/turbine/drivetrain';

describe('gearbox', () => {
  it('planetary stage: sun = 5.714 × carrier', () => {
    expect(SUN_RATIO).toBeCloseTo(5.714, 3);
    // planetary assembly condition: (sun + ring) divisible by the planet count
    expect((TEETH.sun + TEETH.ring) % 3).toBe(0);
    expect(TEETH.sun + 2 * TEETH.planet).toBe(TEETH.ring);
  });
  it('parallel stages ×3.773 and ×4.5; HSS turns with the rotor at 97 : 1', () => {
    expect(Math.abs(INTERMEDIATE_RATIO / SUN_RATIO)).toBeCloseTo(3.773, 3);
    expect(HSS_RATIO).toBeCloseTo(GEAR_RATIO, 1);
    expect(HSS_RATIO).toBeGreaterThan(0);
  });
});
