# Hunter Protocol — Long-Term RPG Expansion Roadmap

This is the authoritative backlog and phase order for evolving Hunter
Protocol into a commercial-quality RPG, built incrementally, one feature
at a time. **The order below is fixed by the project owner and must be
followed** — don't reorder, batch, or jump ahead without an explicit
instruction to.

## Standing rules (apply to every feature, every phase)

- Never break existing systems. Never rewrite working code unless the
  feature genuinely requires it.
- Maintain a clean, scalable architecture (see "Architecture decision"
  below) - every new system gets its own module.
- Build one feature at a time. Do not touch unrelated systems while a
  feature is in flight.
- Every feature must be production quality: no placeholders, no TODOs,
  no simplification. If a feature is too large for one pass, split it into
  smaller milestones and finish one completely before starting the next -
  never land a partial milestone and move on.
- Every feature must integrate with existing systems, not sit beside them.
- Every feature must be fully tested (typecheck + build clean, plus Node
  sanity scripts for any new logic - no Playwright, per standing
  instruction) before the next one starts.
- **Wait for an explicit go-ahead before starting the next numbered item.**
  This file tracks status; it does not authorize work by itself.

## Architecture decision

`Data / Systems / Managers / UI / Components / Models / Services /
Storage` separation, applied to *new* systems going forward. The
existing, working `types.ts` / `data.ts` / `store.ts` / `screens/` were
**not** mass-relocated into a new tree - that's pure churn risk with zero
player-facing value and the fastest way to violate "never break existing
systems." Instead:

```
src/
  systems/<name>/        One folder per new system. Each owns its own
                          types.ts + data.ts + logic (+ index.ts for a
                          public API where useful). Established by
                          systems/save/, systems/titles/,
                          systems/achievements/, systems/progress/
                          (shared condition/counter infra).
  services/               Cross-cutting infra a system leans on -
                          storage.ts (localStorage wrapper) today.
  store.ts                Stays the single composition root / Game class.
                          Grows to *call into* systems/* instead of
                          implementing their logic inline.
  types.ts / data.ts       Stay the shared root for what already lives
                          there (combat, gates, itemization, skills,
                          potions). New systems get their own
                          types/data under systems/<name>/.
  screens/                 Stays the UI layer. New systems nest as
                          sub-tabs inside an existing screen (Status
                          gained Titles/Achievements sub-tabs; Inventory
                          already had Gear/Shop/Potions) rather than each
                          claiming a new bottom-tab slot, unless a feature
                          genuinely needs its own top-level screen.
```

See `AI_CONTEXT.md` for the full current-state architecture writeup
(rendering patterns, data model, VFX conventions, etc.) - read that before
touching anything below.

## Phase order (fixed)

### Phase 1 — Foundation
1. **Save/Load System** — ✅ **Done.** `src/systems/save/` +
   `src/services/storage.ts`. Versioned schema (`CURRENT_SCHEMA_VERSION`),
   debounced autosave, beforeunload flush, Title screen Continue/New
   Hunter (with a save preview + confirmed wipe). Persists player, gates,
   shadows, inventory, bag, shop, progress. Never resumes mid-battle by
   design.
2. **Data-driven architecture improvements** — ✅ **Done.** A generic
   `Registry<T>` (`src/services/registry.ts`): O(1) `.get(id)` in place of
   a `.find()` scan, plus a load-time check that throws immediately if two
   entries in a content table ever share an id (previously that mistake
   would only ever surface as "the wrong one turned up" at the point of
   use). Wired up for the 4 tables that had real lookup call sites -
   `GATE_REGISTRY`/`SKILL_REGISTRY`/`POTION_REGISTRY` (in `data.ts`) and
   `TITLE_REGISTRY` (in `systems/titles/data.ts`) - replacing every
   `.find()` on those tables across `store.ts`, `battle.ts`, and
   `gates.ts`. `Game` gained a public `getGate(id)` for the UI, matching
   the pattern the store already used internally. Deliberately did *not*
   add an `ACHIEVEMENT_REGISTRY` - nothing needs achievement-by-id lookup
   yet (achievements are only ever iterated in full), and a registry with
   no real consumer would be exactly the kind of speculative code the
   "no placeholders" rule rules out; add one the day a real call site
   needs it. This is also the pattern every later phase's own content
   table (Talents, Classes, Crafting recipes, Equipment Sets, ...) should
   use for its own id lookups.
3. **Inventory improvements** — ✅ **Done.** Item comparison: tapping a
   bag or Shop item's name/affix block expands a panel showing the exact
   stat delta against whatever's currently equipped in that slot (or a
   pure-gain preview if the slot is empty) - `compareItemAffixes`/
   `affixDeltaText` in `data.ts`, the union of every affix key on *either*
   side so a stat only the equipped item has still shows as a loss, not
   silently dropped. Bag sort (Default/Rarity/Value/Newest) alongside the
   existing slot/rarity filters, default preserves the original array
   order exactly (no behavior change unless the player opts in). Both
   verified via Node scripts against real game data - comparison deltas
   for gains/losses/identical items/stable key ordering, and sort output
   for all four modes including a no-mutation check on the source array.
