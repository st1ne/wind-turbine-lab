/**
 * Whole / Cutaway / Exploded (TECH_SPEC §8). Two eased channels run independently, so any
 * view change animates from wherever the last one left off and nothing ever pops:
 *
 *   cut      0 → 1 over 0.9 s: the clipping plane sweeps from outside the nacelle to the shaft
 *            axis on the camera's side (picked when Cutaway is entered)
 *   explode  0 → 1 over 1.1 s per part, staggered 60 ms: rotor +6 m upwind, drivetrain parts
 *            spread along the shaft, the nacelle lifts +4 m and its shell fades to 0.15, with
 *            dashed guide lines from each part's home
 *
 * Internals are only rendered while either channel is open (culled, not hidden, in Whole).
 * The rotor keeps turning and the gears keep meshing throughout: this module only moves
 * whole parts, the turbine module still animates them.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineDashedMaterial,
  Vector3,
  type MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import { MODEL_SCALE } from '@/config/turbine';
import { createCutaway, type Cutaway } from '@/scene/cutaway';
import type { SceneModule } from '@/scene/module';
import { NACELLE } from '@/scene/turbine/nacelle';
import type { Turbine } from '@/scene/turbine/turbine';
import type { ViewMode } from '@/state/uiState';
import { easeInOutCubic } from '@/util/easing';

export const CUT_S = 0.9;
export const EXPLODE_S = 1.1;
export const STAGGER_S = 0.06;
/** plane offset where nothing is cut yet: just outside the 6 m wide nacelle, world units */
const CUT_OPEN = 3.4 * MODEL_SCALE;
const ROTOR_FORWARD_M = -6;
const SHELL_LIFT_M = 4;
const SHELL_FADED = 0.15;

interface Moving {
  readonly obj: Object3D;
  readonly home: Vector3;
  readonly offset: Vector3;
  readonly order: number;
  readonly guide: Line | null;
  /** guide line start, in the part's parent frame */
  readonly anchor: Vector3;
}

export interface Views extends SceneModule<Group> {
  readonly cutaway: Cutaway;
  /** 0–1 progress of each channel (eased), for other modules and tests */
  readonly cut: number;
  readonly explode: number;
  setResolution(width: number, height: number): void;
}

