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

- **Gates** — 6 hand-placed encounters, E through S rank: *Crumbling Ruins*
  (Goblin Scout) → *Sunken Crypt* (Orc Brute) → *Frost Hollow* (Ice Wraith)
  → *Red Cathedral* (Blood Knight) → *Void Spire* (Shadow Beast) →
  *Dragon's Maw* (Ancient Wyrm)
- **Battle** — turn-based: **Attack**, **Dagger Rush** (15 MP skill),
  **Guard** (halves the next hit), **Potion** (+30 HP), plus a live combat log
- **Leveling** — XP curve grows 1.25x per level; each level grants +15 max
  HP, +5 max MP, and 3 stat points to spend on STR/AGI/INT/VIT/PER
- **Shadow Army** — defeating a monster and choosing **Arise** on the
  victory screen adds it as a permanent Shadow, ranked to your current
  Hunter rank
- **Inventory** — starting gear (Dagger of the Depths, Reinforced Leather,
  Band of Focus) plus healing potions
- Progress autosaves are **not yet wired up** (see Roadmap) — this MVP
  plays a full session in memory; add `src/systems/save.ts`-style
  persistence when you're ready to ship

## Visual effects

Every battle action plays through two layers, both ported/extended from
the original design:

1. **CSS keyframe layer** — screen shake, floating damage/heal numbers,
   HP-bar hit-flash, lunge, impact glow, guard-ring pulse — the exact
   animations from the source design file.
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

- Persist progress (localStorage save/load) between sessions
- Real portrait artwork in place of the procedural SVG silhouettes
- More Gates, multi-enemy encounters, additional skills
- Shadow Army management (rename, deploy in battle, upgrade)
- Sound design (hit/level-up/gate-clear/Arise stingers)
