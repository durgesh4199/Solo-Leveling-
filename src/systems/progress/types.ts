import type { Rank } from "../../types";

/** Declarative unlock condition shared by Titles and Achievements - data,
 *  not a closure, so definitions stay plain objects (easy to grow into the
 *  hundreds later without every entry carrying its own bespoke function).
 *  Add a new `type` here (and a matching case in evaluateCondition) when a
 *  future system needs a new kind of milestone. */
export type ConditionDef =
  | { type: "counter"; key: string; atLeast: number }
  | { type: "level"; atLeast: number }
  | { type: "rank"; atLeast: Rank }
  | { type: "shadowCount"; atLeast: number }
  | { type: "gatesClearedCount"; atLeast: number }
  | { type: "gold"; atLeast: number };

/** Everything a condition might need to read, gathered once per check
 *  rather than each condition reaching into `Game` directly - keeps
 *  Titles/Achievements decoupled from the store's internals. */
export interface ProgressContext {
  counters: Record<string, number>;
  level: number;
  rank: Rank;
  shadowCount: number;
  gatesClearedCount: number;
  gold: number;
}

/** Canonical counter keys incremented from store.ts - centralized so a
 *  typo can't silently create a second, unreachable counter. Per-archetype
 *  kill counters use the archetype string itself (see ARCHETYPE_BY_RANK in
 *  data.ts) as the suffix: "kills.goblin", "kills.orc", etc. */
export const COUNTER_KEYS = {
  killsTotal: "kills.total",
  bossesDefeatedTotal: "bossesDefeated.total",
  critsLandedTotal: "critsLanded.total",
  goldEarnedTotal: "goldEarned.total",
  itemsEquippedTotal: "itemsEquipped.total",
  potionsUsedTotal: "potionsUsed.total",
  randomEventsTriggered: "randomEvents.total",
  killsByArchetype: (archetype: string) => `kills.${archetype}`
} as const;
