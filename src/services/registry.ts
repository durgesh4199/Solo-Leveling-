/** A tiny read-only lookup index for *static* content tables (gates,
 *  skills, potions, titles, achievements, ...) - O(1) `.get(id)` instead
 *  of a `.find()` scan repeated at every call site, plus a load-time
 *  integrity check that two entries never silently share a key. Without
 *  this, a duplicate id (e.g. two gates both authored as "g5") would only
 *  ever surface as "the wrong one turned up" at the point of use, much
 *  later and far from the actual mistake - a registry throws immediately
 *  when the content module loads, so the bug is caught at build/boot time
 *  instead.
 *
 *  Only for content that's fixed at build time. Anything that changes at
 *  runtime - the bag, the Shop's rolled stock, a wave's spawned enemies -
 *  is player state, not content, and stays a plain array with `.find()`;
 *  wrapping mutable state in a registry built once at import time would
 *  be actively wrong (it would never see later additions/removals). */
export interface Registry<T> {
  get(key: string): T | undefined;
  /** For lookups that should never fail on legitimate content (e.g. "the
   *  gate a live battle already belongs to") - throws with a clear
   *  message instead of forcing every call site to handle an
   *  "impossible" undefined. */
  getOrThrow(key: string): T;
  has(key: string): boolean;
  all(): readonly T[];
}

export function createRegistry<T>(items: readonly T[], keyOf: (item: T) => string, label: string): Registry<T> {
  const map = new Map<string, T>();
  for (const item of items) {
    const key = keyOf(item);
    if (map.has(key)) {
      throw new Error(`${label} registry: duplicate key "${key}" - every ${label.toLowerCase()} id must be unique.`);
    }
    map.set(key, item);
  }
  return {
    get: (key) => map.get(key),
    getOrThrow: (key) => {
      const found = map.get(key);
      if (!found) throw new Error(`${label} registry: no entry for key "${key}".`);
      return found;
    },
    has: (key) => map.has(key),
    all: () => items
  };
}
