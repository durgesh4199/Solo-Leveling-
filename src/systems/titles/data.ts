import type { TitleDef } from "./types";
import { COUNTER_KEYS } from "../progress/types";
import { createRegistry, type Registry } from "../../services/registry";

/** Starter roster - the condition/bonus architecture supports growing this
 *  to hundreds of entries (per EXPANSION_ROADMAP.md Phase 1) without any
 *  structural change; this batch seeds one title per kill-archetype plus
 *  the milestone categories the design brief calls out (collection, gate
 *  clears, boss kills, rank). Only one Title can be equipped at a time
 *  (see Game.equipTitle) - its bonus folds into the same effective-stat/
 *  gold/xp pipeline equipment affixes already use. */
export const TITLES: TitleDef[] = [
  {
    id: "goblin_slayer", name: "Goblin Slayer",
    description: "Defeat 200 goblins.",
    condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("goblin"), atLeast: 200 },
    bonus: { kind: "statPct", stat: "str", value: 0.03 }, bonusText: "+3% STR"
  },
  {
    id: "orc_bane", name: "Orc Bane",
    description: "Defeat 200 orcs.",
    condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("orc"), atLeast: 200 },
    bonus: { kind: "statPct", stat: "vit", value: 0.03 }, bonusText: "+3% VIT"
  },
  {
    id: "wraith_warden", name: "Wraith Warden",
    description: "Defeat 200 wraiths.",
    condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("wraith"), atLeast: 200 },
    bonus: { kind: "statPct", stat: "int", value: 0.03 }, bonusText: "+3% INT"
  },
  {
    id: "knights_bane", name: "Knight's Bane",
    description: "Defeat 200 knights.",
    condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("knight"), atLeast: 200 },
    bonus: { kind: "statPct", stat: "agi", value: 0.03 }, bonusText: "+3% AGI"
  },
  {
    id: "beast_tamer", name: "Beast Tamer",
    description: "Defeat 200 beasts.",
    condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("beast"), atLeast: 200 },
    bonus: { kind: "statPct", stat: "per", value: 0.03 }, bonusText: "+3% PER"
  },
  {
    id: "dragon_hunter", name: "Dragon Hunter",
    description: "Defeat 200 wyrms.",
    condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("wyrm"), atLeast: 200 },
    bonus: { kind: "critFlat", value: 0.03 }, bonusText: "+3% Crit"
  },
  {
    id: "shadow_collector", name: "Shadow Collector",
    description: "Arise 25 Shadows.",
    condition: { type: "shadowCount", atLeast: 25 },
    bonus: { kind: "xpPct", value: 0.05 }, bonusText: "+5% XP"
  },
  {
    id: "shadow_monarch", name: "Shadow Monarch",
    description: "Arise 100 Shadows.",
    condition: { type: "shadowCount", atLeast: 100 },
    bonus: { kind: "xpPct", value: 0.12 }, bonusText: "+12% XP"
  },
  {
    id: "gate_master", name: "Gate Master",
    description: "Clear 10 Gates.",
    condition: { type: "gatesClearedCount", atLeast: 10 },
    bonus: { kind: "goldPct", value: 0.08 }, bonusText: "+8% Gold"
  },
  {
    id: "gate_conqueror", name: "Gate Conqueror",
    description: "Clear all 20 Gates.",
    condition: { type: "gatesClearedCount", atLeast: 20 },
    bonus: { kind: "goldPct", value: 0.15 }, bonusText: "+15% Gold"
  },
  {
    id: "boss_slayer", name: "Boss Slayer",
    description: "Defeat 25 Gate bosses.",
    condition: { type: "counter", key: COUNTER_KEYS.bossesDefeatedTotal, atLeast: 25 },
    bonus: { kind: "critFlat", value: 0.04 }, bonusText: "+4% Crit"
  },
  {
    id: "monarch", name: "Monarch",
    description: "Reach S-Rank.",
    condition: { type: "rank", atLeast: "S" },
    bonus: { kind: "allStatsPct", value: 0.05 }, bonusText: "+5% All Stats"
  }
];

/** O(1) title-by-id lookup, replacing the `.find()` in Game.equippedTitle(). */
export const TITLE_REGISTRY: Registry<TitleDef> = createRegistry(TITLES, (t) => t.id, "Title");
