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
7. Shadow Management UI — pending.

### Phase 3 — Character progression
8. Talent Tree — pending.
9. Hunter Classes — pending.
10. Promotion Exams — pending.

### Phase 4 — Content variety
11. Dungeon Modifiers — pending. *(Note: a first version already exists -
    `GATE_MODIFIERS`/`GateModifier` in `data.ts`, 5 entries rolled per
    gate attempt. This item is about expanding it, not building from
    scratch.)*
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
