import type { StatKey } from "../../types";
import { createRegistry } from "../../services/registry";
import type { RelicBonus, RelicDef, RelicTier } from "./types";

/** Starter roster - 6 minor, 5 greater, 3 ancient, the same "grow the
 *  table later, no structural change needed" scale Titles/Achievements/
 *  Talents already established. Every bonus is a small additive
 *  percentage in the same 2-12% range those systems use - a Relic isn't
 *  meant to out-scale a Title or a Talent node on its own, it's meant to
 *  stack a *third* small bonus on top of them (see RELIC_SLOT_COUNT). */
export const RELICS: RelicDef[] = [
  // Minor - the common find, one small stat/gold bonus each.
  { id: "hunters_compass", name: "Hunter's Compass", description: "A cracked compass that always points toward treasure.", tier: "minor", bonus: { kind: "goldPct", value: 0.03 }, bonusText: "+3% Gold", icon: "coin" },
  { id: "ember_core", name: "Ember Core", description: "A warm stone that quickens the pulse.", tier: "minor", bonus: { kind: "statPct", stat: "str", value: 0.03 }, bonusText: "+3% STR", icon: "flame" },
  { id: "frost_needle", name: "Frost Needle", description: "Impossibly light, impossibly sharp.", tier: "minor", bonus: { kind: "statPct", stat: "agi", value: 0.03 }, bonusText: "+3% AGI", icon: "lightning" },
  { id: "still_water_charm", name: "Still Water Charm", description: "A drop of water that never evaporates or spills.", tier: "minor", bonus: { kind: "statPct", stat: "int", value: 0.03 }, bonusText: "+3% INT", icon: "moon-stars" },
  { id: "warding_stone", name: "Warding Stone", description: "Worn smooth by a thousand blocked blows.", tier: "minor", bonus: { kind: "statPct", stat: "vit", value: 0.03 }, bonusText: "+3% VIT", icon: "shield" },
  { id: "keen_lens", name: "Keen Lens", description: "Everything looks a little closer through it.", tier: "minor", bonus: { kind: "statPct", stat: "per", value: 0.03 }, bonusText: "+3% PER", icon: "circle-dashed" },

  // Greater - rarer, a bigger single bonus.
  { id: "sovereigns_seal", name: "Sovereign's Seal", description: "Stamped with a mark no living hand carved.", tier: "greater", bonus: { kind: "critFlat", value: 0.03 }, bonusText: "+3% Crit", icon: "shield-checkered" },
  { id: "bloodstone_pendant", name: "Bloodstone Pendant", description: "It beats faintly, in time with a fight well-fought.", tier: "greater", bonus: { kind: "xpPct", value: 0.07 }, bonusText: "+7% XP", icon: "sparkles" },
  { id: "ashen_talon", name: "Ashen Talon", description: "Torn from something that no longer needs it.", tier: "greater", bonus: { kind: "statPct", stat: "str", value: 0.06 }, bonusText: "+6% STR", icon: "sword" },
  { id: "whispering_grimoire", name: "Whispering Grimoire", description: "Its pages turn on their own, just slightly.", tier: "greater", bonus: { kind: "statPct", stat: "int", value: 0.06 }, bonusText: "+6% INT", icon: "moon-stars" },
  { id: "ironclad_bracer", name: "Ironclad Bracer", description: "Never once dented, never once removed.", tier: "greater", bonus: { kind: "statPct", stat: "vit", value: 0.06 }, bonusText: "+6% VIT", icon: "shield-checkered" },

  // Ancient - the rare, build-defining finds.
  { id: "crown_of_the_shadow_sovereign", name: "Crown of the Shadow Sovereign", description: "A crown that fits no head it hasn't chosen.", tier: "ancient", bonus: { kind: "allStatsPct", value: 0.05 }, bonusText: "+5% All Stats", icon: "sparkles" },
  { id: "cube_of_devouring", name: "Cube of Devouring", description: "Everything it touches becomes more of itself.", tier: "ancient", bonus: { kind: "goldPct", value: 0.12 }, bonusText: "+12% Gold", icon: "coin" },
  { id: "vial_of_black_blood", name: "Vial of Black Blood", description: "Still warm, after all this time.", tier: "ancient", bonus: { kind: "critFlat", value: 0.06 }, bonusText: "+6% Crit", icon: "flask" }
];

