/** Always-on modifier applied to every one of a deployed Shadow's strikes,
 *  one per archetype. Distinct discriminated shapes rather than a generic
 *  {key,value} bag so each effect's parameters are self-documenting and
 *  store.ts's companionStrike can exhaustively switch over them. */
export type ShadowPassiveEffect =
  | { key: "executeBonus"; hpThresholdPct: number; bonusPct: number }
  | { key: "damageMult"; pct: number }
  | { key: "manaOnHit"; amount: number }
  | { key: "healOnHit"; pct: number }
  | { key: "critChance"; chance: number }
  | { key: "goldOnKill"; chance: number; amount: number };

/** A % chance, rolled once per companionStrike call, to replace the
 *  Shadow's normal single hit with something bigger - one per archetype,
 *  each genuinely different in shape (not just a bigger number) so the
 *  six Shadow families actually feel distinct to fight alongside. */
export type ShadowActiveEffect =
  | { key: "doubleStrike"; chance: number }
  | { key: "bigHit"; chance: number; mult: number }
  | { key: "flurry"; chance: number; hits: number; eachPct: number }
  | { key: "armorPierce"; chance: number }
  | { key: "guaranteedCrit"; chance: number }
  | { key: "aoe"; chance: number; eachPct: number };

export interface ShadowSkillSet {
  passive: { name: string; description: string; effect: ShadowPassiveEffect };
  active: { name: string; description: string; effect: ShadowActiveEffect };
}
