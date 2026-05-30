/**
 * ~60-line reactive primitive: signal / computed / effect with automatic dependency
 * tracking. Enough for settings, profile, scores and HUD bindings — no Redux needed.
 */

type Sub = () => void;
let activeEffect: Sub | null = null;

export interface Signal<T> {
  (): T;
  set(v: T): void;
  update(fn: (prev: T) => T): void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<Sub>();

  const read = (() => {
    if (activeEffect) subs.add(activeEffect);
    return value;
  }) as Signal<T>;

  read.set = (v: T) => {
    if (Object.is(v, value)) return;
    value = v;
    // Copy to avoid mutation-during-iteration issues.
    for (const s of [...subs]) s();
  };
  read.update = (fn: (prev: T) => T) => read.set(fn(value));

  return read;
}

export function computed<T>(fn: () => T): () => T {
  const s = signal<T>(undefined as unknown as T);
  effect(() => s.set(fn()));
  return () => s();
}

export function effect(fn: Sub): () => void {
  const run: Sub = () => {
    const prev = activeEffect;
    activeEffect = run;
    try {
      fn();
    } finally {
      activeEffect = prev;
    }
  };
  run();
  // (For our app's lifetime, effects live as long as their target — no teardown needed,
  // but we return a no-op disposer for symmetry / future use.)
  return () => {};
}
