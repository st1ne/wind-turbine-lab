/**
 * Regime label for the UI templates (TECH_SPEC §6.9, §3.5):
 * CALM (RUN, V < 3) / CHASE (region 2) / CAP (2.5) / SPILL (3) / SHUTDOWN / PARKED / STARTUP /
 * TRIP (incl. TRIPPED) / BETZ (ideal disk mode).
 */
import { V_CUT_IN } from '@/config/turbine';
import { torqueRegion } from '@/physics/controller';
import type { Regime, SupervisorState } from '@/physics/types';

export function regimeOf(
  state: SupervisorState,
  V: number,
  omegaGenRad: number,
  pitchDeg: number,
  idealDisk: boolean,
): Regime {
  if (idealDisk) return 'BETZ';
  switch (state) {
    case 'SHUTDOWN':
    case 'PARKED':
    case 'STARTUP':
      return state;
    case 'TRIP':
    case 'TRIPPED':
      return 'TRIP';
    case 'RUN':
      break;
  }
  if (V < V_CUT_IN) return 'CALM';
  switch (torqueRegion(omegaGenRad, pitchDeg, state, false)) {
    case 'r3':
      return 'SPILL';
    case 'r25':
      return 'CAP';
    default:
      return 'CHASE';
  }
}
