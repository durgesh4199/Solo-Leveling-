import type { AffixKey, Archetype, GateDef, GateModifier, ItemAffix, ItemRarity, ItemSlot, LootItem, PotionDef, Rank, SkillDef, StatKey, WavePlanEntry } from "./types";
import { createRegistry, type Registry } from "./services/registry";

/** Every gate rank's signature monster family - fixes which of the 6
 *  hand-drawn silhouettes (see art/portraits.ts) a rank's enemies use, so
 *  "what does an S-rank threat look like" stays a consistent visual
 *  language even across the many differently-named species within it. */
export const ARCHETYPE_BY_RANK: Record<Rank, Archetype> = {
  E: "goblin", D: "orc", C: "wraith", B: "knight", A: "beast", S: "wyrm"
};

/** Six named subspecies per archetype (trash) plus four boss epithets -
 *  index 0 of each is the original "hand-placed" gate's monster/boss name,
 *  kept verbatim; every other gate on that archetype draws a rotated slice
 *  of the same pool so no two gates field an identical roster. */
const TRASH_POOL: Record<Archetype, string[]> = {
  goblin: ["Goblin Scout", "Goblin Raider", "Goblin Skulker", "Goblin Shaman", "Goblin Marauder", "Goblin Trapper"],
  orc: ["Orc Brute", "Orc Grunt", "Orc Berserker", "Orc Reaver", "Orc Butcher", "Orc Skirmisher"],
  wraith: ["Ice Wraith", "Frost Specter", "Pale Wraith", "Hollow Wisp", "Wailing Wraith", "Rime Phantom"],
  knight: ["Blood Knight", "Fallen Knight", "Cursed Templar", "Iron Sentinel", "Wraithguard", "Crimson Vanguard"],
  beast: ["Shadow Beast", "Dire Fang", "Night Stalker", "Bloodfang Prowler", "Feral Warden", "Void Hound"],
  wyrm: ["Ancient Wyrm", "Storm Wyrm", "Serpent Drake", "Wyrmling Broodguard", "Ashwing Drake", "Voidscale Wyrm"]
};
const BOSS_POOL: Record<Archetype, string[]> = {
  goblin: ["Goblin Overlord", "Goblin Warlord", "Goblin Chieftain", "Goblin Despot"],
  orc: ["Orc Warchief", "Orc Warlord", "Orc Bloodfist", "Orc Ravager"],
  wraith: ["Ice Wraith Sovereign", "Frost Sovereign", "Wraith Empress", "Hollow Monarch"],
  knight: ["Blood Knight Commander", "Fallen Grandmaster", "Crimson Warlord", "Iron Sovereign"],
  beast: ["Shadow Beast Alpha", "Dire Fang Matriarch", "Void Hound Alpha", "Night Stalker Prime"],
  wyrm: ["Ancient Wyrm, Elder", "Storm Wyrm Sovereign", "Voidscale Dominion", "Ashwing Dominion"]
};

/** Picks a gate's 5-species trash roster + boss name from its rank's
 *  archetype pools, rotated by `kInRank` (this gate's position among its
 *  own rank) so e.g. all four E-rank gates still feel distinct from each
 *  other despite sharing the goblin archetype. */
function rosterFor(archetype: Archetype, kInRank: number): { enemyTypes: string[]; bossName: string } {
  const trash = TRASH_POOL[archetype];
  const enemyTypes = Array.from({ length: 5 }, (_, j) => trash[(kInRank + j) % trash.length]);
  const bossPool = BOSS_POOL[archetype];
  return { enemyTypes, bossName: bossPool[kInRank % bossPool.length] };
}

function gate(id: string, rank: Rank, name: string, kInRank: number, recommendedLevel: number, baseHp: number, baseAtk: number, baseDef: number, xp: number): GateDef {
  const { enemyTypes, bossName } = rosterFor(ARCHETYPE_BY_RANK[rank], kInRank);
  return { id, rank, name, enemyTypes, bossName, recommendedLevel, baseHp, baseAtk, baseDef, xp };
}

/** 20 gates, E through S - the original 6 "hand-placed" gates (kInRank 0 on
 *  each rank) are unchanged from the source design; the rest fill out each
 *  rank with 2-3 more gates at gently ramping power, so every rank offers a
 *  real choice of where to grind instead of one mandatory stop. */
