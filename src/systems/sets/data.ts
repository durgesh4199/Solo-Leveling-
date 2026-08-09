import type { ItemSlot, LootItem, PlayerState, Rank, StatKey } from "../../types";
import { generateSetPiece } from "../../data";
import { createRegistry } from "../../services/registry";
import type { EquipmentSetDef, SetBonus } from "./types";

const SLOTS: ItemSlot[] = ["weapon", "helmet", "chest", "legs", "ring", "amulet"];

/** Starter roster - 3 sets, one per broad build identity (offense/
 *  defense/utility, the same 3-way split the Talent Tree's branches
 *  already use), each covering all 6 gear slots so committing to a set
 *  is a real alternative to picking the single best-rolled affix per
 *  slot, not a side-grade. Every piece is always "legendary" rarity
 *  (generateSetPiece) - a set piece is meant to read as a real find the
 *  moment it drops, not something that needs a lucky rarity roll on top
 *  of the drop itself. */
export const EQUIPMENT_SETS: EquipmentSetDef[] = [
  {
    id: "vanguard", name: "Vanguard's Warplate",
    description: "Forged for Hunters who close the distance and don't look back.",
    pieces: {
      weapon: { slot: "weapon", name: "Vanguard's Greatblade", affixKeys: ["str"], icon: "sword" },
      helmet: { slot: "helmet", name: "Vanguard's Warhelm", affixKeys: ["str"], icon: "helmet" },
      chest: { slot: "chest", name: "Vanguard's Breastplate", affixKeys: ["str", "hp"], icon: "shield-checkered" },
      legs: { slot: "legs", name: "Vanguard's Greaves", affixKeys: ["str"], icon: "boots" },
      ring: { slot: "ring", name: "Vanguard's Signet", affixKeys: ["crit"], icon: "circle-dashed" },
      amulet: { slot: "amulet", name: "Vanguard's Warseal", affixKeys: ["str"], icon: "moon-stars" }
    },
    thresholds: [
      { count: 2, bonus: { kind: "statPct", stat: "str", value: 0.04 }, bonusText: "+4% STR" },
      { count: 4, bonus: { kind: "critFlat", value: 0.04 }, bonusText: "+4% Crit" },
      { count: 6, bonus: { kind: "statPct", stat: "str", value: 0.08 }, bonusText: "+8% STR" }
    ]
  },
  {
    id: "warden", name: "Warden's Bulwark",
    description: "Every piece is a promise: nothing gets past this line.",
    pieces: {
      weapon: { slot: "weapon", name: "Warden's Maul", affixKeys: ["vit"], icon: "sword" },
      helmet: { slot: "helmet", name: "Warden's Greathelm", affixKeys: ["vit"], icon: "helmet" },
      chest: { slot: "chest", name: "Warden's Aegis Plate", affixKeys: ["vit", "hp"], icon: "shield-checkered" },
      legs: { slot: "legs", name: "Warden's Legguards", affixKeys: ["vit"], icon: "boots" },
      ring: { slot: "ring", name: "Warden's Oathband", affixKeys: ["int"], icon: "circle-dashed" },
      amulet: { slot: "amulet", name: "Warden's Bulwark Seal", affixKeys: ["hp"], icon: "moon-stars" }
    },
    thresholds: [
      { count: 2, bonus: { kind: "statPct", stat: "vit", value: 0.04 }, bonusText: "+4% VIT" },
      { count: 4, bonus: { kind: "statPct", stat: "int", value: 0.04 }, bonusText: "+4% INT" },
      { count: 6, bonus: { kind: "allStatsPct", value: 0.05 }, bonusText: "+5% All Stats" }
    ]
  },
  {
    id: "nightstalker", name: "Nightstalker's Guise",
    description: "By the time they notice, it's already too late.",
    pieces: {
      weapon: { slot: "weapon", name: "Nightstalker's Fangs", affixKeys: ["agi"], icon: "sword" },
      helmet: { slot: "helmet", name: "Nightstalker's Cowl", affixKeys: ["per"], icon: "helmet" },
      chest: { slot: "chest", name: "Nightstalker's Wraps", affixKeys: ["agi"], icon: "shield-checkered" },
      legs: { slot: "legs", name: "Nightstalker's Treads", affixKeys: ["agi"], icon: "boots" },
      ring: { slot: "ring", name: "Nightstalker's Loop", affixKeys: ["crit"], icon: "circle-dashed" },
      amulet: { slot: "amulet", name: "Nightstalker's Charm", affixKeys: ["per"], icon: "moon-stars" }
    },
    thresholds: [
      { count: 2, bonus: { kind: "statPct", stat: "agi", value: 0.04 }, bonusText: "+4% AGI" },
      { count: 4, bonus: { kind: "goldPct", value: 0.06 }, bonusText: "+6% Gold" },
      { count: 6, bonus: { kind: "critFlat", value: 0.06 }, bonusText: "+6% Crit" }
    ]
  }
];

