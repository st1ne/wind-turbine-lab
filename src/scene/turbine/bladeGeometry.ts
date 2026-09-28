/**
 * Blade loft from the 17 NREL 5 MW stations (TECH_SPEC §5.2), in full-scale metres.
 *
 * Blade frame: span along +y from the rotor centre (root at the hub radius, tip at R),
 * rotor axis +x (downwind), direction of motion −z (clockwise seen from upwind).
 * The pitch axis is the y axis and sits at 25 % chord. Twist is baked in; pitch is applied at
 * runtime as a rotation about y (rotation.y = +β turns the chord toward the wind).
 *
 * Section at twist θ, chordwise s ∈ [0, 1] (LE → TE) and normal n (toward the suction side):
 *   chord dir  = ( sin θ, 0,  cos θ)       LE upstream-forward, TE downstream-back
 *   normal dir = ( cos θ, 0, −sin θ)       suction side faces downwind at θ = 0
 * Cylinder stations are circles of diameter = chord; airfoils use the NACA 4-digit thickness
 * law with the family thickness ratio plus ~3 % parabolic camber. Stations are blended with a
 * Catmull-Rom spline over the station index (40 spanwise rings, 48 points per section,
 * cosine-spaced). Group 0 = blade, group 1 = red tip band (ICAO marking look) + tip cap.
 */
import { BufferAttribute, BufferGeometry } from 'three';
import { HUB_RADIUS_M, RADIUS_M } from '@/config/turbine';
import { STATIONS, THICKNESS_RATIO } from '@/physics/blade';

const SECTION_POINTS = 48;
const RINGS = 40;
const CAMBER = 0.03;
/** tip band starts here, m from the rotor centre */
export const TIP_BAND_START_M = 59.6;
const DEG = Math.PI / 180;

interface Knot {
  r: number;
  chord: number;
  twist: number;
  thickness: number;
  /** 1 = circular section, 0 = airfoil */
  circle: number;
}

const KNOTS: Knot[] = [
  { r: HUB_RADIUS_M, chord: 3.542, twist: 13.308, thickness: 1, circle: 1 },
  ...STATIONS.map((s) => ({
    r: s.rM,
    chord: s.chordM,
    twist: s.twistDeg,
    thickness: THICKNESS_RATIO[s.family],
    circle: s.family === 'CYL1' || s.family === 'CYL2' ? 1 : 0,
  })),
  { r: RADIUS_M, chord: 0.75, twist: 0.0, thickness: 0.18, circle: 0 },
];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/** Interpolated section parameters at radius r. */
export function knotAt(r: number): Knot {
  const n = KNOTS.length;
  let i = 0;
  while (i < n - 2 && (KNOTS[i + 1] as Knot).r < r) i++;
  const k0 = KNOTS[Math.max(i - 1, 0)] as Knot;
  const k1 = KNOTS[i] as Knot;
  const k2 = KNOTS[i + 1] as Knot;
  const k3 = KNOTS[Math.min(i + 2, n - 1)] as Knot;
  const t = Math.min(Math.max((r - k1.r) / (k2.r - k1.r), 0), 1);
  const f = (key: keyof Knot): number => catmullRom(k0[key], k1[key], k2[key], k3[key], t);
  return {
    r,
    chord: Math.max(f('chord'), 0.3),
    twist: f('twist'),
    thickness: Math.min(Math.max(f('thickness'), 0.12), 1),
    // the circle → airfoil blend is kept monotonic (no overshoot)
    circle: Math.min(Math.max(k1.circle + (k2.circle - k1.circle) * t * t * (3 - 2 * t), 0), 1),
  };
}

/** NACA 4-digit half thickness (closed trailing edge) for thickness ratio t. */
function nacaHalfThickness(s: number, t: number): number {
  return (
    5 * t * (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4)
  );
}

/** 2D section point k in chord units: [s − 0.25, n] relative to the pitch axis. */
function sectionPoint(k: number, knot: Knot): [number, number] {
  const phi = (2 * Math.PI * k) / SECTION_POINTS;
  const s = 0.5 + 0.5 * Math.cos(phi);
  const side = Math.sin(phi) >= 0 ? 1 : -1;
  const camber = 4 * CAMBER * s * (1 - s);
  const nAir = camber + side * nacaHalfThickness(s, knot.thickness);
  // circle of diameter 1 centred on the pitch axis
  const sCircle = 0.25 + 0.5 * Math.cos(phi);
  const nCircle = 0.5 * Math.sin(phi);
  const c = knot.circle;
  return [(s - 0.25) * (1 - c) + (sCircle - 0.25) * c, nAir * (1 - c) + nCircle * c];
}

export function createBladeGeometry(): BufferGeometry {
  const radii: number[] = [];
  for (let j = 0; j < RINGS; j++) {
    // denser near the root transition and the tip
    const u = j / (RINGS - 1);
    const w = u - 0.06 * Math.sin(2 * Math.PI * u);
    radii.push(HUB_RADIUS_M + (RADIUS_M - 0.35 - HUB_RADIUS_M) * w);
  }
  const bandRing = radii.findIndex((r) => r >= TIP_BAND_START_M);
  radii.splice(bandRing, 0, TIP_BAND_START_M);

  const P = SECTION_POINTS;
  const nRings = radii.length;
  const pos = new Float32Array((nRings * P + 1) * 3);
  let v = 0;
  let tipCentre: [number, number, number] = [0, RADIUS_M, 0];
  radii.forEach((r, j) => {
    const knot = knotAt(r);
    const th = knot.twist * DEG;
    const cd: [number, number] = [Math.sin(th), Math.cos(th)];
    const nd: [number, number] = [Math.cos(th), -Math.sin(th)];
    let cx = 0;
    let cz = 0;
    for (let k = 0; k < P; k++) {
      const [s, n] = sectionPoint(k, knot);
      const x = (s * cd[0] + n * nd[0]) * knot.chord;
      const z = (s * cd[1] + n * nd[1]) * knot.chord;
      pos[v++] = x;
      pos[v++] = r;
      pos[v++] = z;
      cx += x;
      cz += z;
    }
    if (j === nRings - 1) tipCentre = [cx / P, RADIUS_M, cz / P];
  });
  pos[v++] = tipCentre[0];
  pos[v++] = tipCentre[1];
  pos[v++] = tipCentre[2];

  const bladeIdx: number[] = [];
  const bandIdx: number[] = [];
  for (let j = 0; j < nRings - 1; j++) {
    const target = j >= bandRing ? bandIdx : bladeIdx;
    for (let k = 0; k < P; k++) {
      const a = j * P + k;
      const b = j * P + ((k + 1) % P);
      const c = (j + 1) * P + ((k + 1) % P);
      const d = (j + 1) * P + k;
      // sections run counter-clockwise seen from the tip, so this winding faces outward
      target.push(a, b, d, b, c, d);
    }
  }
  const tip = nRings * P;
  const last = (nRings - 1) * P;
  for (let k = 0; k < P; k++) bandIdx.push(last + k, last + ((k + 1) % P), tip);

  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setIndex([...bladeIdx, ...bandIdx]);
  g.addGroup(0, bladeIdx.length, 0);
  g.addGroup(bladeIdx.length, bandIdx.length, 1);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}
