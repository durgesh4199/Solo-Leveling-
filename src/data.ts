import type { EquipmentItem, GateDef, Rank, SkillDef, WavePlanEntry } from "./types";

/** Ported from the Hunter Protocol design file; extended with a boss name
 *  per gate for the multi-wave encounter system (see buildWavePlan /
 *  statsForUnit below). */
export const GATES_DATA: GateDef[] = [
  { id: "g1", rank: "E", name: "Crumbling Ruins", monsterName: "Goblin Scout", bossName: "Goblin Overlord", recommendedLevel: 1, baseHp: 55, baseAtk: 7, baseDef: 0, xp: 25 },
  { id: "g2", rank: "D", name: "Sunken Crypt", monsterName: "Orc Brute", bossName: "Orc Warchief", recommendedLevel: 4, baseHp: 95, baseAtk: 11, baseDef: 2, xp: 45 },
  { id: "g3", rank: "C", name: "Frost Hollow", monsterName: "Ice Wraith", bossName: "Ice Wraith Sovereign", recommendedLevel: 8, baseHp: 140, baseAtk: 15, baseDef: 4, xp: 70 },
  { id: "g4", rank: "B", name: "Red Cathedral", monsterName: "Blood Knight", bossName: "Blood Knight Commander", recommendedLevel: 13, baseHp: 195, baseAtk: 20, baseDef: 7, xp: 100 },
  { id: "g5", rank: "A", name: "Void Spire", monsterName: "Shadow Beast", bossName: "Shadow Beast Alpha", recommendedLevel: 19, baseHp: 260, baseAtk: 26, baseDef: 10, xp: 145 },
  { id: "g6", rank: "S", name: "Dragon's Maw", monsterName: "Ancient Wyrm", bossName: "Ancient Wyrm, Elder", recommendedLevel: 26, baseHp: 340, baseAtk: 34, baseDef: 14, xp: 200 }
];

/** Total enemies (trash + the final boss) a gate throws at you in one run.
 *  Ramps 10 -> 20 across the six ranks. */
export const TOTAL_ENEMIES_BY_RANK: Record<Rank, number> = {
  E: 10, D: 12, C: 14, B: 16, A: 18, S: 20
};

/** Enemies fought simultaneously in one non-boss wave. */
export const GROUP_SIZE = 3;

export function totalEnemiesForGate(gate: GateDef): number {
  return TOTAL_ENEMIES_BY_RANK[gate.rank];
}

/** Splits a gate's trash-mob count into waves of up to GROUP_SIZE, plus a
 *  final solo boss wave. E.g. E-rank (10 total = 9 trash + boss) -> three
 *  waves of 3, then the boss. */
export function buildWavePlan(gate: GateDef): WavePlanEntry[] {
  const total = totalEnemiesForGate(gate);
  const trashCount = total - 1;
  const groupCount = Math.ceil(trashCount / GROUP_SIZE);
  const plan: WavePlanEntry[] = [];
  let unitCursor = 0;
  for (let i = 0; i < groupCount; i++) {
    const remaining = trashCount - i * GROUP_SIZE;
    const count = Math.min(GROUP_SIZE, remaining);
    plan.push({ count, isBoss: false, unitStart: unitCursor });
    unitCursor += count;
  }
  plan.push({ count: 1, isBoss: true, unitStart: unitCursor });
  return plan;
}

/** Stat/XP for one trash unit, ramping smoothly across the *whole* trash
 *  sequence (not per-wave) so a gate feels like one continuous escalation
 *  ("easy to hard") regardless of how it's chunked into groups.
 *
 *  A gate is now a 9-19 enemy gauntlet rather than the old 3-5, and HP/MP
 *  carry over the whole run - so per-unit output has to be tuned against
 *  *cumulative* damage across every wave, not any single fight. Both HP
 *  (kills land faster, fewer attacker-rounds accumulate) and per-unit
 *  attack (up to GROUP_SIZE hit every round) are scaled well down from a
 *  solo encounter's numbers. */
export function statsForUnit(gate: GateDef, globalIndex: number, trashCount: number) {
  const rampT = trashCount > 1 ? globalIndex / (trashCount - 1) : 0;
  const scale = 1 + rampT * 0.6;
  return {
    hp: Math.round(gate.baseHp * scale * 0.5),
    atk: Math.max(1, Math.round(gate.baseAtk * scale * 0.2)),
    def: Math.round(gate.baseDef * scale),
    xp: Math.round(gate.xp * 0.22 * scale)
  };
}

export function statsForBoss(gate: GateDef) {
  return {
    hp: Math.round(gate.baseHp * 2.6),
    atk: Math.round(gate.baseAtk * 1.5),
    def: Math.round(gate.baseDef * 1.4) + 1,
    xp: Math.round(gate.xp * 1.6)
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

/** Skills unlock progressively as the Hunter levels up. Attack/Guard/Potion
 *  are always available; these are the spendable-MP options. */
export const SKILLS: SkillDef[] = [
  {
    key: "dagger_rush", name: "Dagger Rush", icon: "flame", mpCost: 15, unlockLevel: 1,
    kind: "single", base: 14, scale: 1.6,
    description: "A heavy single-target strike."
  },
  {
    key: "piercing_thrust", name: "Piercing Thrust", icon: "sword", mpCost: 20, unlockLevel: 5,
    kind: "cleave", base: 10, scale: 1.3,
    description: "Skewers the two frontmost enemies."
  },
  {
    key: "shadow_execute", name: "Shadow Execute", icon: "skull", mpCost: 25, unlockLevel: 10,
    kind: "execute", base: 18, scale: 1.8,
    description: "Massive damage - doubled against a wounded target."
  },
  {
    key: "umbral_storm", name: "Umbral Storm", icon: "lightning", mpCost: 35, unlockLevel: 15,
    kind: "aoe", base: 12, scale: 1.4,
    description: "Strikes every enemy in the current wave."
  }
];

export function unlockedSkills(level: number): SkillDef[] {
  return SKILLS.filter((s) => s.unlockLevel <= level);
}
