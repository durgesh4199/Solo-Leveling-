/** A Random Event's actual effect. Deliberately all *instant*, one-shot
 *  effects (a flat gold/gear/HP change, or one bonus enemy joining the
 *  very next wave) - no temporary buffs/debuffs with a duration, since
 *  that's real infrastructure this system doesn't have yet (combat
 *  status effects are still their own future roadmap item; building a
 *  duration mechanic as a side effect of Random Events would be exactly
 *  the unrelated-system scope creep the standing rules rule out). */
export type RandomEventEffect =
  | { kind: "gold"; baseAmount: number }
  | { kind: "loot" }
  | { kind: "heal"; hpPct: number; mpPct: number }
  | { kind: "ambush" }
  | { kind: "toll"; hpCostPct: number; baseGoldReward: number };

export interface RandomEventDef {
  id: string;
  label: string;
  description: string;
  /** Relative roll weight among events that rolled true at all - same
   *  cumulative-weight shape GateModifier's `weight` uses (#11). */
  weight: number;
  effect: RandomEventEffect;
}