export const GATES_DATA: GateDef[] = [
  gate("g1", "E", "Crumbling Ruins", 0, 1, 55, 7, 0, 25),
  gate("g2", "E", "Wailing Marsh", 1, 2, 62, 8, 0, 29),
  gate("g3", "E", "Bone Thicket", 2, 3, 68, 8, 1, 32),
  gate("g4", "E", "Rustwater Sewers", 3, 3, 72, 9, 1, 35),

  gate("g5", "D", "Sunken Crypt", 0, 4, 95, 11, 2, 45),
  gate("g6", "D", "Howling Quarry", 1, 5, 105, 12, 2, 52),
  gate("g7", "D", "Ashen Barrow", 2, 6, 115, 13, 3, 58),
  gate("g8", "D", "Thorned Hollow", 3, 7, 125, 14, 3, 64),

  gate("g9", "C", "Frost Hollow", 0, 8, 140, 15, 4, 70),
  gate("g10", "C", "Glacier Fang", 1, 9, 150, 16, 4, 77),
  gate("g11", "C", "Mirrored Depths", 2, 10, 160, 17, 5, 83),
  gate("g12", "C", "Obsidian Reach", 3, 11, 170, 18, 5, 89),

  gate("g13", "B", "Red Cathedral", 0, 13, 195, 20, 7, 100),
  gate("g14", "B", "Crimson Bastion", 1, 15, 212, 22, 8, 112),
  gate("g15", "B", "Widow's Chapel", 2, 17, 228, 24, 9, 124),

  gate("g16", "A", "Void Spire", 0, 19, 260, 26, 10, 145),
  gate("g17", "A", "Abyssal Rift", 1, 21, 280, 28, 11, 160),
  gate("g18", "A", "Nightmare Bastion", 2, 23, 300, 30, 12, 175),

  gate("g19", "S", "Dragon's Maw", 0, 26, 340, 34, 14, 200),
  gate("g20", "S", "Worldless Throne", 1, 29, 375, 37, 16, 225)
];

/** Promotion Exams (#10) - one single-boss "trial" gate per rank tier
 *  above E, flagged `isPromotionExam` so `totalEnemiesForGate` collapses
 *  them to a solo boss fight with no trash waves. Kept in their own array
 *  rather than mixed into `GATES_DATA` (which the Gates screen's normal
 *  list renders as-is, unfiltered) - a Promotion Exam isn't an
 *  explorable gate, it's a one-time rank-gated trial offered separately
 *  (see Game.examEligibleRank/startPromotionExam in store.ts). Stat
 *  baselines are hand-tuned a notch above the first gate of the rank
 *  being left behind, so the trial reads as "harder than what you've
 *  been fighting", not a formality. `enemyTypes` is unused (boss-only
 *  fights never read it - see makeEnemies in store.ts) so it's left
 *  empty rather than populated with dead data. */
export const EXAM_GATES_DATA: GateDef[] = [
  { id: "exam_d", rank: "D", name: "D-Rank Promotion Trial", enemyTypes: [], bossName: "D-Rank Proctor", recommendedLevel: 4, baseHp: 110, baseAtk: 13, baseDef: 2, xp: 60, isPromotionExam: true },
  { id: "exam_c", rank: "C", name: "C-Rank Promotion Trial", enemyTypes: [], bossName: "C-Rank Proctor", recommendedLevel: 8, baseHp: 165, baseAtk: 18, baseDef: 5, xp: 95, isPromotionExam: true },
  { id: "exam_b", rank: "B", name: "B-Rank Promotion Trial", enemyTypes: [], bossName: "B-Rank Proctor", recommendedLevel: 13, baseHp: 230, baseAtk: 24, baseDef: 8, xp: 135, isPromotionExam: true },
  { id: "exam_a", rank: "A", name: "A-Rank Promotion Trial", enemyTypes: [], bossName: "A-Rank Proctor", recommendedLevel: 19, baseHp: 305, baseAtk: 31, baseDef: 12, xp: 190, isPromotionExam: true },
  { id: "exam_s", rank: "S", name: "S-Rank Promotion Trial", enemyTypes: [], bossName: "S-Rank Proctor", recommendedLevel: 26, baseHp: 400, baseAtk: 40, baseDef: 17, xp: 260, isPromotionExam: true }
];

