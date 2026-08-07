import type { StatKey } from "../../types";
import { createRegistry } from "../../services/registry";
import type { TalentBonus, TalentNode } from "./types";

/** Talent Points earned per level - a second, smaller currency alongside
 *  the existing 3 stat points/level (PlayerState.statPoints), spent on
 *  this tree instead of raw stats. Granted in Game.grantXp, alongside the
 *  existing statPoints grant. */
export const TALENT_POINTS_PER_LEVEL = 1;

export const TALENT_TIER_COUNT = 5;

/** 3 branches x 5 tiers = 15 nodes, each a single linear path (see
 *  TalentNode.tier's doc comment) - Offense stacks STR + Crit into a
 *  glass-cannon capstone, Defense stacks VIT/INT survivability into an
 *  all-stats capstone, Utility trades AGI/PER into a Gold/XP economy with
 *  a Crit capstone, so the 3 branches feel like genuinely different
 *  builds rather than one tree with a reskinned label per column. Every
 *  value is a small additive percentage in the same range Titles already
 *  use (3-15% for stat/xp/gold, 2-5% for crit, from systems/titles/
 *  data.ts) - Talents just let a player *stack several* of these
 *  permanently instead of wearing one Title at a time. */
export const TALENTS: TalentNode[] = [
  { id: "off_1", branch: "offense", tier: 1, name: "Blade Focus", description: "+3% STR.", bonus: { kind: "statPct", stat: "str", value: 0.03 }, bonusText: "+3% STR" },
  { id: "off_2", branch: "offense", tier: 2, name: "Killer Instinct", description: "+2% Crit Chance.", bonus: { kind: "critFlat", value: 0.02 }, bonusText: "+2% Crit" },
  { id: "off_3", branch: "offense", tier: 3, name: "War Cry", description: "+5% STR.", bonus: { kind: "statPct", stat: "str", value: 0.05 }, bonusText: "+5% STR" },
  { id: "off_4", branch: "offense", tier: 4, name: "Precision Strikes", description: "+3% Crit Chance.", bonus: { kind: "critFlat", value: 0.03 }, bonusText: "+3% Crit" },
  { id: "off_5", branch: "offense", tier: 5, name: "Monarch's Wrath", description: "+10% STR.", bonus: { kind: "statPct", stat: "str", value: 0.1 }, bonusText: "+10% STR" },

  { id: "def_1", branch: "defense", tier: 1, name: "Iron Skin", description: "+3% VIT.", bonus: { kind: "statPct", stat: "vit", value: 0.03 }, bonusText: "+3% VIT" },
  { id: "def_2", branch: "defense", tier: 2, name: "Warded Mind", description: "+3% INT.", bonus: { kind: "statPct", stat: "int", value: 0.03 }, bonusText: "+3% INT" },
  { id: "def_3", branch: "defense", tier: 3, name: "Bulwark", description: "+5% VIT.", bonus: { kind: "statPct", stat: "vit", value: 0.05 }, bonusText: "+5% VIT" },
  { id: "def_4", branch: "defense", tier: 4, name: "Clear Mind", description: "+5% INT.", bonus: { kind: "statPct", stat: "int", value: 0.05 }, bonusText: "+5% INT" },
  { id: "def_5", branch: "defense", tier: 5, name: "Titan's Resolve", description: "+5% All Stats.", bonus: { kind: "allStatsPct", value: 0.05 }, bonusText: "+5% All Stats" },

  { id: "util_1", branch: "utility", tier: 1, name: "Quick Reflexes", description: "+3% AGI.", bonus: { kind: "statPct", stat: "agi", value: 0.03 }, bonusText: "+3% AGI" },
  { id: "util_2", branch: "utility", tier: 2, name: "Keen Eye", description: "+3% PER.", bonus: { kind: "statPct", stat: "per", value: 0.03 }, bonusText: "+3% PER" },
  { id: "util_3", branch: "utility", tier: 3, name: "Treasure Sense", description: "+8% Gold from kills.", bonus: { kind: "goldPct", value: 0.08 }, bonusText: "+8% Gold" },
  { id: "util_4", branch: "utility", tier: 4, name: "Battle Insight", description: "+8% XP from kills.", bonus: { kind: "xpPct", value: 0.08 }, bonusText: "+8% XP" },
  { id: "util_5", branch: "utility", tier: 5, name: "Hunter's Instinct", description: "+5% Crit Chance.", bonus: { kind: "critFlat", value: 0.05 }, bonusText: "+5% Crit" }
];

export const TALENT_REGISTRY = createRegistry(TALENTS, (t) => t.id, "Talent");

/** A tier > 1 node requires the previous tier in the *same* branch
 *  already unlocked - tier 1 nodes have no prerequisite. */
export function canUnlockTalent(unlockedIds: string[], node: TalentNode): boolean {
  if (node.tier <= 1) return true;
  const prev = TALENTS.find((n) => n.branch === node.branch && n.tier === node.tier - 1);
  return prev ? unlockedIds.includes(prev.id) : true;
}

function sumBonus(unlockedIds: string[], match: (b: TalentBonus) => number): number {
  return unlockedIds.reduce((sum, id) => {
    const node = TALENT_REGISTRY.get(id);
    return node ? sum + match(node.bonus) : sum;
  }, 0);
}

/** Sum of every unlocked node's contribution to one core stat - both a
 *  matching `statPct` and any `allStatsPct` capstone count toward it. */
export function talentStatPct(unlockedIds: string[], stat: StatKey): number {
  return sumBonus(unlockedIds, (b) => {
    if (b.kind === "statPct" && b.stat === stat) return b.value;
    if (b.kind === "allStatsPct") return b.value;
    return 0;
  });
}

export function talentCritFlat(unlockedIds: string[]): number {
  return sumBonus(unlockedIds, (b) => (b.kind === "critFlat" ? b.value : 0));
}

export function talentXpPct(unlockedIds: string[]): number {
  return sumBonus(unlockedIds, (b) => (b.kind === "xpPct" ? b.value : 0));
}

export function talentGoldPct(unlockedIds: string[]): number {
  return sumBonus(unlockedIds, (b) => (b.kind === "goldPct" ? b.value : 0));
}