4. **Equipment affix system** — ✅ **Done** (partially - see deferrals
   below, each with a stated reason rather than a silent drop). Extended
   `AffixKey` with 4 new, fully functional combat-round affixes, each
   wired into real combat math (not a passive stat bump the way hp/mp/crit
   are) and covered by a live-`Game` integration test, not just unit math:
   - **Life Steal** — heals the player for a % of damage their own hit
     (Attack or Skill) deals; `applyLifeSteal()`. Deliberately excludes
     the deployed Shadow's own strikes - it's the Hunter's gear doing the
     stealing.
   - **Attack Speed** — a % chance of an immediate follow-up strike on the
     same target, scoped to the basic Attack only (Skills keep their own
     fixed base/scale "cast" feel). Verified the proc gate is a real
     probability check (a low roll provably does *not* proc), not
     always-on.
   - **Mana Regen** — flat MP restored once a full round completes (every
     enemy in the wave has acted), not per player action - so it still
     ticks on a round where the player just used Attack. No float text (a
     "+N MP" every single round would be visual noise); the MP bar
     filling is feedback enough.
   - **Fire Damage** — flat bonus damage added to every player hit,
     Attack and Skills alike, before the crit multiplier (so a crit
     amplifies it too, same as the STR term). Deliberately has **no**
     elemental/burn mechanic behind it (see deferrals) - it's honest,
     functional bonus damage, not a stub pretending to be something bigger.
   - `priceForItem` extended to price all 4 correctly (each normalized
     back to the same power unit the core stats use, matching the
     existing hp/mp/crit pattern) so Shop prices and sell-back value stay
     consistent for gear rolling the new affixes.

   **Deferred, not dropped** - each needs infrastructure this milestone
   didn't build and that isn't its own item in the fixed order:
   - **Poison** (and Fire/elemental damage *as a DoT*, distinct from the
     flat Fire Damage bonus above) needs a real status-effect/DoT system -
     a per-round damage tick with duration/stacking - which doesn't exist
     yet and isn't its own item in the fixed 20. Building one as a side
     effect of "equipment affixes" would be exactly the kind of unrelated-
     system scope creep the standing rules rule out. Worth raising with
     the project owner as a future item if wanted.
   - **Cooldown Reduction** is meaningless today - Skills have no cooldown
     at all (only MP cost gates them), so a CDR affix would either be a
     silent no-op (forbidden - "no placeholders") or force inventing a
     whole skill-cooldown mechanic as a side effect of an itemization
     milestone. Revisit once/if a cooldown mechanic exists (Talent Tree
     or a combat-depth item are the more natural homes for that).
   - **Sockets** are empty affix slots meant to be filled by a Crafting
     gem. Crafting itself now exists (#14), but as Craft Equipment/
     Reforge/Shadow Essence, not a gem-item type - sockets are still
     unbuilt and remain deferred to whichever future item introduces a
     real gem. Adding an empty, currently-unfillable socket now would
     still be the textbook placeholder the standing rules forbid.

### Phase 2 — Shadows
5. **Shadow Collection** — ✅ **Done** (scoped - see deferrals below).
   `ShadowRecord` gained `archetype`, `level`, `xp`, `loyalty`,
   `battlesFought`. Every listed property from the brief is either real
   now or explicitly deferred with a reason - nothing was added as a
   number that does nothing:
   - **Level/XP** - a deployed Shadow earns XP on every companionStrike
     (2 base, +4 more if that strike kills), rolling over into levels
     exactly like the player's own XP, capped at `SHADOW_MAX_LEVEL` (30)
     so a single Shadow's power can't grow unboundedly. Floats a global
     toast on level-up.
   - **Stats** - scoped to what the game's actual mechanics use: a single
     `power` stat (the only one anything reads - Shadows have no HP, take
     no hits, don't guard). `effectiveShadowPower()` = base rank power +
     level growth (8%/level of base) + a small Loyalty bonus, mirroring
     the player's raw-stat-vs-effectiveStat split (`power` on the record
     stays the stable Arise-time snapshot).
   - **Passive Skill / Active Skill** - the real depth of this item: 6
     archetypes (the same 6 that already drive portrait/rim-glow), each
     with one always-on passive and one active that has a % chance per
     companionStrike to replace the normal hit with something bigger -
     `src/systems/shadows/data.ts`'s `SHADOW_SKILLS`. Goblin (execute
     bonus / double strike), Orc (flat damage% / 2.2x big hit), Wraith
     (mana-on-hit / 3-hit flurry), Knight (heal-on-hit / armor pierce),
     Beast (raised crit chance / guaranteed crit), Wyrm (gold-on-kill /
     AoE breath). All 12 formulas verified via a live `Game` instance
     with deterministic (mocked) RNG, not just isolated math.
   - **Loyalty** - +1 per wave cleared while deployed, capped 100, never
     decays (a standing "fought together" record, not a punishable
     resource with no clear driver to justify decay).
   - **Mood** - derived from Loyalty (`shadowMood()`), not a second
     independently-tracked number - there's no other mechanic (feeding,
     training, ...) to drive a separate Mood value, and inventing one
     ungrounded would be exactly the kind of scope creep the standing
     rules warn against. Still real and displayed, just computed.
   - **Duplicate handling: Merge** - `Game.mergeShadow(keepId)` merges
     with the *weakest* same-species duplicate (never costs you your best
     copy by accident), transferring half its levels (minimum 1) and a
     Loyalty bump to the survivor. UI: a minimal extension of the
     existing Shadow Army screen (a "Merge Duplicate" button + confirm),
     not a redesign - that's #7's job.

   **Deferred, not dropped:**
   - **Equipment Slots** - needs a management UI to equip/unequip through,
     which is explicitly #7 (Shadow Management UI), the very next item.
     Building it here would just get redone.
   - **Evolution Stage** - is #6 (Shadow Evolution) by name; adding an
     `evolutionStage` field now with nothing to change it would be inert
     - the textbook placeholder the standing rules forbid.
   - **Convert duplicates to Shadow Essence** - delivered in #14
     (`Game.disenchantShadow`), and deliberately broadened past the
     original "duplicates only" framing once Crafting gave Essence
     something real to buy: any owned Shadow can be disenchanted, not
     just spare copies. Merge (above) remains the separate
     duplicates-only path for when you'd rather keep the fighting power.
6. **Shadow Evolution** — ✅ **Done.** `ShadowRecord` gained `evolutionStage`
   (0 = original Arise form). Evolving a fully-leveled Shadow (`level ===
   SHADOW_MAX_LEVEL`) advances it to the next rank tier - deliberately
   reusing the exact rank -> archetype -> power pipeline every Shadow
   already goes through once at Arise time (`ARCHETYPE_BY_RANK`,
   `SHADOW_RANK_POWER`) instead of inventing a second, parallel
   progression system:
   - **Rank advances one tier** via `nextShadowRank()` (new, in
     `systems/shadows/data.ts`) - E→D→C→B→A→S. S-rank Shadows have
     nowhere further to go and can't evolve again.
   - **Archetype advances with it** (`ARCHETYPE_BY_RANK[newRank]`) - since
     archetype is rank-locked everywhere else in the game (portrait,
     rim-glow, `SHADOW_SKILLS`), an evolution is a genuine transformation:
     new silhouette, new passive/active skill pair, higher power ceiling -
     not just a bigger number on the same Shadow. This is what "Evolution
     Stage" from the original brief actually delivers on.
   - **Power baseline jumps** to the new rank's `SHADOW_RANK_POWER` value -
     `effectiveShadowPower()` (unchanged) then grows it again from there
     via level/loyalty exactly like any other Shadow.
   - **Level/XP reset to 1/0** on evolve, so growth keeps meaning
     something in the new, stronger form rather than a Shadow sitting
     maxed forever after one evolution. `name`/`type`/`loyalty`/
     `battlesFought` - the Shadow's identity and history - carry over
     unchanged; evolving is not re-Arising.
   - **Gold-gated**, scaled to the rank being left behind
     (`SHADOW_EVOLUTION_COST`: E 150g, D 400g, C 800g, B 1400g, A 2200g) -
     evolution is a milestone earned through play, not a free flip.
   - UI: Shadow Army cards show an "Evolve to X-Rank · Ng" button once a
     Shadow is maxed (mirrors the existing Merge confirm pattern - a
     Cancel/Confirm step, disabled-with-tooltip if gold is short) and a
     small evolution-count badge (⚡×N) once a Shadow has evolved at least
     once, so the history stays visible on the card, not just implied.
   - Save compatibility: `continueSave()` defaults `evolutionStage` to 0
     for any Shadow loaded from a save that predates this field.
   - Verified via a live `Game` instance: rejects evolve below max level
     (no mutation), rejects at S-rank (`max-rank`), rejects without enough
     gold (no mutation, exact reason returned), correctly advances rank/
     archetype/power/evolutionStage and resets level/xp on success, gold
     deducted by the exact tiered cost, loyalty/battlesFought/name/type
     preserved across the transformation, and an unknown id is a graceful
     no-op.
