export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export interface PlayerStats {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  rank: Rank;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  strength: number;
  agility: number;
  statPoints: number;
  gatesCleared: number;
}

export interface ShadowRecord {
  id: string;
  name: string;
  sourceMonster: string;
  rank: Rank;
  power: number;
}

export interface SaveData {
  version: number;
  player: PlayerStats;
  shadows: ShadowRecord[];
  highestGateRank: Rank;
  updatedAt: number;
}

export interface MonsterTemplate {
  key: string;
  name: string;
  rank: Rank;
  color: number;
  maxHp: number;
  attack: number;
  speed: number;
  xpReward: number;
  extractChance: number; // 0..1 chance to become a shadow on kill
  scale: number;
}
