import type { Archetype, ItemSlot, LootItem, Rank, ShadowRecord, StatKey } from "../../types";
import { SHADOW_RANK_POWER, sumEquipmentAffix } from "../../data";
import type { ShadowSkillSet } from "./types";

/** One passive + one active per archetype, thematically matched to the
 *  monster family (see ARCHETYPE_BY_RANK in data.ts) - the same six
 *  archetypes that already drive portrait/rim-glow, now also driving how
 *  a deployed Shadow actually fights. Every effect is a real formula
 *  applied in Game.companionStrike, not a flavor label. */
export const SHADOW_SKILLS: Record<Archetype, ShadowSkillSet> = {
  goblin: {
    passive: {
      name: "Opportunist",
      description: "+25% damage against targets below 30% HP.",
      effect: { key: "executeBonus", hpThresholdPct: 0.3, bonusPct: 0.25 }
    },
    active: {
      name: "Ambush",
      description: "18% chance to strike twice.",
      effect: { key: "doubleStrike", chance: 18 }
    }
  },
  orc: {
    passive: {
      name: "Brutal Strength",
      description: "+15% damage on every strike.",
      effect: { key: "damageMult", pct: 0.15 }
    },
    active: {
      name: "Rampage",
      description: "12% chance of a single strike at 2.2x damage.",
      effect: { key: "bigHit", chance: 12, mult: 2.2 }
    }
  },
  wraith: {
    passive: {
      name: "Spirit Channel",
      description: "Restores 3 MP to the Hunter on every strike.",
      effect: { key: "manaOnHit", amount: 3 }
    },
    active: {
      name: "Ethereal Barrage",
      description: "10% chance of 3 rapid strikes at 45% damage each.",
      effect: { key: "flurry", chance: 10, hits: 3, eachPct: 0.45 }
    }
  },
  knight: {
    passive: {
      name: "Guardian's Bond",
      description: "Heals the Hunter for 12% of damage dealt.",
      effect: { key: "healOnHit", pct: 0.12 }
    },
    active: {
      name: "Guard Break",
      description: "15% chance to ignore the target's Defense entirely.",
      effect: { key: "armorPierce", chance: 15 }
    }
  },
  beast: {
    passive: {
      name: "Predator's Instinct",
      description: "25% chance for its strikes to critically hit.",
      effect: { key: "critChance", chance: 25 }
    },
    active: {
      name: "Savage Pounce",
      description: "15% chance to guarantee a critical strike.",
      effect: { key: "guaranteedCrit", chance: 15 }
    }
  },
  wyrm: {
    passive: {
      name: "Hoarder",
      description: "20% chance of bonus gold when its strike lands a kill.",
      effect: { key: "goldOnKill", chance: 20, amount: 15 }
    },
    active: {
      name: "Draconic Breath",
      description: "10% chance to strike every enemy for 60% damage each.",
      effect: { key: "aoe", chance: 10, eachPct: 0.6 }
    }
  }
};

/** Capped so a single Shadow's power can't grow unboundedly across a very
 *  long-lived save (the "avoid exponential stat inflation" guardrail from
 *  EXPANSION_ROADMAP.md) - a maxed Shadow is a real milestone, not a
 *  moving target. */
export const SHADOW_MAX_LEVEL = 30;

/** XP needed to go from `level` to `level + 1` - gentle exponential, tuned
 *  small since Shadow XP grants (see Game.grantShadowXp) are themselves
 *  small flat per-hit amounts, not scaled kill XP the way player XP is. */
export function shadowXpToNext(level: number): number {
  return Math.round(20 * Math.pow(1.15, level - 1));
}

const CORE_STATS: StatKey[] = ["str", "agi", "int", "vit", "per"];
/** How much raw power one point of a core-stat affix is worth on a
 *  Shadow's own gear (#7 - Shadow equipment slots). Shadows have no
 *  STR/AGI/INT/VIT/PER of their own to feed the way the Hunter's gear
 *  does, so a core-stat roll converts straight into power at this fixed
 *  rate instead - the "no affix ever fully wasted" equivalent of the
 *  Hunter's effectiveStat pipeline. */
