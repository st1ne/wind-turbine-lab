/**
 * Shared physics types (TECH_SPEC §6, §14.3).
 * SI units internally; units appear in names where ambiguous.
 */

export type AirfoilFamily = 'CYL1' | 'CYL2' | 'DU40' | 'DU35' | 'DU30' | 'DU25' | 'DU21' | 'NACA64';

/** Supervisor states (§6.9). TRIPPED is latched until reset. */
export type SupervisorState = 'RUN' | 'SHUTDOWN' | 'PARKED' | 'STARTUP' | 'TRIP' | 'TRIPPED';

/** Regime label that picks the explanation template (§3.5, §6.9). */
export type Regime =
  | 'CALM'
  | 'CHASE'
  | 'CAP'
  | 'SPILL'
  | 'SHUTDOWN'
  | 'PARKED'
  | 'STARTUP'
  | 'TRIP'
  | 'BETZ';

/** Immutable per-frame view of the simulation (§14.3). */
export interface SimSnapshot {
  /** sim time, s */
  readonly t: number;
  /** instantaneous wind speed incl. gusts, m/s */
  readonly V: number;
  /** mean wind after the ramp limiter, m/s */
  readonly Vmean: number;
  /** rotor speed, rad/s */
  readonly omega: number;
  /** rotor azimuth, rad */
  readonly psi: number;
  /** collective pitch, deg */
  readonly beta: number;
  /** commanded pitch, deg */
  readonly betaCmd: number;
  /** aerodynamic torque on the rotor shaft, N·m */
  readonly Qaero: number;
  /** generator torque on the HSS, N·m */
  readonly Qgen: number;
  /** electrical power, W */
  readonly Pel: number;
  /** rotor thrust, N */
  readonly T: number;
  readonly cp: number;
  readonly ct: number;
  /** tip-speed ratio */
  readonly lambda: number;
  /** disk-averaged axial induction */
  readonly a: number;
  readonly state: SupervisorState;
  readonly regime: Regime;
  readonly brakeOn: boolean;
  /** brake heat energy, J (decays with τ = 20 s) */
  readonly brakeHeat: number;
  /** smoothstep(18, 28, Vmean) */
  readonly stormLevel: number;
}

/** Inputs the sim reads every step. */
export interface SimInputs {
  /** slider target for the mean wind, m/s */
  windTarget: number;
  gusts: boolean;
  /** null = auto pitch; number = locked angle in deg */
  pitchLockDeg: number | null;
  /** ideal-disk mode flag (affects regime only) */
  idealDisk: boolean;
}
