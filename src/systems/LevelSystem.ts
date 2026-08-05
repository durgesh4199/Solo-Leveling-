import type { PlayerStats } from "../types";
import { rankForLevel } from "../data/ranks";

/** XP required to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(20 * Math.pow(level, 1.35) + 15);
}

export interface LevelUpResult {
  leveledUp: boolean;
  levelsGained: number;
  rankChanged: boolean;
}

/** Applies XP to a player's stats in place, handling (multi-)level-up rollover. */
export function grantXp(player: PlayerStats, amount: number): LevelUpResult {
  const previousRank = player.rank;
  let levelsGained = 0;
  player.xp += amount;

  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    levelsGained += 1;
    player.xpToNext = xpForLevel(player.level);
    player.statPoints += 3;

    // Baseline growth per level; extra allocation comes from statPoints.
    player.maxHp += 8;
    player.maxMp += 4;
    player.strength += 2;
    player.agility += 1;
    player.hp = player.maxHp;
    player.mp = player.maxMp;
  }

  player.rank = rankForLevel(player.level);

  return {
    leveledUp: levelsGained > 0,
    levelsGained,
    rankChanged: player.rank !== previousRank
  };
}

export function createNewPlayer(name: string): PlayerStats {
  return {
    name,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    rank: "E",
    hp: 40,
    maxHp: 40,
    mp: 20,
    maxMp: 20,
    strength: 6,
    agility: 5,
    statPoints: 0,
    gatesCleared: 0
  };
}
