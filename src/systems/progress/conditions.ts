import type { Rank } from "../../types";
import type { ConditionDef, ProgressContext } from "./types";

const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];

export function evaluateCondition(cond: ConditionDef, ctx: ProgressContext): boolean {
  switch (cond.type) {
    case "counter": return (ctx.counters[cond.key] ?? 0) >= cond.atLeast;
    case "level": return ctx.level >= cond.atLeast;
    case "rank": return RANK_ORDER.indexOf(ctx.rank) >= RANK_ORDER.indexOf(cond.atLeast);
    case "shadowCount": return ctx.shadowCount >= cond.atLeast;
    case "gatesClearedCount": return ctx.gatesClearedCount >= cond.atLeast;
    case "gold": return ctx.gold >= cond.atLeast;
  }
}

/** Renders a condition's current progress as "342 / 1,000" (or the rank
 *  itself for rank-gated ones) - used by the Titles/Achievements UI so a
 *  locked entry still shows how close the player is, not just a padlock. */
export function conditionProgressText(cond: ConditionDef, ctx: ProgressContext): string {
  const fmt = (n: number) => n.toLocaleString();
  switch (cond.type) {
    case "counter": return `${fmt(Math.min(ctx.counters[cond.key] ?? 0, cond.atLeast))} / ${fmt(cond.atLeast)}`;
    case "level": return `Level ${fmt(ctx.level)} / ${fmt(cond.atLeast)}`;
    case "rank": return `Rank ${ctx.rank} (needs ${cond.atLeast})`;
    case "shadowCount": return `${fmt(Math.min(ctx.shadowCount, cond.atLeast))} / ${fmt(cond.atLeast)}`;
    case "gatesClearedCount": return `${fmt(Math.min(ctx.gatesClearedCount, cond.atLeast))} / ${fmt(cond.atLeast)}`;
    case "gold": return `${fmt(Math.min(ctx.gold, cond.atLeast))} / ${fmt(cond.atLeast)}g`;
  }
}
