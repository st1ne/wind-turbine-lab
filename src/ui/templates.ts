/**
 * Regime explanation templates (TECH_SPEC §3.5). Every number comes from src/physics or the
 * turbine config, formatted by physics/format.ts. Key numbers are bold; the first mention of
 * each concept word is colored to match the scene (wind cyan, power amber, Betz violet,
 * thrust coral).
 */
import { PITCH_RATE_DEG_S } from '@/config/controller';
import {
  BETZ,
  OMEGA_RATED_RAD,
  P_RATED_W,
  RADIUS_M,
  STARTUP_CONNECT,
  THRUST_RATED_N,
  V_CUT_IN,
  V_RESTART,
} from '@/config/turbine';
import { A_VISUAL_MAX, BETZ_SWEET_SPOT, cpIdeal } from '@/physics/actuatorDisk';
import { fixed, fmtDeg, fmtKN, fmtKW, fmtMs, fmtMW, fmtPct, fmtRpm } from '@/physics/format';
import {
  lockedFlatThrustN,
  runawayRpm,
  runawayTipMach,
  tipSpeedMs,
  windPowerW,
} from '@/physics/loads';
import type { SimSnapshot } from '@/physics/types';

export interface TemplateContext {
  s: SimSnapshot;
  /** ideal-disk wake speed ratio */
  wakeB: number;
  /** locked pitch angle, or null when the pitch is on auto */
  pitchLockDeg: number | null;
  /** highest rotor speed since the trip began, rad/s (the TRIP text quotes the peak) */
  tripPeakOmegaRad?: number;
}

export { BETZ_SWEET_SPOT };

const CONCEPTS: readonly (readonly [RegExp, string])[] = [
  [/\bwind\b/i, 'c-wind'],
  [/\bpower\b/i, 'c-power'],
  [/\bBetz\b/, 'c-ideal'],
  [/\bthrust\b/i, 'c-loads'],
];

const b = (value: string): string => `<b>${value}</b>`;

/**
 * Tagged template: interpolations are trusted HTML (bold numbers); static text gets the
 * concept coloring, once per concept per paragraph.
 */
function paragraph(strings: TemplateStringsArray, ...values: string[]): string {
  const used = new Set<string>();
  let out = '';
  strings.forEach((raw, i) => {
    let text = raw;
    for (const [re, cls] of CONCEPTS) {
      if (used.has(cls)) continue;
      const m = re.exec(text);
      if (!m) continue;
      used.add(cls);
      text = `${text.slice(0, m.index)}<span class="${cls}">${m[0]}</span>${text.slice(m.index + m[0].length)}`;
    }
    out += text + (values[i] ?? '');
  });
  return out;
}

const mw1 = (w: number): string => fmtMW(w, w < 10e6 ? 2 : 1);

/** "Thrust drops from 725 kN at rated to …", or "stays at" within ±1 % of rated. */
function thrustVersusRated(thrustN: number): string {
  if (Math.abs(thrustN - THRUST_RATED_N) < 0.01 * THRUST_RATED_N) {
    return paragraph`Thrust stays at its rated ${b(fmtKN(thrustN))}.`;
  }
  const verb = thrustN < THRUST_RATED_N ? 'drops' : 'climbs';
  return paragraph`Thrust ${verb} from ${b(fmtKN(THRUST_RATED_N))} at rated to ${b(fmtKN(thrustN))}.`;
}

