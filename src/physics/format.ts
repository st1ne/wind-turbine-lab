/**
 * Display formatting (TECH_SPEC §18): the only place SI values become display units.
 * Fixed decimals so tabular digits never re-layout; no "-0.0".
 */

const RPM = 30 / Math.PI;

/** Fixed-decimal number with a real minus sign and no negative zero. */
export function fixed(x: number, decimals: number): string {
  if (!Number.isFinite(x)) return '—';
  const s = x.toFixed(decimals);
  if (/^-0\.?0*$/.test(s)) return s.slice(1);
  return s.replace('-', '−');
}

/** Thousands separator for integers: 12,500. */
export function grouped(x: number): string {
  if (!Number.isFinite(x)) return '—';
  return Math.round(x).toLocaleString('en-US').replace('-', '−');
}

export function fmtMW(powerW: number, decimals = 2): string {
  return `${fixed(powerW / 1e6, decimals)} MW`;
}

export function fmtKW(powerW: number): string {
  return `${grouped(powerW / 1e3)} kW`;
}

export function fmtKN(thrustN: number): string {
  return `${grouped(thrustN / 1e3)} kN`;
}

export function fmtMNm(torqueNm: number, decimals = 2): string {
  return `${fixed(torqueNm / 1e6, decimals)} MN·m`;
}

export function fmtRpm(omegaRad: number, decimals = 1): string {
  return `${fixed(omegaRad * RPM, decimals)} rpm`;
}

export function fmtDeg(deg: number, decimals = 1): string {
  return `${fixed(deg, decimals)}°`;
}

export function fmtMs(V: number, decimals = 1): string {
  return `${fixed(V, decimals)} m/s`;
}

export function fmtPct(fraction: number, decimals = 0): string {
  return `${fixed(fraction * 100, decimals)} %`;
}

export function fmtM(m: number, decimals = 2): string {
  return `${fixed(m, decimals)} m`;
}
