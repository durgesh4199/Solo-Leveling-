import type { MonsterTemplate, Rank } from "../types";

/**
 * Original monster roster (not tied to any specific licensed IP names).
 * Each Gate rank pulls its spawn pool from here.
 */
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    key: "sewer_rat",
    name: "Sewer Fang",
    rank: "E",
    color: 0x8b8b3f,
    maxHp: 18,
    attack: 3,
    speed: 60,
    xpReward: 6,
    extractChance: 0.08,
    scale: 0.8
  },
  {
    key: "goblin",
    name: "Cave Goblin",
    rank: "E",
    color: 0x6fae4a,
    maxHp: 30,
    attack: 5,
    speed: 70,
    xpReward: 10,
    extractChance: 0.1,
    scale: 1
  },
  {
    key: "hollow_soldier",
    name: "Hollow Soldier",
    rank: "D",
    color: 0x8892a6,
    maxHp: 55,
    attack: 9,
    speed: 75,
    xpReward: 22,
    extractChance: 0.12,
    scale: 1.1
  },
  {
    key: "ash_wolf",
    name: "Ashen Wolf",
    rank: "D",
    color: 0xb35b3f,
    maxHp: 46,
    attack: 11,
    speed: 110,
    xpReward: 24,
    extractChance: 0.1,
    scale: 1
  },
  {
    key: "ghoul",
    name: "Crypt Ghoul",
    rank: "C",
    color: 0x6b8f3f,
    maxHp: 90,
    attack: 16,
    speed: 85,
    xpReward: 42,
    extractChance: 0.14,
    scale: 1.15
  },
  {
    key: "stone_golem",
    name: "Stone Golem",
    rank: "C",
    color: 0x9a8a6b,
    maxHp: 140,
    attack: 14,
    speed: 45,
    xpReward: 48,
    extractChance: 0.13,
    scale: 1.4
  },
  {
    key: "blood_knight",
    name: "Blood Knight",
    rank: "B",
    color: 0x8f2e2e,
    maxHp: 190,
    attack: 24,
    speed: 95,
    xpReward: 85,
    extractChance: 0.16,
    scale: 1.25
  },
  {
    key: "wraith",
    name: "Void Wraith",
    rank: "B",
    color: 0x5a3f8f,
    maxHp: 160,
    attack: 28,
    speed: 120,
    xpReward: 90,
    extractChance: 0.15,
    scale: 1.1
  },
  {
    key: "drake",
    name: "Frost Drake",
    rank: "A",
    color: 0x3f8fae,
    maxHp: 320,
    attack: 40,
    speed: 100,
    xpReward: 160,
    extractChance: 0.18,
    scale: 1.6
  },
  {
    key: "abyss_lord",
    name: "Abyssal Warlord",
    rank: "A",
    color: 0x6b2e8f,
    maxHp: 380,
    attack: 46,
    speed: 90,
    xpReward: 180,
    extractChance: 0.2,
    scale: 1.5
  },
  {
    key: "monarch_shade",
    name: "Monarch's Shade",
    rank: "S",
    color: 0x1f1030,
    maxHp: 650,
    attack: 65,
    speed: 105,
    xpReward: 320,
    extractChance: 0.25,
    scale: 1.8
  }
];

export function monstersForRank(rank: Rank): MonsterTemplate[] {
  const pool = MONSTER_TEMPLATES.filter((m) => m.rank === rank);
  return pool.length > 0 ? pool : MONSTER_TEMPLATES.filter((m) => m.rank === "E");
}
