/**
 * Minimal tweens (TECH_SPEC §4.6): a tween manager for one-shot animations and a tweened number
 * that retargets smoothly (stat cards, 250 ms ease-out).
 */
import { easeOutQuint } from '@/util/easing';

export interface Tweens {
  to(
    from: number,
    to: number,
    durationS: number,
    onUpdate: (v: number) => void,
    ease?: (t: number) => number,
  ): void;
  update(dt: number): void;
}

interface Tween {
  from: number;
  to: number;
  dur: number;
  t: number;
  onUpdate: (v: number) => void;
  ease: (t: number) => number;
}

export function createTweens(): Tweens {
  let active: Tween[] = [];
  return {
    to(from, to, durationS, onUpdate, ease = easeOutQuint) {
      if (durationS <= 0) {
        onUpdate(to);
        return;
      }
      active.push({ from, to, dur: durationS, t: 0, onUpdate, ease });
    },
    update(dt) {
      if (active.length === 0) return;
      for (const tw of active) {
        tw.t = Math.min(tw.t + dt, tw.dur);
        tw.onUpdate(tw.from + (tw.to - tw.from) * tw.ease(tw.t / tw.dur));
      }
      active = active.filter((tw) => tw.t < tw.dur);
    },
  };
}

/** A number that eases toward its latest target; retargeting starts from the current value. */
export interface TweenedNumber {
  readonly value: number;
  target(v: number): void;
  /** Jump without animation. */
  snap(v: number): void;
  update(dt: number): void;
}

export function createTweenedNumber(initial: number, durationS = 0.25): TweenedNumber {
  let value = initial;
  let from = initial;
  let to = initial;
  let t = durationS;
  return {
    get value() {
      return value;
    },
    target(v) {
      if (!Number.isFinite(v) || v === to) return;
      from = value;
      to = v;
      t = 0;
    },
    snap(v) {
      value = from = to = v;
      t = durationS;
    },
    update(dt) {
      if (t >= durationS) return;
      t = Math.min(t + dt, durationS);
      value = from + (to - from) * easeOutQuint(t / durationS);
    },
  };
}
