/**
 * Warning beacon on the fan housing (TECH_SPEC §4.1, §11): off in normal operation; in
 * SHUTDOWN / PARKED it turns amber and rotates at 1 rev/s, in TRIP / TRIPPED it turns red.
 * A glowing dome and a rotating spot light that sweeps the room.
 */
import {
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  SpotLight,
} from 'three';
import { ENVIRONMENT } from '@/config/environment';
import { THEME } from '@/config/theme';
import type { SupervisorState } from '@/physics/types';
import { makeMaterial } from '@/scene/materials';
import type { SceneModule } from '@/scene/module';

const F = ENVIRONMENT.fan;
export const BEACON_REV_S = 1;

/** Beacon colour for a supervisor state, or null when it is off. */
export function beaconColor(state: SupervisorState): 'amber' | 'red' | null {
  if (state === 'TRIP' || state === 'TRIPPED') return 'red';
  if (state === 'SHUTDOWN' || state === 'PARKED') return 'amber';
  return null;
}

export function createBeacon(): SceneModule<Group> {
  const group = new Group();
  group.name = 'beacon';
  group.position.set(F.x - 0.08, F.y + F.radius + 0.045, -0.1);

  const baseGeo = new CylinderGeometry(0.018, 0.022, 0.014, 20);
  baseGeo.translate(0, 0.007, 0);
  const base = new Mesh(
    baseGeo,
    makeMaterial({ color: '#2b313d', roughness: 0.5, metalness: 0.6 }, 'environment'),
  );
  const domeGeo = new SphereGeometry(0.016, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  domeGeo.translate(0, 0.014, 0);
  const amber = new Color(THEME.power);
  const red = new Color(THEME.alarm);
  const off = new Color('#3a2a14');
  const domeMat = new MeshBasicMaterial({ color: off.clone() });
  const dome = new Mesh(domeGeo, domeMat);
  group.add(base, dome);

  // rotating head: a spot light that sweeps the room
  const head = new Group();
  head.position.y = 0.02;
  group.add(head);
  const spot = new SpotLight(amber, 0, 5, Math.PI / 10, 0.5, 1.2);
  spot.position.set(0, 0, 0);
  spot.target.position.set(1, -0.12, 0);
  head.add(spot, spot.target);
  let angle = 0;
  return {
    object3d: group,
    update(s, _ui, dt) {
      const c = beaconColor(s.state);
      const col = c === 'red' ? red : amber;
      if (c) {
        angle += BEACON_REV_S * 2 * Math.PI * dt;
        head.rotation.y = angle;
        // the dome brightens as the beam faces the viewer; bloom does the rest
        domeMat.color.copy(col).multiplyScalar(2.5 + 1.5 * Math.max(Math.cos(angle), 0));
        spot.color.copy(col);
        spot.intensity = 6;
      } else {
        domeMat.color.copy(off);
        spot.intensity = 0;
      }
    },
    dispose() {
      [baseGeo, domeGeo].forEach((g) => g.dispose());
      domeMat.dispose();
      base.material.dispose();
    },
  };
}
