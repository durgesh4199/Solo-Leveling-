import type { ConditionDef } from "../progress/types";

/** Achievement rewards are one-time, granted the instant the condition is
 *  first met (see Game.refreshProgress) - no separate "claim" step to
 *  track, so the unlocked-id list alone is the full state. */
export type AchievementReward =
  | { kind: "gold"; amount: number }
  | { kind: "statPoints"; amount: number };

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  condition: ConditionDef;
  reward: AchievementReward;
  rewardText: string;
}
