import type { AchievementDef } from "./types";
import { COUNTER_KEYS } from "../progress/types";

/** Starter roster - 28 entries spanning every category the design brief
 *  calls out (kills, collection, rank, gates, bosses, equipment, crit,
 *  gold, potions, level). The condition/reward architecture is
 *  content-only from here: growing this toward "hundreds" is adding more
 *  entries, not new code (see EXPANSION_ROADMAP.md Phase 1). */
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "kill_100", name: "Blooded", description: "Defeat 100 enemies.", condition: { type: "counter", key: COUNTER_KEYS.killsTotal, atLeast: 100 }, reward: { kind: "gold", amount: 200 }, rewardText: "+200 Gold" },
  { id: "kill_500", name: "Veteran Hunter", description: "Defeat 500 enemies.", condition: { type: "counter", key: COUNTER_KEYS.killsTotal, atLeast: 500 }, reward: { kind: "gold", amount: 600 }, rewardText: "+600 Gold" },
  { id: "kill_1000", name: "Exterminator", description: "Defeat 1,000 enemies.", condition: { type: "counter", key: COUNTER_KEYS.killsTotal, atLeast: 1000 }, reward: { kind: "gold", amount: 1500 }, rewardText: "+1,500 Gold" },
  { id: "kill_5000", name: "Harbinger of the End", description: "Defeat 5,000 enemies.", condition: { type: "counter", key: COUNTER_KEYS.killsTotal, atLeast: 5000 }, reward: { kind: "statPoints", amount: 5 }, rewardText: "+5 Stat Points" },

  { id: "kill_goblins", name: "Goblin Genocide", description: "Defeat 1,000 goblins.", condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("goblin"), atLeast: 1000 }, reward: { kind: "gold", amount: 400 }, rewardText: "+400 Gold" },
  { id: "kill_orcs", name: "Orc Cleanser", description: "Defeat 1,000 orcs.", condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("orc"), atLeast: 1000 }, reward: { kind: "gold", amount: 400 }, rewardText: "+400 Gold" },
  { id: "kill_wraiths", name: "Wraith Bane", description: "Defeat 1,000 wraiths.", condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("wraith"), atLeast: 1000 }, reward: { kind: "gold", amount: 400 }, rewardText: "+400 Gold" },
  { id: "kill_knights", name: "Knight Breaker", description: "Defeat 1,000 knights.", condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("knight"), atLeast: 1000 }, reward: { kind: "gold", amount: 400 }, rewardText: "+400 Gold" },
  { id: "kill_beasts", name: "Beastbreaker", description: "Defeat 1,000 beasts.", condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("beast"), atLeast: 1000 }, reward: { kind: "gold", amount: 400 }, rewardText: "+400 Gold" },
  { id: "kill_wyrms", name: "Wyrmslayer", description: "Defeat 1,000 wyrms.", condition: { type: "counter", key: COUNTER_KEYS.killsByArchetype("wyrm"), atLeast: 1000 }, reward: { kind: "gold", amount: 400 }, rewardText: "+400 Gold" },

  { id: "gates_5", name: "Gatebreaker", description: "Clear 5 Gates.", condition: { type: "gatesClearedCount", atLeast: 5 }, reward: { kind: "gold", amount: 250 }, rewardText: "+250 Gold" },
  { id: "gates_20", name: "Gate Master", description: "Clear all 20 Gates.", condition: { type: "gatesClearedCount", atLeast: 20 }, reward: { kind: "statPoints", amount: 3 }, rewardText: "+3 Stat Points" },

  { id: "boss_10", name: "Boss Hunter", description: "Defeat 10 Gate bosses.", condition: { type: "counter", key: COUNTER_KEYS.bossesDefeatedTotal, atLeast: 10 }, reward: { kind: "gold", amount: 400 }, rewardText: "+400 Gold" },
  { id: "boss_50", name: "Boss Slayer", description: "Defeat 50 Gate bosses.", condition: { type: "counter", key: COUNTER_KEYS.bossesDefeatedTotal, atLeast: 50 }, reward: { kind: "statPoints", amount: 3 }, rewardText: "+3 Stat Points" },

  { id: "shadows_10", name: "Shadow Keeper", description: "Arise 10 Shadows.", condition: { type: "shadowCount", atLeast: 10 }, reward: { kind: "gold", amount: 300 }, rewardText: "+300 Gold" },
  { id: "shadows_50", name: "Shadow Legion", description: "Arise 50 Shadows.", condition: { type: "shadowCount", atLeast: 50 }, reward: { kind: "gold", amount: 800 }, rewardText: "+800 Gold" },
  { id: "shadows_100", name: "Monarch of Shadows", description: "Arise 100 Shadows.", condition: { type: "shadowCount", atLeast: 100 }, reward: { kind: "statPoints", amount: 5 }, rewardText: "+5 Stat Points" },

  { id: "rank_d", name: "Rising Hunter", description: "Reach D-Rank.", condition: { type: "rank", atLeast: "D" }, reward: { kind: "gold", amount: 100 }, rewardText: "+100 Gold" },
  { id: "rank_c", name: "C-Rank Hunter", description: "Reach C-Rank.", condition: { type: "rank", atLeast: "C" }, reward: { kind: "gold", amount: 200 }, rewardText: "+200 Gold" },
  { id: "rank_b", name: "B-Rank Hunter", description: "Reach B-Rank.", condition: { type: "rank", atLeast: "B" }, reward: { kind: "gold", amount: 350 }, rewardText: "+350 Gold" },
  { id: "rank_a", name: "A-Rank Hunter", description: "Reach A-Rank.", condition: { type: "rank", atLeast: "A" }, reward: { kind: "gold", amount: 500 }, rewardText: "+500 Gold" },
  { id: "rank_s", name: "S-Rank Hunter", description: "Reach S-Rank.", condition: { type: "rank", atLeast: "S" }, reward: { kind: "statPoints", amount: 5 }, rewardText: "+5 Stat Points" },

  { id: "equip_20", name: "Well Equipped", description: "Equip 20 items.", condition: { type: "counter", key: COUNTER_KEYS.itemsEquippedTotal, atLeast: 20 }, reward: { kind: "gold", amount: 200 }, rewardText: "+200 Gold" },
  { id: "crit_500", name: "Precision Striker", description: "Land 500 critical hits.", condition: { type: "counter", key: COUNTER_KEYS.critsLandedTotal, atLeast: 500 }, reward: { kind: "gold", amount: 300 }, rewardText: "+300 Gold" },
  { id: "gold_10000", name: "Gold Baron", description: "Earn 10,000 gold in total.", condition: { type: "counter", key: COUNTER_KEYS.goldEarnedTotal, atLeast: 10000 }, reward: { kind: "statPoints", amount: 2 }, rewardText: "+2 Stat Points" },
  { id: "potions_100", name: "Alchemist's Friend", description: "Use 100 potions.", condition: { type: "counter", key: COUNTER_KEYS.potionsUsedTotal, atLeast: 100 }, reward: { kind: "gold", amount: 150 }, rewardText: "+150 Gold" },

  { id: "level_20", name: "Seasoned", description: "Reach Level 20.", condition: { type: "level", atLeast: 20 }, reward: { kind: "gold", amount: 300 }, rewardText: "+300 Gold" },
  { id: "level_40", name: "Grizzled Veteran", description: "Reach Level 40.", condition: { type: "level", atLeast: 40 }, reward: { kind: "statPoints", amount: 3 }, rewardText: "+3 Stat Points" }
];
