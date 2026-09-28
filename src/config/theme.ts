/**
 * Theme colors for three.js, mirroring the CSS tokens in src/ui/styles.css (TECH_SPEC §3.2, §4).
 */
export const THEME = {
  bg: '#0a0e1a',
  wind: '#4cc9ff',
  power: '#ffb547',
  ideal: '#a78bfa',
  loads: '#ff7a59',
  alarm: '#ff4d5e',
  ok: '#5be49b',
  text: '#e8ecf5',
  textMuted: '#8b93a7',
} as const;

/** Scene palette (§4.2–4.3). */
export const PALETTE = {
  keyLight: '#ffd9a8',
  fillSky: '#6f8cff',
  fillGround: '#1a1410',
  rimLight: '#4cc9ff',
  turbine: '#e9edf2',
  tipBand: '#d8332f',
  steel: '#8d96a3',
  brass: '#c9a45c',
  grassA: '#4c9a5a',
  grassB: '#3b7d48',
  rock: '#9aa0a6',
  soil: '#6b5842',
  bark: '#5a4331',
  concrete: '#a7abb1',
  benchTop: '#2a2f3a',
  benchEdge: '#3a4150',
  benchLeg: '#1b1f28',
  room: '#10131c',
  roomFloor: '#0c0e15',
  lightStrip: '#cfe4ff',
  fanShroud: '#2b313d',
  fanBlade: '#aab3c0',
  ledBg: '#140c02',
} as const;
