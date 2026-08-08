import type { Rank } from "../../types";
import type { RandomEventDef } from "./types";

/** Chance of any Random Event at all on a given wave transition
 *  (Game.advanceWave) - the other ~75% of the time, nothing happens and
 *  the next wave just starts normally, same as before this item. */
export const RANDOM_EVENT_CHANCE = 0.25;

/** Rough gold-reward scale across ranks - mirrors how GATES_DATA's own
 *  `xp` column already ramps roughly 1x (E) -> 8x (S), so a flat gold
 *  amount defined once (tuned for E-rank) still feels proportionate at
 *  every rank instead of trivial at S-rank or oversized at E-rank. */
export const RANDOM_EVENT_RANK_MULT: Record<Rank, number> = {
  E: 1, D: 1.8, C: 2.8, B: 4, A: 5.8, S: 8
};

/** 5 event types, one weighted pool - no "nothing happens" entry needed
 *  since that's already the ~75% case `rollRandomEvent` handles before
 *  ever touching this pool. `Toll Shrine` is the one real risk/reward
 *  event (costs HP, pays more gold than a plain Gold Cache) - never
 *  lethal on its own (see Game.applyRandomEvent's clamp), a fair trade
 *  rather than a punishing gotcha. */
export const RANDOM_EVENTS: RandomEventDef[] = [
  { id: "gold_cache", label: "Gold Cache", description: "You stumble on a stash of gold.", weight: 3, effect: { kind: "gold", baseAmount: 40 } },
  { id: "bonus_loot", label: "Hidden Cache", description: "A hidden cache holds a piece of gear.", weight: 2, effect: { kind: "loot" } },
  { id: "healing_spring", label: "Healing Spring", description: "A spring restores some of your HP and MP.", weight: 2, effect: { kind: "heal", hpPct: 0.4, mpPct: 0.4 } },
  { id: "ambush", label: "Ambush!", description: "A hidden foe joins the next fight.", weight: 2, effect: { kind: "ambush" } },
  { id: "toll", label: "Toll Shrine", description: "A shrine demands blood for gold.", weight: 1.5, effect: { kind: "toll", hpCostPct: 0.15, baseGoldReward: 90 } }
];

function pickWeighted(pool: RandomEventDef[]): RandomEventDef {
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[pool.length - 1];
}

/** Rolled once per wave transition. `nextWaveIsBoss` excludes Ambush from
 *  the pool when true - a surprise extra enemy right as the player walks
 *  into the boss wave reads as unfair rather than fun, so that one event
 *  is scoped out rather than firing indiscriminately. Returns null on
 *  the ~75% "nothing happens" roll. */
export function rollRandomEvent(nextWaveIsBoss: boolean): RandomEventDef | null {
  if (Math.random() >= RANDOM_EVENT_CHANCE) return null;
  const pool = nextWaveIsBoss ? RANDOM_EVENTS.filter((e) => e.effect.kind !== "ambush") : RANDOM_EVENTS;
  return pickWeighted(pool);
}
