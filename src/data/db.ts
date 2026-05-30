import { get, set, del, keys } from 'idb-keyval';
import type { z } from 'zod';

/**
 * Namespaced, schema-validated wrapper over idb-keyval. Every read is validated by a zod
 * schema and falls back to a typed default on miss/corruption, so the app never crashes on
 * bad storage. See docs/07-data-model.md.
 */

const NS = 'rp';
const key = (store: string, k = '_') => `${NS}:${store}:${k}`;

export async function read<S extends z.ZodTypeAny>(
  store: string,
  k: string,
  schema: S,
  fallback: z.infer<S>,
): Promise<z.infer<S>> {
  try {
    const raw = await get(key(store, k));
    if (raw === undefined) return fallback;
    const parsed = schema.safeParse(raw);
    return parsed.success ? (parsed.data as z.infer<S>) : fallback;
  } catch (err) {
    console.warn(`[db] read failed for ${store}:${k}`, err);
    return fallback;
  }
}

export async function write<T>(store: string, k: string, value: T): Promise<void> {
  try {
    await set(key(store, k), value);
  } catch (err) {
    console.warn(`[db] write failed for ${store}:${k}`, err);
  }
}

export async function remove(store: string, k: string): Promise<void> {
  try {
    await del(key(store, k));
  } catch (err) {
    console.warn(`[db] remove failed for ${store}:${k}`, err);
  }
}

/** Export every Retro Pocket key as a plain object (for Settings → backup). */
export async function exportAll(): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const k of await keys()) {
    if (typeof k === 'string' && k.startsWith(`${NS}:`)) out[k] = await get(k);
  }
  return out;
}

/** Wipe all Retro Pocket data (Settings → reset progress). */
export async function wipeAll(): Promise<void> {
  for (const k of await keys()) {
    if (typeof k === 'string' && k.startsWith(`${NS}:`)) await del(k);
  }
}