export const EQUIPMENT_SET_REGISTRY = createRegistry(EQUIPMENT_SETS, (s) => s.id, "Equipment Set");

/** Chance a real Gate boss clear (the same restriction Relics use - never
 *  trash, never a Promotion Exam, never a Tower floor, see
 *  Game.onWaveCleared) also drops a random Equipment Set piece into the
 *  Bag, independently of that same clear's Relic-drop roll. No ownership
 *  tracking the way Relics have (RelicState.ownedIds) - a set piece is a
 *  real LootItem sitting in the Bag/equipment like any other, so a second
 *  copy is no different from any other loot duplicate: sell it like one. */
export const SET_DROP_CHANCE = 0.1;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rollSetPieceDrop(rank: Rank): LootItem {
  const set = pick(EQUIPMENT_SETS);
  const slot = pick(SLOTS);
  const piece = set.pieces[slot];
  return generateSetPiece(rank, slot, piece.name, piece.affixKeys, piece.icon, set.id);
}

/** How many of a given set's 6 pieces the Hunter currently has equipped -
 *  a plain `.setId` tally against `player.equipment`, not a separately
 *  tracked count, so it can never drift from what's actually worn. */
export function equippedSetCounts(equipment: PlayerState["equipment"]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of Object.values(equipment)) {
    if (!item?.setId) continue;
    counts[item.setId] = (counts[item.setId] ?? 0) + 1;
  }
  return counts;
}

/** Every threshold currently met, across every set with any pieces
 *  equipped - cumulative per set (see SetThreshold's doc comment), not
 *  just the single highest tier reached. */
function activeBonuses(equipment: PlayerState["equipment"]): SetBonus[] {
  const counts = equippedSetCounts(equipment);
  const bonuses: SetBonus[] = [];
  for (const [setId, count] of Object.entries(counts)) {
    const def = EQUIPMENT_SET_REGISTRY.get(setId);
    if (!def) continue;
    for (const t of def.thresholds) {
      if (count >= t.count) bonuses.push(t.bonus);
    }
  }
  return bonuses;
}

export function setStatPct(equipment: PlayerState["equipment"], stat: StatKey): number {
  return activeBonuses(equipment).reduce((sum, b) => {
    if (b.kind === "statPct" && b.stat === stat) return sum + b.value;
    if (b.kind === "allStatsPct") return sum + b.value;
    return sum;
  }, 0);
}

export function setCritFlat(equipment: PlayerState["equipment"]): number {
  return activeBonuses(equipment).reduce((sum, b) => sum + (b.kind === "critFlat" ? b.value : 0), 0);
}

export function setXpPct(equipment: PlayerState["equipment"]): number {
  return activeBonuses(equipment).reduce((sum, b) => sum + (b.kind === "xpPct" ? b.value : 0), 0);
}

export function setGoldPct(equipment: PlayerState["equipment"]): number {
  return activeBonuses(equipment).reduce((sum, b) => sum + (b.kind === "goldPct" ? b.value : 0), 0);
}
