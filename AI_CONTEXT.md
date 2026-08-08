# Hunter Protocol — AI Context Summary

Read this first if you're picking up this project cold. It describes what
exists, how it's built, and why certain things are shaped the way they are
— so you don't re-derive decisions that were already made deliberately.

## What this is

A Solo Leveling-inspired, turn-based hunter RPG. Clear ranked Gates in
sequential monster gauntlets, level up, spend stat points, loot/buy/equip
gear, and **Arise** the monsters you defeat as permanent Shadow allies.
Single-player, browser-based, no backend. Progress **does** persist now
(versioned localStorage save, see "Meta-progression" below) - this is a
recent addition, don't assume the game still resets every reload.

This project is mid-way through a long-term content expansion, built to a
**fixed, numbered 20-item order set by the project owner** and tracked in
**`EXPANSION_ROADMAP.md`** - read that alongside this file before doing
any expansion work; it has the current status of every item and the rule
that the order isn't renegotiable without an explicit instruction to. Save/
Load, Achievements, and Titles are already built (Achievements/Titles
landed ahead of their numbered slot in that order - see the roadmap's note
on why); everything else is pending, one item at a time, waiting for the
owner's go-ahead before each one starts.

Repo: `durgesh4199/Solo-Leveling-`, working branch
`claude/hunter-protocol-game-b1i5ur`. Also published as a single-file HTML
Claude Artifact at a persistent URL (see "Publish pipeline" below) — that
artifact is the thing the user actually plays and screenshots.

## Tech stack

- **TypeScript + Vite**, no game engine. Plain DOM manipulation + a custom
  observer-pattern store (`Game` class in `src/store.ts`:
  `subscribe()`/`notify()`), not React/Vue/etc.
- A hand-written **WebGL2 shader FX layer** (`src/fx/`) for particle/streak
  effects, with graceful CSS-only fallback if WebGL2 is unavailable.
- All art is **procedural inline SVG** (`src/art/`) — no image assets, no
  external fonts.
- Also wired for Electron (Windows desktop) and Capacitor (Android) builds,
  though the web/artifact build is what's actively iterated on.

## File map

```
src/
  main.ts                 Bootstrap: mounts styles + the app
  types.ts                Every shared TS type (GameState, BattleState, GateDef, LootItem, ...)
  data.ts                 All tuning/content data: gates, rarity tables, affix rolls, skills, potions, stat tuning
  store.ts                The Game class: state + every action (battle, leveling, shop, Arise...)
  art/
    icons.ts               Small inline-SVG icon set
    portraits.ts            Procedural portrait generator (Hunter + 6 monster archetypes + shadows + gates)
  fx/
    gl.ts                    Minimal WebGL2 helpers
    shaders.ts                GLSL sources (streak, radial, particles)
    ShaderFX.ts                Public effect API: slash, flurry, smash, guardRing, dissolve, arisePortal, levelUpBurst
  screens/
    index.ts                App shell: screen switching + bottom tab bar + the global toast overlay
    title.ts / gates.ts / battle.ts / stats.ts / shadows.ts / inventory.ts
  systems/                 New-system home (see EXPANSION_ROADMAP.md's architecture note) - one folder per system
    progress/                Shared by titles/achievements: ConditionDef + evaluateCondition + counter key constants
    titles/                   TITLES data + TitleBonus/TitleDef types
    achievements/              ACHIEVEMENTS data + AchievementReward/AchievementDef types
    save/                       SavedGameState/SaveFile types + loadSave/writeSave/clearSave
  services/
    storage.ts               The only file that touches `localStorage` directly
    registry.ts               Generic createRegistry<T>() - O(1) id lookup + load-time duplicate-id check for static content tables
  styles/
    tokens.css               Design tokens (colors, spacing, radii) - "Nocturne" dark-violet theme
    base.css                   Buttons, cards, tags, bars, tabs, form controls
    effects.css                 Every CSS keyframe/VFX class (incl. .global-toast)
```

`screens/*.ts` each export a `ScreenModule = (root, game) => ScreenController`.
Two patterns are used:
- **`simpleScreen(render, wire?)`** (from `screens/types.ts`) — full
  `innerHTML` rebuild on every store `notify()`. Used where there's no
  local UI-only state to preserve (title, gates).
- **Custom stateful module** — closure variables hold view-only state
  (filters, sub-tabs, a UI countdown timer) across redraws, and/or does
  *targeted* DOM patching instead of full rebuilds so CSS animations don't
  get cut off by node recreation mid-flight. `battle.ts` is the extreme
  case: the whole arena is built once at mount, and `update()` only ever
  patches specific text/class/style, never re-does `innerHTML`, because a
  full rebuild would restart every in-flight lunge/slash/float-number
  animation. `inventory.ts` and `shadows.ts` use full-rebuild-per-update
  (`draw()` on every notify) but still keep closure state for their filter
  dropdowns/sub-tabs/sell-confirm state.

## Core data model (`types.ts`)

- `GameState` — `player`, `gatesCleared`, `shadowArmy`, `inventory.potions`,
  `bag`, `shop`, `battle` (nullable — only set during a run).
- `PlayerState` — level/xp, hp/mp (+max), 5 core stats (`str agi int vit
  per`), `statPoints`, `gold`, `equipment` (6 slots).
- `GateDef` — id/rank/name, `enemyTypes: string[]` (exactly 5 trash
  species), `bossName`, recommended level, base hp/atk/def/xp.
- `LootItem` — slot, rarity, `affixes: ItemAffix[]` (1-4 rolls, each a core
  stat OR direct hp/mp/crit).
- `EnemyUnit` — per-spawn combat state, now carries its own `name` (one of
  its gate's 5 species) since a wave can mix species.
- `BattleState` — the active run's state; `rank: Rank` (not a stored
  monster name) drives which archetype/portrait every enemy in the run
  uses (see "Enemy variety" below).
- `Archetype` = `"goblin" | "orc" | "wraith" | "knight" | "beast" | "wyrm"`
  — the 6 hand-drawn silhouette families every monster portrait draws from.

## Game systems, screen by screen

**Title** — ambient CSS-only motes/reveal animations, player summary row
(name, rank/level, live Power Score), rank-colored player aura around the
portrait, "Enter the System" → Gates.

