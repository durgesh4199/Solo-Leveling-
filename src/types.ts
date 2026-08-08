export type Rank = "E" | "D" | "C" | "B" | "A" | "S";

/** One of six hand-drawn silhouette families a monster's portrait is built
 *  from - each gate rank has a signature archetype (see ARCHETYPE_BY_RANK
 *  in data.ts), so silhouette + rim-glow color tells you a monster's rank
 *  at a glance even across dozens of differently-named species. */
export type Archetype = "goblin" | "orc" | "wraith" | "knight" | "beast" | "wyrm";

export type Screen = "title" | "gates" | "battle" | "stats" | "shadows" | "inventory";

export type StatKey = "str" | "agi" | "int" | "vit" | "per";

/** One of the 5 Hunter Classes (see systems/classes/) - defined here
 *  rather than in systems/classes/types.ts because it's a small leaf
 *  value type `PlayerState` itself needs to reference, the same category
 *  as `StatKey`/`ItemSlot`/`Rank` above; `HunterClassDef`/`ClassBonus`
 *  (the actual content/definitions) stay in systems/classes/types.ts and
 *  import this rather than redefining it. */
export type HunterClassId = "fighter" | "mage" | "tank" | "assassin" | "healer";

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
  /** Chosen once, permanently (no respec - see Game.chooseHunterClass),
   *  starting at CLASS_UNLOCK_LEVEL. `null`/`undefined` both mean "no
   *  class chosen yet" - a save from before this item predates the field
   *  entirely, so every read site treats it as falsy rather than
   *  requiring a strict `=== null` (no migration/backfill needed since
   *  `PlayerState` is already persisted whole). */
  hunterClass: HunterClassId | null;
  /** The Hunter's *officially confirmed* rank (#10, Promotion Exams) -
   *  distinct from `rankForLevel(level)` in data.ts, which is only the
   *  rank a Hunter's level alone would *qualify* them to test for. Every
   *  gameplay/display use of "what rank is this Hunter" (Shop stock
   *  quality, a newly-Arisen Shadow's rank, the portrait aura/rank tag,
   *  "reach rank X" Title/Achievement conditions) reads this field, not
   *  `rankForLevel` - a Hunter stays at their last confirmed rank, no
   *  matter how far level races ahead, until they pass the next
   *  Promotion Exam (see Game.completePromotionExam in store.ts).
   *  Unlike `hunterClass`, an old save predating this field can't just
   *  treat a missing value as a safe default (there's no falsy "no rank"
   *  state) - `continueSave()` backfills it from `rankForLevel(level)`
   *  instead, so an existing character keeps the rank their level
   *  already implied rather than being knocked back to E. */
  rank: Rank;
}

export interface GateDef {
  id: string;
  rank: Rank;
  name: string;
  /** Exactly 5 trash species names fought within this gate - a random one
   *  is assigned to each spawned trash unit (see makeEnemies in store.ts),
   *  all rendered with this gate rank's archetype silhouette. */
  enemyTypes: string[];
  bossName: string;
  recommendedLevel: number;
  baseHp: number;
  baseAtk: number;
  baseDef: number;
  xp: number;
  /** Marks one of the 5 Promotion Exam trial gates (#10, EXAM_GATES_DATA
   *  in data.ts) rather than one of the 20 explorable gates - collapses
   *  `totalEnemiesForGate` to a solo boss fight (see data.ts) and routes
   *  a boss kill through `Game.completePromotionExam` instead of the
   *  normal gate-clear path. Absent/false for every explorable gate. */
  isPromotionExam?: boolean;
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
 *  max-HP/max-MP bonuses (not funneled through a stat point); `crit` is a
 *  flat percentage-point bonus to crit chance. The rest are combat-round
 *  affixes, each with a real mechanical effect (see Game.equipmentAffixSum
 *  and its call sites in store.ts) rather than a passive stat bump:
 *  `lifeSteal` heals a % of damage the player's own hits deal, `attackSpeed`
 *  is a % chance of an immediate follow-up strike on Attack, `manaRegen`
 *  restores flat MP once a round completes, `fireDamage` adds flat bonus
 *  damage to every player hit (Attack and Skills alike). */
export type AffixKey = StatKey | "hp" | "mp" | "crit" | "lifeSteal" | "attackSpeed" | "manaRegen" | "fireDamage";
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
  /** Which of the 6 passive/active skill sets this Shadow uses (see
   *  src/systems/shadows/) - set once at Arise time from the source
   *  monster's gate-rank archetype, stored explicitly rather than
   *  re-derived from `rank` every read. */
  archetype: Archetype;
  /** Base power at Arise time - stays a stable historical/rarity
   *  indicator. What combat and Power Score actually use is
   *  `effectiveShadowPower()` (base + level growth + loyalty bonus),
   *  mirroring the player's own raw-stat-vs-effectiveStat split. */
  power: number;
  level: number;
  xp: number;
  /** 0-100, grows +1 per wave cleared while deployed, never decays -
   *  a standing record of "how long we've fought together", not a
   *  punishable resource. Feeds a small effectiveShadowPower bonus and
   *  the derived Mood label (see shadowMood() in systems/shadows/). */
  loyalty: number;
  battlesFought: number;
  /** How many times this Shadow has evolved (0 = its original Arise form).
   *  Evolving advances `rank`/`archetype`/`power` to the next tier and
   *  resets `level`/`xp` so growth keeps meaning something in the new,
   *  stronger form - see Game.evolveShadow() in store.ts. `name`/`type`/
   *  `loyalty`/`battlesFought` (the Shadow's identity and history) carry
   *  over unchanged across an evolution. */
  evolutionStage: number;
  /** Gear equipped directly on this Shadow, independent of the Hunter's
   *  own `PlayerState.equipment` - the same `LootItem`/`ItemSlot` system,
   *  drawn from and returned to the shared Bag (see Game.equipShadowItem/
   *  unequipShadowItem in store.ts), so a piece of gear is worn by either
   *  the Hunter or one Shadow, never both at once. Core-stat affixes fold
   *  into `effectiveShadowPower()`; the combat-round affixes (crit/
   *  lifeSteal/attackSpeed/manaRegen/fireDamage) apply directly inside
   *  Game.companionStrike, mirroring how the Hunter's own gear works. */
  equipment: Partial<Record<ItemSlot, LootItem>>;
  deployed: boolean;
}

