import type { StatKey } from "../../types";

/** A Relic's passive effect - the same shape as TitleBonus/TalentBonus
 *  (percentages folding additively into the existing effective-stat/gold/
 *  xp pipeline, per the "no exponential stat inflation" guardrail in
 *  EXPANSION_ROADMAP.md), duplicated rather than imported for the same
 *  reason TalentBonus duplicates TitleBonus - unrelated systems that
 *  happen to share a shape, not a real dependency between them. What
 *  actually makes a Relic different from a Title or a Talent node is
 *  *how it's acquired and worn*, not the bonus shape - see RelicDef and
 *  RelicState below. */
export type RelicBonus =
  | { kind: "statPct"; stat: StatKey; value: number }
  | { kind: "allStatsPct"; value: number }
  | { kind: "xpPct"; value: number }
  | { kind: "goldPct"; value: number }
  | { kind: "critFlat"; value: number };

/** Rarer tiers roll less often (see rollRelicDrop in data.ts, the same
 *  weighted-pool technique GateModifier/RandomEvent already use) and
 *  grant a bigger bonus - "minor" trinkets are the common find, "ancient"
 *  relics are the rare, build-defining ones. */
export type RelicTier = "minor" | "greater" | "ancient";

export interface RelicDef {
  id: string;
  name: string;
  description: string;
  tier: RelicTier;
  bonus: RelicBonus;
  bonusText: string;
  icon: string;
}
