import type { HunterClassId } from "../../types";

/** A Hunter Class's single defining mechanic - deliberately *not* another
 *  statPct/critFlat clone of what Titles/Talents already do (see
 *  systems/titles/types.ts, systems/talents/types.ts) - a Class is a
 *  one-time, permanent identity choice, so it earns that weight by doing
 *  something those two systems structurally can't: reach into a specific
 *  combat formula (Attack-only damage, Skill-only damage, the crit
 *  multiplier itself, Guard's damage mitigation, potion healing) rather
 *  than a generic percentage every build gets the same flavor of. */
export type ClassBonus =
  | { kind: "attackDamagePct"; value: number }
  | { kind: "skillDamagePct"; value: number }
  | { kind: "critMultiplierBonus"; value: number }
  | { kind: "guardMitigationPct"; value: number }
  | { kind: "potionHealPct"; value: number };

export interface HunterClassDef {
  id: HunterClassId;
  name: string;
  description: string;
  bonus: ClassBonus;
  bonusText: string;
  /** Player level required before this class can be chosen - not a
   *  meaningful gameplay gate (all 5 unlock together), just enough of a
   *  delay that "choose your class" isn't the very first thing a brand
   *  new Hunter sees before they've felt any of the systems it modifies. */
  unlockLevel: number;
}
