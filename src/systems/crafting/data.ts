import type { ItemRarity, Rank, ShadowRecord } from "../../types";
import { effectiveShadowPower } from "../shadows/data";

export interface CraftCost {
  essence: number;
  gold: number;
}

/** Shadow Essence earned by disenchanting a Shadow (Game.disenchantShadow,
 *  fulfilling the "Convert duplicates to Shadow Essence" property #5
 *  deferred to this item) - scaled off the exact same
 *  `effectiveShadowPower()` combat and Power Score already read
 *  everywhere else, so a Shadow's Essence value tracks its real strength
 *  (rank + level + loyalty + gear) instead of a second, drifting
 *  formula. Not limited to duplicates the way Merge is - any owned
 *  Shadow can be disenchanted, since Essence is now a real resource with
 *  something to spend it on, not a placeholder currency. */
export function essenceFromShadow(shadow: Pick<ShadowRecord, "rank" | "level" | "loyalty" | "equipment">): number {
  return Math.max(1, Math.round(effectiveShadowPower(shadow) * 0.4));
}

/** Craft Equipment cost, keyed by the rank of the item being crafted -
 *  always the Hunter's own *confirmed* rank (#10), gated the same way
 *  Shop stock and a newly-Arisen Shadow's power already are. */
export const CRAFT_EQUIPMENT_COST: Record<Rank, CraftCost> = {
  E: { essence: 8, gold: 60 },
  D: { essence: 14, gold: 120 },
  C: { essence: 22, gold: 220 },
  B: { essence: 34, gold: 380 },
  A: { essence: 50, gold: 600 },
  S: { essence: 75, gold: 950 }
};

/** Reforge cost, keyed by the *item's own* rarity, not the Hunter's rank -
 *  a higher-rarity item has more affixes to reroll, so it costs more to
 *  reforge regardless of what rank the Hunter currently is. */
export const REFORGE_COST_BY_RARITY: Record<ItemRarity, CraftCost> = {
  common: { essence: 3, gold: 20 },
  uncommon: { essence: 5, gold: 40 },
  rare: { essence: 8, gold: 80 },
  epic: { essence: 14, gold: 160 },
  legendary: { essence: 22, gold: 320 },
  mythic: { essence: 35, gold: 600 },
  godly: { essence: 55, gold: 1000 }
};

/** Craft Equipment's rarity-roll bonus is bigger than the Shop's (0.05,
 *  see rollShopStock in data.ts) - it costs real Shadow Essence, not
 *  just gold, so crafting should be a meaningfully better bet than
 *  another Shop reroll, not just a slower way to buy the same odds. */
export const CRAFT_RARITY_BONUS = 0.15;
