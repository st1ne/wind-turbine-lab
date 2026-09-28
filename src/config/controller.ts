/**
 * Controller gains and limits (TECH_SPEC §6.7).
 * Source: NREL 5 MW baseline controller (Jonkman et al. 2009, §7), simplified.
 */
import type { SupervisorState } from '@/physics/types';

/** PI proportional gain at 0° pitch, s */
export const PITCH_KP = 0.01882681;
/** PI integral gain at 0° pitch */
export const PITCH_KI = 0.008068634;
/** gain-schedule knee, deg: GK(β) = 1 / (1 + β / knee) */
export const PITCH_GAIN_KNEE_DEG = 6.302336;

/** pitch rate limits per supervisor state, deg/s */
export const PITCH_RATE_DEG_S: Record<SupervisorState, number> = {
  RUN: 8,
  TRIP: 8,
  TRIPPED: 8,
  SHUTDOWN: 4,
  PARKED: 4,
  STARTUP: 2,
};

/**
 * Pitch feed-forward (app only, not in the reference): the scheduled pitch for the measured
 * wind, low-passed with this time constant (anemometer / wind-speed estimator), s.
 */
export const PITCH_FF_TAU_S = 1;

/** fixed simulation step, s (§6.11) */
export const SIM_DT_S = 1 / 120;
export const MAX_SUBSTEPS = 40;
/** mean-wind ramp limit, m/s per sim second (§6.10) */
export const WIND_RAMP_M_S2 = 2;
/** gust turbulence intensity */
export const GUST_TI = 0.12;
export const GUST_PERIODS_S = [3.1, 7.3, 13.1, 29.7] as const;
