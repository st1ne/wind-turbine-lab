/**
 * Cp vs tip-speed ratio (TECH_SPEC §3.6, tab 2): x 0–14, y 0–0.65. Cp(λ) from the BEM tables
 * at the current pitch (amber) and at 0° (grey), the Betz line 16/27 (violet dashed) and the
 * live (λ, Cp) dot. The amber curve is resampled when the pitch moves by more than 0.05°.
 */
import { BETZ } from '@/config/turbine';
import { fixed, fmtDeg, fmtPct } from '@/physics/format';
import { cpAt } from '@/physics/tables';
import { linspace, type Axes } from '@/ui/charts/chartBase';
import { CHART_COLORS as C, type ChartView } from '@/ui/charts/types';

const X_MAX = 14;
const Y_MAX = 0.65;

export const CP_TSR_AXES: Axes = {
  x: { min: 0, max: X_MAX },
  y: { min: 0, max: Y_MAX },
  xTicks: [0, 2, 4, 6, 8, 10, 12, 14],
  yTicks: [0, 0.2, 0.4, 0.6],
  xFormat: (v) => fixed(v, 0),
  yFormat: (v) => fixed(v, 1),
  xTitle: 'tip-speed ratio λ',
  yTitle: 'Cp',
};

export const LAMBDAS = linspace(0, X_MAX, 141);

/** Cp(λ) at a fixed pitch, sampled on LAMBDAS. */
export function cpCurve(pitchDeg: number): number[] {
  return Array.from(LAMBDAS, (l) => cpAt(l, pitchDeg));
}

export function createCpTsr(): ChartView {
  const flat = cpCurve(0);
  let pitch = Number.NaN;
  let current = flat;
  return {
    describe({ s }) {
      return `Cp ${fmtPct(s.cp, 1)} at tip-speed ratio ${fixed(s.lambda, 1)}, pitch ${fmtDeg(s.beta)}`;
    },
    draw(c, { s }) {
      if (!(Math.abs(s.beta - pitch) <= 0.05)) {
        pitch = s.beta;
        current = cpCurve(pitch);
      }
      c.begin(CP_TSR_AXES);
      c.clipped(() => {
        c.polyline([0, X_MAX], [BETZ, BETZ], { color: C.ideal, width: 1.2, dash: [4, 3] });
        c.polyline(LAMBDAS, flat, { color: C.steady, width: 1.2, alpha: 0.8 });
        c.polyline(LAMBDAS, current, { color: C.power, width: 1.6 });
        const x = Math.min(Math.max(s.lambda, 0), X_MAX);
        const y = Math.min(Math.max(s.cp, 0), Y_MAX);
        c.ring(x, y, 6, C.power, 0.35);
        c.dot(x, y, C.power, 3.5);
      });
      c.label(`Betz ${fixed(BETZ, 3)}`, X_MAX - 0.2, BETZ, C.ideal, 'right');
      c.label(`pitch ${fmtDeg(s.beta)}`, X_MAX - 0.2, 0.08, C.power, 'right');
    },
  };
}
