/**
 * Minimal tween manager (§4.6).
 * Built in TODO.md Phase 5.
 */
import { notImplemented } from '@/util/stub';

export interface Tweens {
  to(_from: number, _to: number, _durationS: number, _onUpdate: (v: number) => void): void;
  update(_dt: number): void;
}

export function createTweens(): Tweens {
  return notImplemented('createTweens');
}