/** O(1) gate-by-id lookup - store.ts previously re-scanned GATES_DATA with
 *  `.find()` at every call site that needed "the gate this battle belongs
 *  to"; this also throws at load time if a gate id is ever duplicated,
 *  which a plain array + `.find()` would instead let through silently.
 *  Covers both the 20 explorable gates and the 5 Promotion Exam trials so
 *  every existing `GATE_REGISTRY.get(battle.gateId)` call site keeps
 *  working unchanged for an exam battle too. */
export const GATE_REGISTRY: Registry<GateDef> = createRegistry([...GATES_DATA, ...EXAM_GATES_DATA], (g) => g.id, "Gate");

/** A trash unit's species (one of its gate's 5 enemyTypes, picked at
 *  random per spawn - see makeEnemies in store.ts) also picks which of
 *  these stat-weight profiles it rolls, by pool position: index 0 is a
 *  plain baseline (the original design's numbers, untouched), the rest
 *  trade HP for ATK or vice versa so "5 different types" is a real combat
 *  difference, not just a different name on the same numbers. */
export const TYPE_VARIANTS: { hpMult: number; atkMult: number; defMult: number }[] = [
  { hpMult: 1.0, atkMult: 1.0, defMult: 1.0 },
  { hpMult: 0.85, atkMult: 1.25, defMult: 0.9 },
  { hpMult: 1.25, atkMult: 0.8, defMult: 1.15 },
  { hpMult: 0.95, atkMult: 1.05, defMult: 1.05 },
  { hpMult: 1.1, atkMult: 1.15, defMult: 0.85 }
];

/** Total enemies (trash + the final boss) a gate throws at you in one run.
 *  Ramps 10 -> 20 across the six ranks. */
export const TOTAL_ENEMIES_BY_RANK: Record<Rank, number> = {
  E: 10, D: 12, C: 14, B: 16, A: 18, S: 20
};

/** Enemies fought simultaneously in one non-boss wave. */
export const GROUP_SIZE = 3;

/** A Promotion Exam (#10) or an Infinite Tower floor (#17) is a single
 *  solo boss encounter, no trash waves - overrides the normal rank-based
 *  enemy count down to just the boss. */