export const RELIC_REGISTRY = createRegistry(RELICS, (r) => r.id, "Relic");

/** How many Relics can be equipped (their bonus active) at once - owning
 *  more than this is completely fine (see RelicState.ownedIds vs
 *  .equippedIds), it just means choosing which 3 to actually wear, the
 *  same "own many, actively wear a few" shape Titles already has at
 *  slot-count 1, just widened since Relics stack instead of replacing
 *  each other. */
export const RELIC_SLOT_COUNT = 3;

/** Rarer tiers are worth more per relic but should come up less often -
 *  the same weighted-pool shape GATE_MODIFIERS/RANDOM_EVENTS already use,
 *  just keyed by tier instead of a per-entry `weight` field, since every
 *  Relic in a tier is meant to be equally likely to be the one that
 *  drops. */
const RELIC_TIER_WEIGHT: Record<RelicTier, number> = { minor: 40, greater: 18, ancient: 6 };

/** Chance a Gate's boss (never trash, never a Promotion Exam boss - see
 *  Game.onWaveCleared) drops a brand-new Relic on top of its normal XP/
 *  gold/loot. Deliberately lower than Random Events' 25% (#12) - a Relic
 *  is a permanent stat bonus, not a one-shot consumable payout, so it
 *  should feel like a real find, not a routine one. */
export const RELIC_DROP_CHANCE = 0.15;

/** Weighted pick among Relics the player doesn't already own - once every
 *  Relic in the roster is owned, this returns null and the drop roll
 *  simply does nothing that run (same "ran out of achievements to earn"
 *  shape the Achievements system already has, not an error case). */
export function rollRelicDrop(ownedIds: string[]): RelicDef | null {
  const pool = RELICS.filter((r) => !ownedIds.includes(r.id));
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, r) => sum + RELIC_TIER_WEIGHT[r.tier], 0);
  let roll = Math.random() * total;
  for (const r of pool) {
    roll -= RELIC_TIER_WEIGHT[r.tier];
    if (roll <= 0) return r;
  }
  return pool[pool.length - 1];
}

function sumBonus(equippedIds: string[], match: (b: RelicBonus) => number): number {
  return equippedIds.reduce((sum, id) => {
    const relic = RELIC_REGISTRY.get(id);
    return relic ? sum + match(relic.bonus) : sum;
  }, 0);
}

/** Sum of every *equipped* Relic's contribution to one core stat - both a
 *  matching `statPct` and any `allStatsPct` relic count toward it, same
 *  as talentStatPct. Owned-but-not-equipped Relics contribute nothing -
 *  only the up-to-RELIC_SLOT_COUNT worn ones are live. */
export function relicStatPct(equippedIds: string[], stat: StatKey): number {
  return sumBonus(equippedIds, (b) => {
    if (b.kind === "statPct" && b.stat === stat) return b.value;
    if (b.kind === "allStatsPct") return b.value;
    return 0;
  });
}

export function relicCritFlat(equippedIds: string[]): number {
  return sumBonus(equippedIds, (b) => (b.kind === "critFlat" ? b.value : 0));
}

export function relicXpPct(equippedIds: string[]): number {
  return sumBonus(equippedIds, (b) => (b.kind === "xpPct" ? b.value : 0));
}

export function relicGoldPct(equippedIds: string[]): number {
  return sumBonus(equippedIds, (b) => (b.kind === "goldPct" ? b.value : 0));
}
