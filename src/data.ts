import type { AffixKey, GateDef, GateModifier, ItemAffix, ItemRarity, ItemSlot, LootItem, PotionDef, Rank, SkillDef, StatKey, WavePlanEntry } from "./types";

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
    // 0.3 (was 0.22) - levels come noticeably faster across a run.
    xp: Math.round(gate.xp * 0.3 * scale)
  };
}

export function statsForBoss(gate: GateDef) {
  return {
    hp: Math.round(gate.baseHp * 2.6),
    atk: Math.round(gate.baseAtk * 1.5),
    def: Math.round(gate.baseDef * 1.4) + 1,
    // 2.0 (was 1.6) - the boss kill is a real level-up moment.
    xp: Math.round(gate.xp * 2.0)
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

/** Every gate/rank an item can drop scaled against - keeps loot power in
 *  step with how far into the game (E->S) it dropped. */
const RANK_INDEX: Record<Rank, number> = { E: 0, D: 1, C: 2, B: 3, A: 4, S: 5 };

/** Added on top of a roll's source bonus (elite/boss/shop - see
 *  rollRarity callers) so *how far into the game you are* also improves
 *  rarity odds, not just an item's raw power - an S-rank kill has a real
 *  shot at the top tiers an E-rank kill doesn't, on top of hitting harder
 *  numbers either way. */
const RANK_RARITY_BONUS: Record<Rank, number> = { E: 0, D: 0.05, C: 0.1, B: 0.15, A: 0.2, S: 0.25 };

/** Seven tiers, common up to godly. `statMult` scales every affix an item
 *  rolls (see rollAffixValue); `weight` is its base share of a roll before
 *  any luck bonus is applied - legendary/mythic/godly are deliberately
 *  thin at the base rate (3% / 0.8% / 0.1%) so they stay a real event even
 *  after a long grind; bonuses (elite/boss/rank/shop) are what actually
 *  make them reachable. */
export const RARITY_META: Record<ItemRarity, { label: string; color: string; weight: number; statMult: number }> = {
  common: { label: "Common", color: "#9397ab", weight: 0.4, statMult: 1 },
  uncommon: { label: "Uncommon", color: "#7fd88f", weight: 0.27, statMult: 1.35 },
  rare: { label: "Rare", color: "#6fa8f5", weight: 0.18, statMult: 1.8 },
  epic: { label: "Epic", color: "#b57bfa", weight: 0.11, statMult: 2.5 },
  legendary: { label: "Legendary", color: "#f5c451", weight: 0.03, statMult: 3.4 },
  mythic: { label: "Mythic", color: "#ff6b5b", weight: 0.008, statMult: 4.6 },
  godly: { label: "Godly", color: "#fef6e4", weight: 0.001, statMult: 6.5 }
};
const RARITY_ORDER: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "godly"];

/** How many affix rolls an item gets, by rarity - the higher the tier, the
 *  more of the "and more" (HP/MP/crit, on top of the core stats) shows up
 *  on a single piece. */
const AFFIX_COUNT_BY_RARITY: Record<ItemRarity, number> = {
  common: 1, uncommon: 1, rare: 2, epic: 2, legendary: 3, mythic: 3, godly: 4
};

const SLOT_ICON: Record<ItemSlot, string> = {
  weapon: "sword", helmet: "helmet", chest: "shield-checkered", legs: "boots", ring: "circle-dashed", amulet: "moon-stars"
};
const SLOT_BASES: Record<ItemSlot, string[]> = {
  weapon: ["Dagger", "Blade", "Fang", "Cleaver", "Piercer"],
  helmet: ["Helm", "Hood", "Circlet", "Visor", "Crown"],
  chest: ["Leather", "Mail", "Plate", "Cloak", "Hide"],
  legs: ["Greaves", "Leggings", "Chausses", "Wraps", "Guards"],
  ring: ["Band", "Loop", "Signet", "Ring"],
  amulet: ["Amulet", "Pendant", "Talisman", "Charm"]
};
const STAT_PREFIX: Record<StatKey, string[]> = {
  str: ["Brutal", "Savage", "Cruel"],
  agi: ["Swift", "Nimble", "Fleet"],
  int: ["Arcane", "Runic", "Mystic"],
  vit: ["Sturdy", "Vital", "Stalwart"],
  per: ["Keen", "Watchful", "Sharp"]
};
/** Used when an item's chosen "primary" affix is HP/MP/crit rather than a
 *  core stat - those don't have a themed prefix pool of their own. */
const GENERIC_PREFIX = ["Warding", "Blessed", "Radiant", "Hale", "Vital"];
const SUFFIXES = ["of the Depths", "of the Hunt", "of Shadows", "of the Wolf", "of Ruin"];
const RARE_SUFFIXES = ["of the Abyss", "of the Monarch", "of the Void", "of Eternity", "of the Fallen"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** How much a gate's rank adds to any rarity roll happening in its
 *  context (a kill inside it, or the Shop's stock at that rank) - stacks
 *  additively with the roll's own source bonus (elite/boss/shop). */
export function rankRarityBonus(rank: Rank): number {
  return RANK_RARITY_BONUS[rank];
}

/** `bonus` (0..~1) skews the roll toward the top of the table - each tier
 *  above common gets a share of it, heavier at the tiers closest to
 *  common so a "generous" modifier mostly turns commons into uncommons/
 *  rares rather than routinely handing out godly gear. */
export function rollRarity(bonus = 0): ItemRarity {
  const weights: [ItemRarity, number][] = [
    ["godly", RARITY_META.godly.weight + bonus * 0.15],
    ["mythic", RARITY_META.mythic.weight + bonus * 0.3],
    ["legendary", RARITY_META.legendary.weight + bonus * 0.5],
    ["epic", RARITY_META.epic.weight + bonus * 0.8],
    ["rare", RARITY_META.rare.weight + bonus],
    ["uncommon", RARITY_META.uncommon.weight + bonus * 0.6],
    ["common", RARITY_META.common.weight]
  ];
  const total = weights.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  let roll = Math.random() * total;
  for (const [rarity, w] of weights) {
    roll -= Math.max(0, w);
    if (roll <= 0) return rarity;
  }
  return "common";
}

const CORE_STATS: StatKey[] = ["str", "agi", "int", "vit", "per"];
const AFFIX_POOL: AffixKey[] = [...CORE_STATS, "hp", "mp", "crit"];

/** hp/mp affixes are flat pool bonuses (naturally bigger numbers) and crit
 *  is a capped percentage - each gets its own scale off the same
 *  rank/rarity power budget the core stats use, so a "+22 Max HP" and a
 *  "+5 STR" roll of the same rarity feel comparably strong. */
function rollAffixValue(key: AffixKey, rankPower: number, statMult: number): number {
  const jitter = 0.8 + Math.random() * 0.4;
  if (key === "hp") return Math.max(4, Math.round(rankPower * statMult * 4.2 * jitter));
  if (key === "mp") return Math.max(2, Math.round(rankPower * statMult * 1.5 * jitter));
  if (key === "crit") return Math.min(12, Math.max(1, Math.round(rankPower * statMult * 0.32 * jitter)));
  return Math.max(1, Math.round(rankPower * statMult * jitter));
}

/** Generates a fully-named, ready-to-equip item with 1-4 random affixes
 *  (see AFFIX_COUNT_BY_RARITY) - `rank` sets the power budget, `rarity`
 *  scales it and how many rolls the item gets. */
export function generateLoot(rank: Rank, rarity: ItemRarity): LootItem {
  const slot = pick<ItemSlot>(["weapon", "helmet", "chest", "legs", "ring", "amulet"]);
  const rankPower = 3 + RANK_INDEX[rank] * 2;
  const affixCount = AFFIX_COUNT_BY_RARITY[rarity];
  const pool = [...AFFIX_POOL];
  const affixes: ItemAffix[] = [];
  for (let i = 0; i < affixCount && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const key = pool.splice(idx, 1)[0];
    affixes.push({ key, value: rollAffixValue(key, rankPower, RARITY_META[rarity].statMult) });
  }

  const primary = affixes.find((a): a is ItemAffix & { key: StatKey } => (CORE_STATS as string[]).includes(a.key));
  const base = pick(SLOT_BASES[slot]);
  const prefix = primary ? pick(STAT_PREFIX[primary.key]) : pick(GENERIC_PREFIX);
  const useDramaticSuffix = RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf("epic");
  const suffix = Math.random() < 0.7 ? pick(useDramaticSuffix ? RARE_SUFFIXES : SUFFIXES) : "";
  const name = suffix ? `${prefix} ${base} ${suffix}` : `${prefix} ${base}`;

  return {
    id: `item-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name, slot, rarity, affixes,
    icon: SLOT_ICON[slot]
  };
}

/** Renders one affix as display text - "+5 STR", "+22 Max HP", "+3% Crit". */
export function affixText(a: ItemAffix): string {
  if (a.key === "hp") return `+${a.value} Max HP`;
  if (a.key === "mp") return `+${a.value} Max MP`;
  if (a.key === "crit") return `+${a.value}% Crit`;
  return `+${a.value} ${a.key.toUpperCase()}`;
}

/** Gold price for a shop-listed item - each affix is normalized back to a
 *  comparable "power" unit (undoing the different per-key scaling
 *  rollAffixValue applies) before pricing, so a piece with two HP/MP
 *  affixes doesn't quietly cost far more or less than one with two core
 *  stats of equivalent power. */
export function priceForItem(item: LootItem): number {
  const power = item.affixes.reduce((sum, a) => {
    if (a.key === "hp") return sum + a.value / 4.2;
    if (a.key === "mp") return sum + a.value / 1.5;
    if (a.key === "crit") return sum + a.value * 3;
    return sum + a.value;
  }, 0);
  return Math.max(15, Math.round(power * 9));
}

/** Rolls a fresh batch of purchasable gear at the given rank - the Shop's
 *  stock. Slightly loot-luckier than a plain kill drop (small flat bonus)
 *  since it's gold you had to earn, not a free kill roll - plus the same
 *  rank bonus a kill at that rank would get. */
export function rollShopStock(rank: Rank, count = 6): LootItem[] {
  const bonus = 0.05 + rankRarityBonus(rank);
  return Array.from({ length: count }, () => generateLoot(rank, rollRarity(bonus)));
}

/** Rolled once per gate run - swaps up the risk/reward on every attempt
 *  instead of the same fight playing out identically each time. */
export const GATE_MODIFIERS: GateModifier[] = [
  { key: "none", label: "", description: "", xpMult: 1, loot: 0, enemyAtkMult: 1, enemyHpMult: 1 },
  { key: "blessed", label: "Blessed Gate", description: "+50% XP from every kill", xpMult: 1.5, loot: 0, enemyAtkMult: 1, enemyHpMult: 1 },
  { key: "bountiful", label: "Bountiful Gate", description: "Much higher loot drop chance", xpMult: 1, loot: 0.25, enemyAtkMult: 1, enemyHpMult: 1 },
  { key: "vicious", label: "Vicious Gate", description: "Enemies hit harder, but drop more loot", xpMult: 1, loot: 0.15, enemyAtkMult: 1.35, enemyHpMult: 1 },
  { key: "swift", label: "Swift Gate", description: "Enemies are frailer than usual", xpMult: 1, loot: 0, enemyAtkMult: 1, enemyHpMult: 0.75 }
];

export function rollGateModifier(): GateModifier {
  // ~40% chance of an ordinary run with no modifier at all.
  if (Math.random() < 0.4) return GATE_MODIFIERS[0];
  return pick(GATE_MODIFIERS.slice(1));
}

/** How hard a deployed Shadow hits per player action, by its rank. */
export const SHADOW_RANK_POWER: Record<Rank, number> = {
  E: 3, D: 5, C: 8, B: 12, A: 18, S: 26
};

export const STAT_DEFS: { key: "str" | "agi" | "int" | "vit" | "per"; label: string; icon: string }[] = [
  { key: "str", label: "STR — Strength", icon: "sword" },
  { key: "agi", label: "AGI — Agility", icon: "lightning" },
  { key: "int", label: "INT — Intelligence", icon: "sparkles" },
  { key: "vit", label: "VIT — Vitality", icon: "shield" },
  { key: "per", label: "PER — Perception", icon: "moon-stars" }
];

/** Every number a stat point buys, centralized so the store (which applies
 *  the effects) and the Status screen (which shows what you just gained)
 *  can never drift out of sync with each other. */
export const STAT_TUNING = {
  strAtkPerPoint: 1.1,
  vitHpPerPoint: 5,
  intMpPerPoint: 3,
  agiCritPerPoint: 0.003,
  perCritPerPoint: 0.002,
  agiMissReductionPerPoint: 0.01,
  perMissReductionPerPoint: 0.006
};

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

/** Three tiers apiece of HP/MP consumables - a cheap early option and a
 *  real late-game one, bought in the Inventory shop and used mid-battle
 *  from the Items panel. */
export const POTIONS: PotionDef[] = [
  { id: "hp_minor", name: "Minor HP Potion", kind: "hp", tier: "minor", amount: 30, cost: 25, icon: "flask" },
  { id: "hp_greater", name: "Greater HP Potion", kind: "hp", tier: "greater", amount: 70, cost: 55, icon: "flask" },
  { id: "hp_supreme", name: "Supreme HP Potion", kind: "hp", tier: "supreme", amount: 150, cost: 110, icon: "flask" },
  { id: "mp_minor", name: "Minor MP Potion", kind: "mp", tier: "minor", amount: 15, cost: 25, icon: "moon-stars" },
  { id: "mp_greater", name: "Greater MP Potion", kind: "mp", tier: "greater", amount: 35, cost: 55, icon: "moon-stars" },
  { id: "mp_supreme", name: "Supreme MP Potion", kind: "mp", tier: "supreme", amount: 70, cost: 110, icon: "moon-stars" }
];
