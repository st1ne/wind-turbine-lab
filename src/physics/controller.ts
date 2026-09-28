/**
 * NREL baseline controller, simplified (TECH_SPEC §6.7). Port of the controller block of
 * reference/wind_model_reference.py.
 *
 * Torque on the HSS, ω_g = Nω:
 *   region 3   (β ≥ 1° or ω_g ≥ VS_RT):  Q = P_rated / (η ω_g)
 *   region 2.5 (ω_g ≥ VS_TR):            Q = SLOPE25 (ω_g − VS_SY)
 *   region 2:                             Q = K_HSS ω_g²
 * Pitch: gain-scheduled PI on e = ω_g − ω_g,rated, GK(β) = 1 / (1 + β/6.302336°), anti-windup.
 * Optional feed-forward (app only): β_cmd = β_sched(V_meas) + PI, where the PI integral may go
 * negative just far enough to cancel the feed-forward. The reference PI alone cannot follow a
 * 2 m/s² preset ramp or TI 0.12 gusts above ≈ 18 m/s without a 115 % overspeed trip; modern
 * turbines add wind-speed feed-forward for the same reason.
 *
 * Source: Jonkman et al. 2009, NREL/TP-500-38060 §7.
 */
import { PITCH_GAIN_KNEE_DEG, PITCH_KI, PITCH_KP, PITCH_RATE_DEG_S } from '@/config/controller';
import { ETA, GEAR_RATIO, OMEGA_GEN_RATED_RAD, P_RATED_W } from '@/config/turbine';
import { OPTIMUM } from '@/physics/tables';
import type { SupervisorState } from '@/physics/types';

const RAD = Math.PI / 180;

/** generator-side optimal-gain constant, N·m/(rad/s)² */
export const K_HSS = OPTIMUM.kOpt / GEAR_RATIO ** 3;
/** torque-controller rated speed, rad/s */
export const VS_RT = 0.99 * OMEGA_GEN_RATED_RAD;
/** synchronous speed of the region 2.5 line (10 % slip), rad/s */
export const VS_SY = VS_RT / 1.1;
export const SLOPE25 = P_RATED_W / ETA / VS_RT / (VS_RT - VS_SY);
/** region 2 → 2.5 transition speed: lower root of K ω² = SLOPE25 (ω − VS_SY), rad/s */
export const VS_TR =
  (SLOPE25 - Math.sqrt(SLOPE25 ** 2 - 4 * K_HSS * SLOPE25 * VS_SY)) / (2 * K_HSS);

export type TorqueRegion = 'off' | 'r2' | 'r25' | 'r3';

export function torqueRegion(
  omegaGenRad: number,
  pitchDeg: number,
  state: SupervisorState,
  calm: boolean,
): TorqueRegion {
  if (state !== 'RUN' || calm || !(omegaGenRad > 0.01)) return 'off';
  if (pitchDeg >= 1.0 || omegaGenRad >= VS_RT) return 'r3';
  if (omegaGenRad >= VS_TR) return 'r25';
  return 'r2';
}

/** Generator torque on the HSS, N·m. Zero outside RUN and in CALM. */
export function generatorTorque(
  omegaGenRad: number,
  pitchDeg: number,
  state: SupervisorState,
  calm = false,
): number {
  switch (torqueRegion(omegaGenRad, pitchDeg, state, calm)) {
    case 'r3':
      return P_RATED_W / ETA / omegaGenRad;
    case 'r25':
      return SLOPE25 * (omegaGenRad - VS_SY);
    case 'r2':
      return K_HSS * omegaGenRad * omegaGenRad;
    default:
      return 0;
  }
}

export interface PitchPi {
  integral: number;
}

function gainSchedule(pitchDeg: number): number {
  return 1.0 / (1.0 + pitchDeg / PITCH_GAIN_KNEE_DEG);
}

/** Integral state that reproduces pitchDeg at zero speed error (bumpless start). */
export function pitchIntegralFor(pitchDeg: number): number {
  return (pitchDeg * RAD) / (PITCH_KI * gainSchedule(pitchDeg));
}

/** Integral state that makes ff + PI reproduce pitchDeg at zero speed error. */
export function pitchIntegralForFF(pitchDeg: number, ffDeg: number): number {
  return ((pitchDeg - ffDeg) * RAD) / (PITCH_KI * gainSchedule(pitchDeg));
}

/** PI pitch command in deg; updates the integral with anti-windup. */
export function pitchCommand(
  pi: PitchPi,
  omegaGenRad: number,
  pitchDeg: number,
  dt: number,
): number {
  const gk = gainSchedule(pitchDeg);
  const err = omegaGenRad - OMEGA_GEN_RATED_RAD;
  pi.integral = Math.min(Math.max(pi.integral + err * dt, 0.0), (90 * RAD) / (PITCH_KI * gk));
  const cmd = (gk * (PITCH_KP * err + PITCH_KI * pi.integral)) / RAD;
  return Math.min(Math.max(cmd, 0.0), 90.0);
}

/**
 * PI pitch command plus a feed-forward angle, in deg. The integral is bounded so the PI term
 * spans [−ff, 90°]: in region 2 (ff = 0) this is the reference anti-windup.
 */
export function pitchCommandFF(
  pi: PitchPi,
  omegaGenRad: number,
  pitchDeg: number,
  ffDeg: number,
  dt: number,
): number {
  const gk = gainSchedule(pitchDeg);
  const err = omegaGenRad - OMEGA_GEN_RATED_RAD;
  const lo = -(ffDeg * RAD) / (PITCH_KI * gk);
  const hi = (90 * RAD) / (PITCH_KI * gk);
  pi.integral = Math.min(Math.max(pi.integral + err * dt, lo), hi);
  const cmd = ffDeg + (gk * (PITCH_KP * err + PITCH_KI * pi.integral)) / RAD;
  return Math.min(Math.max(cmd, 0.0), 90.0);
}

/** Move pitch toward the command at the state's rate limit. */
export function rateLimitPitch(
  pitchDeg: number,
  cmdDeg: number,
  state: SupervisorState,
  dt: number,
): number {
  const rate = PITCH_RATE_DEG_S[state];
  return pitchDeg + Math.max(-rate * dt, Math.min(rate * dt, cmdDeg - pitchDeg));
}
