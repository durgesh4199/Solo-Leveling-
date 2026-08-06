import type { StatKey } from "../../types";
import type { ConditionDef } from "../progress/types";

/** A Title's passive effect - percentages, so it stacks additively into
 *  the existing effective-stat/gold/xp pipeline the same way an equipment
 *  affix does, rather than opening a new multiplier chain (see the
 *  balancing guardrails in EXPANSION_ROADMAP.md). */
export type TitleBonus =
  | { kind: "statPct"; stat: StatKey; value: number }
  | { kind: "allStatsPct"; value: number }
  | { kind: "xpPct"; value: number }
  | { kind: "goldPct"; value: number }
  | { kind: "critFlat"; value: number };

export interface TitleDef {
  id: string;
  name: string;
  description: string;
  condition: ConditionDef;
  bonus: TitleBonus;
  bonusText: string;
}