**Gates** — 20 gates across all 6 ranks (4×E / 4×D / 4×C / 3×B / 3×A /
2×S). Each gate is a 10-20 enemy gauntlet (rank-scaled via
`TOTAL_ENEMIES_BY_RANK`), split into waves of up to 3 simultaneous trash
enemies (`GROUP_SIZE`) ramping in strength across the whole run, capped by
a solo boss wave (`buildWavePlan` in data.ts). HP/MP carry over between
waves within one run — potions are the only mid-run relief. A random
`GateModifier` rolls once per attempt (~40% none, otherwise weighted
among 11 real modifiers - see "Dungeon Modifiers" below). Every gate
rank has a signature `Archetype` (E=goblin, D=orc,
C=wraith, B=knight, A=beast, S=wyrm) and each gate's 5 `enemyTypes` are a
rotated slice of that archetype's 6-name pool, so gates on the same rank
field different rosters. Each trash spawn also rolls a stat-weight
`TYPE_VARIANT` (glass-cannon/tanky/balanced/...) tied to which of the 5
species it got, so "5 different types" is a real combat difference.

A **Promotion Exam** banner (#10) appears above the 20-gate list whenever
level has raced ahead of confirmed rank (`Game.examEligibleRank()`) - a
single, tougher solo boss trial, not one of the 20 explorable gates (see
"Promotion Exams" below).

Every wave-to-wave transition (`Game.advanceWave`) has a ~25% chance of a
**Random Event** (#12) - gold, bonus loot, a partial heal, a bonus enemy
joining the wave, or a small risk/reward HP-for-gold trade - see "Random
Events" below.

**Battle** — turn-based, auto-targets the frontmost living enemy
(indicated by an underline on its name label, not the old portrait-edge
line which used to visually collide with the name once per-unit labels
were added). Player actions: **Attack**, **Skills** (unlock by level:
Dagger Rush L1 → Piercing Thrust L5 → Shadow Execute L10 → Umbral Storm
L15), **Guard** (blocks 1-3 random rounds, halves incoming damage per
round up, but Attack itself can whiff while guarding — AGI/PER reduce that
miss chance), **Items** (tiered potions). Enemies aren't just damage
sponges: each rolls attack/guard/special per its own AI
(`decideEnemyAction`) — low-HP units turtle up more, all units lean into
specials the instant the player guards, Elites are more aggressive/less
guard-happy than plain trash, a badly-hurt player faces enemies that press
the advantage instead of guarding, and a boss below 25% HP enters a real
enrage phase (always special, a one-time "grows desperate" toast) - see
"Better Enemy AI" below. A deployed Shadow auto-strikes
after every player action (`companionStrike`). All landed hits read
blood-red (float numbers, impact glow, screen flash); non-damage effects
(guard, Arise, level-up) stay violet. No text combat log — feedback is
purely visual/animated.

**Stats** — 5 sub-tabs (`stats.ts` follows the same sub-tab shell pattern
as Inventory now, via a small `mountSubTab()` wrapper - the original
Status body moved into `mountStatusBody()` unchanged, still a persistent-
DOM/targeted-update controller, not a full rebuild, so its stat-point
gain-toast animation timers stay valid):
- **Status** (was the whole screen before Phase 1) — Power Score card at
  top, then HP/MP/XP bars, then one row per core stat with a `+` button.
  Hovering previews exactly what the point buys (`gainText()`); clicking
  floats the same text as a confirmation. STR→Attack damage, AGI/PER→crit
  chance + guard-miss reduction, VIT/INT→**immediate** max (and current)
  HP/MP (not gated behind a future level-up). Also surfaces an accent-
  bordered "Talent Points available" hint whenever there's an unspent one.
- **Class** — see "Hunter Classes" below.
- **Talents** — see "Talent Tree" below.
- **Titles** — see "Meta-progression" below.
- **Achievements** — see "Meta-progression" below.

**Shadows** — grid of every Shadow ever Arisen (offered after *every* wave
clear, trash or boss, not just bosses). Rank + species filter dropdowns.
One deploy slot; deploying a new Shadow auto-recalls the previous one.
Every Shadow now has its own level/XP (grows from fighting while
deployed), Loyalty (grows from wave clears while deployed, feeds a small
power bonus, never decays), a derived Mood label, and one of 6
archetype-based passive+active skill pairs that make *how* it fights
alongside you meaningfully different by species (see "Shadow Collection"
below) - shown right on the card, plus a "Merge Duplicate" button when a
same-species duplicate exists. A Shadow fully leveled can also be
**Evolved** into the next rank tier for gold - a real transformation
(new archetype, new skill pair, higher power ceiling, level reset to 1),
not just a stat bump (see "Shadow Evolution" below). Each card can also
be **renamed** and has its own **Gear** panel - 6 equipment slots
(weapon/helmet/chest/legs/ring/amulet), the same Bag/LootItem system the
Hunter's own paperdoll uses, feeding both `effectiveShadowPower` and its
own combat behavior (see "Shadow Management UI" below).

**Inventory** — 3 sub-tabs in one screen:
- **Gear** — paperdoll equipment grid (6 slots: weapon/helmet/chest/legs/
  ring/amulet) around the Hunter portrait, connector lines as real grid
  children (not %-based pseudo-elements, to survive uneven row heights),
  plus the loot bag below with slot/rarity `<select>` filters and a
  Default/Rarity/Value/Newest sort. Selling an item asks for a
  tap-to-confirm (row flips to "Sell for Xg? / Confirm / Cancel") before
  paying out **10%** of its Shop price (`SELL_PRICE_RATIO`/
  `sellPriceForItem` in data.ts) — no free discard. Tapping any bag row's
  name/affix block (not the action buttons) expands a comparison against
  whatever's equipped in that slot - `compareItemAffixes`/`affixDeltaText`
  in data.ts, the union of every affix key on either side (so a stat only
  the equipped item has still shows as a loss, not silently dropped).
- **Shop** — procedurally-rolled gear at the player's current rank, 6
  items, with the same tap-to-compare as the bag. Restocks itself free
  every 10 real minutes (`SHOP_AUTO_RESTOCK_MS`), or pay `rerollCost` to
  reroll early — both reset the same countdown, shown live via a 1s
  UI-only tick.
- **Potions** — 6 tiers (Minor/Greater/Supreme × HP/MP), bought here, used
  from the battle Items panel.

## Itemization

- **Rarity**: 7 tiers, `common → uncommon → rare → epic → legendary →
  mythic → godly`, each rarer and a bigger `statMult` than the last.
  `rollRarity(bonus)` additively skews the roll toward the top; `bonus`
  stacks from source (elite +0.15, boss +0.3, shop +0.05) *and* gate rank
  (`rankRarityBonus`, E=0 up to S=+0.25) — so an S-rank boss kill has real
  odds at top tiers an E-rank trash kill just doesn't.
- **Affixes**: 1-4 rolls per item (by rarity, `AFFIX_COUNT_BY_RARITY`),
  each either a core stat (folds into `effectiveStat()`, identical to a
  spent stat point), a direct flat `hp`/`mp`/`crit` bonus, or one of 4
  combat-round affixes (`lifeSteal`/`attackSpeed`/`manaRegen`/
  `fireDamage`) applied directly where they act rather than folded into a
  passive getter - see `Game.applyLifeSteal`/`rollBasicAttack` and the
  mana-regen tick in `enemyTurn`'s round-completion branch. A VIT/INT
  affix converts to HP/MP through the exact same `STAT_TUNING` rate a
  spent stat point does — the two systems can't drift apart. Every
  `AffixKey` needs a case in `affixText`/`affixDeltaText`/`priceForItem`
  in data.ts *and* wherever it actually acts in store.ts - `rollAffixValue`
  alone isn't enough to make an affix real (see the "no placeholders"
  discipline in EXPANSION_ROADMAP.md's item #4 entry: Sockets/Cooldown
  Reduction/Poison were deliberately left out of the pool rather than
  added as rolls that do nothing).
- **"Effective" pattern**: `effectiveStat()`, `effectiveMaxHp()`,
  `effectiveMaxMp()`, `critChance` all fold in equipment at *read* time;
  raw `player.maxHp`/stat fields stay pure (equipment-free). `clampVitals()`
  keeps current HP/MP from exceeding a just-lowered effective max after
  unequipping something.

## Power Score

`game.powerScore` (getter) — one "how strong am I" number: level*15 +
(sum of all 5 effective stats)*8 + effectiveMaxHp*2 + effectiveMaxMp*3 +
critChance*100*12 + (sum of every Shadow's power in the whole army, not
just deployed)*10. Pure display/vanity number, not consulted by any combat
formula. Shown on Title (inline) and Status (dedicated glowing card that
pulses gold whenever it increases).

## Meta-progression: Save, Titles, Achievements (Phase 1 of EXPANSION_ROADMAP.md)

- **Save** (`src/systems/save/`, `src/services/storage.ts`) — persists
  `player, gatesCleared, shadowArmy, inventory, bag, shop, progress`
  (never `screen` or `battle` - a save always lands on Gates, never
  mid-fight) to a versioned localStorage blob. `Game` loads it at
  construct time into a private `pendingSave` field *without* applying it
  - the Title screen previews it (`game.peekSave()`) and the player
  explicitly chooses `continueSave()` or `startNewHunter()` (native
  `window.confirm()` - deliberate, it's the one destructive action in the
  game and a native dialog is the simplest honest way to gate it).
  Autosave is debounced (`scheduleAutosave()`, one write per 3s at most)
  from inside `notify()`, plus a `beforeunload` flush. **Bump
  `CURRENT_SCHEMA_VERSION` in `systems/save/types.ts` and add a migration
  branch in `loadSave()` whenever `SavedGameState`'s shape changes in a
  way an old save can't just be read as-is** - don't skip this, it's the
  only thing standing between a future refactor and silently wiping every
  player's save.
- **Progress counters** (`src/systems/progress/`) — `GameState.progress.
  counters: Record<string, number>`, incremented at the handful of store.ts
  call sites that represent a real lifetime milestone (kills - in
  `applyDamage`, by total and by archetype; crits landed; bosses defeated;
  gold earned; items equipped; potions used). `COUNTER_KEYS` in
  `progress/types.ts` is the single source of truth for the key strings -
  never hardcode one elsewhere. `ConditionDef`/`evaluateCondition` are the
  shared declarative-condition language both Titles and Achievements
  check against (`ProgressContext`, built fresh each check by
  `Game.getProgressContext()` from counters + live player/shadowArmy/
  gatesCleared state - not itself persisted, since it's cheap to
  recompute from what already is).
- **Titles** (`src/systems/titles/`) — `TITLES: TitleDef[]`, one equipped
  at a time (`Game.equipTitle`), its `TitleBonus` folds directly into
  `effectiveStat` (statPct/allStatsPct, applied *after* equipment affixes
  - same multiplicative-on-top-of-gear semantics), `critChance`
  (critFlat), `grantXp` (xpPct), and `grantKillRewards`'s gold payout
  (goldPct). 12-entry starter roster.
- **Achievements** (`src/systems/achievements/`) — `ACHIEVEMENTS:
  AchievementDef[]`, reward (gold or stat points) granted the instant the
  condition is met, no separate claim step. 28-entry starter roster - the
  architecture supports growing toward "hundreds" (per the brief) as pure
  content, no code changes needed.
- **Unlock evaluation** — `Game.refreshProgress()` runs on *every*
  `notify()` (cheap: ~40 condition checks against a small context object,
  fine for a turn-based game). A newly-met Title/Achievement floats a
  `GlobalToast` (`Game.showGlobalToast`, rendered by `screens/index.ts`'s
  app shell so it's visible on any screen, not just Battle - Battle
  already had its own in-run `BattleToast`, this is the app-wide
  equivalent). If several unlock in the same pass only the last toast of
  the burst is visible; all of them still land correctly in the
  unlocked-id lists regardless - known, accepted limitation, not a bug.

## Shadow Collection (Phase 2 item #5 of EXPANSION_ROADMAP.md)

- **`src/systems/shadows/data.ts`** - `SHADOW_SKILLS: Record<Archetype,
  ShadowSkillSet>`, one passive + one active per archetype (goblin/orc/
  wraith/knight/beast/wyrm - the same 6 that drive portrait art), plus
  `effectiveShadowPower()`, `shadowXpToNext()`, `shadowMood()`,
  `SHADOW_MAX_LEVEL`. `src/systems/shadows/types.ts` has the
  `ShadowPassiveEffect`/`ShadowActiveEffect` discriminated unions - every
  effect kind needs a case in `Game.companionStrike`'s `strike()` closure
  (store.ts) to actually do anything; adding to the union alone is not
  enough (same "no placeholders" discipline as AffixKey).
- **`Game.companionStrike`** (store.ts) - rewritten around the passive/
  active split: `active.effect.chance` rolled once per call; if it hits,
  the matching branch (doubleStrike/bigHit/flurry/armorPierce/
  guaranteedCrit/aoe) replaces the normal single hit; the passive's
  effect always applies inside the shared `strike()` closure regardless
  of which branch ran. `Game.applyDamage`'s return value (actual damage
  dealt, post-guard-mitigation - added in the affix-system work, #4) is
  what several passives (healOnHit, goldOnKill-via-`killedAny`) key off.
- **`Game.grantShadowXp(shadowId, killedThisAction)`** - called at the end
  of every `companionStrike`; **`Game.growShadowLoyalty(shadowId)`** -
  called from `onWaveCleared` if a Shadow was deployed for that wave. Both
  look the Shadow up by id and replace it immutably in `shadowArmy`
  (`array[idx] = {...updated}`), the same pattern `deployShadow` already
  used.
- **`Game.mergeShadow(keepId)`** - public, merges with the *lowest-level*
  other Shadow sharing `type` (species) - the weakest duplicate, so
  merging never costs a player their best copy by accident.
- **Testing note**: verifying `companionStrike`'s 12 formulas (6 passives
  × 6 actives) needs `game.battleAttack()`/`useSkill()`, not `useItem()` -
  potions don't call `companionStrike` at all. Since the player's own hit
  lands *before* the companion's, isolate the companion's exact damage by
  reading the target's `floatText` right after the call (the companion's
  hit is the last thing to touch it) for single-hit effects, or by
  computing the player's own expected damage from the same mocked-random
  value and subtracting it from total HP loss for multi-hit ones (flurry/
  doubleStrike/aoe). `effectiveShadowPower()` derives from `rank`, not
  the stored `power` field - overriding `power` in a test fixture does
  nothing; override `rank` to change a test Shadow's actual combat power.

