/**
 * Supervisory state machine (TECH_SPEC §6.9). Port of the supervisory logic in
 * reference/wind_model_reference.py simulate(), plus the app's holds:
 *
 *   RUN ──V ≥ 25 held 3 s──▶ SHUTDOWN ──ω < 0.01──▶ PARKED ──V < 20 held 10 s──▶ STARTUP
 *   RUN ──ω > 1.15 ω_rated──▶ TRIP ──ω < 0.01──▶ TRIPPED (latched until reset)
 *   STARTUP ──ω ≥ 0.9 ω_target──▶ RUN
 *
 * The real cut-out uses a 10-minute mean; the demo uses short holds (help explains this).
 * ω_target is the scheduled speed at V (= ω_rated above ≈ 10.4 m/s, as in the reference test);
 * this lets the rotor reconnect after a storm that dies down to a light breeze.
 */
import {
  BRAKE_ENGAGE,
  BRAKE_HEAT_TAU_S,
  BRAKE_TORQUE_NM,
  CUT_OUT_HOLD_S,
  OMEGA_RATED_RAD,
  RESTART_HOLD_S,
  STARTUP_CONNECT,
  TRIP_OVERSPEED,
  V_CUT_OUT,
  V_RESTART,
} from '@/config/turbine';
import type { SupervisorState } from '@/physics/types';

export interface SupervisorOptions {
  cutOutHoldS: number;
  restartHoldS: number;
}

export interface Supervisor {
  readonly state: SupervisorState;
  /**
   * Transitions evaluated before the controllers run. Returns true when the generator
   * has just connected (STARTUP → RUN), so the caller can reset the pitch integral.
   */
  preStep(V: number, omegaRad: number, omegaTargetRad: number, dt: number): boolean;
  /** SHUTDOWN → PARKED once the rotor has stopped (evaluated after the pitch update). */
  postStep(omegaRad: number): void;
  brakeOn(omegaRad: number): boolean;
  /** Reset after a trip. Returns the new state. */
  reset(V: number): SupervisorState;
  /** Force a state (steady init). Clears hold timers. */
  force(state: SupervisorState): void;
}

export function createSupervisor(
  opts: SupervisorOptions = { cutOutHoldS: CUT_OUT_HOLD_S, restartHoldS: RESTART_HOLD_S },
): Supervisor {
  let state: SupervisorState = 'RUN';
  let cutOutTimer = 0;
  let restartTimer = 0;

  return {
    get state() {
      return state;
    },
    preStep(V, om, omTarget, dt) {
      if (state === 'TRIP' && om < 0.01) state = 'TRIPPED';

      cutOutTimer = state === 'RUN' && V >= V_CUT_OUT ? cutOutTimer + dt : 0;
      if (state === 'RUN' && cutOutTimer > 0 && cutOutTimer >= opts.cutOutHoldS) {
        state = 'SHUTDOWN';
        cutOutTimer = 0;
      }
      if (state === 'RUN' && om > TRIP_OVERSPEED * OMEGA_RATED_RAD) state = 'TRIP';

      const parked = state === 'SHUTDOWN' || state === 'PARKED';
      restartTimer = parked && V < V_RESTART ? restartTimer + dt : 0;
      if (parked && restartTimer > 0 && restartTimer >= opts.restartHoldS) {
        state = 'STARTUP';
        restartTimer = 0;
      }
      if (state === 'STARTUP' && om >= STARTUP_CONNECT * Math.min(omTarget, OMEGA_RATED_RAD)) {
        state = 'RUN';
        return true;
      }
      return false;
    },
    postStep(om) {
      if (state === 'SHUTDOWN' && om < 0.01) state = 'PARKED';
    },
    brakeOn(om) {
      return (
        state === 'TRIP' ||
        state === 'TRIPPED' ||
        ((state === 'SHUTDOWN' || state === 'PARKED') && om < BRAKE_ENGAGE * OMEGA_RATED_RAD)
      );
    },
    reset(V) {
      if (state === 'TRIP' || state === 'TRIPPED') state = V < V_CUT_OUT ? 'STARTUP' : 'PARKED';
      cutOutTimer = 0;
      restartTimer = 0;
      return state;
    },
    force(s) {
      state = s;
      cutOutTimer = 0;
      restartTimer = 0;
    },
  };
}

/** Brake torque on the rotor shaft for the current state, N·m. */
export function brakeTorque(on: boolean, omegaRad: number): number {
  return on && omegaRad > 0 ? BRAKE_TORQUE_NM : 0;
}

/** Brake heat: E += Q_brake·ω·dt, decaying with τ = 20 s. */
export function stepBrakeHeat(heatJ: number, qBrakeNm: number, omegaRad: number, dt: number): number {
  return heatJ * Math.exp(-dt / BRAKE_HEAT_TAU_S) + qBrakeNm * omegaRad * dt;
}
