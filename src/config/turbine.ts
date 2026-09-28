/**
 * Turbine constants (TECH_SPEC §5.1, §6.1). Full-scale SI units.
 * Source: Jonkman et al. 2009, NREL/TP-500-38060 (NREL 5 MW reference turbine).
 */

const RPM_TO_RAD = Math.PI / 30;

export const RHO_KG_M3 = 1.225;
export const RADIUS_M = 63.0;
export const HUB_RADIUS_M = 1.5;
export const BLADES = 3;
export const SWEPT_AREA_M2 = Math.PI * RADIUS_M * RADIUS_M;
/** generator + converter efficiency */
export const ETA = 0.944;
export const P_RATED_W = 5.0e6;
export const GEAR_RATIO = 97.0;
export const OMEGA_RATED_RAD = 12.1 * RPM_TO_RAD;
export const OMEGA_GEN_RATED_RAD = OMEGA_RATED_RAD * GEAR_RATIO;
/** drivetrain inertia referred to the rotor shaft, kg·m² */
export const INERTIA_KG_M2 = 43.784e6;
export const V_CUT_IN = 3.0;
export const V_CUT_OUT = 25.0;
export const V_RESTART = 20.0;
export const BETZ = 16 / 27;

/** Supervisor holds used by the app (§6.9). The reference sim uses 0 s for both. */
export const CUT_OUT_HOLD_S = 3;
export const RESTART_HOLD_S = 10;
/** overspeed trip threshold as a fraction of rated rotor speed */
export const TRIP_OVERSPEED = 1.15;
/** STARTUP → RUN when ω reaches this fraction of the target speed */
export const STARTUP_CONNECT = 0.9;
/** brake engages in SHUTDOWN/PARKED below this fraction of rated speed */
export const BRAKE_ENGAGE = 0.3;
/** HSS brake torque referred to the rotor shaft, N·m */
export const BRAKE_TORQUE_NM = 28116.2 * GEAR_RATIO;
/** brake heat decay time constant, s */
export const BRAKE_HEAT_TAU_S = 20;

// ---- loads (§6.8)
export const TOWER_HEIGHT_M = 87.6;
export const HUB_HEIGHT_M = 90.0;
/** effective tower bending stiffness, N·m² */
export const TOWER_EI_NM2 = 3.6e11;
/** blade tip flap deflection at rated thrust, m */
export const BLADE_TIP_DEFLECTION_RATED_M = 5.4;
export const THRUST_RATED_N = 725e3;
/** average EU household consumption, W (≈ 3.5 MWh/yr) */
export const HOME_POWER_W = 400;
/** free-spin tip-speed ratio at β = 0 (Cp = 0 root) */
export const RUNAWAY_TSR = 16.7;
export const SPEED_OF_SOUND_M_S = 343;
/** generator / converter output voltage (§3.7 label), V */
export const CONVERTER_VOLTAGE_V = 690;
export const G_M_S2 = 9.81;

// ---- geometry (§5.1), used by the scene
export const TOWER_BASE_DIAMETER_M = 6.0;
export const TOWER_TOP_DIAMETER_M = 3.87;
export const SHAFT_TILT_DEG = 5;
export const PRECONE_DEG = 2.5;
export const OVERHANG_M = 5.0;
export const BLADE_LENGTH_M = 61.5;
export const NACELLE_SIZE_M = { length: 18, width: 6, height: 6 } as const;
export const MASSES_T = { rotor: 110, nacelle: 240, tower: 347 } as const;

export const MODEL_SCALE = 1 / 200;