## Shadow Evolution (Phase 2 item #6 of EXPANSION_ROADMAP.md)

- **`Game.evolveShadow(id)`** (store.ts, public) - the only mutator for
  `ShadowRecord.evolutionStage`. Deliberately reuses the Arise-time
  pipeline instead of a new one: `nextShadowRank()` (new, in
  `systems/shadows/data.ts`, wraps a local `RANK_ORDER` ladder) picks the
  next tier, then `ARCHETYPE_BY_RANK[newRank]` and `SHADOW_RANK_POWER
  [newRank]` (both already existed, from `data.ts`) supply the new
  archetype and power baseline - the exact same two lookups
  `Game.ariseShadow` uses. Because archetype is rank-locked everywhere
  else (portrait, rim-glow, `SHADOW_SKILLS`), evolving genuinely swaps a
  Shadow's whole combat kit, not just its power number.
- Returns a discriminated result, not a bare boolean/null, since there
  are three distinct rejection reasons the UI needs to tell apart:
  `{ok:false, reason:"not-maxed"|"max-rank"|"insufficient-gold"}` vs
  `{ok:true, newRank}`. Follow this pattern for future systems with more
  than one plausible failure mode - a bare `null` return (used by
  `mergeShadow`, which only has one failure mode: "no duplicate") stops
  being enough as soon as a caller needs to say *why*.
