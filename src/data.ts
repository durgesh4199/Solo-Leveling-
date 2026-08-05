import type { EquipmentItem, GateDef, Rank } from "./types";

/** Ported 1:1 from the Hunter Protocol design file. */
export const GATES_DATA: GateDef[] = [
  { id: "g1", rank: "E", name: "Crumbling Ruins", monsterName: "Goblin Scout", recommendedLevel: 1, baseHp: 55, baseAtk: 7, baseDef: 0, xp: 25 },
  { id: "g2", rank: "D", name: "Sunken Crypt", monsterName: "Orc Brute", recommendedLevel: 4, baseHp: 95, baseAtk: 11, baseDef: 2, xp: 45 },
  { id: "g3", rank: "C", name: "Frost Hollow", monsterName: "Ice Wraith", recommendedLevel: 8, baseHp: 140, baseAtk: 15, baseDef: 4, xp: 70 },
  { id: "g4", rank: "B", name: "Red Cathedral", monsterName: "Blood Knight", recommendedLevel: 13, baseHp: 195, baseAtk: 20, baseDef: 7, xp: 100 },
  { id: "g5", rank: "A", name: "Void Spire", monsterName: "Shadow Beast", recommendedLevel: 19, baseHp: 260, baseAtk: 26, baseDef: 10, xp: 145 },
  { id: "g6", rank: "S", name: "Dragon's Maw", monsterName: "Ancient Wyrm", recommendedLevel: 26, baseHp: 340, baseAtk: 34, baseDef: 14, xp: 200 }
];

export const RANK_TAG_CLASS: Record<Rank, string> = {
  E: "tag-neutral", D: "tag-neutral", C: "tag-outline", B: "tag-outline", A: "tag-accent-2", S: "tag-accent"
};

export function rankForLevel(level: number): Rank {
  if (level >= 26) return "S";
  if (level >= 19) return "A";
  if (level >= 13) return "B";
  if (level >= 8) return "C";
  if (level >= 4) return "D";
  return "E";
}

export const EQUIPMENT: EquipmentItem[] = [
  { icon: "sword", name: "Dagger of the Depths", slot: "Weapon", bonus: "+8 STR" },
  { icon: "shield-checkered", name: "Reinforced Leather", slot: "Armor", bonus: "+6 VIT" },
  { icon: "circle-dashed", name: "Band of Focus", slot: "Ring", bonus: "+4 PER" }
];

export const STAT_DEFS: { key: "str" | "agi" | "int" | "vit" | "per"; label: string }[] = [
  { key: "str", label: "STR — Strength" },
  { key: "agi", label: "AGI — Agility" },
  { key: "int", label: "INT — Intelligence" },
  { key: "vit", label: "VIT — Vitality" },
  { key: "per", label: "PER — Perception" }
];
