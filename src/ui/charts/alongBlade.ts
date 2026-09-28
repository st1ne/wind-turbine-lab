/**
 * Along the blade (TECH_SPEC §3.6, tab 3): angle of attack α(r) at the airfoil stations 4–17
 * (the root cylinders carry no lift), x = span 0–63 m, y −10…25°. Live BEM per element at up
 * to 10 Hz, a ghost at 0° pitch for the same wind and rotor speed, and the stall band
 * 10–11° shaded coral: pitching lowers α outboard.
 */
import { RADIUS_M } from '@/config/turbine';
import { spanwiseAlpha } from '@/physics/bem';
import { STATIONS } from '@/physics/blade';
import { fixed, fmtDeg } from '@/physics/format';
import type { Axes } from '@/ui/charts/chartBase';
import { CHART_COLORS as C, type ChartView } from '@/ui/charts/types';

/** first airfoil station (0-based); stations 1–3 are cylinders */
export const FIRST_AIRFOIL = 3;
const RECOMPUTE_S = 0.1;
/** below this wind the BEM angles say nothing useful */
const MIN_WIND_M_S = 0.5;

const AXES: Axes = {
  x: { min: 0, max: Math.ceil(RADIUS_M) },
  y: { min: -10, max: 25 },
  xTicks: [0, 10, 20, 30, 40, 50, 60],
  yTicks: [-10, 0, 10, 20],
  xFormat: (v) => fixed(v, 0),
  yFormat: (v) => fixed(v, 0),
  xTitle: 'span r m',
  yTitle: 'α °',
};

export function createAlongBlade(): ChartView {
  const rs = STATIONS.slice(FIRST_AIRFOIL).map((st) => st.rM);
  let alpha: number[] = [];
  let ghost: number[] = [];
  let lastS = -Infinity;
  return {
    describe({ s }) {
      const tip = alpha[alpha.length - 1];
      return tip === undefined
        ? 'Angle of attack along the blade: no flow'
        : `Angle of attack along the blade: ${fmtDeg(tip)} near the tip at pitch ${fmtDeg(s.beta)}`;
    },
    draw(c, { s, nowS }) {
      if (nowS - lastS >= RECOMPUTE_S) {
        lastS = nowS;
        if (s.V >= MIN_WIND_M_S) {
          alpha = spanwiseAlpha(s.V, s.omega, s.beta).slice(FIRST_AIRFOIL);
          ghost = spanwiseAlpha(s.V, s.omega, 0).slice(FIRST_AIRFOIL);
        } else {
          alpha = [];
          ghost = [];
        }
      }
      c.begin(AXES);
      c.hband(10, 11, 'rgba(255,122,89,0.28)');
      c.label('stall', 1, 11, C.loads);
      c.clipped(() => {
        c.polyline([0, AXES.x.max], [0, 0], { color: 'rgba(255,255,255,0.18)', width: 1 });
        c.polyline(rs, ghost, { color: C.steady, width: 1.2, dash: [3, 3] });
        c.polyline(rs, alpha, { color: C.power, width: 1.6 });
        alpha.forEach((a, i) => c.dot(rs[i] as number, a, C.power, 2));
      });
      if (!alpha.length) c.label('no flow', AXES.x.max / 2, 5, C.muted, 'center');
      else c.label('- - at pitch 0°', 34, 21.5, C.steady);
    },
  };
}