7. **Shadow Management UI** — ✅ **Done.** Delivers the two properties #5
   explicitly deferred to this item: Equipment Slots and a real management
   UI to work them through, plus renaming (raised in "Known limitations").
   - **`ShadowRecord.equipment: Partial<Record<ItemSlot, LootItem>>`** -
     the exact same `LootItem`/`ItemSlot`/Bag system the Hunter's own
     `player.equipment` already uses, not a second itemization model.
     `Game.equipShadowItem(shadowId, itemId)` / `unequipShadowItem(shadowId,
     slot)` mirror `equipItem`/`unequipItem`'s move-from-bag/swap-in/
     return-previous logic exactly. A piece of gear is worn by the Hunter
     or by one Shadow, never both - equipping it onto a Shadow pulls it
     out of the shared Bag.
   - **Combat integration**: core-stat affixes (STR/AGI/INT/VIT/PER) fold
     into `effectiveShadowPower()` at a fixed conversion rate (Shadows
     have no stats of their own to feed the way the Hunter's do) -
     `POWER_PER_STAT_AFFIX` in `systems/shadows/data.ts`. The four
     combat-round affixes apply inside `Game.companionStrike` exactly the
     way the Hunter's own gear works: **Fire Damage** adds flat bonus
     damage to every strike, **Crit** adds an independent chance at the
     1.8x multiplier, **Life Steal** heals the *player* off the Shadow's
     own damage dealt (`applyLifeSteal` generalized to take an explicit
     `pct` parameter so both the Hunter's gear and a Shadow's gear share
     one heal implementation), **Attack Speed** grants a chance at one
     more strike against whatever's still standing after the primary
     action resolves. **Mana Regen** ticks alongside the Hunter's own at
     the existing per-round-completion site in `enemyTurn`. `hp`/`mp`
     affixes are deliberately inert on Shadow gear - a Shadow has no
     HP/MP pool of its own to restore, a structural fact rather than a
     deferred feature (documented in code, not silently dropped).
   - **Rename**: `Game.renameShadow(shadowId, name)` - trims and caps at
     `SHADOW_NAME_MAX_LENGTH` (28), rejects a blank result. UI is an
     inline text input replacing the name row (Save/Cancel), not a native
     `prompt()`, matching every other confirm-style interaction on this
     screen.
   - **UI** (`screens/shadows.ts`): a per-card "Manage Gear" toggle
     expands 6 compact slot rows (icon, filled-item name in its rarity
     color or "Empty", Equip/Unequip); Equip opens an inline picker of
     matching-slot Bag items sorted by value, closes itself once one is
     chosen. A pencil-icon button next to the name opens the rename
     input. Both follow the established "closure-held view state, redraw
     on every action" pattern already used for Merge/Evolve confirms.
   - **Integrity fixes required by adding gear, not optional polish**:
     `mergeShadow` now returns the *consumed* Shadow's equipped items to
     the Bag instead of silently deleting them with the Shadow record -
     gear a player equipped is never destroyed by a merge. `continueSave()`
     defaults `equipment` to `{}` for saves that predate this field,
     alongside the existing `evolutionStage` default from #6.
   - **Shared helper**: `sumEquipmentAffix(equipment, key)` (new, in
     `data.ts`) replaces `Game.equipmentAffixSum`'s inline loop and is
     reused by the Shadow-power and companionStrike code above - one
     implementation for "sum this affix across an equipment map" instead
     of two copies (Hunter, Shadow) drifting apart.
   - Verified via a live `Game` instance: equip/unequip/slot-swap (with
     correct bag round-tripping), power bonus from a core-stat affix
     matches the documented conversion rate, rename trims/caps/rejects-
     blank/no-ops-on-unknown-id, merge returns a consumed Shadow's gear to
     the Bag, and each of fireDamage/crit/lifeSteal/attackSpeed measurably
     changes `companionStrike`'s behavior when rolled onto Shadow gear.

### Phase 3 — Character progression
8. **Talent Tree** — ✅ **Done.** A second, smaller currency alongside the
   existing per-level stat points: 1 Talent Point per level
   (`TALENT_POINTS_PER_LEVEL`), spent permanently (no respec) on a
   15-node tree - 3 branches (Offense/Defense/Utility) x 5 tiers, each
   branch a single linear path (tier N needs tier N-1 in the *same*
   branch already learned) rather than a full node graph, so "invest
   deeper in one branch or spread across all three" stays a real, legible
   choice without needing graph-layout UI.
   - `src/systems/talents/` (new system, mirrors Titles' own structure):
     `types.ts` has `TalentBonus` - the exact same 5 kinds `TitleBonus`
     already uses (statPct/allStatsPct/xpPct/goldPct/critFlat), so every
     value reuses formulas/pipelines that already exist rather than
     inventing new ones. The difference from Titles: many nodes can be
     unlocked *simultaneously* (a Title is one-equipped-at-a-time), so
     every read site sums across all unlocked nodes
     (`talentStatPct`/`talentCritFlat`/`talentXpPct`/`talentGoldPct` in
     `data.ts`) instead of reading one active bonus.
   - **Branch identities**: Offense stacks STR + Crit into a glass-cannon
     capstone (+10% STR); Defense stacks VIT/INT into an all-stats
     capstone (+5% All Stats); Utility trades AGI/PER into a Gold/XP
     economy with a Crit capstone (+5% Crit) - three genuinely different
     builds, not one tree relabeled three times.
   - **Stacking is additive, not compounding**: `effectiveStat`,
     `critChance`, `grantXp`, and `grantKillRewards` each already read an
     equipped Title's bonus; extending them for Talents combines the
     Title's percentage and the summed Talent percentage into *one*
     number before applying a single multiply, rather than two nested
     multiplies - two independent +3% bonuses become a flat +6%, not a
     silently-compounding 6.09% (the "no multiplier chains" guardrail in
     this file applies just as much *between* systems as within one).
   - **`Game.learnTalent(nodeId)`** (public): spends one point, requires
     the node's prerequisite already learned, rejects an already-learned
     node (no double-spend) and an out-of-points attempt, with no state
     mutation on any rejection path.
   - **Save migration**: `talents` is a brand-new top-level `GameState`
     slice, so a save from before this item has no such field at all -
     rather than just defaulting to 0 points and leaving an already-
     leveled Hunter permanently behind on a currency that didn't exist
     when they earned those levels, `continueSave()` grants a one-time
     catch-up of 1 point per level already reached the first time such a
     save loads. A save that already has a `talents` field (created after
     this item shipped) is loaded as-is, no double-grant.
   - **UI**: a 4th sub-tab ("Talents") on the Status screen, next to
     Titles/Achievements - 3 columns, one per branch, each a top-to-bottom
     tier list with a thin connecting line; a node shows Learned
     (checkmark), Available (a Learn button, disabled with a tooltip if
     out of points), or Locked (dimmed, prereq not met) - not hidden
     entirely, since seeing the rest of a branch's path is the point of a
     tree. The Status sub-tab also surfaces an accent-bordered "Talent
     Points available" hint whenever there's a point to spend, so it's
     not buried behind a tab the player has no reason to open yet.
   - Verified via a live `Game` instance: full learn-gating (locked/
     already-learned/no-points/unknown-id, each confirmed to leave state
     unmutated on rejection), Talent Points granted 1:1 with levels
     gained in the same `grantXp` call that grants stat points (no
     regression there), additive (not compounding) stacking with a Title
     bonus verified numerically at both small and large stat values,
     critChance/gold-reward integration, and both the fresh-save and
     already-migrated `continueSave()` paths.
9. **Hunter Classes** — ✅ **Done.** The 5 classes Solo Leveling itself
   uses for Hunters (Fighter/Mage/Tank/Assassin/Healer), chosen once and
   permanently (no respec) from `CLASS_UNLOCK_LEVEL` (5) onward.
   Deliberately *not* another statPct/critFlat clone of what Titles (#1
   Phase) and Talents (#8) already do - each class's bonus lands in
   exactly one specific combat formula instead of the shared generic
   pipeline, so the choice feels like a real identity, not a sixth
   flavor of the same percentage:
   - **Fighter** — +12% damage on basic Attacks only (`rollBasicAttack`).
   - **Mage** — +12% damage on Skills only (`useSkill`).
   - **Assassin** — +30% added to the crit *multiplier* itself (1.8 ->
     2.1), via a new shared `critMultiplier()` used by both
     `rollBasicAttack` and `useSkill` - deliberately not applied to the
     deployed Shadow's own crit in `companionStrike` (its own separate
     `* 1.8` literal, untouched), the same "it's the Hunter's own build,
     not the Shadow's" line equipment Life Steal already draws.
   - **Tank** — shaves further off Guard's existing damage-mitigation
     multipliers (0.4 normal-hit / 0.75 special-hit while guarding),
     floored at 0.05 so Guard can never reduce incoming damage to zero.
   - **Healer** — +20% healing specifically from HP potions
     (`useItem`'s `kind === "hp"` branch) - deliberately excludes MP
     potions, which are a resource to spend, not something a "Healer"
     identity is about restoring more of.
   - `PlayerState.hunterClass: HunterClassId | null` - no new save-
     migration path needed (unlike #8's `talents`): `PlayerState` is
     already persisted whole, and every read site treats a missing/
     `undefined` field the same as `null` ("no class chosen"), so an old
     save just reads as "hasn't picked yet" with zero special-casing.
   - UI: a 5th Status sub-tab ("Class") - locked message below the
     unlock level, a Cancel/Confirm choice per class once unlocked
     (mirrors Shadow Army's Merge/Evolve confirm pattern - this is
     permanent, so it earns the same "are you sure" step), and just the
     chosen class's card once one is set, since there's nothing left to
     choose.
   - Verified via a live `Game` instance: full choose-gating (below
     unlock level, unknown id, already-chosen - each confirmed to leave
     `hunterClass` unmutated), each of the 5 formula integrations
     measured directly against its documented percentage, and an
     explicit check that Assassin's crit-multiplier bonus does *not*
     leak into the deployed Shadow's own crit damage.
10. **Promotion Exams** — ✅ **Done.** `rankForLevel(level)` (data.ts) used
    to be the *only* notion of "rank" in the game - the instant your
    level crossed a threshold, every rank-driven system (Shop stock,
    Arise'd Shadow power, the portrait aura, "reach rank X" Title/
    Achievement conditions) treated you as already there. That's now
    split in two: `rankForLevel(level)` stays exactly as it was (the rank
    your *level alone* would qualify you for), and a new
    `PlayerState.rank` is the Hunter's *officially confirmed* rank -
    every one of those systems reads `player.rank` now, not
    `rankForLevel(player.level)`. The gap between the two is what a
    Promotion Exam closes.
    - **The exam itself is a real fight, not a menu toggle**: 5 new
      `GateDef` entries (`EXAM_GATES_DATA`, one per rank D through S)
      flagged `isPromotionExam`, which collapses `totalEnemiesForGate` to
      a single solo boss - no trash waves. Stat baselines are hand-tuned
      a notch above the first gate of the rank being left behind, so it
      reads as "harder than what you've been fighting," not a formality.
      Because it's a real `GateDef`, `Game.startBattle` runs it with
      *zero* special-casing - the entire combat/loot/XP engine already
      works for it.
    - **`Game.examEligibleRank()`** compares `rankForLevel(player.level)`
      against `player.rank` and offers only the *next* tier up, even if
      level has raced several thresholds ahead in one big XP grant - one
      exam at a time, in order, never skipping straight to the top.
    - **`Game.completePromotionExam`** (private, called from
      `onWaveCleared` when the cleared gate is an exam) confirms the new
      rank and pays a one-time gold + stat point reward
      (`PROMOTION_REWARD`, systems/exams/data.ts) *on top of* the fight's
      own normal kill rewards - and, since crossing into a new rank can
      itself satisfy a "reach rank X" Title/Achievement condition,
      *on top of* whatever `refreshProgress()` grants for that too. All
      three stack by design. Deliberately does **not** mark the exam gate
      in `gatesCleared` - it isn't one of the 20 explorable gates the
      "clear every gate" condition counts.
    - **No Arise after an exam**: `ariseShadow()` already only accepts a
      `"wave-clear"`/`"gate-clear"` battle result; the new `"exam-pass"`
      result is neither, so it's refused for free with no special-casing
      needed there either - a Proctor isn't a monster to command as a
      Shadow.
    - **Save migration**: unlike `hunterClass` (a missing field safely
      reads as "none chosen"), `rank` has no meaningful falsy state - an
      old save gets it backfilled from `rankForLevel(level)` in
      `continueSave()`, so an already-leveled Hunter keeps the rank their
      level already implied rather than being knocked back to E. The
      Title screen's save *preview* (before `continueSave()` actually
      runs) falls back the same way, since it reads potentially-
      unmigrated data.
    - **UI**: a Promotion Exam banner on the Gates screen (above the
      normal 20-gate list, not mixed into it) whenever
      `examEligibleRank()` is non-null; a distinct "Promoted!" result
      panel in battle (no Arise button) instead of the normal "Gate
      Cleared" one; a new gold-white `global-toast.promotion` style for
      the announcement.
    - Verified via a live `Game` instance: eligibility gating (including
      the "leveled past several tiers, still only offers the next one"
      case, and "already S-Rank, no further exam"), `startPromotionExam`
      resolving the correct single-boss gate, a full win resolving to the
      correct confirmed rank / `"exam-pass"` result / gold+stat reward /
      an untouched `gatesCleared`, a loss leaving rank unchanged, three
      call sites (`rerollShop`, `ariseShadow`, `progressContext`) reading
      confirmed rank instead of level-implied rank in a scenario where
      the two disagree, and both `continueSave()` migration paths (missing
      field backfilled vs. already-present field left alone).

### Phase 4 — Content variety
11. **Dungeon Modifiers** — ✅ **Done.** Expanded from 4 real modifiers (+
    "none") to 11 (+ "none") and, more importantly, from 4 tunable knobs
    to 7 - `GateModifier` gained `enemyDefMult`, `eliteChanceBonus`, and
    `goldMult`, none of which any modifier could touch before (nothing
    previously varied a fight's defense, its odds of fielding an Elite,
    or its gold reward).
    - **Three rough tiers**, so the roll itself carries weight, not just
      the numbers inside each entry: mild/common (Blessed, Bountiful,
      Swift, **Wealthy** and **Generous** [both new], **Frail** [new] -
      one knob nudged, no real downside), moderate/risk-reward (Vicious,
      **Elite Surge**, **Tempered**, **Fortified** [all new] - a real
      enemy buff paired with a real reward bump), and **Cursed** [new] -
      the one stacked atk+hp+def buff, deliberately the rarest via the
      new per-modifier `weight` field (`pickWeightedModifier` in
      data.ts, the same cumulative-weight technique `rollRarity` already
      uses for loot tiers) rather than every real modifier being equally
      likely to come up.
    - **`eliteChanceBonus`** stacks additively onto the flat 12% base
      elite-spawn roll, capped at 60% so even Elite Surge never turns a
      trash wave into an all-Elite wave.
    - **`enemyDefMult`** applies to both trash and the wave's boss
      (`makeEnemies`, store.ts) - previously nothing in a `GateModifier`
      touched defense at all.
    - **`goldMult`** applies in `grantKillRewards` as its own separate
      multiplier layered on top of the Title/Talent gold percentage (the
      same "gear-then-multiplier" ordering `effectiveStat` already
      uses), defaulting to 1 (a no-op) for every modifier that isn't
      specifically about gold.
    - The existing 4 knobs (`xpMult`/`loot`/`enemyAtkMult`/
      `enemyHpMult`) and the ~40%-chance-of-"none" roll structure are
      untouched - this is additive, not a rebalance of what already
      worked.
    - Verified via a live `Game` instance: `GATE_MODIFIERS` shape/count,
      "none" is a true no-op across every knob, weighted rolling never
      returns "none" above the 40% threshold and never returns a real
      modifier below it, `enemyDefMult` doubling both trash and boss
      defense exactly, `eliteChanceBonus` measurably raising the elite
      roll's outcome at a fixed `Math.random` value, `goldMult` applying
      correctly in `grantKillRewards`, and a `null` battle modifier
      still behaving as a pre-#11-identical 1x no-op.
12. **Random Events** — ✅ **Done.** New `src/systems/events/` - a ~25%
    chance (`RANDOM_EVENT_CHANCE`) of one of 5 weighted event types firing
    on a wave-to-wave transition (`Game.advanceWave`), never on the very
    first wave of a run (that's `startBattle`, not `advanceWave`) and
    never for a Promotion Exam trial (single-wave, `advanceWave` is never
    called for one at all).
    - **Every effect is instant/one-shot** - flat gold (Gold Cache),
      one guaranteed bonus item (Hidden Cache, reusing the existing
      `generateLoot`/`rollRarity` loot pipeline directly), a % of missing
      HP/MP restored (Healing Spring), or one bonus enemy joining the
      very next wave (Ambush!). Deliberately **not** a temporary buff/
      debuff with a duration - that's real infrastructure this system
      doesn't have (combat status effects are still their own separate,
      unbuilt future item), and building one as a side effect of Random
      Events would be exactly the unrelated-system scope creep the
      standing rules rule out.
    - **Toll Shrine** is the one real risk/reward entry - costs a % of
      max HP, pays out more gold than a plain Gold Cache, floored so it
      can never itself bring the Hunter below 1 HP (a flavor event
      should never be what ends a run outright).
    - **Ambush is excluded from the pool whenever the upcoming wave is
      the boss wave** - a surprise extra enemy right as the Hunter walks
      into the fight they were already building up to reads as unfair,
      not fun, so it's scoped out entirely rather than firing
      indiscriminately.
    - Gold amounts scale by a new `RANDOM_EVENT_RANK_MULT` table (rank
      E->S, mirroring how `GATES_DATA`'s own `xp` column already ramps
      roughly 1x->8x) so a Gold Cache/Toll Shrine's flat base amount
      still feels proportionate at every rank.
    - **Refactor required to reuse trash-unit generation for Ambush's
      bonus unit**: `Game.makeEnemies`'s trash-generation body was
      extracted into `Game.makeTrashUnit` (same formula, now also usable
      with a `forceElite` flag) rather than duplicating that formula a
      second time and risking the two drifting apart. Verified behavior-
      identical via the same #11 modifier tests re-run clean.
    - New `COUNTER_KEYS.randomEventsTriggered` counter (increments once
      per event that actually fires) - real integration with the
      existing Progress system, giving a future Achievement/Title
      something to key off, the same way every other lifetime counter
      already does.
    - New `global-toast.event` style (green) for the announcement -
      distinct from achievement/title/shadow/promotion toasts.
    - Verified via a live `Game` instance: the ~25% threshold and the
      ambush-excluded-on-boss-waves rule (2000-trial statistical check
      confirming ambush *can* occur off a boss wave and *never* occurs
      into one), every effect's exact numeric formula in isolation
      (`applyRandomEvent`), the toll's 1-HP floor, and the full
      integrated `advanceWave()` path over 800 trials - confirming the
      bonus Ambush unit really gets appended to `battle.enemies`, the
      trigger rate lands in the expected statistical band, and a
      Math.random-forced "no event" run reproduces the exact pre-#12
      enemy count with zero regression.
13. **Better Enemy AI** — ✅ **Done.** Three real, tuned behaviors added
    to `decideEnemyAction` on top of the original turtle-when-hurt/press-
    when-guarded logic (untouched, not replaced):
    - **Boss enrage** - a boss at or below 25% HP
      (`Game.BOSS_ENRAGE_HP_PCT`) always uses its special attack, no roll
      involved - a real phase-change moment instead of a boss playing
      exactly like a bigger trash unit all the way to 0 HP. A one-time
      `grows desperate and unleashes a fierce strike!` toast announces
      the moment it happens (new `BattleState.bossEnraged` flag so it
      only fires once per boss, not every enraged round after); later
      enraged rounds fall back to the plain "unleashes a fierce strike!"
      text every ordinary special already gets.
    - **Elite aggression** - Elites are bruisers, not turtles: a lower
      base guard chance than plain trash, layered on top of the
      existing "threatening -> more special" bump they already shared
      with bosses. Distinct from the boss's enrage behavior on purpose -
      each of the 3 additions has its own flavor rather than every
      "tougher" unit getting the same treatment.
    - **Pressing the advantage** - when the *player* drops below 30% HP,
      every enemy's guard chance drops hard (floored at 0) and special
      chance climbs - a close fight doesn't let the player stall it out
      by guarding against an AI that doesn't notice it's winning.
    - Verified via a live `Game` instance, calling `decideEnemyAction`
      directly at deterministic `Math.random` values chosen to sit
      between two behaviors' actual thresholds (e.g. a roll between
      Elite's and plain trash's guard-chance cutoffs, so the same roll
      produces "guard" for one and "special" for the other) - confirms
      enrage bypasses the roll entirely and is boss-only (a non-boss
      unit at the identical low HP% is unaffected), Elite's lower guard
      chance, and the player-HP-aware guard/special shift. Also verified
      the full `enemyTurn` integration: the enrage toast's distinct text
      fires exactly once, and a later still-enraged round reads with the
      ordinary special text instead of repeating it.

### Phase 5 — Itemization depth
14. **Crafting** — ✅ **Done.** New `src/systems/crafting/` and a new
    player-scoped resource, `PlayerState.shadowEssence`, earned exactly one
    way: disenchanting a Shadow (`Game.disenchantShadow`). This is the
    "Convert duplicates to Shadow Essence" property deferred from #5 back
    when Essence had nothing to spend on - it's deliberately **not**
    limited to duplicates now that Crafting exists to give it a purpose;
    any owned Shadow can be disenchanted, Merge (duplicates-only) stays
    the separate, still-useful "keep fighting power, lose the copy" path.
    - **`essenceFromShadow`** derives the payout from the exact same
      `effectiveShadowPower()` combat/Power-Score formula every other
      Shadow-strength read already uses (rank + level + loyalty + its own
      equipped gear), not a second, independently-tuned number that could
      drift out of sync - a strong Shadow is worth more Essence for the
      same reason it's worth more in a fight. Any gear the disenchanted
      Shadow had equipped returns to the Bag first, same as Merge already
      does; only the Shadow record itself is lost.
    - **Craft Equipment** (`Game.craftEquipment`, new Craft sub-tab in
      Inventory) - spends Essence + gold for a *guaranteed* item at a
      slot the player picks, at their confirmed rank (#10). Reuses
      `generateLoot` unchanged except for one new optional 3rd parameter,
      `forcedSlot` - when omitted, `generateLoot` still rolls a random
      slot exactly as it always has (verified as an explicit regression
      case), so every pre-#14 call site (Shop stock, gate loot drops,
      Random Events' Hidden Cache) is untouched. Craft Equipment's rarity
      roll uses a bigger bonus (`CRAFT_RARITY_BONUS = 0.15`) than the
      Shop's own reroll bonus (0.05) - it costs real Essence, not just
      gold, so it needs to be a meaningfully better bet than another Shop
      reroll rather than a slower way to buy the same odds.
    - **Reforge** (`Game.reforgeEquippedItem`, same Craft sub-tab) -
      rerolls an *equipped* item's affixes in place, keeping its slot and
      rarity fixed and generating everything else fresh via the same
      `generateLoot(rank, item.rarity, slot)` call. Costed by the item's
      *own* rarity (`REFORGE_COST_BY_RARITY`), not the Hunter's rank - a
      higher-rarity item has more affixes to reroll regardless of what
      rank the Hunter currently is. Calls the existing `clampVitals()`
      afterward for consistency with every other equipment-mutating path,
      even though a reforge can't itself put HP/MP out of bounds.
    - **No confirm step on either action** - both are "spend for an
      outcome" purchases costed directly on their button, the same
      pattern the Shop's buy button already uses, not a permanent-choice
      confirm like Merge/Evolve/Disenchant (which does get one, since
      disenchanting is irreversible and loses the Shadow outright).
    - **Sockets remain deferred** - the #4 affix system still doesn't have
      a "Crafting gem" to fill an empty socket with, and this item didn't
      introduce one; sockets stay scoped to whichever future item adds a
      real gem-item type; nothing new here changes that plan.
    - New save-migration case, the third and most restrictive of the
      three now-documented patterns: `shadowEssence` is a **new field on
      an already-persisted object with no safe falsy default**, since it
      participates directly in arithmetic (cost comparisons, subtraction)
      where `undefined` would silently produce `NaN` rather than reading
      as "none yet" the way `hunterClass: null` safely does - so
      `continueSave()` explicitly backfills it to `0` for any save from
      before this item, exactly the same shape as the `rank` backfill
      added in #10.
    - Verified via a live `Game` instance: `essenceFromShadow`'s formula
      and its floor-at-1 minimum, `disenchantShadow` (correct essence
      payout, army removal, gear returned to Bag, unknown-id no-op),
      `craftEquipment` (affordable case producing the forced slot and
      deducting both currencies, essence-short and gold-short rejections
      each leaving state untouched, a second slot to confirm the force
      isn't hardcoded to one), `reforgeEquippedItem` (in-place equipment
      swap keeping slot/rarity, cost deduction, empty-slot rejection,
      insufficient-funds rejection leaving the original item untouched,
      HP staying in bounds afterward), `generateLoot`'s new `forcedSlot`
      parameter both with and without an argument (confirming omission
      still randomizes, exactly matching pre-#14 behavior), and the
      `continueSave()` backfill for a save missing `shadowEssence`.
15. **Relics** — ✅ **Done.** New `src/systems/relics/` and a new
    top-level `GameState.relics: RelicState` slice (`{ ownedIds,
    equippedIds }`). What makes a Relic a genuinely different system from
    Titles/Talents/Classes, not a reskin of one of them:
    - **Titles**: milestone-unlocked, exactly one equipped at a time.
    - **Talents**: level-gated currency, many permanently unlocked at
      once, no respec.
    - **Hunter Class**: one permanent pick, each bonus lands in one
      specific combat formula rather than the shared pct pipeline.
    - **Relics**: **found**, not earned - a `RelicBonus` (the same 5-kind
      shape `TitleBonus`/`TalentBonus` already use, duplicated for the
      same "unrelated systems, shared shape" reason `TalentBonus`
      duplicates `TitleBonus`) percentage that a player can *own* many of
      but only *equip* `RELIC_SLOT_COUNT` (3) at once, freely swappable
      any time with no cost and no permanence - a real loadout choice
      layered on top of an RNG acquisition system, a combination none of
      the three above have.
    - **Acquisition**: a real Gate boss clear (never trash, never a
      Promotion Exam boss - `Game.onWaveCleared` branches exam gates off
      to `completePromotionExam` before the roll is ever reached, and an
      exam gate isn't one of the 20 explorable Gates anyway) has a flat
      15% chance (`RELIC_DROP_CHANCE`) of dropping a brand-new, not-yet-
      owned Relic, weighted toward the common "minor" tier over "greater"
      over the rare "ancient" tier (`rollRelicDrop`, the same cumulative-
      weight technique `pickWeightedModifier`/`rollRandomEvent` already
      use). Once every Relic in the 14-entry starter roster (6 minor/5
      greater/3 ancient) is owned, the roll is a harmless no-op - the same
      "ran out of content to grant" shape Achievements already has.
    - **`Game.equipRelic`/`unequipRelic`** - equip is a no-op (not an
      error) for an unowned id, an already-equipped id, or when all 3
      slots are full; unequip just frees the slot. No confirm step -
      unlike Merge/Evolve/Disenchant, swapping a loadout costs nothing and
      loses nothing, so there's no permanent choice to guard.
    - **Fourth system now folding into the shared additive pct pipeline**
      (`effectiveStat`/`critChance`/`grantXp`/`grantKillRewards`) -
      `relicStatPct`/`relicCritFlat`/`relicXpPct`/`relicGoldPct` sum
      across `equippedIds` only (owned-but-unequipped Relics contribute
      nothing) and fold into the same single combined `pct` Title + Talent
      already combine into before one multiply, per the "no multiplier
      chains" guardrail - title + talent + relic all add, never
      compound.
    - New Relics sub-tab on Status (`renderRelics`, screens/stats.ts) -
      every roster entry always shows its name/description/bonus (the
      same "locked but not hidden" convention Titles already use), only
      the action slot differs: Not Found / Equip / Equipped, with the
      Equip button disabling once the 3-slot cap is hit.
    - New `global-toast.relic` style (bronze) for the "Relic Found:
      &lt;name&gt;" announcement on drop.
    - New save-migration case: `relics` is a **brand-new top-level slice**
      on an old save, same shape as Talents' own missing-slice case (#8),
      but *without* a retroactive catch-up grant - a Relic is found, not
      earned by leveling, so a save missing the slice legitimately just
      owns none yet; `continueSave()` defaults it to
      `{ ownedIds: [], equippedIds: [] }`.
    - Verified via a live `Game` instance: roster id-uniqueness and
      registry resolution, `rollRelicDrop` excluding owned ids (down to
      the exactly-one-left-in-pool case) and returning `null` once
      everything's owned, a 500-trial statistical check that the weighted
      tiers aren't collapsing to one, all four `relic*Pct` helpers summing
      correctly (including `allStatsPct` contributing to a stat with no
      direct relic), `equipRelic`/`unequipRelic`'s full state machine (no-
      op on unowned, cap enforcement, idempotent re-equip, slot reuse
      after unequip), each of the four shared formula sites actually
      reflecting an equipped Relic's bonus, a forced boss-clear roll
      correctly granting the one remaining Relic and firing the toast, a
      non-boss wave clear and a Promotion Exam boss clear each never
      rolling a Relic even with `Math.random` forced to guarantee a drop
      if the code path were ever reached, and the `continueSave()`
      backfill for a save missing the `relics` slice entirely.
16. **Equipment Sets** — ✅ **Done.** New `src/systems/sets/` and one new
    optional field, `LootItem.setId?: string` - undefined-safe everywhere
    it's read (no save migration needed, same "genuinely falsy-safe"
    shape `hunterClass: null` already established, unlike Relics/Crafting/
    Tower/Prestige's new top-level slices which all needed one).
    - **What makes a Set genuinely different from Relics** (both are RNG
      boss drops): a Relic is a wholly separate accessory slot dimension
      that never competes with the 6 core gear slots; a Set piece *is*
      ordinary gear - it drops into the same paperdoll slots as any other
      loot and directly competes with the best-rolled affix roll for that
      slot. The tension a Set creates is real: commit to matching pieces
      for a threshold bonus, or keep whatever rolled the best individual
      affixes.
    - **3 sets, one per broad build identity** (offense/defense/utility,
      the same 3-way split the Talent Tree's branches already use) -
      Vanguard's Warplate (STR/Crit), Warden's Bulwark (VIT/INT/All
      Stats), Nightstalker's Guise (AGI/Gold/Crit) - each covering all 6
      gear slots, always "legendary" rarity (`generateSetPiece`) so a set
      piece reads as a real find the instant it drops, no separate lucky
      rarity roll needed on top.
    - **`generateSetPiece` reuses `generateLoot`'s own rank-power/
      `rollAffixValue` machinery** rather than a second, independently-
      tuned formula - a set piece's *name* and *which* affix keys it
      rolls are fixed by its `SetPieceDef` (always recognizably "this"
      piece), but the numeric *magnitude* of each affix still scales with
      the rank it drops at, so a Set piece never goes stale at high ranks
      the way a hand-authored flat number would have.
    - **Threshold bonuses are cumulative** (2pc/4pc/6pc, not "replace the
      previous tier") - at 4 pieces equipped, both the 2pc and the 4pc
      bonus are active at once, so committing deeper into one set over
      mixing loose pieces keeps paying off at every step.
    - **No ownership tracking** the way Relics have (`RelicState
      .ownedIds`) - a set piece is a plain `LootItem` sitting in the Bag/
      equipment like any other, so a duplicate drop is no different from
      any other loot duplicate (sell it like one).
    - **Fifth system into the shared additive pct pipeline** - `setStatPct
      /setCritFlat/setXpPct/setGoldPct` (keyed off `player.equipment`
      directly, not a separate stored list, so it can never drift from
      what's actually worn) fold into the same combined `pct`
      `effectiveStat`/`critChance`/`grantXp`/`grantKillRewards` already
      compute for title + talent + relic.
    - **Independent boss-drop roll alongside the Relic one** (`SET_DROP_
      CHANCE = 0.1`, `Game.rollSetPieceDropOnBossClear`) - same real-Gate-
      boss-clear-only restriction as Relics, rolled separately so getting
      one doesn't affect the odds of the other.
    - New Set Bonuses panel on Inventory's Gear sub-tab (`drawSetBonuses`)
      - every set always shows (same "locked but not hidden" convention
      Titles/Relics use), listing all 6 piece names and every threshold's
      active/inactive state. A small "SET" badge marks a set-tagged item
      directly on the paperdoll.
    - Verified via a live `Game` instance: roster shape (3 sets, 6 slots
      each, unique ids), `generateSetPiece`'s fixed keys/rank-scaling,
      `rollSetPieceDrop`'s variety across slots/sets over 100 trials,
      `equippedSetCounts`/the cumulative 2pc/4pc/6pc threshold math at
      2/4/6 pieces equipped, `effectiveStat` reflecting an equipped
      threshold, the forced boss-clear roll landing a legendary tagged
      item in the Bag with the toast firing, and a non-boss wave clear
      never rolling one.

### Phase 6 — Endgame & meta-progression
17. **Infinite Tower** — ✅ **Done.** New `src/systems/tower/` and a new
    top-level `GameState.tower: TowerState` (`{ highestFloor }`) - a
    single permanent record, not a resumable in-progress climb.
    - **Reuses the whole battle engine unchanged**, the same way
      Promotion Exams (#10) do: a Tower floor is just a `GateDef` flagged
      `isTowerFloor` (`towerFloorGate(floor)`, synthesized on demand -
      unlike `GATES_DATA`/`EXAM_GATES_DATA` there's no fixed table of
      these, since there's no upper bound on how high a climb can go), so
      combat/loot/XP/crit/Dungeon-Modifiers/Random-Events all already
      work for it with zero special-casing in the battle engine itself.
    - **New `Game.resolveGate(gateId)`** centralizes the one real new
      piece of plumbing this needed: every internal call site that used
      to read a live battle's `gateId` straight off `GATE_REGISTRY`
      (`advanceWave`, `grantKillRewards`, `onWaveCleared`, the public
      `getGate`) now goes through this instead - it checks the real
      registry first, falling back to synthesizing a Tower floor only if
      the id parses as one (`towerFloorFromGateId`), so every non-Tower
      call site is byte-for-byte unchanged.
    - **Every floor is a solo boss, no trash** (`totalEnemiesForGate`
      collapses `isTowerFloor` gates to 1, same as `isPromotionExam`) -
      stats grow **linearly**, not exponentially, at 3.5% of the floor-1
      baseline per floor: gentle enough to stay well-behaved at very high
      floor counts (no overflow risk) while genuinely endless (no coded
      cap). Floor 1's baseline is tuned close to the first E-rank Gate's
      own boss, so a fresh Level 1 Hunter can fairly attempt it.
    - **One continuous run**: HP/MP carry floor-to-floor exactly the way
      they already carry wave-to-wave within a Gate (`advanceTowerFloor`
      deliberately never resets them, unlike `startBattle`'s fresh-entry
      reset) - a defeat ends the run but the `highestFloor` record it
      already climbed to during it is safe.
    - **Every floor rolls its own fresh Dungeon Modifier and Random
      Event** (unlike a Gate, where one modifier covers the whole run) -
      each floor is its own self-contained encounter, not a wave within a
      larger plan, so varying it per floor reads as "a new room", not "your
      modifier changed mid-fight".
    - **Milestone gold every `TOWER_MILESTONE_INTERVAL` (10) floors** on
      top of each floor's own normal boss-kill reward, scaling with the
      floor - a small "you've come a long way" nudge for a long climb.
    - **Deliberately does not touch `gatesCleared` or roll a Relic/Set-
      piece drop** - those stay a real Gate's own reward identity;
      `onWaveCleared` branches a Tower floor's boss clear off to
      `completeTowerFloor` before either would ever fire, keeping the two
      modes' reward shapes clearly separate.
    - New Tower screen/tab (`screens/tower.ts`, a `simpleScreen` lobby -
      "Begin Climb"/"Climb Again", the current record, and the rules)
      plus Tower-aware text on the Battle screen (`FLOOR N` instead of
      `WAVE X/Y`/`FINAL WAVE`, a `tower-floor-clear` result panel with
      "Next Floor", and a defeat subtitle reporting which floor was
      reached). `retreatBattle()` now routes back to the Tower lobby
      after a Tower battle instead of always assuming Gates.
    - Verified via a live `Game` instance: id round-tripping
      (`towerGateId`/`towerFloorFromGateId`), rank-band boundaries (26/51/
      91/141), stat growth, `totalEnemiesForGate`'s collapse,
      `startTowerFloor` always starting at floor 1, `resolveGate`
      synthesizing a floor not in `GATE_REGISTRY`, `completeTowerFloor`
      raising (never lowering) the record, the milestone gold trigger,
      `advanceTowerFloor` carrying HP/MP and building the correct next
      floor, `continueAfterWave`/`ariseShadow`/`retreatBattle` all
      routing correctly for a Tower battle, and the `continueSave()`
      backfill for a save missing the `tower` slice.
18. **Achievements** — ✅ **Done** (built ahead of its numbered slot, see
    note below). `src/systems/achievements/` - 28-entry starter roster
    across kills/collection/rank/gates/bosses/gold/crits/potions/level,
    condition-driven, instant gold/stat-point reward on unlock. Growing
    the roster toward "hundreds" is pure content from here, no code
    changes needed.
19. **Titles** — ✅ **Done** (built ahead of its numbered slot, see note
    below). `src/systems/titles/` - 12-entry starter roster, one equipped
    at a time, bonus folds into `effectiveStat`/`critChance`/`grantXp`/
    `grantKillRewards` the same way equipment affixes already do.

### Phase 7 — Prestige
20. **Prestige/Reawakening** — ✅ **Done.** New `src/systems/prestige/`
    and a new top-level `GameState.prestige: PrestigeState`
    (`{ reawakeningCount, shardsBanked }`).
    - **Eligibility**: confirmed S-Rank (#10's `PlayerState.rank`, not
      merely level-implied) at `REAWAKEN_MIN_LEVEL` (30) or above - by
      that point a Hunter has realistically exhausted what the current
      content ceiling offers, which is the whole point of Reawakening
      existing at all. `Game.reawakenEligible()` is the single source of
      truth the UI gates its button on and `Game.reawaken()` itself
      re-checks as a backstop (a no-op, zero mutation, if called while
      ineligible).
    - **A deliberately partial wipe**, much narrower than
      `startNewHunter`'s complete one: **resets** player stats/gold/gear/
      rank/hunterClass/shadowEssence (name kept), `gatesCleared`,
      `shadowArmy`, the Bag, Shop stock, and Talent points/unlocks.
      **Keeps** `progress` (Titles/Achievements/lifetime counters -
      already treated as permanent everywhere else), **both** owned and
      equipped Relics (a deliberate reward for Reawakening, not just
      another reset), `tower.highestFloor`, and of course `prestige`
      itself, which only ever grows.
    - **Monarch Shards, granted by `reawakenShardsFor(powerScore)`** -
      scaled off the Hunter's Power Score at the moment of reawakening (a
      single number that already folds in level/stats/gear/Shadows/
      Relics/Sets) rather than a second, narrower formula, floored at 1.
      Shards are **never spent** - they bank permanently and grant a
      small, uncapped `allStatsPct` bonus (`PRESTIGE_PCT_PER_SHARD =
      0.4%` per shard) folded into `effectiveStat`'s shared `pct`, the
      sixth system now feeding it. No hard cap needed to keep this sane -
      Reawakening itself is the rate-limiter (a full run back to Level
      30+ S-Rank every time).
    - **Sixth system into the shared additive pct pipeline**, but
      deliberately touches *only* `effectiveStat` (an `allStatsPct`-only
      bonus), not `critChance`/`grantXp`/`grantKillRewards` - the
      "small additive-feeling percentages stacked on the existing
      effectiveStat pipeline" guardrail language names exactly this one
      site, and Prestige doesn't need the other three to feel meaningful.
    - New Prestige sub-tab on Status (`renderPrestige`) - shows the
      Reawakening count, banked Shards, and the resulting bonus
      percentage; the Reawaken button itself goes through the same
      Cancel/Confirm gate every other irreversible action uses (Merge/
      Evolve/Disenchant/Class), plus an explicit plain-language breakdown
      of exactly what resets vs. what's kept, since that's the one thing
      a player genuinely can't guess on their own here.
    - Verified via a live `Game` instance: `reawakenShardsFor`'s floor and
      scaling, `prestigeAllStatsPct`'s linear-per-shard formula,
      `reawakenEligible` at every boundary (rank alone insufficient,
      level alone insufficient, both together sufficient),
      `reawaken()` rejecting (with zero mutation) when ineligible, the
      full eligible flow verifying every individual reset field, every
      individual kept field, the correct shard/count increments, and the
      landing screen/toast, `effectiveStat` reflecting banked Shards, and
      the `continueSave()` backfill for a save missing the `prestige`
      slice.

> **Note on #18/#19 being done early:** the previous work session built
> Save/Titles/Achievements together as one foundational "Phase 1" before
> this fixed 20-item order was specified. Redoing them in their numbered
> slot would be pure waste, so they're marked done here rather than
> rebuilt later. Everything from here forward follows the fixed order
> above with no more reordering.

## Next-Generation Feature Expansion Spec

The fixed 20-item roadmap above is complete. The project owner has since
handed over a larger **Next-Generation Feature Expansion Specification**
(19 more items across four phases - Combat Depth, Content Depth, Long-Term
Engagement, Advanced Endgame) to work through the same way: one milestone
at a time, verified before the next starts, no reordering without an
explicit go-ahead. Its own protocol layers on top of the standing rules
above (inspect the repo, identify existing infra to reuse, present a plan,
use `systems/<feature>/` + `Registry<T>`, save-migrate anything persisted,
fold new stat axes into the shared additive-pct pipeline where they
belong).

### Phase 1.1 — Status Effect Framework ✅

Duration-based buffs/debuffs did not exist in the battle engine at all
before this milestone - the only "N rounds remaining" mechanic was Guard
(`guardRounds`), and it was single-purpose. This milestone built real,
general-purpose status infrastructure and shipped the full 13-status
roster named in the spec, live-triggered through five existing structures
rather than inventing new ones.

- **New module `src/systems/statusEffects/`** - `types.ts` defines
  `StatusEffectKind` (9 reusable mechanical kinds: `dot`, `hot`, `shield`,
  `stun`, `chanceToSkipAction`, `silence`, `damageDealtPct`,
  `damageTakenPct`, `critChanceFlat`) and `StatusStackRule` (`stack` with
  a cap, `refresh`, or `ignore`) - the same "few kinds, many flavored
  entries" shape `TitleBonus`/`TalentBonus`/`RelicBonus`/`SetBonus`
  already use. `data.ts` holds the 13-entry `STATUS_EFFECTS` roster
  (Bleed, Poison, Burn, Freeze, Stun, Silence, Weakness, Attack Up,
  Vulnerability, Defense Up, Regeneration, Shield, Crit Up),
  `STATUS_EFFECT_REGISTRY`, `BLESSING_STATUS_IDS`, and pure aggregation
  helpers (`statusDamageDealtPct`, `statusDamageTakenPct`,
  `statusCritChanceFlat`, `statusHealingReducedPct`, `hasStun`,
  `hasSilence`, `rollFreezeSkip`, `activeShieldPool`) over a plain
  `ActiveStatusEffect[]` - no class, no hidden state, same shape every
  other bonus system's helpers already take.
- **Runtime state, no save migration needed** - `ActiveStatusEffect` (in
  root `types.ts`) is a live instance (`defId`, `source`,
  `roundsRemaining`, `stacks`, `magnitude`), added as `EnemyUnit.
  statusEffects` and `BattleState.playerStatusEffects`. `SavedGameState`
  already excludes `battle` entirely (an in-progress fight never survives
  a save/reload), so both new arrays never touch `persistNow()` - the
  cleanest possible migration story: none needed. `playerStatusEffects`
  carries wave-to-wave and floor-to-floor exactly the way HP/MP already
  do (only a fresh `startBattle` resets it).
- **Engine hooks in `store.ts`** - `applyStatusEffect`/
  `mergeStatusEffect` (the single entry point every trigger below calls
  through, so stack-rule handling lives in one place); `tickStatusEffects`/
  `tickOne`, called once per completed round in `enemyTurn` right
  alongside the existing Mana Regen tick; a new `applyDamageToPlayer`
  chokepoint (there was previously no shared one - `enemyTurn` did an
  inline `player.hp -=`), which Vulnerability/Defense Up/Shield now hook
  into, used by both a normal enemy hit and a DoT tick against the player
  so a lethal tick ends the battle exactly like a lethal hit does;
  `applyDamage` (the existing enemy-directed chokepoint) gained the same
  `damageTakenPct` term; `rollBasicAttack`/`useSkill` fold in
  `damageDealtPct` alongside the existing class-bonus percentage; the
  `critChance` getter gained `statusCritChanceFlat`; a shared
  `handlePlayerStunned` helper (mirrors the existing self-guard-miss
  branch's shape: skip the action, still let a deployed Shadow act, still
  advance the round) wired into `battleAttack`/`useSkill`/`battleGuard` -
  deliberately **not** wired into `useItem`, so a stunned Hunter still has
  one real decision left (use a potion or not) instead of full
  incapacitation.
- **Five live triggers, all reusing existing structures** (nothing built
  that Skill Upgrades/Sockets+Gems/Shadow Traits below would need to
  rework):
  1. A new `ARCHETYPE_STATUS: Record<Archetype, string>` in `data.ts`
     thematically pairs each of the six existing monster archetypes with
     one status (goblin→Bleed, orc→Weakness, wraith→Silence,
     knight→Vulnerability, beast→Poison, wyrm→Burn).
  2. **Enemy → player**: any resolved "special" attack in `enemyTurn`
     rolls `rollEnemyInflictedStatus` - a boss's enrage (the existing
     one-time `enragingNow` flag) guarantees Stun, an Elite's special
     additionally rolls 15% for Freeze, otherwise 35% for that gate
     rank's archetype status. Silence also downgrades a chosen "special"
     back down to a plain attack afterward (the AI's own decision logic
     is untouched).
  3. **Shadow → enemy**: `companionStrike`'s `strike()` closure rolls a
     20% chance per landed hit to apply the deployed Shadow's own
     archetype status to its target - the defensive/utility counterpart
     to the enemy-side table, with zero changes to `SHADOW_SKILLS` data
     or the `ShadowActiveEffect`/`ShadowPassiveEffect` unions.
  4. **Random Event "Blessing"** - `RandomEventEffect` gained a
     `{ kind: "blessing" }` case (its own doc comment had flagged this
     exact gap since Random Events shipped); resolves a random pick from
     `BLESSING_STATUS_IDS` (Regeneration, Shield, Attack Up, Defense Up,
     Crit Up) onto the player, following the same "special-cased by the
     caller, not `applyRandomEvent` itself" shape `"ambush"` already set
     - except `applyRandomEvent` now takes the live `battle` as a third
     parameter (Blessing needs it to attach a status to; Ambush still
     doesn't, since it needs the *freshly generated* enemies array
     instead).
  5. Player-side Stun/Freeze/Silence: `enemyTurn`'s per-attacker `step()`
     checks Stun/Freeze on the acting enemy before `decideEnemyAction`
     even runs (mirrors the existing dead-unit skip), and the player's
     own three action methods check Stun via `handlePlayerStunned`;
     Silence blocks `useSkill()` outright as a plain rejected-action
     early return (no MP spent, no round consumed - the same shape the
     existing MP/level checks already use).
- **UI** - a small icon-badge row (icon + stack count if >1, full
  name/description/duration in the tooltip, green for buffs / red for
  debuffs) on the player (`#player-status-row`, next to the HP bar) and
  on every enemy card (`.status-row`, under its mini HP bar) in
  `screens/battle.ts` - read directly off `battle.playerStatusEffects`/
  `unit.statusEffects` inside the screen's existing `update()` sync loop,
  no new render/timer mechanism.
- **Verified**: a standalone pure-logic script (roster shape, every
  aggregation helper, `rollFreezeSkip` with a stubbed `Math.random`,
  `activeShieldPool`, DoT stack-math) plus a live-`Game` Playwright pass
  driving the real engine through a temporary debug hook (stack/refresh/
  ignore rules via repeated `applyStatusEffect`; `applyDamageToPlayer`
  regression-safe at 100 raw dmg with zero statuses; Shield fully then
  partially absorbing consecutive hits; Vulnerability's +20% landing
  exactly; Poison's stack-scaled tick damage; Regeneration's tick heal;
  Stun's exact 1-round expiry; Burn reducing a potion's heal; a Stunned
  player's `battleAttack()` dealing zero damage while still advancing the
  round; a Silenced player's `useSkill()` rejected with MP untouched; the
  status icon rows actually rendering in the DOM) - zero console errors
  the whole run. `npx tsc -b --noEmit` and `npm run build` both clean.
- **What's still deferred, on purpose**: Skills (`SKILLS`/`useSkill`'s
  kind-branching) and Equipment Sockets are untouched - those are Phase
  1.2 and 1.3 below, and either would need rework if this milestone had
  preempted them. Both will add *more sources* for this same 13-status
  roster (a Skill that applies Burn on hit, a Gem that grants Shield on
  Guard, ...) rather than a second parallel status system.

## Balancing guardrails (apply to every phase, not just one)

- No exponential stat inflation - every new multiplicative system
  (Titles, Relics, Sets, Prestige) applies as **small additive-feeling
  percentages** stacked on the existing `effectiveStat` pipeline, the same
  way equipment affixes already do, not as new multiplier chains that
  compound unboundedly.
- Every rarity tier must stay worth using - Crafting and expanded affixes
  both need to make *common* materials/items relevant at every stage, not
  just endgame ones.
- Every Gate stays useful - Dungeon Modifiers and future daily/weekly
  content are the levers that pull a player back to an "early" E-rank gate
  at Level 40, rather than only the newest content mattering.

## Save data & "cloud save" note

There is no backend for this project (static site / single-file Claude
Artifact) - "cloud save" as a literal server-backed account system is out
of scope unless a backend gets introduced separately. What's built is a
**versioned local save** (localStorage, schema-versioned so future phases
can migrate old saves forward safely) - the right foundation *for* cloud
save later (swap the storage service's backend, keep everything else)
without pretending a server exists today.
