import { rankForLevel } from "../../data";
import type { Rank } from "../../types";

const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];

/** The rank one tier above `rank`, or null at the top (S). Same small
 *  local ladder every other rank-ordered comparison in the codebase
 *  walks (see e.g. systems/shadows/data.ts's nextShadowRank) - scoped
 *  here rather than shared since it's only ever consulted from the exam
 *  path. */
export function nextRank(rank: Rank): Rank | null {
  const i = RANK_ORDER.indexOf(rank) + 1;
  return i < RANK_ORDER.length ? RANK_ORDER[i] : null;
}

/** Which rank tier a Promotion Exam is currently available for, or null
 *  if none is. A Hunter's *level* alone (`rankForLevel`) can qualify them
 *  for a rank well ahead of their *confirmed* one (`PlayerState.rank`) -
 *  exams close that gap one tier at a time regardless of how far level
 *  has raced ahead, so a Hunter who jumped several rank thresholds in
 *  one big XP grant still takes each exam in order rather than skipping
 *  straight to the top. */
export function examEligibleRank(confirmedRank: Rank, level: number): Rank | null {
  const next = nextRank(confirmedRank);
  if (!next) return null;
  return RANK_ORDER.indexOf(rankForLevel(level)) >= RANK_ORDER.indexOf(next) ? next : null;
}

/** GateDef id for each rank's Promotion Exam trial - see EXAM_GATES_DATA
 *  in data.ts. */
export const EXAM_GATE_ID: Partial<Record<Rank, string>> = {
  D: "exam_d", C: "exam_c", B: "exam_b", A: "exam_a", S: "exam_s"
};

/** One-time gold + stat point reward for passing a rank's exam - scaled
 *  up with rank the same way gate-clear/boss-kill rewards already are,
 *  on top of the exam boss's own normal XP/gold/loot from the fight
 *  itself (an exam is a real, if tougher, boss fight - not just a gate). */
export const PROMOTION_REWARD: Partial<Record<Rank, { gold: number; statPoints: number }>> = {
  D: { gold: 200, statPoints: 3 },
  C: { gold: 400, statPoints: 4 },
  B: { gold: 700, statPoints: 5 },
  A: { gold: 1100, statPoints: 6 },
  S: { gold: 1800, statPoints: 8 }
};
