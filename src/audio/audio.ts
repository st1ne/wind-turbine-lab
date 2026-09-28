/**
 * Sound (TECH_SPEC §13): WebAudio synthesis, no files, off by default, and started only from a
 * user gesture (browsers keep an AudioContext suspended until then).
 *
 *   whoosh     band-passed noise, amplitude-modulated at the blade-pass frequency 3ω/2π,
 *              level ∝ (ωR)² (tip speed squared)
 *   hum        sine at 2 · ω_g/2π (two pole pairs, ≈ 39 Hz at rated) plus its 2nd harmonic,
 *              level ∝ P / P_rated
 *   wind       pink noise, low-pass cutoff rising with V
 *   rain       high-passed noise ∝ storm level; thunder: a low noise burst 1–3 s after each
 *              lightning flash
 *   brake      a short resonant squeal when the brake engages
 *   master     volume → limiter (compressor at −6 dB, 20:1) → speakers
 * Parameters glide with setTargetAtTime so nothing clicks.
 */
import { GEAR_RATIO, OMEGA_RATED_RAD, P_RATED_W, RADIUS_M } from '@/config/turbine';
import { bladePassHz, tipSpeedMs } from '@/physics/loads';
import type { SimSnapshot } from '@/physics/types';

const GLIDE_S = 0.08;
const TIP_RATED_M_S = OMEGA_RATED_RAD * RADIUS_M;

// ---- pure mappings (tested)

/** Generator hum fundamental: electrical frequency of a 4-pole machine, 2 · ω_g / 2π, Hz. */
export function humFrequencyHz(omegaRad: number): number {
  return (2 * omegaRad * GEAR_RATIO) / (2 * Math.PI);
}

/** Whoosh level 0–1 ∝ (ωR)², normalised to rated tip speed. */
export function whooshLevel(omegaRad: number): number {
  return Math.min((tipSpeedMs(omegaRad) / TIP_RATED_M_S) ** 2, 1.5);
}

/** Whoosh envelope over one blade passage: a soft pulse per blade (φ = passages, any real). */
export function whooshPulse(passages: number): number {
  return (0.5 + 0.5 * Math.cos(2 * Math.PI * passages)) ** 3;
}

/** Hum level 0–1 ∝ electrical power. */
export function humLevel(powerW: number): number {
  return Math.min(Math.max(powerW / P_RATED_W, 0), 1.1);
}

/** Wind noise low-pass cutoff, Hz. */
export function windCutoffHz(V: number): number {
  return 180 + 70 * Math.max(V, 0);
}

export interface AudioExtras {
  /** lightning flashes so far (a new one schedules thunder) */
  readonly flashes: number;
}

export interface Audio {
  setEnabled(on: boolean): void;
  /** master volume 0–1 */
  setVolume(v: number): void;
  update(s: SimSnapshot, extras: AudioExtras): void;
  /** current state, for the dev overlay and tests */
  inspect(): { context: string; master: number; humHz: number; rain: number; wind: number };
  dispose(): void;
}

function noiseBuffer(ctx: AudioContext, seconds: number, pink: boolean): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Paul Kellet's economy pink filter
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (!pink) {
      d[i] = w;
      continue;
    }
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
  }
  return buf;
}

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  whoosh: GainNode;
  whooshFilter: BiquadFilterNode;
  hum: GainNode;
  hum1: OscillatorNode;
  hum2: OscillatorNode;
  wind: GainNode;
  windFilter: BiquadFilterNode;
  rain: GainNode;
  white: AudioBuffer;
}

function buildGraph(): Graph {
  const ctx = new AudioContext();
  const master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.1;
  master.connect(limiter).connect(ctx.destination);

  const white = noiseBuffer(ctx, 2, false);
  const pink = noiseBuffer(ctx, 4, true);
  const loop = (buf: AudioBuffer): AudioBufferSourceNode => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    return src;
  };
  const gain = (v = 0): GainNode => {
    const g = ctx.createGain();
    g.gain.value = v;
    g.connect(master);
    return g;
  };

  const whoosh = gain();
  const whooshFilter = ctx.createBiquadFilter();
  whooshFilter.type = 'bandpass';
  whooshFilter.frequency.value = 480;
  whooshFilter.Q.value = 0.9;
  loop(white).connect(whooshFilter).connect(whoosh);

  const hum = gain();
  const hum1 = ctx.createOscillator();
  const hum2 = ctx.createOscillator();
  const h2 = ctx.createGain();
  h2.gain.value = 0.35;
  hum1.connect(hum);
  hum2.connect(h2).connect(hum);
  hum1.start();
  hum2.start();

  const wind = gain();
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.Q.value = 0.5;
  loop(pink).connect(windFilter).connect(wind);

  const rain = gain();
  const rainFilter = ctx.createBiquadFilter();
  rainFilter.type = 'highpass';
  rainFilter.frequency.value = 2600;
  loop(white).connect(rainFilter).connect(rain);

  return { ctx, master, whoosh, whooshFilter, hum, hum1, hum2, wind, windFilter, rain, white };
}

