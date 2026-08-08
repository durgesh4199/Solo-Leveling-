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
     gem (#14, not yet built). Adding an empty, currently-unfillable
     socket now would itself be the textbook placeholder the standing
     rules forbid. Build this when Crafting exists to give it something
     to do.

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
   - **Convert duplicates to Shadow Essence** - Essence is a Crafting
     material (#14, not built); a currency with nothing to spend it on
     yet is the same placeholder problem. Merge (above) is the working
     duplicate-handling path until Crafting exists.
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
12. Random Events — pending.
13. Better Enemy AI — pending. *(Note: `decideEnemyAction` already gives
    enemies attack/guard/special decisions with some smarts - HP-based
    turtling, leaning into specials when the player guards. This item is
    about deepening it, not building from scratch.)*

### Phase 5 — Itemization depth
14. Crafting — pending.
15. Relics — pending.
16. Equipment Sets — pending.

### Phase 6 — Endgame & meta-progression
17. Infinite Tower — pending.
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
20. Prestige/Reawakening — pending.

> **Note on #18/#19 being done early:** the previous work session built
> Save/Titles/Achievements together as one foundational "Phase 1" before
> this fixed 20-item order was specified. Redoing them in their numbered
> slot would be pure waste, so they're marked done here rather than
> rebuilt later. Everything from here forward follows the fixed order
> above with no more reordering.

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
