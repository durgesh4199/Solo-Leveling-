export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

export type Screen = "title" | "gates" | "battle" | "stats" | "shadows" | "inventory";

export type StatKey = "str" | "agi" | "int" | "vit" | "per";

export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  statPoints: number;
  str: number;
  agi: number;
  int: number;
  vit: number;
  per: number;
}

export interface GateDef {
  id: string;
  rank: Rank;
  name: string;
  monsterName: string;
  bossName: string;
  recommendedLevel: number;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  xp: number;
}

export interface EquipmentItem {
  icon: string;
  name: string;
  slot: string;
  bonus: string;
}

export interface ShadowRecord {
  id: string;
  name: string;
  rank: Rank;
  type: string;
}

export type VfxKind = "slash" | "flurry" | null;
export type LungeSide = "player" | "enemy" | null;
export type FloatKind = "dmg" | "heal";

export interface FloatText {
  text: string;
  kind: FloatKind;
}

export type BattleResult = "victory" | "defeat" | null;

export interface BattleState {
  gateId: string;
  gateName: string;
  monsterKey: string; // base monster type for this gate - used to pick portrait art
  enemyName: string;  // display name; the boss wave gets the gate's bossName
  enemyHp: number;
  enemyMaxHp: number;
  enemyAtk: number;
  enemyDef: number;
  xpReward: number;
  waveIndex: number; // 1-based
  totalWaves: number;
  isBoss: boolean;
  over: boolean;
  result: BattleResult;
  guarding: boolean;
  locked: boolean;
  enemyHit: boolean;
  playerHit: boolean;

  vfxId?: number;
  vfxEnemy?: VfxKind;
  vfxPlayer?: VfxKind;
  guardRing?: boolean;
  lunge?: LungeSide;
  flash?: boolean;

  floatEnemy?: FloatText | null;
  floatEnemyId?: number;
  floatPlayer?: FloatText | null;
  floatPlayerId?: number;
  enemyGlow?: boolean;
  playerGlow?: boolean;
}

export interface GameState {
  screen: Screen;
  player: PlayerState;
  gatesCleared: Record<string, boolean>;
  shadowArmy: ShadowRecord[];
  inventory: { potions: number };
  battle: BattleState | null;
}