export function createAudio(): Audio {
  let g: Graph | null = null;
  let enabled = false;
  let volume = 0.7;
  let lastFlashes = 0;
  let lastBrake = false;
  let passages = 0;
  let lastT: number | null = null;

  const unlock = (): void => {
    if (g && enabled && g.ctx.state === 'suspended') void g.ctx.resume();
  };
  const onVisibility = (): void => {
    if (!g) return;
    if (document.hidden) void g.ctx.suspend();
    else if (enabled) void g.ctx.resume();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', onVisibility);

  // the first update after the graph is built jumps straight to the targets (no 440 Hz glide)
  let fresh = true;
  const set = (p: AudioParam, v: number): void => {
    if (!g) return;
    if (fresh) p.setValueAtTime(v, g.ctx.currentTime);
    else p.setTargetAtTime(v, g.ctx.currentTime, GLIDE_S);
  };
  const applyMaster = (): void => {
    if (g) g.master.gain.setTargetAtTime(enabled ? volume * volume : 0, g.ctx.currentTime, GLIDE_S);
  };

  function thunder(delayS: number): void {
    if (!g) return;
    const { ctx } = g;
    const src = ctx.createBufferSource();
    src.buffer = g.white;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 140;
    const env = ctx.createGain();
    const t0 = ctx.currentTime + delayS;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.9, t0 + 0.06);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 2.8);
    src.connect(lp).connect(env).connect(g.master);
    src.start(t0);
    src.stop(t0 + 3);
  }

  function squeal(): void {
    if (!g) return;
    const { ctx } = g;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 1750;
    const vib = ctx.createOscillator();
    vib.frequency.value = 7;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 25;
    vib.connect(vibDepth).connect(osc.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1750;
    bp.Q.value = 18;
    const env = ctx.createGain();
    const t0 = ctx.currentTime;
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(0.25, t0 + 0.04);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + 0.7);
    osc.connect(bp).connect(env).connect(g.master);
    osc.start(t0);
    vib.start(t0);
    osc.stop(t0 + 0.75);
    vib.stop(t0 + 0.75);
  }

  return {
    setEnabled(on) {
      enabled = on;
      if (on && !g) g = buildGraph(); // first call comes from a click or key press
      if (g && on) void g.ctx.resume();
      applyMaster();
    },
    setVolume(v) {
      volume = Math.min(Math.max(v, 0), 1);
      applyMaster();
    },
    update(s, extras) {
      const dtSim = lastT === null ? 0 : Math.max(s.t - lastT, 0);
      lastT = s.t;
      passages += bladePassHz(s.omega) * dtSim;
      if (!g || !enabled) {
        lastFlashes = extras.flashes;
        lastBrake = s.brakeOn;
        return;
      }
      const w = whooshLevel(s.omega);
      set(g.whoosh.gain, 0.5 * w * (0.25 + 0.75 * whooshPulse(passages)));
      set(g.whooshFilter.frequency, 300 + 260 * Math.sqrt(w));
      const f = Math.max(humFrequencyHz(s.omega), 1);
      set(g.hum1.frequency, f);
      set(g.hum2.frequency, 2 * f);
      set(g.hum.gain, 0.22 * humLevel(s.Pel));
      set(g.windFilter.frequency, windCutoffHz(s.V));
      set(g.wind.gain, 0.12 + 0.5 * Math.min(s.V / 35, 1));
      set(g.rain.gain, 0.3 * s.stormLevel);
      if (extras.flashes > lastFlashes) thunder(1 + Math.random() * 2);
      lastFlashes = extras.flashes;
      if (s.brakeOn && !lastBrake) squeal();
      lastBrake = s.brakeOn;
      fresh = false;
    },
    inspect() {
      return {
        context: g ? g.ctx.state : 'none',
        master: g ? g.master.gain.value : 0,
        humHz: g ? g.hum1.frequency.value : 0,
        rain: g ? g.rain.gain.value : 0,
        wind: g ? g.wind.gain.value : 0,
      };
    },
    dispose() {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
      void g?.ctx.close();
      g = null;
    },
  };
}
