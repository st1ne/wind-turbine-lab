/**
 * Simulation (TECH_SPEC §6.6–6.11). The per-step order is a line-by-line port of simulate() in
 * reference/wind_model_reference.py:
 *
 *   1. wind (ramped mean + gusts)       5. generator torque
 *   2. Cp/Ct lookup → Q_aero, T          6. pitch command + rate limit
 *   3. supervisor transitions            7. brake, SHUTDOWN → PARKED
 *   4. (STARTUP → RUN resets the PI)     8. J dω/dt, azimuth, brake heat
 *
 * Fixed step dt = 1/120 s; step() accumulates real time × time scale with ≤ 40 sub-steps.
 * initSteady(V) starts at the steady operating point so the rotor never overshoots on load.
 */
import { MAX_SUBSTEPS, PITCH_FF_TAU_S, SIM_DT_S } from '@/config/controller';
import {
  CUT_OUT_HOLD_S,
  ETA,
  GEAR_RATIO,
  RADIUS_M,
  RESTART_HOLD_S,
  V_CUT_IN,
  V_CUT_OUT,
} from '@/config/turbine';
import { inductionFromCt } from '@/physics/actuatorDisk';
import {
  generatorTorque,
  pitchCommand,
  pitchCommandFF,
  pitchIntegralFor,
  pitchIntegralForFF,
  rateLimitPitch,
  type PitchPi,
} from '@/physics/controller';
import { stepAzimuth, stepDrivetrain } from '@/physics/drivetrain';
import { dynamicForceN, windPowerW } from '@/physics/loads';
import { regimeOf } from '@/physics/regime';
import {
  brakeTorque,
  createSupervisor,
  stepBrakeHeat,
  type Supervisor,
} from '@/physics/supervisor';
import { cpAt, ctAt, OPTIMUM, scheduleAt } from '@/physics/tables';
import type { SimInputs, SimSnapshot, SupervisorState } from '@/physics/types';
import { createGusts, gustyWind, rampMeanWind } from '@/physics/wind';
import { smoothstep } from '@/util/math';

const RPM = Math.PI / 30;

export interface SimOptions {
  /** apply the 3 s cut-out / 10 s restart holds (false = reference behaviour) */
  holds: boolean;
  /** ramp-limit the mean wind (false = mean wind follows the target instantly) */
  windRamp: boolean;
  /** gust phase seed */
  seed: number;
  /** add the scheduled pitch for the measured wind to the PI (false = reference controller) */
  pitchFeedForward: boolean;
}

/** Options that reproduce reference/wind_model_reference.py exactly (tests, §7.5). */
export const REFERENCE_SIM: Partial<SimOptions> = {
  holds: false,
  windRamp: false,
  pitchFeedForward: false,
};

export interface Sim {
  /** Advance by dtSim seconds of sim time in fixed steps (≤ 40 per call; backlog dropped). */
  step(dtSim: number, inputs: SimInputs): void;
  /** Advance exactly one step of length dt. */
  advance(dt: number, inputs: SimInputs): void;
  snapshot(): SimSnapshot;
  /** Jump to the steady operating point at wind V (on load, tour jumps, URL restore). */
  initSteady(V: number): void;
  /** Reset after a trip (the UI's Reset pill). */
  resetTrip(): void;
}

/** Scheduled steady pitch for a measured wind (0 below cut-in). */
function feedForwardPitch(V: number): number {
  return V < V_CUT_IN ? 0 : scheduleAt(V).pitch;
}

/** Target rotor speed at V from the schedule; below cut-in, the optimal-TSR speed. */
function targetOmega(V: number): number {
  if (V < V_CUT_IN) return (OPTIMUM.lambdaOpt * Math.max(V, 0)) / RADIUS_M;
  return scheduleAt(V).rpm * RPM;
}