export function createViews(turbine: Turbine, camera: PerspectiveCamera): Views {
  const { rotor, nacelle, drivetrain, tower } = turbine;
  const root = new Group();
  root.name = 'views';

  // ---- cutaway: capture poses with the rotor at azimuth 0 (sections are axisymmetric anyway)
  const spin0 = rotor.spin.rotation.x;
  rotor.spin.rotation.x = 0;
  turbine.object3d.updateMatrixWorld(true);
  const cutaway = createCutaway(
    [
      { mesh: nacelle.shell, lineParent: nacelle.object3d },
      { mesh: rotor.hub.spinner, lineParent: rotor.object3d },
      { mesh: rotor.hubBody, lineParent: rotor.object3d },
      {
        mesh: tower.upper,
        lineParent: tower.object3d,
        bend: tower.bend,
        displaceX: tower.displacementAt,
      },
    ],
    {
      capCenter: new Vector3(0.045, 0.45, 0),
      capWidth: 0.32,
      capHeight: 0.22,
    },
  );
  rotor.spin.rotation.x = spin0;
  root.add(cutaway.object3d);

  // ---- exploded parts
  const guideMat = new LineDashedMaterial({
    color: '#8b93a7',
    dashSize: 0.35,
    gapSize: 0.25,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const moving: Moving[] = [];
  const add = (
    obj: Object3D,
    offset: Vector3,
    order: number,
    guide: boolean,
    anchorLocal = new Vector3(),
  ): void => {
    let line: Line | null = null;
    const anchor = obj.position.clone().add(anchorLocal);
    if (guide && obj.parent) {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
      line = new Line(g, guideMat);
      line.visible = false;
      line.frustumCulled = false;
      obj.parent.add(line);
    }
    moving.push({ obj, home: obj.position.clone(), offset, order, guide: line, anchor });
  };
  add(rotor.object3d, new Vector3(ROTOR_FORWARD_M, 0, 0), 0, true);
  add(
    nacelle.object3d,
    new Vector3(0, SHELL_LIFT_M, 0),
    0,
    true,
    new Vector3(6.3, NACELLE.topY, 0),
  );
  for (const part of drivetrain.explode) add(part.obj, part.offset, part.order, part.guide);
  const maxOrder = Math.max(...moving.map((m) => m.order));
  const explodeTotal = EXPLODE_S + STAGGER_S * maxOrder;

  const fading = [nacelle.shell, rotor.hub.spinner].map((m) => m.material as MeshStandardMaterial);

  let cutClock = 0;
  let explodeClock = 0;
  let side: 1 | -1 = 1;
  let lastView: ViewMode | null = null;
  let internals = true;
  let cutE = 0;
  let explodeE = 0;
  const tmp = new Vector3();

  function setInternals(v: boolean): void {
    if (v === internals) return;
    internals = v;
    drivetrain.setVisible(v);
    rotor.setInternalsVisible(v);
  }
  setInternals(false);

  function setFade(f: number): void {
    const opacity = 1 - (1 - SHELL_FADED) * f;
    const transparent = f > 0.001;
    for (const m of fading) {
      if (m.transparent !== transparent) {
        m.transparent = transparent;
        m.depthWrite = !transparent;
        m.needsUpdate = true;
      }
      m.opacity = opacity;
    }
  }

  return {
    object3d: root,
    cutaway,
    get cut() {
      return cutE;
    },
    get explode() {
      return explodeE;
    },
    update(_s, ui, dt) {
      if (ui.view !== lastView) {
        // the cut faces the camera: pick the side when Cutaway is entered, not while it runs
        if (ui.view === 'cutaway' && cutClock === 0) side = camera.position.z >= 0 ? 1 : -1;
        lastView = ui.view;
      }
      const wantCut = ui.view === 'cutaway';
      const wantExplode = ui.view === 'exploded';
      cutClock = Math.min(Math.max(cutClock + (wantCut ? dt : -dt), 0), CUT_S);
      explodeClock = Math.min(Math.max(explodeClock + (wantExplode ? dt : -dt), 0), explodeTotal);

      setInternals(ui.view !== 'whole' || cutClock > 0 || explodeClock > 0);

      cutE = easeInOutCubic(cutClock / CUT_S);
      cutaway.setPlane(side, cutClock > 0 ? CUT_OPEN * (1 - cutE) : null);
      cutaway.update();

      explodeE = easeInOutCubic(explodeClock / explodeTotal);
      for (const m of moving) {
        const e = easeInOutCubic(
          Math.min(Math.max((explodeClock - STAGGER_S * m.order) / EXPLODE_S, 0), 1),
        );
        m.obj.position.copy(m.home).addScaledVector(m.offset, e);
        if (m.guide) {
          m.guide.visible = e > 0.01;
          if (m.guide.visible) {
            const pos = m.guide.geometry.getAttribute('position') as BufferAttribute;
            tmp.copy(m.anchor).addScaledVector(m.offset, e);
            pos.setXYZ(0, m.anchor.x, m.anchor.y, m.anchor.z);
            pos.setXYZ(1, tmp.x, tmp.y, tmp.z);
            pos.needsUpdate = true;
            m.guide.computeLineDistances();
          }
        }
      }
      guideMat.opacity = 0.7 * explodeE;
      // the shell and spinner fade with the first (slot 0) parts
      setFade(easeInOutCubic(Math.min(explodeClock / EXPLODE_S, 1)));
    },
    setResolution(width, height) {
      cutaway.setResolution(width, height);
    },
    dispose() {
      cutaway.dispose();
      guideMat.dispose();
      for (const m of moving) {
        m.guide?.geometry.dispose();
        m.guide?.removeFromParent();
      }
    },
  };
}
