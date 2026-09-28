/**
 * Precomputes the Cp/Ct tables (TECH_SPEC §6.4) plus the optimum and steady schedule (§7.1–7.2)
 * into src/physics/tables.generated.json.
 * Grid: λ 0–20 step 0.25 (81), β −2…90° step 1 (93), V = 10 m/s; λ = 0 is evaluated at 0.01,
 * exactly like reference/wind_model_reference.py.
 * Then diffs the grid against reference/tables.json (max abs error must be < 0.002).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { RADIUS_M } from '../src/config/turbine';
import { rotor } from '../src/physics/bem';
import { computeOptimum, computeSchedule } from '../src/physics/schedule';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const round5 = (x: number): number => Math.round(x * 1e5) / 1e5;

const LAMBDA = Array.from({ length: 81 }, (_, i) => Math.round(0.25 * i * 100) / 100);
const BETA = Array.from({ length: 93 }, (_, j) => j - 2);

const t0 = performance.now();
const cp: number[][] = [];
const ct: number[][] = [];
for (const l of LAMBDA) {
  const cpRow: number[] = [];
  const ctRow: number[] = [];
  for (const b of BETA) {
    const r = rotor(10.0, (Math.max(l, 0.01) * 10.0) / RADIUS_M, b);
    cpRow.push(round5(r.cp));
    ctRow.push(round5(r.ct));
  }
  cp.push(cpRow);
  ct.push(ctRow);
}
const optimum = computeOptimum();
const schedule = computeSchedule(optimum);

const out = join(root, 'src/physics/tables.generated.json');
writeFileSync(out, JSON.stringify({ lambda: LAMBDA, beta: BETA, cp, ct, optimum, schedule }));
console.log(`wrote ${out} in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
console.log(
  `Cp_max ${optimum.cpMax.toFixed(4)} at TSR ${optimum.lambdaOpt.toFixed(2)}, V_rated ${optimum.vRated.toFixed(2)} m/s`,
);

// ---- diff against the Python reference
const ref = JSON.parse(readFileSync(join(root, 'reference/tables.json'), 'utf8')) as {
  cp: number[][];
  ct: number[][];
};
let maxErr = 0;
let where = '';
for (const [name, mine, theirs] of [
  ['cp', cp, ref.cp],
  ['ct', ct, ref.ct],
] as const) {
  mine.forEach((row, i) =>
    row.forEach((v, j) => {
      const e = Math.abs(v - (theirs[i]?.[j] ?? NaN));
      if (!(e <= maxErr)) {
        maxErr = e;
        where = `${name}[λ=${LAMBDA[i]}, β=${BETA[j]}]`;
      }
    }),
  );
}
console.log(`diff vs reference/tables.json: max abs error ${maxErr.toExponential(2)} at ${where}`);
if (!(maxErr < 0.002)) {
  console.error('FAIL: tables differ from the reference by ≥ 0.002');
  process.exit(1);
}