const POWER_PER_STAT_AFFIX = 0.6;

/** A Shadow's power contribution from its own equipped gear - core-stat
 *  affixes (see POWER_PER_STAT_AFFIX above). `hp`/`mp` affixes are
 *  deliberately excluded: a Shadow has no HP/MP pool of its own to
 *  restore (it never takes damage or spends mana), so those rolls are
 *  legitimately inert on Shadow-worn gear - the same way a pure-INT item
 *  is dead weight on a strength build in any itemized RPG, not a bug.
 *  crit/lifeSteal/attackSpeed/manaRegen/fireDamage are combat-round
 *  affixes applied directly where they act inside Game.companionStrike,
 *  mirroring how the Hunter's own gear works (see equipmentAffixSum's
 *  call sites in store.ts) rather than folding into this raw number. */
function equipmentPowerBonus(equipment: Partial<Record<ItemSlot, LootItem>>): number {
  return CORE_STATS.reduce((sum, key) => sum + sumEquipmentAffix(equipment, key), 0) * POWER_PER_STAT_AFFIX;
}

/** Base rank power + a per-level slice of that same base (higher-rank
 *  Shadows grow faster per level, matching how SHADOW_RANK_POWER already
 *  scales across ranks) + a small, capped Loyalty bonus + its own
 *  equipped gear's core-stat contribution (#7). This is what combat and
 *  Power Score actually read - `shadow.power` itself stays the stable
 *  Arise-time snapshot, mirroring the player's raw-stat vs effectiveStat
 *  split. */
export function effectiveShadowPower(shadow: Pick<ShadowRecord, "rank" | "level" | "loyalty" | "equipment">): number {
  const base = SHADOW_RANK_POWER[shadow.rank];
  const perLevelGrowth = base * 0.08;
  const levelBonus = (shadow.level - 1) * perLevelGrowth;
  const loyaltyBonus = Math.floor(shadow.loyalty / 20);
  const equipmentBonus = equipmentPowerBonus(shadow.equipment);
  return Math.round(base + levelBonus + loyaltyBonus + equipmentBonus);
}

const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];

/** The rank a Shadow evolves into, or null if it's already at the top -
 *  S-rank Shadows have nothing further to evolve into. Reuses the same
 *  rank ladder every other rank-ordered comparison in the codebase walks
 *  (see e.g. systems/progress/conditions.ts), scoped locally here since
 *  it's only ever consulted from the evolution path. */
export function nextShadowRank(rank: Rank): Rank | null {
  const nextIdx = RANK_ORDER.indexOf(rank) + 1;
  return nextIdx < RANK_ORDER.length ? RANK_ORDER[nextIdx] : null;
}

/** Gold cost to evolve a maxed-level Shadow out of the given (pre-
 *  evolution) rank - keyed by the rank being left behind, scaling up
 *  steeply since each evolution is a bigger power jump than the last.
 *  No S entry: S-rank Shadows can't evolve further (see nextShadowRank). */
export const SHADOW_EVOLUTION_COST: Partial<Record<Rank, number>> = {
  E: 150, D: 400, C: 800, B: 1400, A: 2200
};

/** Longest name a Shadow can be renamed to (Game.renameShadow) - long
 *  enough for a real nickname, short enough to never overflow the Shadow
 *  Army card's name row. */
export const SHADOW_NAME_MAX_LENGTH = 28;

/** A derived display label, not a separately-tracked/driven stat - there's
 *  no independent "mood" mechanic to invent a driver for (feeding,
 *  training, ... none of that exists), so Mood reads directly off Loyalty
 *  instead of being a second, ungrounded number. Still a real, computed
 *  property, just not separately stored. */
export function shadowMood(loyalty: number): { label: string; icon: string } {
  if (loyalty >= 80) return { label: "Devoted", icon: "sparkles" };
  if (loyalty >= 50) return { label: "Content", icon: "check-circle" };
  if (loyalty >= 20) return { label: "Reserved", icon: "shield" };
  return { label: "Wary", icon: "ghost" };
}
