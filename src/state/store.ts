/**
 * Tiny observable store (TECH_SPEC §14.3): get, set(partial), subscribe(selector, cb).
 * Subscribers fire synchronously after set() when their selected value changes (Object.is).
 */

export interface Store<S> {
  get(): Readonly<S>;
  set(partial: Partial<S>): void;
  /** Subscribe to a slice; returns an unsubscribe function. */
  subscribe<T>(selector: (s: Readonly<S>) => T, cb: (value: T, prev: T) => void): () => void;
}

interface Sub<S> {
  selector: (s: Readonly<S>) => unknown;
  cb: (value: unknown, prev: unknown) => void;
  last: unknown;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state: S = { ...initial };
  const subs = new Set<Sub<S>>();

  return {
    get: () => state,
    set(partial) {
      let changed = false;
      for (const key of Object.keys(partial) as (keyof S)[]) {
        if (!Object.is(state[key], partial[key])) {
          changed = true;
          break;
        }
      }
      if (!changed) return;
      state = { ...state, ...partial };
      // iterate a copy so callbacks may subscribe/unsubscribe or set() again
      for (const sub of [...subs]) {
        if (!subs.has(sub)) continue;
        const value = sub.selector(state);
        if (Object.is(value, sub.last)) continue;
        const prev = sub.last;
        sub.last = value;
        sub.cb(value, prev);
      }
    },
    subscribe(selector, cb) {
      const sub: Sub<S> = {
        selector,
        cb: cb as (value: unknown, prev: unknown) => void,
        last: selector(state),
      };
      subs.add(sub);
      return () => {
        subs.delete(sub);
      };
    },
  };
}
