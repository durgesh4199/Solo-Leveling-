/** Confirmed S-Rank (#10's PlayerState.rank, not merely level-implied) is
 *  required, plus a level floor on top of it - by the time a Hunter is
 *  both, they're realistically done with everything the current content
 *  ceiling offers, which is the entire point of a Reawakening existing:
 *  there's nowhere further up to go *without* one. */
export const REAWAKEN_MIN_LEVEL = 30;

/** Monarch Shards granted by one Reawakening, scaled off the Hunter's
 *  Power Score at the moment of reawakening (a single "how strong were
 *  you" number that already folds in level/stats/gear/Shadows/Relics/
 *  Sets - see Game.powerScore) rather than a second, narrower formula.
 *  Floored at 1 so even a minimally-eligible reawakening always pays out
 *  something. */
export function reawakenShardsFor(powerScore: number): number {
  return Math.max(1, Math.round(powerScore / 250));
}

/** Monarch Shards are never spent - they bank permanently and grant a
 *  small, uncapped `allStatsPct` bonus (folded into Game.effectiveStat's
 *  shared pct, per the "small additive-feeling percentages" guardrail in
 *  EXPANSION_ROADMAP.md) for every shard ever earned. At 0.4% per shard,
 *  a single Reawakening (typically single-digit to low-double-digit
 *  shards at a realistic first-reawaken Power Score) grants a modest but
 *  real head start on the next run, without a shard-farming loop ever
 *  needing a hard cap to stay sane - Reawakening itself is the
 *  rate-limiter (a full run back to Level 30+ S-Rank each time). */
export const PRESTIGE_PCT_PER_SHARD = 0.004;

export function prestigeAllStatsPct(shardsBanked: number): number {
  return shardsBanked * PRESTIGE_PCT_PER_SHARD;
}
