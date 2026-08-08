# Hunter Protocol

A turn-based, Solo Leveling-inspired hunter RPG: clear ranked Gates in
one-on-one battles, level up, allocate stats, gear up, and **Arise** the
monsters you defeat as Shadow allies.

Ported faithfully from an original Claude Design mockup (dark "Nocturne"
theme, System-window UI) into a real, shippable game — TypeScript, no game
engine, no external art/font dependencies — built to run on:

| Platform | Toolchain                    | Output                       |
|----------|-------------------------------|-------------------------------|
| Web      | Vite                           | Static site (`dist/`)         |
| Windows  | Electron + electron-builder    | `.exe` installer / portable    |
| Android  | Capacitor                      | `.apk` / `.aab`                |

## Gameplay

- **Gates** — 20 gates across all 6 ranks (4×E, 4×D, 4×C, 3×B, 3×A, 2×S),
  each fielding **5 distinct trash species** of its own (rolled at random
  per spawn) plus a named boss - not just a bigger version of the same
  enemy. Every rank has its own signature monster family (goblins on E,
  orcs on D, wraiths on C, knights on B, beasts on A, wyrms on S), so the
  silhouette + rim-glow color always tells you a threat's rank at a
  glance; each of the 5 species within a gate also rolls its own
  stat-weight flavor (glass-cannon, tanky, balanced, ...) so the variety
  is felt in combat, not just read off a name label. The original 6
  hand-placed gates (*Crumbling Ruins* → *Sunken Crypt* → *Frost Hollow* →
  *Red Cathedral* → *Void Spire* → *Dragon's Maw*) are unchanged; 14 more
  fill out every rank with real alternatives to grind
- **Multi-enemy gates** — each gate is a 10-20 enemy gauntlet (rank-scaled:
  10 on E, up to 20 on S), fought in waves of up to **3 simultaneous
  enemies**, ramping in strength across the whole run ("easy to hard"),
  capped by a solo **boss** — a visually amplified version of that gate's
  monster (bigger portrait, glowing rotating ring, boss name, heavier
  stats). HP/MP carry over between waves within a run — no free heals,
  potions are the only relief
- **Dungeon Modifiers** — every gate attempt rolls one (~40% chance of a
  plain, unmodified run) from 11 real modifiers spanning three tiers:
  mild (Blessed +50% XP, Bountiful +loot chance, Wealthy +50% gold,
  Generous softer enemies + XP, Swift/Frail weaker enemies), risk-reward
  (Vicious harder-hitting enemies + loot, Elite Surge far more Elites,
  Tempered/Fortified tougher and better-armored enemies for more
  reward), and the rare **Cursed Gate** - enemies hit harder, have more
  HP *and* more armor all at once, but the gold and loot chance are
  cranked way up to match. Rarer modifiers roll less often (weighted, not
  a flat coin-flip across all of them), so the biggest risk/reward gates
  actually feel rare
- **Battle** — turn-based, auto-targeting the frontmost living enemy
  (underlined): **Attack**, **Skills** (see below), **Guard** (blocks for a
  random 1-3 rounds, halving incoming damage each round it's up - but
  footing is worse while guarding, so Attack itself can whiff; AGI/PER cut
  that miss chance down), **Items** (see Consumables below). Enemies sit
  above, the player (and a deployed Shadow) below, so attacks read as
  motion up/down between them rather than side-to-side. All alive enemies
  in a wave attack each round, so a full group is real pressure - and
  they're not just dumb damage dealers: each one rolls between a normal
  attack, **blocking** (reduces the next hit it takes), and a **special
  strike** (~1.7x damage, its own blood-red shockwave-ring vfx distinct
  from a normal hit or a player crit, telegraphed with a toast and a
  heavier shake) - low-HP enemies turtle up more, and all of them lean into
  specials the instant *you're* the one guarding. Every landed hit - yours,
  a Shadow's, or an enemy's - reads blood red (float numbers, impact glow,
  screen flash); non-damage effects (guard, Arise, level-up) stay violet.
  Feedback is purely visual - no text log
- **Skills** — unlock progressively with level, opened via a picker panel
  (locked ones show their unlock level): **Dagger Rush** (Lv 1, heavy
  single hit), **Piercing Thrust** (Lv 5, hits the front 2 enemies),
  **Shadow Execute** (Lv 10, single-target - doubled against a wounded
  target), **Umbral Storm** (Lv 15, hits the entire wave)
- **Leveling** — XP is granted per kill and tuned to come at a good clip
  (trash enemies give a smaller cut, the boss a big one); the curve grows a
  gentle 1.18x per level, and each level grants +15 max HP, +5 max MP, and
  3 stat points to spend on STR/AGI/INT/VIT/PER - it does **not** top off
  current HP/MP, so leveling mid-fight is a milestone, not a free heal
- **Stats** — every stat now does something concrete: STR raises Attack
  damage, AGI/PER raise crit chance and cut down the guard-miss chance,
  VIT grants immediate max (and current) HP, INT grants immediate max (and
  current) MP. Spending a point floats a confirmation of exactly what it
  bought ("+5 Max HP", "+0.3% Crit · -1% Guard Miss", ...) right off the
  Status screen row you spent it on
- **Shadow Army** — **every** wave clear (trash or boss) offers **Arise** on
  a short interstitial before continuing, adding that wave's monster as a
  permanent Shadow ranked to your current Hunter rank - not just the boss.
  The Shadow Army screen filters by rank and by species so a large roster
  stays easy to manage. Every Shadow now **levels up** from fighting
  alongside you (more from a kill than a graze), grows **Loyalty** the
  longer you fight together (never decays, feeds a small power bonus, and
  shows as a Mood label - Wary → Reserved → Content → Devoted), and
  belongs to one of 6 families with a genuinely different fighting style:
  **Goblins** hit harder as a target gets low and sometimes strike twice;
  **Orcs** hit harder always, with a chance at a single huge blow;
  **Wraiths** trickle you MP on every hit and can unleash a 3-hit flurry;
  **Knights** heal you off their own damage and can ignore a target's
  Defense outright; **Beasts** crit often and can guarantee one; **Wyrms**
  sometimes drop bonus gold on a kill and can breathe damage across the
  whole enemy wave at once. A "Merge Duplicate" button on a card with a
  same-species double consumes the weaker copy for levels + Loyalty on
  the one you keep. Once a Shadow hits max level, **Evolve** it (gold
  cost, scales with rank) into the next rank tier - a real transformation,
  not a stat bump: new archetype, new passive/active skill pair, higher
  power ceiling, level reset to 1 so it keeps growing meaningfully. Its
  name, species, Loyalty, and battle history carry over unchanged; an
  evolution-count badge on the card marks how many times it's happened.
  Each Shadow can also be **renamed** and has its own **Gear** panel - 6
  equipment slots (weapon, helmet, body armor, legs, ring, amulet), drawn
  from and returned to your shared Bag, same as your own gear. Core-stat
  gear boosts its Power directly; Fire Damage, Crit, Life Steal, Attack
  Speed, and Mana Regen all work on Shadow-worn gear too - a Life Steal
  ring on your Shadow heals *you*, not the Shadow
- **Power** — one combined "how strong am I" number, shown on the Title
  screen and prominently on Status: level, every effective stat (gear
  folds in automatically), effective max HP/MP, crit chance, and the
  combined power of your *whole* Shadow Army all feed into it, and it
  pulses gold on Status whenever it goes up
- **Talent Tree** — a Talents sub-tab on Status: 1 Talent Point per level,
  spent permanently (no respec) on a 15-node tree - 3 branches, 5 tiers
  each, a straight path per branch (unlock tier 2 only after tier 1 in
  that same branch, and so on). **Offense** stacks STR and Crit into a
  glass-cannon capstone; **Defense** stacks VIT/INT into an All Stats
  capstone; **Utility** trades AGI/PER into a Gold/XP economy topped with
  a Crit capstone - three genuinely different builds, stacking on top of
  gear and an equipped Title rather than competing with either
- **Hunter Class** — a Class sub-tab on Status: at Level 5, choose one of
  the 5 classes permanently (no respec) - **Fighter** (+12% Attack
  damage), **Mage** (+12% Skill damage), **Tank** (Guard mitigates far
  more damage), **Assassin** (+30% critical damage), or **Healer** (+20%
  healing from HP potions). Each bonus lands in one specific action
  instead of a generic stat boost, so the choice actually changes how you
  fight, not just your numbers
- **Promotion Exams** — leveling past a rank threshold no longer promotes
  you automatically; it unlocks a **Promotion Exam** banner on the Gates
  screen instead - a single, tougher solo boss trial per rank (D through
  S). Win it and you're officially confirmed at the new rank (Shop stock,
  your Shadows' power, and your portrait aura all reflect it) plus a
  one-time gold + stat point reward; lose and just try again. Rank always
  advances one tier at a time, even if you've out-leveled several tiers
  at once
- **Equipment** — 6 slots (Weapon, Helmet, Body Armor, Legs, Ring, Amulet),
  each item rolling 1-4 random affixes depending on rarity: the five core
  stats (folds into effectiveStat, same as a stat point), direct flat
  HP/MP/Crit bonuses ("+22 Max HP", "+3% Crit") that don't cost a stat
  point at all, and four combat affixes with a real in-battle effect -
  **Life Steal** (heal a % of your own damage dealt), **Attack Speed** (a
  chance at an immediate follow-up strike on Attack), **Mana Regen** (MP
  restored every round), and **Fire Damage** (flat bonus damage on every
  hit). A VIT/INT affix converts to HP/MP at the exact same rate a spent
  stat point does, so the two systems never feel inconsistent
- **Rarity** — 7 tiers, common up to godly (common → uncommon → rare →
  epic → legendary → mythic → godly), each both rarer and a bigger
  multiplier on every affix it rolls than the last. Base odds off a plain
  kill are deliberately thin at the top (legendary 3% · mythic 0.8% ·
  godly 0.1%) - what actually gets you there is the bonuses stacking on
  top: elite kills, boss kills, buying from the Shop, and **gate rank**
  (E→S) all push the odds up, so an S-rank boss kill has a real shot at
  the top tiers an E-rank trash kill just doesn't
- **Inventory** — three sub-tabs, each its own menu: **Gear** (a paperdoll
  equipment grid - Amulet/Helmet across the top with Weapon and Ring
  flanking the Hunter, Body Armor and Legs stacked below, connected by
  pathway lines, plus the loot bag with compact slot/rarity filter
  dropdowns and a Default/Rarity/Value/Newest sort), **Shop** (spend gold
  on procedurally-rolled equipable gear; restocks itself for free every 10
  real minutes, or pay to reroll early - both reset the same countdown,
  shown live on the tab), and **Potions** (the tiered HP/MP consumables,
  used mid-battle from the Items panel next to Skills). The bag has no
  free discard - selling (a tenth of an item's Shop price) is the only way
  an unwanted piece leaves it, and asks for a tap-to-confirm first so
  nothing sells by accident. Tapping any item in the bag or Shop (not the
  buttons) expands a **comparison** against whatever's equipped in that
  slot - exactly which stats go up, which go down, right there before you
  commit to equipping or buying
- **Status** — three sub-tabs. **Status** (unchanged): hovering a stat's
  `+` previews exactly what that point would buy ("+5 Max HP", "+0.3% Crit
  · -1% Guard Miss", ...) before you commit to it, then floats the same
  confirmation off the row once you do. **Titles**: milestone-gated
  passive bonuses (kill counts per monster family, Shadow collection size,
  Gates cleared, boss kills, rank reached) - locked ones show live
  progress toward them, one can be equipped at a time. **Achievements**: a
  starter roster of 28 spanning every progression axis in the game, each
  granting gold or stat points the instant it's met, no separate claim
  step
- **Progress persists** — autosaves (debounced, at most once every 3s,
  plus a final flush on tab close) to a versioned localStorage save. The
  Title screen offers **Continue** (with a preview of who you're
  continuing as) or **Start a New Hunter** (confirmed, since it deletes
  the save) whenever one exists; an in-progress battle is deliberately
  never resumed mid-fight - Continue always lands you back at Gate
  selection

Unlocking a Title or Achievement anywhere in the app (not just in Battle)
floats a brief global toast so growth stays visible no matter which screen
you're on.

## Visual effects

Every battle action plays through two layers, both ported/extended from
the original design:

1. **CSS keyframe layer** — screen shake, floating damage/heal numbers,
   HP-bar hit-flash, lunge, impact glow, guard-ring pulse — the exact
   animations from the source design file. The Hunter's own portrait also
   carries a permanent **rank aura** (Title, Battle, and the Inventory
   paperdoll) - a glow + counter-rotating rings in a color that climbs from
   a muted E-rank violet to a radiant near-white S-rank one, gaining a
   second ring at C-rank and orbiting embers at A-rank, so standing still
   at S-rank actually looks like it
2. **WebGL2 shader FX layer** (`src/fx/`) — hand-written GLSL, no engine
   dependency: glowing energy **slash trails**, a triple-hit **flurry** for
   Dagger Rush with an expanding flare ring, additive **spark particles**
   on every impact, an enemy **dissolve** burst on defeat, and a
   noise-driven violet **portal swirl** for the Arise moment. Falls back
   gracefully to CSS-only effects if WebGL2 isn't available.

All portrait art (Hunter, all 6 enemies, Shadow variants, gate icons) is
original inline SVG generated in `src/art/portraits.ts` — stylized dark
silhouettes with rank-tinted rim glow, no external image files. Swap any
of it for real artwork later by replacing what those functions return.

## Project layout

```
src/
  main.ts               Bootstrap: mounts styles + the app
  types.ts                Shared TypeScript types
  data.ts                  Gates, equipment, rank thresholds (source-file data)
  store.ts                  Game state + every action (battle, leveling, Arise...)
  art/
    icons.ts                Small original inline-SVG icon set
    portraits.ts              Hunter/enemy/shadow/gate portrait generators
  fx/
    gl.ts                     Minimal WebGL2 helpers (compile/link/buffers)
    shaders.ts                 GLSL sources: streak, radial (ring/swirl/rays), particles
    ShaderFX.ts                 Public effect API (slash, flurry, guard, dissolve, portal...)
  screens/
    index.ts                 App shell: screen switching + tab bar
    title.ts / gates.ts / battle.ts / stats.ts / shadows.ts / inventory.ts
  styles/
    tokens.css                Nocturne design tokens (colors, spacing, radii)
    base.css                    Components: buttons, cards, tags, bars, tabs
    effects.css                  All CSS keyframe VFX
electron/
  main.js / preload.js       Desktop shell around the built web bundle
capacitor.config.ts           Android shell configuration
electron-builder.json          Windows/Linux/Mac packaging targets
```

## Requirements

- Node.js 20+ and npm
- Windows build: cross-platform via `electron-builder`; building the NSIS
  installer *from Linux* needs `wine` — building on Windows/macOS needs
  nothing extra (see CI section below for a Wine-free option)
- Android build: Android Studio / Android SDK + JDK 17+ (only needed on
  whichever machine runs `cap sync` / opens the native project)

## Getting started

```bash
git clone <this-repo-url>
cd Solo-Leveling-
npm install
npm run dev        # Vite dev server with hot reload, http://localhost:5173
```

## One-click: build + play the web version

After cloning, one script installs, builds, and opens the game in your
browser:

- **Windows:** double-click `play-web.bat`
- **macOS / Linux:** `./play-web.sh` (first time: `chmod +x play-web.sh`)

Or run the equivalent directly: `npm run play:web`.

## Building for Web

```bash
npm run build       # outputs static site to dist/
npm run preview      # serve the production build locally
npm run play           # like preview, but also opens your default browser
```

## Building for Windows (Electron)

```bash
npm run electron:dev        # run the desktop shell against a dev build
npm run electron:build:win  # produce a Windows .exe (NSIS installer + portable)
```

Output lands in `release/`. Building the `.exe` **on Linux** needs `wine`
installed; building on Windows or macOS needs no extra setup. CI (below)
sidesteps this entirely by building on a real `windows-latest` runner.

## Building for Android (Capacitor)

The native `android/` project isn't checked in (generated tooling, like
`node_modules`). Generate it once on a machine with the Android SDK:

```bash
npm run build
npx cap init "Hunter Protocol" "com.huntersguild.hunterprotocol" --web-dir=dist
npm run cap:add:android    # scaffolds android/
npm run cap:sync           # rebuilds the web bundle + copies it into android/
npm run cap:open:android   # opens Android Studio
```

From Android Studio: **Build → Generate Signed Bundle / APK**. For quick
testing, `npx cap run android` installs a debug build on a connected
device/emulator directly.

## CI builds (no local Wine/Android SDK needed)

`.github/workflows/build.yml` builds all three targets on every push —
download the results from the workflow run's **Artifacts** section:

- `hunter-protocol-web` — the static `dist/` bundle
- `hunter-protocol-windows` — `.exe` installer + portable exe (real `windows-latest` runner)
- `hunter-protocol-android-debug` — debug `.apk` (Ubuntu + Android SDK/Gradle)

## Roadmap

- ~~Persist progress (localStorage save/load) between sessions~~ — done
  (`src/systems/save/`)
- ~~Shadow Army management (rename, equip gear)~~ — done
  (`src/screens/shadows.ts`)
- Real portrait artwork in place of the procedural SVG silhouettes (see
  `ART_ASSETS.md` for the exact file list to supply)
- Sound design (hit/level-up/gate-clear/Arise stingers)

Long-term content roadmap (Crafting, Relics, Equipment Sets, Random
Events, an Infinite Tower, Daily/Weekly missions, Prestige, combat status
effects, and more) lives in **`EXPANSION_ROADMAP.md`**, phased so each
stays a real, working system rather than a stub — Titles, Achievements,
Shadow Evolution, the Talent Tree, Hunter Classes, Promotion Exams, and
Dungeon Modifiers above are already ahead of/within that plan.
