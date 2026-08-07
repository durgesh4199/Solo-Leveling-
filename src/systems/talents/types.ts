import type { StatKey } from "../../types";

export type TalentBranch = "offense" | "defense" | "utility";

/** A Talent node's passive effect - the exact same shape as TitleBonus
 *  (percentages folding additively into the existing effective-stat/gold/
 *  xp pipeline, per the "no exponential stat inflation" guardrail in
 *  EXPANSION_ROADMAP.md), duplicated rather than imported from
 *  systems/titles/ since the two systems are otherwise unrelated - the
 *  same small-intentional-duplication call the codebase already made for
 *  RANK_ORDER (see screens/shadows.ts) over a cross-system dependency
 *  between two features that don't actually share behavior. Unlike a
 *  Title (exactly one equipped at a time), a player can have many Talent
 *  nodes unlocked simultaneously, so every read site sums across all of
 *  them (see systems/talents/data.ts) instead of reading a single bonus. */
export type TalentBonus =
  | { kind: "statPct"; stat: StatKey; value: number }
  | { kind: "allStatsPct"; value: number }
  | { kind: "xpPct"; value: number }
  | { kind: "goldPct"; value: number }
  | { kind: "critFlat"; value: number };

export interface TalentNode {
  id: string;
  branch: TalentBranch;
  /** 1-5, this node's position within its branch, top to bottom. Tier N
   *  can only be unlocked once tier N-1 in the *same* branch already is -
   *  a single linear path per branch, not a full node graph, so "invest
   *  deeper in one branch or spread out across all three" stays a real,
   *  legible choice without needing graph-layout UI to represent it. */
  tier: number;
  name: string;
  description: string;
  bonus: TalentBonus;
  bonusText: string;
}
