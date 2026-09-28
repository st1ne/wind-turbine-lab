/**
 * Spinner (TECH_SPEC §5.3): a lathed nose cone around the hub, in the rotor frame (rotor axis
 * +x downwind, origin at the hub centre). Hub internals are added in Phase 4.
 */
import { Group, LatheGeometry, Mesh, Vector2 } from 'three';
import { PALETTE } from '@/config/theme';
import { makeMaterial } from '@/scene/materials';

export const SPINNER = { radius: 2.3, noseX: -4.4, backX: 1.6 } as const;

export interface Hub {
  readonly object3d: Group;
  readonly spinner: Mesh;
  dispose(): void;
}

export function createHub(): Hub {
  const group = new Group();
  group.name = 'hub';
  const R = SPINNER.radius;
  // profile (radius, axial) with the axial coordinate along the lathe's y axis
  const profile = [
    new Vector2(0.0, SPINNER.noseX),
    new Vector2(0.55, SPINNER.noseX + 0.12),
    new Vector2(1.25, SPINNER.noseX + 0.65),
    new Vector2(1.8, SPINNER.noseX + 1.5),
    new Vector2(2.15, SPINNER.noseX + 2.6),
    new Vector2(R, SPINNER.noseX + 3.9),
    new Vector2(R, SPINNER.backX - 0.3),
    new Vector2(R - 0.25, SPINNER.backX),
    new Vector2(1.2, SPINNER.backX),
  ];
  const geo = new LatheGeometry(profile, 48);
  geo.rotateZ(-Math.PI / 2); // lathe y → rotor x
  const spinner = new Mesh(
    geo,
    makeMaterial({ color: PALETTE.turbine, roughness: 0.4, metalness: 0.12 }, 'rotor'),
  );
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
