import type { Rank } from "../types";

export const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];

/** Minimum hunter level required to hold each rank. */
export const RANK_LEVEL_THRESHOLDS: Record<Rank, number> = {
  E: 1,
  D: 10,
  C: 20,
  B: 30,
  A: 42,
  S: 55
};

export function rankForLevel(level: number): Rank {
  let current: Rank = "E";
  for (const rank of RANK_ORDER) {
    if (level >= RANK_LEVEL_THRESHOLDS[rank]) {
      current = rank;
    }
  }
  return current;
}

export function nextRank(rank: Rank): Rank | null {
  const idx = RANK_ORDER.indexOf(rank);
  if (idx === -1 || idx === RANK_ORDER.length - 1) return null;
  return RANK_ORDER[idx + 1];
}

export const RANK_COLOR: Record<Rank, number> = {
  E: 0x9ca3af,
  D: 0x4ade80,
  C: 0x38bdf8,
  B: 0xa78bfa,
  A: 0xf472b6,
  S: 0xfacc15
};
