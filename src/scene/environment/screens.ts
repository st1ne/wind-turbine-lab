/**
 * Wall blueprint screens (TECH_SPEC §4.1): two framed monitors on the back wall, drawn into
 * CanvasTextures at 5 Hz with the chart base in a blueprint theme.
 *   left   the live stream tube: tube boundary r_t(x), inner streamlines, the disk, and the
 *          induction with the disk and wake speeds it implies (u = (1 − a)V, (1 − 2a)V)
 *   right  Cp–λ at the current pitch with the live operating point
 */
import { Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { BETZ } from '@/config/turbine';
import { fixed, fmtDeg } from '@/physics/format';
import type { SimSnapshot } from '@/physics/types';
import { createCanvasTexture, type CanvasTex } from '@/scene/canvasTexture';
import { diskFlow } from '@/scene/fx/diskFlow';
import type { Flow } from '@/scene/fx/flow';
import type { SceneModule } from '@/scene/module';
import {
  createChartCanvas,
  linspace,
  type ChartCanvas,
  type ChartTheme,
} from '@/ui/charts/chartBase';
import { CP_TSR_AXES, cpCurve, LAMBDAS } from '@/ui/charts/cpTsr';
import { createThrottle } from '@/util/throttle';

const TEX = { width: 768, height: 480 } as const;
const SCREEN = { width: 2.9, height: 1.8125, y: 1.45, z: -7.44, xs: [-2.3, 1.3] } as const;
const REFRESH_HZ = 5;

const BLUEPRINT: ChartTheme = {
  background: '#0b2140',
  grid: 'rgba(140,200,255,0.12)',
  axis: 'rgba(170,215,255,0.45)',
  tick: '#8fb8e0',
  font: '20px "JetBrains Mono", ui-monospace, monospace',
  pad: { left: 70, right: 24, top: 44, bottom: 50 },
  lineScale: 2.4,
};
const INK = {
  line: '#dbeeff',
  tube: '#a78bfa',
  disk: '#ffffff',
  amber: '#ffb547',
  dim: '#8fb8e0',
} as const;

const TUBE_AXES = {
  x: { min: -2.5, max: 5 },
  y: { min: -2, max: 2 },
  xTicks: [-2, -1, 0, 1, 2, 3, 4, 5],
  yTicks: [-2, -1, 0, 1, 2],
  xFormat: (v: number) => fixed(v, 0),
  yFormat: (v: number) => fixed(v, 0),
  xTitle: 'x / R',
  yTitle: 'r / R   STREAM TUBE',
} as const;

function screen(x: number): { mesh: Group; tex: CanvasTex; chart: ChartCanvas } {
  const tex = createCanvasTexture(TEX.width, TEX.height);
  const chart = createChartCanvas(tex.canvas, BLUEPRINT);
  chart.resize(TEX.width, TEX.height, 1);
  const group = new Group();
  const frame = new Mesh(
    new PlaneGeometry(SCREEN.width + 0.12, SCREEN.height + 0.12),
    new MeshBasicMaterial({ color: '#1a1f2a', fog: false }),
  );
  const face = new Mesh(
    new PlaneGeometry(SCREEN.width, SCREEN.height),
    new MeshBasicMaterial({ map: tex.texture, color: new Color(1.15, 1.15, 1.15), fog: false }),
  );
  face.position.z = 0.005;
  group.add(frame, face);
  group.position.set(x, SCREEN.y, SCREEN.z);
  return { mesh: group, tex, chart };
}

export function createScreens(flow: Flow): SceneModule<Group> {
  const group = new Group();
  group.name = 'wall-screens';
  const left = screen(SCREEN.xs[0]);
  const right = screen(SCREEN.xs[1]);
  group.add(left.mesh, right.mesh);
  const xs = linspace(-2.5, 5, 121);
  const refresh = createThrottle(REFRESH_HZ);
  let pitch = Number.NaN;
  let cpCurrent: number[] = [];

  function drawTube(c: ChartCanvas, a: number): void {
    c.begin(TUBE_AXES);
    c.clipped(() => {
      for (const sign of [1, -1]) {
        c.polyline(
          xs,
          Array.from(xs, (x) => sign * diskFlow.tubeR(x, a)),
          {
            color: INK.tube,
            width: 1.4,
            dash: [6, 4],
          },
        );
        for (const r of [0.35, 0.7]) {
          c.polyline(
            xs,
            Array.from(xs, (x) => sign * diskFlow.streamline(r, x, a)),
            {
              color: INK.line,
              width: 0.8,
              alpha: 0.7,
            },
          );
        }
      }
      c.polyline([0, 0], [-1, 1], { color: INK.disk, width: 2.2 });
    });
    c.label(`a = ${fixed(a, 3)}`, -2.3, 1.75, INK.line);
    c.label(`disk  u = ${fixed(1 - a, 2)} V`, -2.3, -1.45, INK.dim);
    c.label(`wake  u = ${fixed(1 - 2 * a, 2)} V`, -2.3, -1.8, INK.dim);
  }

  function drawCp(c: ChartCanvas, s: SimSnapshot): void {
    if (!(Math.abs(s.beta - pitch) <= 0.05)) {
      pitch = s.beta;
      cpCurrent = cpCurve(pitch);
    }
    c.begin({ ...CP_TSR_AXES, yTitle: 'Cp   ROTOR' });
    c.clipped(() => {
      c.polyline([0, 14], [BETZ, BETZ], { color: INK.tube, width: 1, dash: [6, 4] });
      c.polyline(LAMBDAS, cpCurrent, { color: INK.amber, width: 1.4 });
      const x = Math.min(Math.max(s.lambda, 0), 14);
      const y = Math.min(Math.max(s.cp, 0), 0.65);
      c.ring(x, y, 7, INK.amber, 0.5);
      c.dot(x, y, INK.amber, 4);
    });
    c.label(`pitch ${fmtDeg(s.beta)}`, 13.6, 0.08, INK.amber, 'right');
  }

  return {
    object3d: group,
    update(s, _ui, dt) {
      if (!refresh.ready(dt)) return;
      drawTube(left.chart, flow.aVisual);
      drawCp(right.chart, s);
      left.tex.texture.needsUpdate = true;
      right.tex.texture.needsUpdate = true;
    },
    dispose() {
      for (const sc of [left, right]) {
        sc.tex.texture.dispose();
        sc.mesh.traverse((o) => {
          if (o instanceof Mesh) {
            o.geometry.dispose();
            (o.material as MeshBasicMaterial).dispose();
          }
        });
      }
    },
  };
}