function body(ctx: TemplateContext): string {
  const { s } = ctx;
  const pWind = windPowerW(s.V);
  const peak = Math.max(ctx.tripPeakOmegaRad ?? 0, s.omega);
  switch (s.regime) {
    case 'CALM':
      return paragraph`At ${b(fmtMs(s.V))} the wind carries only ${b(fmtKW(pWind))} through the ${fixed(2 * RADIUS_M, 0)} m disk: not enough to beat friction. The rotor idles and waits for ${b(fmtMs(V_CUT_IN, 0))}.`;
    case 'CHASE':
      return paragraph`${b(mw1(pWind))} of wind flows through the disk. The rotor keeps its tips at ${b(`${fixed(s.lambda, 1)}×`)} the wind speed (${fixed(tipSpeedMs(s.omega), 0)} m/s), the ratio where it catches the most: ${b(fmtPct(s.cp, 1))}, or ${fmtPct(s.cp / BETZ)} of the Betz limit. ${b(fmtMW(s.Pel))} of power reaches the grid.`;
    case 'CAP':
      return paragraph`The rotor has hit ${b(fmtRpm(OMEGA_RATED_RAD))}. Tips at ${b(fmtMs(OMEGA_RATED_RAD * RADIUS_M, 0))} are the limit for noise and erosion, so the generator leans on the shaft harder instead. ${b(fmtMW(s.Pel))} of power.`;
    case 'SPILL':
      return paragraph`Too much wind: ${b(mw1(pWind))} arrives, the generator takes only ${b(fmtMW(P_RATED_W))}. The blades twist ${b(fmtDeg(s.beta))} out of the wind and let the rest blow through. ${thrustVersusRated(s.T)}`;
    case 'SHUTDOWN':
      return paragraph`Storm, ${b(fmtMs(s.V))}. The controller feathers the blades toward ${b(fmtDeg(90, 0))}, edge-on, at ${fmtDeg(PITCH_RATE_DEG_S.SHUTDOWN, 0)}/s. Pitch ${b(fmtDeg(s.beta))}, rotor ${b(fmtRpm(s.omega))}. Once it slows, the brake closes.`;
    case 'PARKED':
      return paragraph`Parked and feathered. The blades slice the storm edge-on: rotor thrust is ${b(fmtKN(s.T))}, not the ${b(fmtKN(lockedFlatThrustN(s.V)))} it would be with blades flat to the wind. It restarts below ${b(fmtMs(V_RESTART, 0))}.`;
    case 'STARTUP':
      return paragraph`Wind back under ${fmtMs(V_RESTART, 0)}. Blades pitch in at ${fmtDeg(PITCH_RATE_DEG_S.STARTUP, 0)}/s, the rotor spins up (${b(fmtRpm(s.omega))}), and the generator connects at ${fmtPct(STARTUP_CONNECT)} speed.`;
    case 'TRIP':
      return paragraph`Overspeed! With pitch locked the rotor hit ${b(fmtRpm(peak))} (${b(fmtPct(peak / OMEGA_RATED_RAD))}). Emergency: blades to 90° at ${fmtDeg(PITCH_RATE_DEG_S.TRIP, 0)}/s and brake on. Left alone at ${fmtMs(s.V)} it would try for ${b(`~${fixed(runawayRpm(s.V), 0)} rpm`)}, tips at Mach ${b(fixed(runawayTipMach(s.V), 2))}. Blades fail long before that.`;
    case 'BETZ': {
      const cpb = cpIdeal(ctx.wakeB);
      const text = paragraph`Slow the wind too little and most of it passes unused. Stop it entirely and nothing flows through. At ${b(`b = ${fixed(ctx.wakeB, 2)}`)} the disk takes ${b(fmtPct(cpb, 1))}. The peak, ${b(`16/27 = ${fmtPct(BETZ, 1)}`)}, sits at b = 1/3 (Betz, 1920).`;
      if (Math.abs(ctx.wakeB - 1 / 3) < BETZ_SWEET_SPOT) {
        return `${text} <span class="c-ok">That's the Betz limit: no rotor can do better.</span>`;
      }
      // a = (1 − b)/2 beyond A_VISUAL_MAX: momentum theory no longer holds
      if (ctx.wakeB < 1 - 2 * A_VISUAL_MAX) {
        return `${text} Below <b>b = ${fixed(1 - 2 * A_VISUAL_MAX, 2)}</b> the simple theory breaks down: the air piles up behind the disk and churns (the <span class="c-loads">turbulent wake state</span>).`;
      }
      return text;
    }
  }
}

/** Full explanation HTML for the current state (the explainer diffs the string). */
export function renderTemplate(ctx: TemplateContext): string {
  let html = body(ctx);
  // the lock only holds in RUN; every other state drives the pitch itself
  if (ctx.pitchLockDeg !== null && ctx.s.regime !== 'BETZ' && ctx.s.state === 'RUN') {
    html += ` Pitch is locked at ${b(fmtDeg(ctx.pitchLockDeg))}; the controller can only use generator torque.`;
  }
  return html;
}