/** Rolled once when a gate run starts - a random modifier that makes each
 *  attempt at the same gate feel different, not a fixed grind. #11
 *  (Dungeon Modifiers) widened this from 4 knobs to 7, and gave each
 *  non-"none" entry a relative `weight` so the tougher/rarer ones roll
 *  less often than the mild ones instead of every real modifier being
 *  equally likely (see rollGateModifier in data.ts). */
export interface GateModifier {
  key: string;
  label: string;
  description: string;
  xpMult: number;
  loot: number; // additive to base loot-drop chance
  enemyAtkMult: number;
  enemyHpMult: number;
  enemyDefMult: number;
  eliteChanceBonus: number; // additive to the base per-trash-unit elite chance
  goldMult: number;
  /** Relative roll weight among the non-"none" modifiers - unused for
   *  "none" itself, which is rolled separately (rollGateModifier's own
   *  flat ~40% chance of an unmodified run). */
  weight: number;
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

/** One enemy within the current wave's group. Each trash unit is rolled its
 *  own species name (one of the gate's 5 enemyTypes, each with its own
 *  stat-weight flavor - see TYPE_VARIANTS in data.ts); the whole wave still
 *  shares one portrait silhouette (battle.rank's archetype). */
export interface EnemyUnit {
  uid: string;
  name: string;
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

export type BattleResult = "wave-clear" | "gate-clear" | "defeat" | "exam-pass" | null;

export interface BattleState {
  gateId: string;
  gateName: string;
  rank: Rank; // gate's rank - drives the archetype/portrait + rim-glow for every unit this run
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

/** Meta-progression: lifetime counters (kills, gold earned, ...) that
 *  outlive any single run, plus which Titles/Achievements they've unlocked
 *  so far. See src/systems/progress/, src/systems/titles/,
 *  src/systems/achievements/ - this slice is intentionally just data
 *  (counter values + unlocked-id lists); the definitions/condition logic
 *  live in those system folders, not here. */
export interface ProgressState {
  counters: Record<string, number>;
  unlockedTitleIds: string[];
  equippedTitleId: string | null;
  unlockedAchievementIds: string[];
}

/** Talent Tree state (see src/systems/talents/) - `points` is unspent
 *  currency (like PlayerState.statPoints, but spent on this tree
 *  instead), `unlockedIds` is which nodes have been permanently learned.
 *  Kept as its own top-level slice rather than folded into `player` or
 *  `progress`: it's spent currency + a manual player choice (like
 *  `player.statPoints`), not a counter-driven auto-unlock (like
 *  `progress`'s Title/Achievement lists), so it doesn't fit either
 *  existing slice's semantics cleanly. */
export interface TalentState {
  points: number;
  unlockedIds: string[];
}

/** A brief, app-wide notification (achievement/title unlock, etc.) that
 *  isn't tied to being inside a battle - battle already has its own toast
 *  on BattleState for in-run messages. Rendered by the app shell
 *  (screens/index.ts) so it's visible no matter which screen is open. */
export interface GlobalToast {
  id: number;
  text: string;
  kind: "achievement" | "title" | "info" | "shadow" | "promotion";
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
  progress: ProgressState;
  talents: TalentState;
  globalToast?: GlobalToast | null;
}
