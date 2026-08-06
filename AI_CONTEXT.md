# Hunter Protocol — AI Context Summary

Read this first if you're picking up this project cold. It describes what
exists, how it's built, and why certain things are shaped the way they are
— so you don't re-derive decisions that were already made deliberately.

## What this is

A Solo Leveling-inspired, turn-based hunter RPG. Clear ranked Gates in
sequential monster gauntlets, level up, spend stat points, loot/buy/equip
gear, and **Arise** the monsters you defeat as permanent Shadow allies.
Single-player, browser-based, no backend, no persistence yet (see
Limitations).

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
    index.ts                App shell: screen switching + bottom tab bar
    title.ts / gates.ts / battle.ts / stats.ts / shadows.ts / inventory.ts
  styles/
    tokens.css               Design tokens (colors, spacing, radii) - "Nocturne" dark-violet theme
    base.css                   Buttons, cards, tags, bars, tabs, form controls
    effects.css                 Every CSS keyframe/VFX class
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
`GateModifier` (blessed/bountiful/vicious/swift/none) rolls once per
attempt. Every gate rank has a signature `Archetype` (E=goblin, D=orc,
C=wraith, B=knight, A=beast, S=wyrm) and each gate's 5 `enemyTypes` are a
rotated slice of that archetype's 6-name pool, so gates on the same rank
field different rosters. Each trash spawn also rolls a stat-weight
`TYPE_VARIANT` (glass-cannon/tanky/balanced/...) tied to which of the 5
species it got, so "5 different types" is a real combat difference.

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
specials the instant the player guards. A deployed Shadow auto-strikes
after every player action (`companionStrike`). All landed hits read
blood-red (float numbers, impact glow, screen flash); non-damage effects
(guard, Arise, level-up) stay violet. No text combat log — feedback is
purely visual/animated.

**Stats** — Power Score card (see below) at top, then HP/MP/XP bars, then
one row per core stat with a `+` button. Hovering previews exactly what
the point buys (`gainText()`); clicking floats the same text as a
confirmation. STR→Attack damage, AGI/PER→crit chance + guard-miss
reduction, VIT/INT→**immediate** max (and current) HP/MP (not gated behind
a future level-up).

**Shadows** — grid of every Shadow ever Arisen (offered after *every* wave
clear, trash or boss, not just bosses). Rank + species filter dropdowns.
One deploy slot; deploying a new Shadow auto-recalls the previous one.

**Inventory** — 3 sub-tabs in one screen:
- **Gear** — paperdoll equipment grid (6 slots: weapon/helmet/chest/legs/
  ring/amulet) around the Hunter portrait, connector lines as real grid
  children (not %-based pseudo-elements, to survive uneven row heights),
  plus the loot bag below with slot/rarity `<select>` filters. Selling an
  item asks for a tap-to-confirm (row flips to "Sell for Xg? / Confirm /
  Cancel") before paying out **10%** of its Shop price
  (`SELL_PRICE_RATIO`/`sellPriceForItem` in data.ts) — no free discard.
- **Shop** — procedurally-rolled gear at the player's current rank, 6
  items. Restocks itself free every 10 real minutes
  (`SHOP_AUTO_RESTOCK_MS`), or pay `rerollCost` to reroll early — both
  reset the same countdown, shown live via a 1s UI-only tick.
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
  spent stat point) or a direct flat `hp`/`mp`/`crit` bonus. A VIT/INT
  affix converts to HP/MP through the exact same `STAT_TUNING` rate a
  spent stat point does — the two systems can't drift apart.
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

## Known limitations / roadmap (from README)

- **No persistence** — a full session lives in memory only; no
  localStorage save/load yet.
- Procedural SVG portraits stand in for real artwork.
- Sound design not started.
- Shadow Army has no rename/upgrade yet (deploy/recall only).

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
