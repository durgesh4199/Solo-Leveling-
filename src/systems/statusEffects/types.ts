/** The mechanical shape a status effect has - what its per-round tick or
 *  passive presence actually does. A small, reusable set of kinds, the
 *  same "few kinds, many named/flavored entries" shape TitleBonus/
 *  TalentBonus/RelicBonus/SetBonus already use - e.g. Weakness and Attack
 *  Up are both `damageDealtPct`, just tuned with opposite-sign
 *  `baseMagnitude` on their own StatusEffectDef, not two separate kinds. */
export type StatusEffectKind =
  | { type: "dot"; healingReducedPct?: number }
  | { type: "hot" }
  | { type: "shield" }
  | { type: "stun" }
  | { type: "chanceToSkipAction" }
  | { type: "silence" }
  | { type: "damageDealtPct" }
  | { type: "damageTakenPct" }
  | { type: "critChanceFlat" };

/** How re-applying the SAME status to a unit that already has it active
 *  behaves. */
export type StatusStackRule =
  | { kind: "stack"; maxStacks: number }
  | { kind: "refresh" }
  | { kind: "ignore" };

export interface StatusEffectDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Drives UI color (green/gold vs red) - a separate flag from `kind`,
   *  not a redundant taxonomy: a debuff and a buff can share a kind
   *  (damageDealtPct) and still need opposite treatment here. */
  positive: boolean;
  defaultDuration: number;
  stackRule: StatusStackRule;
  kind: StatusEffectKind;
  /** The tuned, fixed strength of one application - flat damage/heal per
   *  tick, a signed percentage, a flat absorb pool, a flat crit% bump.
   *  Always `def.baseMagnitude` verbatim when applied, the same "small,
   *  fixed, hand-tuned constant" shape every other bonus system in the
   *  codebase already uses (Talent/Relic/Set bonuses are never
   *  dynamically scaled off the source either) - not read for stun/
   *  silence, which are pure boolean gates. */
  baseMagnitude: number;
}
