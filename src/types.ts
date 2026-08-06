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
  gold: number;
  equipment: Partial<Record<ItemSlot, LootItem>>;
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

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic" | "godly";
export type ItemSlot = "weapon" | "helmet" | "chest" | "legs" | "ring" | "amulet";

/** What a single roll on an item actually grants. The five core stats
 *  work like before (folds into effectiveStat); `hp`/`mp` are flat, direct
 *  max-HP/max-MP bonuses (not funneled through a stat point), and `crit`
 *  is a flat percentage-point bonus to crit chance. */
export type AffixKey = StatKey | "hp" | "mp" | "crit";
export interface ItemAffix {
  key: AffixKey;
  value: number;
}

export interface LootItem {
  id: string;
  name: string;
  slot: ItemSlot;
  rarity: ItemRarity;
  /** 1 (common/uncommon) to 4 (godly) rolls, each a different affix key. */
  affixes: ItemAffix[];
  icon: string;
}

export interface ShadowRecord {
  id: string;
  name: string;
  rank: Rank;
  type: string;
  power: number;
  deployed: boolean;
}

/** Rolled once when a gate run starts - a random modifier that makes each
 *  attempt at the same gate feel different, not a fixed grind. */
export interface GateModifier {
  key: string;
  label: string;
  description: string;
  xpMult: number;
  loot: number; // additive to base loot-drop chance
  enemyAtkMult: number;
  enemyHpMult: number;
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

export type VfxKind = "slash" | "flurry" | "smash" | null;
export type LungeSide = "player" | null;
export type FloatKind = "dmg" | "heal" | "crit" | "miss";
export type EnemyAction = "attack" | "guard" | "special";

export type PotionTier = "minor" | "greater" | "supreme";

/** A consumable's definition - HP/MP restoration, three tiers apiece so
 *  there's a cheap early option and a real late-game one. */
export interface PotionDef {
  id: string;
  name: string;
  kind: "hp" | "mp";
  tier: PotionTier;
  amount: number;
  cost: number;
  icon: string;
}

export interface FloatText {
  text: string;
  kind: FloatKind;
}

/** One enemy within the current wave's group. Non-boss waves share a name
 *  (battle.enemyName) and portrait (battle.monsterKey) - only their rolled
 *  stats and elite status differ - so per-unit state only needs to track
 *  combat state. */
export interface EnemyUnit {
  uid: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  xp: number;
  gold: number;
  isElite: boolean;
  alive: boolean;
  hit: boolean;
  vfx: VfxKind;
  lunging: boolean;
  floatText: FloatText | null;
  floatId: number;
  glow: boolean;
  /** Rounds left where a hit against this unit is reduced - set when the
   *  enemy AI chooses to block instead of attacking. */
  guardRounds: number;
}

export interface BattleToast {
  text: string;
  kind: "loot" | "gold" | "info";
  rarity?: ItemRarity;
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
  modifier: GateModifier | null;

  over: boolean;
  result: BattleResult;
  /** Rounds of incoming-damage reduction left on the player, rolled 1-3
   *  each time Guard is used. 0 = not guarding. */
  guardRounds: number;
  locked: boolean;
  playerHit: boolean;
  skillPanelOpen: boolean;
  itemPanelOpen: boolean;

  vfxId?: number;
  vfxPlayer?: VfxKind;
  guardRing?: boolean;
  lunge?: LungeSide;
  flash?: boolean;

  floatPlayer?: FloatText | null;
  floatPlayerId?: number;
  playerGlow?: boolean;

  /** The deployed Shadow's own attack animation, separate from the
   *  player's so both can visibly strike in the same beat. */
  shadowLunge?: boolean;
  shadowVfxId?: number;

  toast?: BattleToast | null;
  toastId?: number;
}

export interface GameState {
  screen: Screen;
  player: PlayerState;
  gatesCleared: Record<string, boolean>;
  shadowArmy: ShadowRecord[];
  /** Potion id (see PotionDef) -> count owned. */
  inventory: { potions: Record<string, number> };
  bag: LootItem[];
  /** The equipment Shop's current stock - rerolls (for gold, or free every
   *  10 real minutes) rather than regenerating on every visit, so it's a
   *  real "what's in stock right now" decision instead of an infinite
   *  vending machine. `lastRerollAt` is a Date.now() timestamp. */
  shop: { stock: LootItem[]; rerollCost: number; lastRerollAt: number };
  battle: BattleState | null;
}