- Level/xp reset to 1/0 on every evolution (so leveling keeps mattering
  in the new form); `name`/`type`/`loyalty`/`battlesFought` are carried
  over unchanged (evolving is not re-Arising - it's the same Shadow, its
  history is real). `SHADOW_EVOLUTION_COST` (systems/shadows/data.ts) is
  keyed by the *pre-evolution* rank - an E-rank Shadow's first evolution
  is cheap, an A→S evolution is the most expensive step.
- **Save compatibility**: `evolutionStage` didn't exist before this item,
  so `Game.continueSave()` defaults it (`s.evolutionStage ?? 0`) when
  applying a loaded save - the one place old `ShadowRecord`s from disk
  get read directly instead of constructed fresh. (Note: the fields #5
  added - `archetype`/`level`/`xp`/`loyalty`/`battlesFought` - do *not*
  have this same defaulting; that's a pre-existing gap, not something
  this item's scope covers fixing.)
- **UI** (`screens/shadows.ts`): the Evolve button/confirm mirrors the
  existing Merge button/confirm exactly (a `evolveConfirmId` closure
  state var alongside `mergeConfirmId`, same Cancel/Confirm two-button
  row) - both are "only show what's currently actionable" patterns, not
  a coincidence; new confirm-gated actions on this screen should keep
  following it.

## Shadow Management UI (Phase 2 item #7 of EXPANSION_ROADMAP.md)

- **`ShadowRecord.equipment`** is a `Partial<Record<ItemSlot, LootItem>>`
  - literally the same type as `PlayerState.equipment`. `Game.
  equipShadowItem`/`unequipShadowItem` are line-for-line the same move-
  from-bag/swap-in/return-previous logic as `equipItem`/`unequipItem`,
  just indexed into `shadowArmy[idx].equipment` instead of `player.
  equipment`. Any future per-entity equipment (if one ever shows up)
  should follow this exact shape rather than inventing a new one.
- **`sumEquipmentAffix(equipment, key)`** (new, `data.ts`) is the shared
  loop both `Game.equipmentAffixSum` (player) and the Shadow-power/
  companionStrike code below now call - added specifically so Shadow
  gear didn't need a second, copy-pasted version of the same sum. If a
  third equipment-bearing entity ever shows up, it reuses this too rather
  than a third copy.
- **Where each affix actually lands on Shadow gear** (companionStrike,
  store.ts): `fireDamage` folds into the `strike()` closure's flat damage
  term; `crit` is an independent `Math.random()*100 < gearCritPct` check
  ORed into the existing `isCrit` condition (stacks with the archetype's
  own crit-chance passive, doesn't replace it); `lifeSteal` reuses
  `applyLifeSteal` (now takes an explicit `pct` argument instead of
  reading `equipmentAffixSum` internally, so both the Hunter's own gear
  and a Shadow's gear share one heal implementation - see its call sites
  in battleAttack/useSkill/companionStrike); `attackSpeed` rolls once
  *after* whichever primary action resolved (single strike, or one of the
  6 Active-Skill branches) and re-reads `currentTarget(battle)` rather
  than reusing the original `target`, since the primary action may have
  killed it or (for the Wyrm's AoE) hit several others instead. `manaRegen`
  is **not** handled in companionStrike at all - it ticks in `enemyTurn`'s
  existing once-per-completed-round site, added alongside the Hunter's
  own `equipmentAffixSum("manaRegen")` read there.
- **Core-stat affixes (STR/AGI/INT/VIT/PER) have no combat mechanic to
  feed on a Shadow** (no per-stat formulas exist for a Shadow the way
  `effectiveStat`/`strAtkPerPoint`/etc. exist for the Hunter), so they
  fold straight into `effectiveShadowPower()` instead, at a fixed
  `POWER_PER_STAT_AFFIX` rate (`systems/shadows/data.ts`). `hp`/`mp`
  affixes have *no* equivalent fold-in and are genuinely inert on Shadow
  gear - a Shadow has no HP/MP pool of its own, full stop. This is
  structural, not a deferred TODO; don't try to "fix" it by inventing a
  Shadow HP/MP pool as a side effect of an unrelated feature.
- **`mergeShadow` now returns the consumed Shadow's equipped gear to the
  Bag** before removing it from `shadowArmy` - this became a correctness
  requirement the moment Shadows could hold gear (previously merge just
  discarded the whole record, which was safe when there was nothing on
  it to lose). Any other place a `ShadowRecord` gets removed outright in
  the future needs the same check.
- **Testing note**: `g["companionStrike"](battle)` (bracket access) is
  how a Node test script reaches the private method directly - TS
  `private` is compile-time only, `tsx` transpiles it straight through.
  Isolating one gear affix's effect means holding every other input
  fixed (same archetype/rank/target HP/mocked Math.random) and comparing
  total damage dealt with vs. without that affix on the test Shadow's
  gear, the same "compute the delta" approach #4/#5's tests already used
  for the Hunter's own gear.

## Talent Tree (Phase 3 item #8 of EXPANSION_ROADMAP.md)

- **`src/systems/talents/`** mirrors `systems/titles/` structurally
  (`types.ts` + `data.ts` + a registry), but its `TalentBonus` union
  intentionally duplicates `TitleBonus`'s 5 kinds rather than importing
  it - see the doc comment on `TalentBonus` for why (unrelated systems
  that happen to share a shape, same call already made for `RANK_ORDER`).
  The one real difference from Titles: a Title is one-equipped-at-a-time,
  but many Talent nodes can be unlocked simultaneously, so nothing reads
  "the" bonus - every integration site sums across every unlocked node
  (`talentStatPct`/`talentCritFlat`/`talentXpPct`/`talentGoldPct`).
- **`GameState.talents: TalentState`** (`{points, unlockedIds}`) is a
  brand-new top-level state slice, defined in root `types.ts` right next
  to `ProgressState` with the same reasoning: it's shared, plain data
  (no behavior) that `GameState` needs to reference directly, so it stays
  in the root file rather than `systems/talents/types.ts` even though
  everything else Talent-related lives there. Follow this precedent for
  any future system's own top-level state slice.
- **Additive stacking across systems, not just within one**: every site
  that already read an equipped Title's percentage bonus
  (`effectiveStat`, `critChance`, `grantXp`, `grantKillRewards`) now
  computes `titlePct + talentPct` as one combined number *before*
  applying a single `value *= 1 + pct`, instead of multiplying twice.
  Two nested multiplies would silently compound (1.03 x 1.03 = 6.09%
  effective, not a flat 6%) - small at these magnitudes, but exactly the
  kind of drift the "no multiplier chains" guardrail exists to prevent,
  and it compounds for real once more percentage-granting systems land
  (Relics, Equipment Sets, Prestige - still pending; #9 Hunter Classes
  shipped without needing this - see below, its bonuses each target one
  specific formula rather than this shared pipeline).
  **Any future system adding its own percentage bonus to one of these
  four sites must fold into the same combined `pct` before the single
  multiply, not bolt on a second multiply.**
- **`Game.learnTalent(nodeId)`** is the only mutator - no respec exists
  (same permanent-choice stance Merge/Evolve already take on the Shadow
  Army screen). `canUnlockTalent()` (systems/talents/data.ts) is pure and
  reused identically by both the mutator's own gating and the UI's
  Learned/Available/Locked card state, so they can never disagree with
  each other about whether a node is currently learnable.
- **Save migration precedent**: unlike #6/#7's new *fields* on an
  existing array (`ShadowRecord.evolutionStage`/`.equipment`, defaulted
  with `?? 0`/`?? {}`), `talents` is an entirely new top-level slice with
  nothing to default from - a pre-#8 save has no `talents` key at all.
  `continueSave()` distinguishes "field truly absent" (`saved.talents ??
  ...`) and grants a one-time catch-up (1 point x levels already reached)
  rather than just defaulting to an empty `{points:0, unlockedIds:[]}`,
  so an already-leveled Hunter isn't permanently shorted on a currency
  that didn't exist when they earned those levels. A future system
  landing its own new top-level slice should make the same call
  explicitly (catch-up grant vs. plain default) rather than defaulting
  by default.
- **Testing note**: `g["grantXp"](amount)` and `g["grantKillRewards"]
  (battle, unit)` (bracket access, same private-method-reach-around as
  #7's `companionStrike` tests) let a test force many level-ups in one
  call or a single kill-reward payout without playing through a full
  battle. `g["pendingSave"] = {...}` followed by `g.continueSave()` is
  how to test the save-migration path without round-tripping through
  actual `localStorage` JSON.

## Hunter Classes (Phase 3 item #9 of EXPANSION_ROADMAP.md)

- **`src/systems/classes/`** - smaller than Titles/Talents structurally
  (no registry-heavy condition logic to evaluate, just 5 fixed defs), but
  follows the same `types.ts` + `data.ts` split. `HunterClassId` itself
  lives in root `types.ts`, not `systems/classes/types.ts` - it's a small
  leaf value type `PlayerState` needs to reference directly (same
  category as `StatKey`/`ItemSlot`/`Rank`), so `systems/classes/types.ts`
  imports it from there rather than the reverse. This is the first system
  to do that; follow it for any future system whose id type a root
  interface needs to hold.
  `HunterClassDef`/`ClassBonus` (the actual content) stay in
  `systems/classes/types.ts` as usual.
- **Why `ClassBonus` isn't another `TitleBonus`/`TalentBonus` clone**:
  Titles and Talents both already cover "generic percentage into the
  shared stat/crit/xp/gold pipeline" - a Class doing the same thing a
  third time would be a reskinned label, not a real choice. Instead each
  of the 5 bonus kinds names a *specific formula* to land in
  (`attackDamagePct` -> `rollBasicAttack` only, `skillDamagePct` ->
  `useSkill` only, `critMultiplierBonus` -> the new shared
  `critMultiplier()`, `guardMitigationPct` -> the Guard-mitigation branch
  in `enemyTurn`, `potionHealPct` -> `useItem`'s HP branch only) - so
  picking Fighter genuinely changes *which* of your actions hits harder,
  not just a flat number everything gets a slice of.
- **`Game.critMultiplier()`** (new, private) replaces the hardcoded
  `* 1.8` literal at the two *Hunter*-facing crit sites
  (`rollBasicAttack`, `useSkill`). `companionStrike`'s own `* 1.8` for
  the deployed Shadow's crit is a separate, untouched literal on
  purpose - same "it's the Hunter's own build, not the Shadow's" line
  Life Steal already draws (see #7's notes above). Any *future* system
  that wants to modify the Hunter's crit multiplier should extend
  `critMultiplier()`, not add a third place that multiplies by some
  variant of 1.8.
- **`PlayerState.hunterClass: HunterClassId | null`** - no save-migration
  entry needed (unlike #8's brand-new `talents` slice): `PlayerState` is
  already persisted whole via `saved.player`, and `Game.
  equippedHunterClass()`/every formula site above check truthiness
  (`if (!id) return null` / `cls?.bonus.kind === ...`), so `undefined`
  on an old save behaves identically to `null` with zero special-casing
  anywhere. This is the simpler alternative to #8's catch-up-grant
  migration, and the one to reach for whenever a new field can hang off
  an already-fully-persisted slice instead of needing its own.
- **UI** (`screens/stats.ts`): unlike `renderTitles`/`renderAchievements`
  (plain module-level functions with no state of their own),
  `renderClass` is defined *inside* the `statsScreen` factory closure so
  it can hold `classConfirmId` across redraws - Class needed a Cancel/
  Confirm step (permanent choice) the way Titles/Achievements never did.
  Follow this "state needed -> nest it in the factory, no state ->
  module-level function" split for any future sub-tab.
- **Testing note**: `g["rollBasicAttack"](target)`/`g["critMultiplier"]()`
  (bracket access, same pattern as #7/#8's tests) isolate one formula at
  a time. Verifying Assassin's crit bonus doesn't leak into
  `companionStrike` needs a guaranteed-crit Shadow (a `beast` archetype
  passive with `Math.random` mocked low so its 25% critChance always
  procs) run once with Assassin chosen and once without, checking the
  damage numbers come out identical - a `critMultiplier()` unit check
  alone wouldn't catch a bug where the *shared* multiplier accidentally
  got read from companionStrike too.

## Promotion Exams (Phase 3 item #10 of EXPANSION_ROADMAP.md)

- **`rankForLevel(level)` vs `PlayerState.rank`**: this is the core split
  this item introduces, and it matters for *any* future code touching
  rank. `rankForLevel` (data.ts, unchanged) is a pure function of level -
  "what rank would this level alone imply." `player.rank` is the
  Hunter's officially confirmed rank, changed only by
  `Game.completePromotionExam`. **Every rank-driven gameplay/display site
  reads `player.rank` now, not `rankForLevel(player.level)`** -
  `rerollShop` (Shop stock quality), `ariseShadow` (a new Shadow's rank/
  power), `progressContext` (Title/Achievement "reach rank X"
  conditions), and every screen that draws the portrait aura or a rank
  tag (`battle.ts`, `stats.ts`, `title.ts`, `inventory.ts`).
  `rankForLevel` itself is now only consulted for *eligibility* -
  computing the gap between level and confirmed rank.
- **A Promotion Exam is a real `GateDef`, not a separate battle mode**:
  `EXAM_GATES_DATA` (data.ts) - 5 entries, one per rank D-S, flagged
  `isPromotionExam: true`. `totalEnemiesForGate` checks that flag first
  and returns `1` (collapsing `buildWavePlan` to a single boss-only wave,
  no trash) before falling through to the normal rank-based lookup. This
  is what lets `Game.startBattle` run an exam with *zero* changes to the
  battle engine itself - it's just a gate whose "trash count" happens to
  be zero. `Game.gates` (the getter the Gates screen's normal list reads)
  filters these back out; `GATE_REGISTRY`/`Game.getGate` still resolve
  them by id, so every existing id-based lookup keeps working unchanged.
- **`systems/exams/data.ts`** is the smallest system module so far - no
  `types.ts` at all, since an exam has no novel content shape beyond the
  `GateDef` it already reuses. Just `nextRank`/`examEligibleRank` (a
  local `RANK_ORDER` ladder, same small-duplication precedent as
  `nextShadowRank`), `EXAM_GATE_ID` (rank -> gate id), and
  `PROMOTION_REWARD` (rank -> gold/statPoints). A system this thin is a
  legitimate shape - don't force an empty `types.ts` on a future system
  just for consistency if it genuinely has nothing new to define there.
- **`Game.completePromotionExam`** is called from `onWaveCleared` when
  the cleared gate's `isPromotionExam` is true (checked *before* the
  normal `battle.isBossWave` branch, since an exam's single wave is
  always flagged as the boss wave too - the exam check has to come
  first or it'd silently fall through to the normal gate-clear path).
  The reward it pays is deliberately *on top of* the fight's own normal
  kill reward (already applied by the time `onWaveCleared` runs) and on
  top of whatever `refreshProgress()` grants for a "reach rank X"
  condition the promotion itself may have just satisfied - all three are
  expected to stack, not something to guard against. Guards against
  double-promotion with a `nextRank(player.rank) === gate.rank` check
  before actually applying anything, in case a stale battle instance
  somehow resolves after the Hunter was already promoted some other way.
- **New `BattleResult` value**: `"exam-pass"`, distinct from
  `"gate-clear"` specifically so `battle.ts`'s result panel can hide the
  Arise button and show "Promoted!" instead of "Gate Cleared" -
  `continueAfterWave()` needed *no* change, since its `if (result ===
  "wave-clear") advanceWave(); else retreatBattle();` branch already
  treats anything that isn't `"wave-clear"` as "go back to Gates", which
  is exactly right for an exam pass too.
- **Save migration precedent, a third variant**: #8's `talents` (a whole
  new top-level slice, missing entirely on old saves) got a one-time
  catch-up grant; #9's `hunterClass` (a new field with a genuinely falsy
  "not set" state) needed no migration at all. `rank` is a third case -
  a new field on an already-fully-persisted object (`PlayerState`, like
  `hunterClass`) but *without* a safe falsy default (unlike
  `hunterClass`, "no rank" isn't a valid state) - so it gets
  `continueSave()`-time backfill from `rankForLevel(level)`, like #6/#7's
  pattern but on a scalar instead of an array. Pick whichever of these
  three matches a future field's actual shape rather than reaching for
  one out of habit.
- **Testing note**: a live `Game`'s `startPromotionExam()` +
  `battleAttack()` (with `player.str` pushed absurdly high, or the
  target's `hp` set to 1, for a guaranteed one-shot kill) is how to drive
  a full exam win in a test without needing deterministic RNG for the
  fight itself. Asserting the reward payout needs `>=`, not `===` -
  the kill's own normal XP/gold and a "reach rank X" Achievement/Title
  auto-unlocking via `refreshProgress()` both add on top of
  `PROMOTION_REWARD`'s numbers by design (see completePromotionExam's
  note above); an exact-equality assertion here is a test bug, not a
  sign the game under- or over-paid.

## Dungeon Modifiers (Phase 4 item #11 of EXPANSION_ROADMAP.md)

- **`GateModifier` grew from 4 knobs to 7**: the original
  `xpMult`/`loot`/`enemyAtkMult`/`enemyHpMult` untouched, plus
  `enemyDefMult`, `eliteChanceBonus`, and `goldMult` - nothing before
  this item could touch a fight's defense, its Elite odds, or its gold
  at all, so those were the three real gaps to close, not just "add more
  entries with the same 4 numbers remixed."
- **`weight` + `pickWeightedModifier`** (data.ts): before this item every
  non-"none" modifier was equally likely (`pick()`, uniform). Now each
  entry carries a relative `weight` and `rollGateModifier` uses the same
  cumulative-weight technique `rollRarity` already uses for loot tiers -
  mild modifiers (weight 3) come up noticeably more than Cursed (weight
  1, the one modifier stacking atk+hp+def buffs at once). The ~40%
  chance of plain "none" is untouched - only the *non-none* branch
  changed from uniform to weighted.
- **Where the 3 new knobs actually land**: `enemyDefMult` in
  `makeEnemies` (store.ts), applied to both the trash formula (alongside
  the existing per-species `TYPE_VARIANT.defMult`) and the boss formula
  (which never had *any* modifier-driven def change before).
  `eliteChanceBonus` also in `makeEnemies` - stacks additively onto the
  flat 12% base roll, `Math.min(0.6, ...)`-capped so Elite Surge can't
  turn a whole wave into Elites. `goldMult` in `grantKillRewards`
  (store.ts), multiplied in *after* the Title/Talent gold percentage is
  combined (`gold = unit.gold * (1 + goldPct) * goldMult`) - same
  layering order `effectiveStat` uses for gear-then-multiplier, so a
  Wealthy Gate and a gold-Title/Talent build stack additively with each
  other but multiplicatively with the modifier, matching how the rest of
  the game already separates "sources that add" from "the one multiplier
  a specific run-level modifier applies."
- **Testing note**: isolating `enemyDefMult` cleanly needs a fixed low
  `Math.random()` (e.g. `0.01`) so `makeEnemies`'s per-unit species/
  variant roll always lands on `TYPE_VARIANTS[0]` (`defMult: 1.0`) -
  otherwise the variant's *own* independent `defMult` gets multiplied in
  first, and comparing `buffed.def === base.def * 2` fails on rounding
  drift between the two separately-rounded values, not a real bug (hit
  this exact false failure once while testing #11 - fixed by controlling
  which variant gets picked, not by loosening the assertion). Also worth
  picking a gate with non-zero `baseDef` for def-mult tests - `g1`'s is
  literally `0`, which makes `0 === 0 * 2` pass without proving anything.

## Random Events (Phase 4 item #12 of EXPANSION_ROADMAP.md)

- **`src/systems/events/`** - `RandomEventDef`/`RandomEventEffect` (a
  discriminated union, same shape-language as `TalentBonus`/`ClassBonus`)
  in `types.ts`; the 5-entry weighted pool, `rollRandomEvent`, and
  `RANDOM_EVENT_RANK_MULT` in `data.ts`. `rollRandomEvent(nextWaveIsBoss)`
  does two things in one call: the ~25% "does anything happen at all"
  gate, then (if it passed) a weighted pick from a pool that's filtered
  to exclude `ambush` when `nextWaveIsBoss` is true.
- **All effects are instant, none have a duration** - this is a
  deliberate scope boundary, not an oversight. A temporary stat buff/
  debuff needs a real duration-tracking mechanic (which combat status
  effects, itself unbuilt, would be the actual home for) - so every
  event here is a one-shot state change instead: gold, one bonus loot
  item, a %-of-missing HP/MP heal, or one bonus enemy. Don't extend this
  pool with a "for N rounds" effect without first building that
  mechanic as its own thing.
- **`Game.applyRandomEvent`** (private, store.ts) is where each
  `RandomEventEffect` kind's actual numbers get applied - a plain
  switch, one case per kind, each ending in a `showGlobalToast(...,
  "event")` announcement. The `"ambush"` case is intentionally a near-
  no-op there (just the toast) - the actual enemy gets appended by the
  *caller*, since only `Game.advanceWave` has the freshly-generated
  `enemies` array in scope for the wave about to start.
- **`Game.makeTrashUnit`** (new, extracted from `makeEnemies`) is what
  makes the Ambush unit possible without a second copy of the trash-
  stat-roll formula: `makeEnemies`'s per-unit loop and `advanceWave`'s
  ambush branch both call it now, the latter with `forceElite: true` and
  pinned to `trashCount - 1` (the hardest position in the gate's ramp) so
  an Ambush unit is a real, noticeably tougher threat, not a coin-flip
  trash reskin. This is the one working-code refactor #12 required (not
  optional polish) - re-verify anything that touches trash-unit
  generation against #11's existing modifier tests too, since this
  function is now shared by both systems.
- **New counter**: `COUNTER_KEYS.randomEventsTriggered`
  (`"randomEvents.total"`) increments once per event that actually
  fires (not per `advanceWave` call) - a real Progress-system
  integration, there for a future "Encounter N Random Events" Title/
  Achievement to key off, the same as every other lifetime counter.
- **Testing note**: a weighted/probabilistic system like this needs
  statistical assertions, not single-sample ones - e.g. confirming
  Ambush can occur off a non-boss transition and never occurs into a
  boss one needs ~2000 trials checking "was it ever seen", and
  confirming the ~25% trigger rate against the real integrated
  `advanceWave()` path (not just `rollRandomEvent` in isolation) needs
  hundreds of trials with a tolerance band (`0.15 < rate < 0.35`), not an
  exact-percentage assertion. `g["advanceWave"]()` (bracket access, same
  pattern as every other private-method test in this codebase) with a
  hand-built `battle` object (`result: "wave-clear"`, a real multi-wave
  gate id, `modifier` already set so `rollGateModifier` never gets
  consulted) is how to drive the integrated path directly without
  needing a live `battleAttack()`/kill sequence first.

## Better Enemy AI (Phase 4 item #13 of EXPANSION_ROADMAP.md)

- **No new module** - unlike #11/#12, this item is entirely inside
  `Game.decideEnemyAction`/`Game.enemyTurn` (store.ts), since it's
  deepening logic that was already centralized there, not adding new
  content data. `Game.BOSS_ENRAGE_HP_PCT` (a `private static readonly`)
  is the one new named constant, shared between `decideEnemyAction`
  (the actual gate) and `enemyTurn` (the toast/`bossEnraged`-flag logic,
  which needs to recompute the *same* condition to tell "just entered
  enrage this round" apart from "already enraged" - see below).
- **Enrage bypasses the roll entirely** - `decideEnemyAction` returns
  `"special"` immediately for an enraged boss, before any of the
  guard/special chance math even runs. This is deliberate: enrage is a
  hard phase change, not "a much higher special chance" that could still
  roll into a guard.
- **The enrage toast needed the *caller* to know something
  `decideEnemyAction` alone can't tell it**: whether this is the round
  the boss *just* dropped into enrage range (worth a distinct "grows
  desperate" announcement) vs. a later round where it's already been
  enraged for a while (worth the ordinary "unleashes a fierce strike"
  text every special already gets). `enemyTurn` recomputes the same
  `battle.isBossWave && !battle.bossEnraged && hp <= threshold` check
  itself (`enragingNow`) *before* calling `decideEnemyAction`, sets
  `next.bossEnraged = true` if it's true, and picks which toast text to
  show based on that - not on `decideEnemyAction`'s return value alone,
  since by the time that returns, "was this the entry round" information
  is already lost. If a future change ever needs `decideEnemyAction` to
  report *why* it chose an action (not just what), that's the sign to
  finally give it a richer return type instead of this recompute-at-the-
  call-site pattern - fine for one flag, would get messy for more.
- **`showBattleToast` is single-slot per battle** (`battle.toast`, no
  queue) - calling it twice in the same synchronous `enemyTurn` step
  would silently stomp the first call, so the enrage-vs-ordinary toast
  choice has to be a single `if/else if`, never two separate calls in
  sequence. Keep this in mind for any future addition that wants to
  announce two things in the same enemy action.
- **Testing note**: `decideEnemyAction` is pure roll-vs-threshold, so
  picking a `Math.random()` mock value that sits *between* two
  behaviors' actual computed thresholds (e.g. Elite's 0.06 guardChance
  vs. plain trash's 0.12) is enough to prove the difference
  deterministically, no statistical trials needed (unlike #11/#12's
  weighted-pool systems). The full `enemyTurn` integration test for the
  enrage toast can be driven synchronously - for a boss wave (always
  exactly one enemy), `this.state.battle` is set before `enemyTurn`'s
  first `setTimeout` ever fires, so `g["enemyTurn"](battle)` followed by
  reading `g.state.battle.toast`/`.bossEnraged` needs no polling.

## Player aura (visual, not mechanical)

`PLAYER_RANK_GLOW` (portraits.ts) is a dedicated violet "chosen one" color
scale, separate from the flat monster-rank greys — climbs from a muted
E-rank tint to a radiant near-white S-rank one. `hunterPortrait(rank)`
uses it for the portrait's own SVG glow/eyes/dagger; `playerAuraHtml(rank)`
wraps a glow + counter-rotating ring(s) around the portrait, tiered:
E/D = one pulse ring, C/B = adds a second ring, A/S = adds orbiting
embers. Shown on Title, the Battle arena (updates live via a cheap
CSS-var/class swap if rank crosses a boundary mid-battle, without
regenerating the portrait SVG itself so no in-flight animation gets cut),
and a recolor-only version on the small Inventory paperdoll portrait
(too small for the full ring/ember treatment without spilling into
neighboring grid tiles).

## VFX layer (`src/fx/ShaderFX.ts`)

WebGL2, hand-written GLSL, no engine dependency. Public methods: `slash`,
`flurry` (Dagger Rush's triple-hit + flare ring), `smash` (enemy specials
— a distinct blood-red shockwave, not reused slash/flurry, so a special
reads as its own kind of threat), `guardRing`, `dissolve` (enemy death
burst), `arisePortal` (violet swirl for Arise), `levelUpBurst`. Falls back
to CSS-only if WebGL2 init fails. Color convention: **blood-red** for
every effect where a hit actually lands (damage, whether player, Shadow,
or enemy); **violet** reserved for everything that isn't damage (guard,
Arise, level-up, dissolve).

## Design conventions worth preserving

- **"Effective X" getters, never raw fields, for anything gear can touch.**
  Adding a new equipment-affectable stat means adding to this pattern, not
  bypassing it.
- **Blood-red = damage landed, violet = everything else.** Keep new VFX
  consistent with this or it muddies the one clear signal the game gives
  during fast-paced multi-enemy fights (no text log).
- **`STAT_TUNING` / `SELL_PRICE_RATIO` / similar named constants in
  data.ts are the single source of truth** for numbers referenced from
  multiple places (store logic + UI preview text) — never hardcode the
  same number twice.
- **Archetype ≠ species name.** Only 6 hand-drawn silhouettes exist;
  monster variety across 20 gates/~100 named species comes from name +
  stat-weight variant, not unique art. Don't try to hand-author a 121st
  portrait function for a new gate — extend the name pools / variant
  table in data.ts instead.
- **Battle screen never does a full `innerHTML` rebuild in `update()`.**
  Any new battle-screen state needs a targeted DOM patch, or it'll cut off
  whatever CSS animation is mid-flight.
- **No text combat log, ever.** All feedback is animation/color/float-text.
- **Any static content table addressed by id gets a `Registry` (see
  `services/registry.ts`), and every `.find()` on that table gets
  converted to use it** - don't add a new `TABLE.find((x) => x.id ===
  id)` call site once a table has a registry; that reintroduces exactly
  the "silent duplicate id" risk the registry exists to prevent. A table
  that's only ever iterated in full (no id lookup anywhere) doesn't need
  one - don't add a registry with no real consumer.
- **New systems get their own `src/systems/<name>/` folder** (types.ts +
  data.ts + logic), not more code stuffed into store.ts/data.ts — see the
  architecture note at the top of `EXPANSION_ROADMAP.md` for why the
  existing core files weren't relocated wholesale when this pattern was
  introduced.
- **Bump `CURRENT_SCHEMA_VERSION` and migrate** (`systems/save/types.ts` /
  `loadSave()`) any time a persisted shape changes - see "Meta-progression"
  above. Skipping this silently breaks every existing player's save.

## Known limitations / roadmap

- Procedural SVG portraits stand in for real artwork (see `ART_ASSETS.md`
  for the exact filename manifest to swap in real images once supplied).
- Sound design not started.
- The full long-term content roadmap is a **fixed, numbered 20-item order
  set by the project owner**, tracked item-by-item in
  **`EXPANSION_ROADMAP.md`**: Save/Load ✅ → data-driven architecture ✅ →
  Inventory improvements ✅ → Equipment affix expansion ✅ → Shadow
  Collection ✅ → Shadow Evolution ✅ → Shadow Management UI ✅ → Talent
  Tree ✅ → Hunter Classes ✅ → Promotion Exams ✅ → Dungeon Modifiers ✅ →
  Random Events ✅ → Better Enemy AI ✅ → Crafting → Relics → Equipment
  Sets → Infinite Tower → Achievements ✅ → Titles ✅ → Prestige. Always
  check that file for current status before starting any expansion work -
  **do not start the next item without an explicit go-ahead**, and do
  not reorder or batch items.

## Workflow notes for whoever picks this up next

- **No Playwright / browser self-testing** — this is a standing user
  instruction. The user takes their own screenshots and reports problems.
  Verify non-visual logic (drop rates, formulas) with plain Node scripts
  (`npx tsx -e "..."` importing from `src/`) instead.
- **Publish pipeline**: `npx tsc -b --noEmit` → `npm run build` → inline
  `dist/index.html` + its hashed CSS/JS into one self-contained HTML file
  (Python one-liner, see recent commits for the exact script) → `Artifact`
  tool, `url` set to the existing persistent artifact URL so it updates in
  place rather than minting a new one, `favicon: "⚔️"`, a `label` ≤60
  chars (hard limit).
- Commit + push to `claude/hunter-protocol-game-b1i5ur` after every
  feature round, with a commit message that explains *why*, not just
  *what* (this file and the commit history are the project's real
  documentation — there's no separate design doc).