export function totalEnemiesForGate(gate: GateDef): number {
  if (gate.isPromotionExam || gate.isTowerFloor) return 1;
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
const AFFIX_POOL: AffixKey[] = [...CORE_STATS, "hp", "mp", "crit", "lifeSteal", "attackSpeed", "manaRegen", "fireDamage"];

/** hp/mp affixes are flat pool bonuses (naturally bigger numbers), crit/
 *  lifeSteal/attackSpeed are capped percentages, manaRegen/fireDamage are
 *  smaller flat bonuses (a per-round tick and a per-hit addition rather
 *  than a one-time pool) - each gets its own scale off the same
 *  rank/rarity power budget the core stats use, so a "+22 Max HP" and a
 *  "+5 STR" roll of the same rarity feel comparably strong. Caps keep the
 *  percentage-based combat affixes (life steal, attack speed) from ever
 *  becoming a build-defining single roll even at godly rarity. */
function rollAffixValue(key: AffixKey, rankPower: number, statMult: number): number {
  const jitter = 0.8 + Math.random() * 0.4;
  if (key === "hp") return Math.max(4, Math.round(rankPower * statMult * 4.2 * jitter));
  if (key === "mp") return Math.max(2, Math.round(rankPower * statMult * 1.5 * jitter));
  if (key === "crit") return Math.min(12, Math.max(1, Math.round(rankPower * statMult * 0.32 * jitter)));
  if (key === "lifeSteal") return Math.min(15, Math.max(1, Math.round(rankPower * statMult * 0.28 * jitter)));
  if (key === "attackSpeed") return Math.min(20, Math.max(1, Math.round(rankPower * statMult * 0.35 * jitter)));
  if (key === "manaRegen") return Math.max(1, Math.round(rankPower * statMult * 0.6 * jitter));
  if (key === "fireDamage") return Math.max(1, Math.round(rankPower * statMult * 1.1 * jitter));
  return Math.max(1, Math.round(rankPower * statMult * jitter));
}

/** Generates a fully-named, ready-to-equip item with 1-4 random affixes
 *  (see AFFIX_COUNT_BY_RARITY) - `rank` sets the power budget, `rarity`
 *  scales it and how many rolls the item gets. `forcedSlot` (#14,
 *  Crafting) pins the slot instead of picking one at random - Craft
 *  Equipment needs to build a chosen slot, and Reforge needs to keep an
 *  existing item's slot fixed while everything else about it rerolls -
 *  every existing caller omits it and gets the original random-slot
 *  behavior unchanged. */
export function generateLoot(rank: Rank, rarity: ItemRarity, forcedSlot?: ItemSlot): LootItem {
  const slot = forcedSlot ?? pick<ItemSlot>(["weapon", "helmet", "chest", "legs", "ring", "amulet"]);
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

/** Generates one Equipment Set piece (#16, systems/sets/) - unlike
 *  generateLoot's randomly-chosen affix pool and generated name, a set
 *  piece's name/slot/icon and *which* affix keys it rolls are fixed by
 *  its EquipmentSetDef (systems/sets/data.ts calls this, one call per
 *  piece), so the same piece always grants the same kind of bonus and is
 *  always recognizable by name. Only the numeric *magnitude* of each
 *  affix scales with rank, reusing the exact same rankPower/rollAffixValue
 *  machinery generateLoot itself uses (always at legendary's statMult, so
 *  a set piece is always a real, notable find regardless of rank) rather
 *  than a second, independently-tuned formula that could drift out of
 *  sync with normal loot's own power curve. */
export function generateSetPiece(rank: Rank, slot: ItemSlot, name: string, affixKeys: AffixKey[], icon: string, setId: string): LootItem {
  const rankPower = 3 + RANK_INDEX[rank] * 2;
  const affixes: ItemAffix[] = affixKeys.map((key) => ({ key, value: rollAffixValue(key, rankPower, RARITY_META.legendary.statMult) }));
  return {
    id: `item-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name, slot, rarity: "legendary", affixes, icon, setId
  };
}

/** Renders one affix as display text - "+5 STR", "+22 Max HP", "+3% Crit". */
export function affixText(a: ItemAffix): string {
  if (a.key === "hp") return `+${a.value} Max HP`;
  if (a.key === "mp") return `+${a.value} Max MP`;
  if (a.key === "crit") return `+${a.value}% Crit`;
  if (a.key === "lifeSteal") return `+${a.value}% Life Steal`;
  if (a.key === "attackSpeed") return `+${a.value}% Attack Speed`;
  if (a.key === "manaRegen") return `+${a.value} MP Regen`;
  if (a.key === "fireDamage") return `+${a.value} Fire Damage`;
  return `+${a.value} ${a.key.toUpperCase()}`;
}

/** One stat's net change if a candidate item replaced whatever's currently
 *  in its slot. */
export interface AffixDelta {
  key: AffixKey;
  candidateValue: number;
  equippedValue: number;
  delta: number;
}

const AFFIX_KEY_ORDER: AffixKey[] = ["str", "agi", "int", "vit", "per", "hp", "mp", "crit"];

/** Sums an item's affixes by key (an item can roll the same key more than
 *  once in principle, though the current generator never does) - null/
 *  undefined (an empty slot) sums to nothing, i.e. every key reads 0. */
function affixValueMap(item: LootItem | null | undefined): Partial<Record<AffixKey, number>> {
  const map: Partial<Record<AffixKey, number>> = {};
  if (!item) return map;
  for (const a of item.affixes) map[a.key] = (map[a.key] ?? 0) + a.value;
  return map;
}

/** What changes, stat by stat, if `candidate` replaced `equipped` in its
 *  slot - the union of every key present on *either* side, not just a
 *  pairing of the candidate's own affixes, so an equipped item's affixes
 *  that the candidate doesn't share still show up as a loss (negative
 *  delta), not just silently dropped from the comparison. `equipped` null
 *  (nothing in that slot yet) makes every delta equal the candidate's own
 *  affix values - a pure "what would I gain" list. Stable key order
 *  (`AFFIX_KEY_ORDER`) so the UI never re-shuffles between renders. */
export function compareItemAffixes(candidate: LootItem, equipped: LootItem | null): AffixDelta[] {
  const candMap = affixValueMap(candidate);
  const equipMap = affixValueMap(equipped);
  const keys = AFFIX_KEY_ORDER.filter((k) => candMap[k] !== undefined || equipMap[k] !== undefined);
  return keys.map((key) => {
    const candidateValue = candMap[key] ?? 0;
    const equippedValue = equipMap[key] ?? 0;
    return { key, candidateValue, equippedValue, delta: candidateValue - equippedValue };
  });
}

/** Renders one AffixDelta as "+3 STR" / "-22 Max HP" / "+2% Crit" - the
 *  sign is explicit only on the positive side since a negative number
 *  already prints its own "-". */
export function affixDeltaText(d: AffixDelta): string {
  const sign = d.delta > 0 ? "+" : "";
  if (d.key === "hp") return `${sign}${d.delta} Max HP`;
  if (d.key === "mp") return `${sign}${d.delta} Max MP`;
  if (d.key === "crit") return `${sign}${d.delta}% Crit`;
  if (d.key === "lifeSteal") return `${sign}${d.delta}% Life Steal`;
  if (d.key === "attackSpeed") return `${sign}${d.delta}% Attack Speed`;
  if (d.key === "manaRegen") return `${sign}${d.delta} MP Regen`;
  if (d.key === "fireDamage") return `${sign}${d.delta} Fire Damage`;
  return `${sign}${d.delta} ${d.key.toUpperCase()}`;
}

/** Sums one affix key across every filled slot of an equipment map. Shared
 *  by the player's own equipment (`Game.equipmentAffixSum`, store.ts) and
 *  a Shadow's equipment (`systems/shadows/data.ts`, since #7's Shadow
 *  gear) so both read the exact same loop instead of two near-identical
 *  copies quietly drifting apart. */
export function sumEquipmentAffix(equipment: Partial<Record<ItemSlot, LootItem>>, key: AffixKey): number {
  let sum = 0;
  for (const item of Object.values(equipment)) {
    if (!item) continue;
    for (const affix of item.affixes) {
      if (affix.key === key) sum += affix.value;
    }
  }
  return sum;
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
    if (a.key === "lifeSteal") return sum + a.value / 0.28;
    if (a.key === "attackSpeed") return sum + a.value / 0.35;
    if (a.key === "manaRegen") return sum + a.value / 0.6;
    if (a.key === "fireDamage") return sum + a.value / 1.1;
    return sum + a.value;
  }, 0);
  return Math.max(15, Math.round(power * 9));
}

/** The bag's only way to shed an unwanted item - selling for a tenth of
 *  what it would cost to buy back from the Shop. Centralized so the store
 *  (which actually pays it out) and the Inventory screen (which previews
 *  it on every bag row) can never drift out of sync with each other. */
export const SELL_PRICE_RATIO = 0.1;

export function sellPriceForItem(item: LootItem): number {
  return Math.max(1, Math.round(priceForItem(item) * SELL_PRICE_RATIO));
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
 *  instead of the same fight playing out identically each time. #11
 *  (Dungeon Modifiers) expanded this from 4 real entries to 11, spanning
 *  three rough tiers: mild/common (Blessed, Bountiful, Swift, Wealthy,
 *  Generous, Frail - one knob nudged, no real downside beyond "less of a
 *  bonus"), moderate/risk-reward (Vicious, Elite Surge, Tempered,
 *  Fortified - a real enemy buff paired with a real reward bump), and
 *  Cursed - the one high-risk/high-reward outlier, deliberately the
 *  rarest (lowest `weight`) since stacking atk+hp+def buffs is a lot to
 *  ask for any single gate attempt. `enemyDefMult`/`eliteChanceBonus`/
 *  `goldMult` are the 3 new knobs beyond the original 4 - nothing
 *  previously touched a fight's defense, elite odds, or gold at all. */
export const GATE_MODIFIERS: GateModifier[] = [
  { key: "none", label: "", description: "", xpMult: 1, loot: 0, enemyAtkMult: 1, enemyHpMult: 1, enemyDefMult: 1, eliteChanceBonus: 0, goldMult: 1, weight: 0 },
  { key: "blessed", label: "Blessed Gate", description: "+50% XP from every kill", xpMult: 1.5, loot: 0, enemyAtkMult: 1, enemyHpMult: 1, enemyDefMult: 1, eliteChanceBonus: 0, goldMult: 1, weight: 3 },
  { key: "bountiful", label: "Bountiful Gate", description: "Much higher loot drop chance", xpMult: 1, loot: 0.25, enemyAtkMult: 1, enemyHpMult: 1, enemyDefMult: 1, eliteChanceBonus: 0, goldMult: 1, weight: 3 },
  { key: "swift", label: "Swift Gate", description: "Enemies are frailer than usual", xpMult: 1, loot: 0, enemyAtkMult: 1, enemyHpMult: 0.75, enemyDefMult: 1, eliteChanceBonus: 0, goldMult: 1, weight: 3 },
  { key: "wealthy", label: "Wealthy Gate", description: "+50% gold from every kill", xpMult: 1, loot: 0, enemyAtkMult: 1, enemyHpMult: 1, enemyDefMult: 1, eliteChanceBonus: 0, goldMult: 1.5, weight: 3 },
  { key: "generous", label: "Generous Gate", description: "Enemies hit softer, +40% XP", xpMult: 1.4, loot: 0, enemyAtkMult: 0.85, enemyHpMult: 1, enemyDefMult: 1, eliteChanceBonus: 0, goldMult: 1, weight: 3 },
  { key: "frail", label: "Frail Gate", description: "Enemies are weak all around - a quick, low-reward clear", xpMult: 1, loot: 0, enemyAtkMult: 1, enemyHpMult: 0.7, enemyDefMult: 0.85, eliteChanceBonus: 0, goldMult: 1, weight: 2 },
  { key: "vicious", label: "Vicious Gate", description: "Enemies hit harder, but drop more loot", xpMult: 1, loot: 0.15, enemyAtkMult: 1.35, enemyHpMult: 1, enemyDefMult: 1, eliteChanceBonus: 0, goldMult: 1, weight: 2 },
  { key: "elite_surge", label: "Elite Surge", description: "Far more Elites, +10% loot chance", xpMult: 1, loot: 0.1, enemyAtkMult: 1, enemyHpMult: 1, enemyDefMult: 1, eliteChanceBonus: 0.14, goldMult: 1, weight: 2 },
  { key: "tempered", label: "Tempered Gate", description: "Enemies are much better armored, +20% XP", xpMult: 1.2, loot: 0, enemyAtkMult: 1, enemyHpMult: 1, enemyDefMult: 1.4, eliteChanceBonus: 0, goldMult: 1, weight: 2 },
  { key: "fortified", label: "Fortified Gate", description: "Tougher and better armored, +30% loot chance", xpMult: 1, loot: 0.3, enemyAtkMult: 1, enemyHpMult: 1.25, enemyDefMult: 1.2, eliteChanceBonus: 0, goldMult: 1, weight: 1.5 },
  { key: "cursed", label: "Cursed Gate", description: "Everything about the enemies is worse - but so is the payout, in your favor", xpMult: 1, loot: 0.5, enemyAtkMult: 1.5, enemyHpMult: 1.25, enemyDefMult: 1.2, eliteChanceBonus: 0, goldMult: 1.75, weight: 1 }
];

/** Weighted pick among the non-"none" modifiers (see each entry's
 *  `weight`) - the same cumulative-weight technique rollRarity already
 *  uses for loot tiers, so a mild modifier (Blessed, weight 3) comes up
 *  noticeably more often than the one high-risk/high-reward outlier
 *  (Cursed, weight 1). */
function pickWeightedModifier(pool: GateModifier[]): GateModifier {
  const total = pool.reduce((sum, m) => sum + m.weight, 0);
  let roll = Math.random() * total;
  for (const m of pool) {
    roll -= m.weight;
    if (roll <= 0) return m;
  }
  return pool[pool.length - 1];
}

export function rollGateModifier(): GateModifier {
  // ~40% chance of an ordinary run with no modifier at all.
  if (Math.random() < 0.4) return GATE_MODIFIERS[0];
  return pickWeightedModifier(GATE_MODIFIERS.slice(1));
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

/** O(1) skill-by-key lookup, replacing the `.find()` in useSkill()/the
 *  battle skill-panel wiring. */
export const SKILL_REGISTRY: Registry<SkillDef> = createRegistry(SKILLS, (s) => s.key, "Skill");

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

/** O(1) potion-by-id lookup, replacing the `.find()` in useItem()/buyPotion(). */
export const POTION_REGISTRY: Registry<PotionDef> = createRegistry(POTIONS, (p) => p.id, "Potion");
