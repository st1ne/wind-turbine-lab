/**
 * Runtime Cp/Ct lookup (TECH_SPEC §6.4): bilinear over the build-time grid, clamped.
 * Port of lookup() in reference/wind_model_reference.py. Also exposes the precomputed
 * optimum (§7.1) and steady schedule (§7.2) with sched_at() interpolation.
 */
import data from '@/physics/tables.generated.json';
import type { Optimum, ScheduleRow } from '@/physics/schedule';

interface TableData {
  lambda: number[];
  beta: number[];
  cp: number[][];
  ct: number[][];
  optimum: Optimum;
  schedule: ScheduleRow[];
}

const TABLES = data as TableData;
const NL = TABLES.lambda.length;
const NB = TABLES.beta.length;
const LAMBDA_STEP = 0.25;
const BETA_MIN = -2;

/** Flat Float64 copies for fast lookups. */
const CP = Float64Array.from(TABLES.cp.flat());
const CT = Float64Array.from(TABLES.ct.flat());

function lookup(table: Float64Array, lambda: number, pitchDeg: number): number {
  // Non-finite inputs clamp to the grid edge instead of propagating NaN.
  const lx = Number.isFinite(lambda) ? lambda : 0;
  const by = Number.isFinite(pitchDeg) ? pitchDeg : 0;
  const x = Math.min(Math.max(lx / LAMBDA_STEP, 0), NL - 1.001);
  const y = Math.min(Math.max(by - BETA_MIN, 0), NB - 1.001);
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const k = i * NB + j;
  return (
    (table[k] as number) * (1 - fx) * (1 - fy) +
    (table[k + NB] as number) * fx * (1 - fy) +
    (table[k + 1] as number) * (1 - fx) * fy +
    (table[k + NB + 1] as number) * fx * fy
  );
}

export function cpAt(lambda: number, pitchDeg: number): number {
  return lookup(CP, lambda, pitchDeg);
}

export function ctAt(lambda: number, pitchDeg: number): number {
  return lookup(CT, lambda, pitchDeg);
}

export const OPTIMUM: Readonly<Optimum> = TABLES.optimum;
export const SCHEDULE: readonly Readonly<ScheduleRow>[] = TABLES.schedule;

/** Steady rpm and pitch at wind V, linear between schedule rows (reference sched_at). */
export function scheduleAt(V: number): { rpm: number; pitch: number } {
  const pts = SCHEDULE;
  const first = pts[0] as ScheduleRow;
  if (V <= first.V) return { rpm: first.rpm, pitch: first.pitch };
  for (let k = 1; k < pts.length; k++) {
    const p0 = pts[k - 1] as ScheduleRow;
    const p1 = pts[k] as ScheduleRow;
    if (V <= p1.V) {
      const f = (V - p0.V) / (p1.V - p0.V);
      return { rpm: p0.rpm + f * (p1.rpm - p0.rpm), pitch: p0.pitch + f * (p1.pitch - p0.pitch) };
    }
  }
  const last = pts[pts.length - 1] as ScheduleRow;
  return { rpm: last.rpm, pitch: last.pitch };
}