export function createSim(options: Partial<SimOptions> = {}): Sim {
  const opts: SimOptions = {
    holds: true,
    windRamp: true,
    seed: 1,
    pitchFeedForward: true,
    ...options,
  };
  const sup: Supervisor = createSupervisor(
    opts.holds
      ? { cutOutHoldS: CUT_OUT_HOLD_S, restartHoldS: RESTART_HOLD_S }
      : { cutOutHoldS: 0, restartHoldS: 0 },
  );
  const gusts = createGusts(opts.seed);
  const pi: PitchPi = { integral: 0 };

  let t = 0;
  let accumulator = 0;
  let Vmean = 8;
  let V = 8;
  let omega = 0;
  let psi = 0;
  let beta = 0;
  let betaCmd = 0;
  let brakeHeat = 0;
  let idealDisk = false;
  // per-step outputs kept for the snapshot
  let qAero = 0;
  let qGen = 0;
  let pEl = 0;
  let thrust = 0;
  let cp = 0;
  let ct = 0;
  let lambda = 0;
  let brakeOn = false;
  /** low-passed measured wind for the pitch feed-forward, m/s */
  let Vmeas = 8;

  /** PI integral that reproduces the current pitch at zero speed error (bumpless). */
  function bumplessIntegral(): number {
    if (!opts.pitchFeedForward) return pitchIntegralFor(beta);
    // the PI only supplies what the feed-forward doesn't
    return pitchIntegralForFF(beta, feedForwardPitch(Vmeas));
  }

  function advance(dt: number, inputs: SimInputs): void {
    idealDisk = inputs.idealDisk;
    Vmean = opts.windRamp ? rampMeanWind(Vmean, inputs.windTarget, dt) : inputs.windTarget;
    V = inputs.gusts ? gustyWind(Vmean, gusts.n(t)) : Math.max(Vmean, 0);

    lambda = (omega * RADIUS_M) / Math.max(V, 0.1);
    cp = cpAt(lambda, beta);
    ct = ctAt(lambda, beta);
    qAero = (cp * windPowerW(V)) / Math.max(omega, 1e-3);
    thrust = ct * dynamicForceN(V);
    const wg = omega * GEAR_RATIO;

    // supervisory logic; the holds use the mean wind so gusts don't flicker the state
    if (sup.preStep(Vmean, omega, targetOmega(Vmean), dt)) pi.integral = bumplessIntegral();
    const state = sup.state;

    qGen = generatorTorque(wg, beta, state, V < V_CUT_IN);

    Vmeas += (V - Vmeas) * Math.min(dt / PITCH_FF_TAU_S, 1);
    if (state === 'RUN' && inputs.pitchLockDeg === null && opts.pitchFeedForward) {
      betaCmd = pitchCommandFF(pi, wg, beta, feedForwardPitch(Vmeas), dt);
    } else if (state === 'RUN' && inputs.pitchLockDeg === null) {
      betaCmd = pitchCommand(pi, wg, beta, dt);
    } else if (state === 'RUN') {
      betaCmd = inputs.pitchLockDeg ?? 0;
    } else if (state === 'STARTUP') {
      betaCmd = scheduleAt(Vmean).pitch;
    } else {
      betaCmd = 90;
    }
    beta = rateLimitPitch(beta, betaCmd, state, dt);

    brakeOn = sup.brakeOn(omega);
    sup.postStep(omega);
    const qBrake = brakeTorque(brakeOn, omega);
    pEl = ETA * qGen * wg;
    brakeHeat = stepBrakeHeat(brakeHeat, qBrake, omega, dt);
    omega = stepDrivetrain(omega, qAero, qGen, qBrake, dt);
    psi = stepAzimuth(psi, omega, dt);
    t += dt;
  }

  function initSteady(Vinit: number): void {
    const v = Math.max(Vinit, 0);
    Vmean = v;
    V = v;
    Vmeas = v;
    brakeHeat = 0;
    accumulator = 0;
    let state: SupervisorState;
    if (v >= V_CUT_OUT) {
      state = 'PARKED';
      omega = 0;
      beta = 90;
    } else {
      state = 'RUN';
      omega = targetOmega(v);
      beta = v < V_CUT_IN ? 0 : scheduleAt(v).pitch;
    }
    betaCmd = beta;
    sup.force(state);
    pi.integral = bumplessIntegral();
    // fill the snapshot outputs without advancing time
    lambda = (omega * RADIUS_M) / Math.max(V, 0.1);
    cp = cpAt(lambda, beta);
    ct = ctAt(lambda, beta);
    qAero = (cp * windPowerW(V)) / Math.max(omega, 1e-3);
    thrust = ct * dynamicForceN(V);
    const wg = omega * GEAR_RATIO;
    qGen = generatorTorque(wg, beta, state, V < V_CUT_IN);
    pEl = ETA * qGen * wg;
    brakeOn = sup.brakeOn(omega);
  }

  initSteady(8);

  return {
    advance,
    initSteady,
    step(dtSim, inputs) {
      // the regime flag follows the UI even while paused (dtSim = 0)
      idealDisk = inputs.idealDisk;
      if (!(dtSim > 0)) return;
      accumulator += dtSim;
      let n = 0;
      while (accumulator >= SIM_DT_S && n < MAX_SUBSTEPS) {
        advance(SIM_DT_S, inputs);
        accumulator -= SIM_DT_S;
        n++;
      }
      if (n === MAX_SUBSTEPS) accumulator = Math.min(accumulator, SIM_DT_S);
    },
    resetTrip() {
      sup.reset(Vmean);
    },
    snapshot(): SimSnapshot {
      const state = sup.state;
      return {
        t,
        V,
        Vmean,
        omega,
        psi,
        beta,
        betaCmd,
        Qaero: qAero,
        Qgen: qGen,
        Pel: pEl,
        T: thrust,
        cp,
        ct,
        lambda,
        a: inductionFromCt(ct),
        state,
        regime: regimeOf(state, V, omega * GEAR_RATIO, beta, idealDisk),
        brakeOn,
        brakeHeat,
        stormLevel: smoothstep(18, 28, Vmean),
      };
    },
  };
}
