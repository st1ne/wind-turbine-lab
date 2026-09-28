import { describe, expect, it } from 'vitest';
import { createStore } from '@/state/store';

describe('store', () => {
  it('notifies selectors only when their slice changes', () => {
    const store = createStore({ a: 1, b: 'x' });
    const seen: [number, number][] = [];
    const off = store.subscribe(
      (s) => s.a,
      (v, prev) => seen.push([v, prev]),
    );
    store.set({ b: 'y' });
    store.set({ a: 1 });
    store.set({ a: 2 });
    off();
    store.set({ a: 3 });
    expect(seen).toEqual([[2, 1]]);
    expect(store.get()).toEqual({ a: 3, b: 'y' });
  });

  it('allows set() from inside a callback', () => {
    const store = createStore({ a: 0, b: 0 });
    store.subscribe(
      (s) => s.a,
      (a) => store.set({ b: a * 10 }),
    );
    store.set({ a: 4 });
    expect(store.get().b).toBe(40);
  });
});
