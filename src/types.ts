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

export interface WavePlanEntry {
  count: number;
  isBoss: boolean;
  unitStart: number; // global trash-unit index this wave starts at (for stat ramp)
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

export type SkillKind = "single" | "cleave" | "execute" | "aoe";

export interface SkillDef {
  key: string;
  name: string;
  icon: string;
  mpCost: number;
  unlockLevel: number;
  kind: SkillKind;
  base: number;
  scale: number;
  description: string;
}

export type VfxKind = "slash" | "flurry" | null;
export type LungeSide = "player" | null;
export type FloatKind = "dmg" | "heal";

export interface FloatText {
  text: string;
  kind: FloatKind;
}

/** One enemy within the current wave's group. Non-boss waves share a name
 *  (battle.enemyName) and portrait (battle.monsterKey) - only their rolled
 *  stats differ - so per-unit state only needs to track combat state. */
export interface EnemyUnit {
  uid: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xp: number;
  alive: boolean;
  hit: boolean;
  vfx: VfxKind;
  lunging: boolean;
  floatText: FloatText | null;
  floatId: number;
  glow: boolean;
}

export type BattleResult = "wave-clear" | "gate-clear" | "defeat" | null;

export interface BattleState {
  gateId: string;
  gateName: string;
  monsterKey: string; // base monster type for this gate - used to pick portrait art
  enemyName: string;  // display name for the current wave (boss wave gets bossName)
  isBossWave: boolean;
  waveIndex: number; // 1-based
  totalWaves: number;
  enemies: EnemyUnit[];

  over: boolean;
  result: BattleResult;
  guarding: boolean;
  locked: boolean;
  playerHit: boolean;
  skillPanelOpen: boolean;

  vfxId?: number;
  vfxPlayer?: VfxKind;
  guardRing?: boolean;
  lunge?: LungeSide;
  flash?: boolean;

  floatPlayer?: FloatText | null;
  floatPlayerId?: number;
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
