/**
 * Spinner (TECH_SPEC §5.3): a lathed nose cone around the hub, in the rotor frame (rotor axis
 * +x downwind, origin at the hub centre). The profile is a closed loop (outer skin out to the
 * back rim, inner skin back to the nose) so the spinner is a hollow solid the cutaway can cap.
 * Hub internals live in rotor.ts.
 */
import { Group, LatheGeometry, Mesh, Vector2, type BufferGeometry } from 'three';
import { PALETTE } from '@/config/theme';
import { makeMaterial } from '@/scene/materials';

export const SPINNER = { radius: 2.3, noseX: -4.4, backX: 1.6, wall: 0.18 } as const;

export interface Hub {
  readonly object3d: Group;
  readonly spinner: Mesh;
  dispose(): void;
}

/** Closed hollow spinner, rotor axis along +x. */
export function createSpinnerGeometry(): BufferGeometry {
  const R = SPINNER.radius;
  const n = SPINNER.noseX;
  const b = SPINNER.backX;
  const t = SPINNER.wall;
  // (radius, axial) with the axial coordinate along the lathe's y axis; counter-clockwise loop
  const outer = [
    [0.0, n],
    [0.55, n + 0.12],
    [1.25, n + 0.65],
    [1.8, n + 1.5],
    [2.15, n + 2.6],
    [R, n + 3.9],
    [R, b - 0.3],
    [R - 0.25, b],
    [1.2, b],
  ];
  const inner = [
    [1.2, b - t],
    [R - t - 0.2, b - t],
    [R - t, b - 0.4],
    [R - t, n + 3.95],
    [2.15 - t, n + 2.65],
    [1.8 - t, n + 1.58],
    [1.25 - 0.16, n + 0.77],
    [0.45, n + 0.28],
    [0.0, n + t],
  ];
  const profile = [...outer, ...inner].map(([r, y]) => new Vector2(r, y));
  const geo = new LatheGeometry(profile, 48);
  geo.rotateZ(-Math.PI / 2); // lathe y → rotor x
  return geo;
}

export function createHub(): Hub {
  const group = new Group();
  group.name = 'hub';
  const geo = createSpinnerGeometry();
  const spinner = new Mesh(
    geo,
    makeMaterial({ color: PALETTE.turbine, roughness: 0.4, metalness: 0.12 }, 'rotor'),
  );
  spinner.name = 'spinner';
  spinner.castShadow = true;
  group.add(spinner);
  return {
    object3d: group,
    spinner,
    dispose() {
      geo.dispose();
    },
  };
}
