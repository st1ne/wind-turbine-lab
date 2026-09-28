/**
 * NREL 5 MW blade stations (TECH_SPEC §6.1).
 * Source: Jonkman et al. 2009, NREL/TP-500-38060, Table 2-1.
 * Radius r, element length Δr, twist, chord, airfoil family.
 */
import type { AirfoilFamily } from '@/physics/types';

export interface BladeStation {
  readonly rM: number;
  readonly drM: number;
  readonly twistDeg: number;
  readonly chordM: number;
  readonly family: AirfoilFamily;
}

const R = [
  2.8667, 5.6, 8.3333, 11.75, 15.85, 19.95, 24.05, 28.15, 32.25, 36.35, 40.45, 44.55, 48.65, 52.75,
  56.1667, 58.9, 61.6333,
];
const DR = [
  2.7333, 2.7333, 2.7333, 4.1, 4.1, 4.1, 4.1, 4.1, 4.1, 4.1, 4.1, 4.1, 4.1, 4.1, 2.7333, 2.7333,
  2.7333,
];
const TWIST = [
  13.308, 13.308, 13.308, 13.308, 11.48, 10.162, 9.011, 7.795, 6.544, 5.361, 4.188, 3.125, 2.319,
  1.526, 0.863, 0.37, 0.106,
];
const CHORD = [
  3.542, 3.854, 4.167, 4.557, 4.652, 4.458, 4.249, 4.007, 3.748, 3.502, 3.256, 3.01, 2.764, 2.518,
  2.313, 2.086, 1.419,
];
const FAMILY: AirfoilFamily[] = [
  'CYL1', 'CYL1', 'CYL2', 'DU40', 'DU35', 'DU35', 'DU30', 'DU25', 'DU25', 'DU21', 'DU21',
  'NACA64', 'NACA64', 'NACA64', 'NACA64', 'NACA64', 'NACA64',
];

export const STATIONS: readonly BladeStation[] = R.map((rM, i) => ({
  rM,
  drM: DR[i] as number,
  twistDeg: TWIST[i] as number,
  chordM: CHORD[i] as number,
  family: FAMILY[i] as AirfoilFamily,
}));

export const STATION_COUNT = STATIONS.length;

export function station(i: number): BladeStation {
  const s = STATIONS[i];
  if (!s) throw new RangeError(`blade station ${i} out of range`);
  return s;
}

/** Thickness-to-chord ratio per family, for the blade loft (§5.2). Cylinders are 1.0. */
export const THICKNESS_RATIO: Record<AirfoilFamily, number> = {
  CYL1: 1.0,
  CYL2: 1.0,
  DU40: 0.4,
  DU35: 0.35,
  DU30: 0.3,
  DU25: 0.25,
  DU21: 0.21,
  NACA64: 0.18,
};
