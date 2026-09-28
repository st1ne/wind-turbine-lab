/**
 * GLSL mirror of physics/actuatorDisk.ts (TECH_SPEC §6.5) for the smoke ribbons and tip
 * vortices. Coordinates are normalised by the rotor radius R (x̂ = x/R, r̂ = r/R, x̂ = 0 at the
 * rotor, +x downstream); `a` is the disk-averaged axial induction.
 *
 *   û(x̂)   = 1 − a(1 + x̂/√(x̂² + 1))                 axial velocity / V
 *   r̂_t(x̂) = √((1 − a)/û)                             stream-tube radius
 *   inside:  r̂(x̂) = r̂∞ √(1/û)   (r̂∞ ≤ √(1 − a))
 *   outside: r̂(x̂)² = r̂∞² + r̂_t² − (1 − a)           (the annulus keeps its area: u = V)
 *
 * fx/diskFlow.test.ts checks a line-by-line JS port of this GLSL against the physics module.
 */
import { axialVelocity, streamlineRadius, tubeRadius } from '@/physics/actuatorDisk';

export const DISK_FLOW_GLSL = /* glsl */ `
float diskU(float x, float a) {
  return 1.0 - a * (1.0 + x / sqrt(x * x + 1.0));
}
float diskTubeR(float x, float a) {
  return sqrt((1.0 - a) / max(diskU(x, a), 1e-4));
}
// streamline radius and local u/V for a line seeded at r̂∞ far upstream
vec2 diskStreamline(float rInf, float x, float a) {
  float u = max(diskU(x, a), 1e-4);
  if (rInf * rInf <= 1.0 - a) return vec2(rInf * sqrt(1.0 / u), u);
  float rt = diskTubeR(x, a);
  return vec2(sqrt(max(rInf * rInf + rt * rt - (1.0 - a), 0.0)), 1.0);
}
`;

/** CPU reference of the GLSL above, in normalised units (for tests and the rake/outline). */
export const diskFlow = {
  u: (x: number, a: number): number => axialVelocity(x, a, 1, 1),
  tubeR: (x: number, a: number): number => tubeRadius(x, a, 1),
  streamline: (rInf: number, x: number, a: number): number => streamlineRadius(rInf, x, a, 1),
};
