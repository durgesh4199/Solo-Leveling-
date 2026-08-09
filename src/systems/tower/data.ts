import type { GateDef, Rank } from "../../types";

const TOWER_GATE_PREFIX = "tower_";

export function towerGateId(floor: number): string {
  return `${TOWER_GATE_PREFIX}${floor}`;
}

/** Parses a `BattleState.gateId` back into a floor number, or null if it
 *  isn't a Tower floor id at all - the one place that knowledge lives, so
 *  Game.resolveGate and every screen that needs to tell "am I looking at
 *  a Tower battle" apart from an ordinary Gate/Exam one all agree. */
export function towerFloorFromGateId(gateId: string): number | null {
  if (!gateId.startsWith(TOWER_GATE_PREFIX)) return null;
  const floor = Number(gateId.slice(TOWER_GATE_PREFIX.length));
  return Number.isInteger(floor) && floor > 0 ? floor : null;
}

/** Which rank-band a floor falls into - purely a flavor/rarity-context
 *  label (drives the archetype silhouette via ARCHETYPE_BY_RANK and the
 *  loot-rarity bonus a kill in this "gate" gets, exactly like a real
 *  Gate's rank already does), *not* what drives raw combat power - that's
 *  the continuous floor-based growth curve in towerFloorGate below, which
 *  never plateaus the way this band table does. */
function towerFloorRank(floor: number): Rank {
  if (floor >= 141) return "S";
  if (floor >= 91) return "A";
  if (floor >= 51) return "B";
  if (floor >= 26) return "C";
  if (floor >= 11) return "D";
  return "E";
}

const TOWER_BOSS_TITLES = ["Sentinel", "Warden", "Keeper", "Guardian", "Overseer"];

/** Synthesizes a GateDef for one Tower floor on the fly - Tower floors
 *  aren't a fixed content table the way GATES_DATA/EXAM_GATES_DATA are
 *  (there's no upper bound on how high a climb can go), so unlike those
 *  they're never registered in GATE_REGISTRY (which is only for content
 *  fixed at build time - see its own doc comment in services/registry.ts).
 *  Game.resolveGate calls this on demand for any battle whose gateId
 *  parses as a Tower floor.
 *
 *  Stats grow linearly (not exponentially) at 3.5% of the floor-1
 *  baseline per floor - gentle enough to stay well-behaved at very high
 *  floor counts (no risk of runaway/overflowing numbers), while still
 *  genuinely endless (no cap coded anywhere). Floor 1's baseline is
 *  tuned close to the first E-rank Gate's own boss (see GATES_DATA's g1
 *  in data.ts) so a fresh Level 1 Hunter can fairly attempt it, the same
 *  way they can fairly attempt g1. */
export function towerFloorGate(floor: number): GateDef {
  const rank = towerFloorRank(floor);
  const growth = 1 + (floor - 1) * 0.035;
  return {
    id: towerGateId(floor),
    rank,
    name: `Tower — Floor ${floor}`,
    enemyTypes: [],
    bossName: `Floor ${floor} ${TOWER_BOSS_TITLES[(floor - 1) % TOWER_BOSS_TITLES.length]}`,
    recommendedLevel: Math.max(1, Math.round(floor * 0.6)),
    baseHp: Math.round(50 * growth),
    baseAtk: Math.round(7 * growth),
    baseDef: Math.round(1 * growth),
    xp: Math.round(20 * growth),
    isTowerFloor: true
  };
}

/** Every 10th floor pays a gold bonus on top of that floor's own normal
 *  boss-kill rewards - a small "you've come a long way" nudge that scales
 *  with the floor, so climbing deeper stays worth it even once a single
 *  floor's own base reward feels small next to the rest of a build's
 *  income. */
export const TOWER_MILESTONE_INTERVAL = 10;

export function towerMilestoneGold(floor: number): number {
  return Math.round(30 * floor);
}
