import type { EquipmentItem, GateDef, Rank } from "./types";

/** Ported from the Hunter Protocol design file; extended with a boss name
 *  per gate for the multi-wave encounter system (see waveCountForRank /
 *  statsForWave in store.ts). */
export const GATES_DATA: GateDef[] = [
  { id: "g1", rank: "E", name: "Crumbling Ruins", monsterName: "Goblin Scout", bossName: "Goblin Overlord", recommendedLevel: 1, baseHp: 55, baseAtk: 7, baseDef: 0, xp: 25 },
  { id: "g2", rank: "D", name: "Sunken Crypt", monsterName: "Orc Brute", bossName: "Orc Warchief", recommendedLevel: 4, baseHp: 95, baseAtk: 11, baseDef: 2, xp: 45 },
  { id: "g3", rank: "C", name: "Frost Hollow", monsterName: "Ice Wraith", bossName: "Ice Wraith Sovereign", recommendedLevel: 8, baseHp: 140, baseAtk: 15, baseDef: 4, xp: 70 },
  { id: "g4", rank: "B", name: "Red Cathedral", monsterName: "Blood Knight", bossName: "Blood Knight Commander", recommendedLevel: 13, baseHp: 195, baseAtk: 20, baseDef: 7, xp: 100 },
  { id: "g5", rank: "A", name: "Void Spire", monsterName: "Shadow Beast", bossName: "Shadow Beast Alpha", recommendedLevel: 19, baseHp: 260, baseAtk: 26, baseDef: 10, xp: 145 },
  { id: "g6", rank: "S", name: "Dragon's Maw", monsterName: "Ancient Wyrm", bossName: "Ancient Wyrm, Elder", recommendedLevel: 26, baseHp: 340, baseAtk: 34, baseDef: 14, xp: 200 }
];

/** Number of enemies (trash waves + a final boss) a gate throws at you in
 *  one run. Higher ranks are longer gauntlets. */
export const WAVE_COUNT_BY_RANK: Record<Rank, number> = {
  E: 3, D: 3, C: 4, B: 4, A: 5, S: 5
};

export function waveCountForGate(gate: GateDef): number {
  return WAVE_COUNT_BY_RANK[gate.rank];
}

/** Stat/XP scaling for a given wave (1-based) of a gate. Trash waves ramp
 *  up gradually ("easy to hard"); the final wave is the boss - a clear
 *  spike in every stat, with a bigger XP payout. */
export function statsForWave(gate: GateDef, waveIndex: number, totalWaves: number) {
  const isBoss = waveIndex === totalWaves;
  if (isBoss) {
    return {
      name: gate.bossName,
      hp: Math.round(gate.baseHp * 2.2),
      atk: Math.round(gate.baseAtk * 1.5),
      def: Math.round(gate.baseDef * 1.4) + 1,
      xp: Math.round(gate.xp * 1.5)
    };
  }
  const rampT = totalWaves > 2 ? (waveIndex - 1) / (totalWaves - 2) : 0; // 0 at wave 1, 1 at the last trash wave
  const scale = 1 + rampT * 0.5;
  return {
    name: gate.monsterName,
    hp: Math.round(gate.baseHp * scale),
    atk: Math.round(gate.baseAtk * scale),
    def: Math.round(gate.baseDef * scale),
    xp: Math.round(gate.xp * 0.35 * scale)
  };
}

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
