import type { AffixKey, ItemSlot, StatKey } from "../../types";

/** A Set threshold's passive effect - the same 5-kind shape Title/Talent/
 *  Relic bonuses already use, duplicated for the same "unrelated systems,
 *  shared shape" reason RelicBonus already duplicates TalentBonus/
 *  TitleBonus rather than importing either. */
export type SetBonus =
  | { kind: "statPct"; stat: StatKey; value: number }
  | { kind: "allStatsPct"; value: number }
  | { kind: "xpPct"; value: number }
  | { kind: "goldPct"; value: number }
  | { kind: "critFlat"; value: number };

/** One equip-count threshold (2/4/6 pieces of the same set worn) and the
 *  bonus that turns on once it's met. Cumulative, not "replace the
 *  previous tier" - at 4 pieces equipped, both the 2pc and 4pc bonus are
 *  active at once, so committing deeper into one set over mixing loose
 *  pieces keeps paying off at every step, not just the last one. */
export interface SetThreshold {
  count: number;
  bonus: SetBonus;
  bonusText: string;
}

/** A single set piece's fixed identity - name/slot/icon never change, and
 *  neither does *which* affix keys it rolls (that's the whole point of a
 *  named set piece: it's always recognizably "this"), but the numeric
 *  value of each affix still scales with the rank it drops at, via
 *  generateSetPiece in data.ts reusing generateLoot's own rank-scaling
 *  formula rather than a second one baked in as flat numbers here. */
export interface SetPieceDef {
  slot: ItemSlot;
  name: string;
  affixKeys: AffixKey[];
  icon: string;
}

export interface EquipmentSetDef {
  id: string;
  name: string;
  description: string;
  pieces: Record<ItemSlot, SetPieceDef>;
  thresholds: SetThreshold[];
}
