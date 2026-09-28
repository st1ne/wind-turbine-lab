/**
 * Power curve (TECH_SPEC §3.6, tab 1): x 0–30 m/s, y 0–6 MW.
 *   grey      steady electrical power from the schedule (0 below cut-in and above cut-out)
 *   violet    Betz max η · 16/27 · ½ρAV³ (dashed, clipped at 6 MW)
 *   cyan      power in the wind ½ρAV³, leaving the top early: what is never taken
 *   bands     wait (< 3) · catch (3–V_rated) · spill (V_rated–25) · hide (> 25)
 *   dot       the live (dynamic, not steady) operating point, with a 6 s fading trail
 */
import { BETZ, ETA, V_CUT_IN, V_CUT_OUT } from '@/config/turbine';
import { fixed, fmtMs, fmtMW } from '@/physics/format';
import { windPowerW } from '@/physics/loads';
import { OPTIMUM, SCHEDULE } from '@/physics/tables';
import { linspace, type Axes } from '@/ui/charts/chartBase';
import { CHART_COLORS as C, type ChartView } from '@/ui/charts/types';

const TRAIL_S = 6;
const X_MAX = 30;
const Y_MAX = 6;

const AXES: Axes = {
  x: { min: 0, max: X_MAX },
  y: { min: 0, max: Y_MAX },
  xTicks: [0, 5, 10, 15, 20, 25, 30],
  yTicks: [0, 2, 4, 6],
  xFormat: (v) => fixed(v, 0),
  yFormat: (v) => fixed(v, 0),
  xTitle: 'wind m/s',
  yTitle: 'MW',
};

function steadyCurve(): { xs: number[]; ys: number[] } {
  const xs = [0, V_CUT_IN];
  const ys = [0, 0];
  for (const row of SCHEDULE) {
    xs.push(row.V);
    ys.push(row.P_MW);
  }
  xs.push(V_CUT_OUT, X_MAX);
  ys.push(0, 0);
  return { xs, ys };
}

export function createPowerCurve(): ChartView {
  const steady = steadyCurve();
  const vs = linspace(0, X_MAX, 151);
  const wind = Array.from(vs, (v) => windPowerW(v) / 1e6);
  const betz = Array.from(vs, (v) => (ETA * BETZ * windPowerW(v)) / 1e6);
  const trail: { t: number; v: number; p: number }[] = [];

  return {
    describe({ s }) {
      return `Power curve: ${fmtMW(s.Pel)} at ${fmtMs(s.V)}`;
    },
    draw(c, { s, nowS }) {
      c.begin(AXES);
      c.band(0, V_CUT_IN, 'rgba(255,255,255,0.015)', 'wait');
      c.band(V_CUT_IN, OPTIMUM.vRated, 'rgba(76,201,255,0.05)', 'catch', C.wind);
      c.band(OPTIMUM.vRated, V_CUT_OUT, 'rgba(255,181,71,0.05)', 'spill', C.power);
      c.band(V_CUT_OUT, X_MAX, 'rgba(255,77,94,0.05)', 'hide', '#ff4d5e');
      c.clipped(() => {
        c.polyline(vs, wind, { color: C.wind, width: 1, alpha: 0.45 });
        c.polyline(vs, betz, { color: C.ideal, width: 1.2, dash: [4, 3] });
        c.polyline(steady.xs, steady.ys, { color: C.steady, width: 1.5 });
      });
      c.label('in the wind', 8.4, 5.1, C.wind, 'right');
      c.label('Betz max', 11.2, 5.1, C.ideal, 'left');

      const P = s.Pel / 1e6;
      const last = trail[trail.length - 1];
      if (!last || last.v !== s.V || last.p !== P) trail.push({ t: nowS, v: s.V, p: P });
      while (trail.length && (trail[0] as { t: number }).t < nowS - TRAIL_S) trail.shift();
      c.clipped(() => {
        for (const pt of trail) {
          const age = (nowS - pt.t) / TRAIL_S;
          c.dot(Math.min(pt.v, X_MAX), Math.min(pt.p, Y_MAX), C.power, 1.6, 0.5 * (1 - age));
        }
        c.ring(Math.min(s.V, X_MAX), Math.min(P, Y_MAX), 6, C.power, 0.35);
        c.dot(Math.min(s.V, X_MAX), Math.min(P, Y_MAX), C.power, 3.5);
      });
    },
  };
}
