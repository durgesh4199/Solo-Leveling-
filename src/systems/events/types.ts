/** A Random Event's actual effect. Originally all *instant*, one-shot
 *  effects (a flat gold/gear/HP change, or one bonus enemy joining the
 *  very next wave) - the doc comment used to note that a temporary
 *  buff/debuff needed real duration infrastructure this system didn't
 *  have yet. That infrastructure now exists (systems/statusEffects/, the
 *  Status Effect Framework), so `"blessing"` is the one non-instant
 *  effect: it grants the Hunter a random beneficial status rather than
 *  an immediate stat change. */
export type RandomEventEffect =
  | { kind: "gold"; baseAmount: number }
  | { kind: "loot" }
  | { kind: "heal"; hpPct: number; mpPct: number }
  | { kind: "ambush" }
  | { kind: "toll"; hpCostPct: number; baseGoldReward: number }
  | { kind: "blessing" };

export interface RandomEventDef {
  id: string;
  label: string;
  description: string;
  /** Relative roll weight among events that rolled true at all - same
   *  cumulative-weight shape GateModifier's `weight` uses (#11). */
  weight: number;
  effect: RandomEventEffect;
}
