# Hunter Protocol

A Solo Leveling-inspired action dungeon-crawler: descend into ranked Gates,
cut down monsters, level your Hunter from **E-Rank to S-Rank**, and extract
fallen enemies as **Shadow** allies who fight at your side.

Single TypeScript + [Phaser 3](https://phaser.io) codebase, shipped to three
targets:

| Platform | Toolchain            | Output                          |
|----------|-----------------------|----------------------------------|
| Web      | Vite                  | Static site (`dist/`)           |
| Windows  | Electron + electron-builder | `.exe` installer / portable |
| Android  | Capacitor             | `.apk` / `.aab`                 |

## Gameplay (current MVP)

- **Move:** WASD / Arrow keys
- **Attack:** Space or mouse click (short-range melee, cooldown-based)
- Clear all monsters in a Gate to complete it and bank XP
- Leveling grants stat points — spend them from the main menu
  ("Allocate Stat Points") on Strength (damage) or Agility (move speed)
- Killing monsters has a chance to **Arise** them as a Shadow that follows
  you and auto-attacks nearby enemies in future Gates
- Progress (level, stats, shadow roster, gates cleared) autosaves to
  `localStorage`, which works identically on Web, in the Electron shell, and
  inside the Capacitor Android WebView

All art is procedurally generated at boot (`src/scenes/BootScene.ts`) via
`Phaser.GameObjects.Graphics.generateTexture`, so the game runs with **zero
external asset dependencies**. Swap in real sprites later by replacing those
calls with `this.load.image(...)`.

## Project layout

```
src/
  main.ts              Phaser game bootstrap
  config.ts             Constants: canvas size, save key, color palette
  types.ts               Shared TypeScript types
  data/                  Static game data (rank thresholds, monster roster)
  systems/               LevelSystem (XP/leveling), SaveSystem (localStorage)
  entities/               Player, Monster, Shadow (Phaser Arcade sprites)
  ui/                     SystemWindow — the reusable "blue system popup" UI
  scenes/
    BootScene.ts          Generates all textures, then hands off to menu
    MainMenuScene.ts       Title screen, stat allocation, save reset
    GateScene.ts            Core gameplay loop (combat, XP, extraction)
    UIScene.ts               HUD overlay (HP/MP/XP bars, rank, shadow count)
electron/
  main.js / preload.js    Desktop shell around the built web bundle
capacitor.config.ts        Android shell configuration
electron-builder.json      Windows/Linux/Mac packaging targets
```

## CI builds (recommended way to get real Windows/Android binaries)

`.github/workflows/build.yml` builds all three targets on every push and
lets you download the results from the workflow run's **Artifacts** section
— no local Wine or Android SDK setup needed:

- `hunter-protocol-web` — the static `dist/` bundle
- `hunter-protocol-windows` — the `.exe` installer + portable exe (built on a real `windows-latest` runner)
- `hunter-protocol-android-debug` — a debug `.apk` (built on Ubuntu with the Android SDK/Gradle)

## Requirements

- Node.js 20+ and npm
- For the Windows build: works cross-platform via `electron-builder`; building
  the NSIS installer *from Linux* needs `wine` (see below) — building on
  Windows itself needs nothing extra
- For the Android build: Android Studio / Android SDK + a JDK 17+ (only
  needed on the machine that runs `cap sync` / opens the native project —
  not for everyday web development)

## Getting started

```bash
npm install
npm run dev        # Vite dev server with hot reload, http://localhost:5173
```

## Building for Web

```bash
npm run build       # outputs static site to dist/
npm run preview      # serve the production build locally to sanity-check it
```

Deploy `dist/` to any static host (Netlify, Vercel, GitHub Pages, S3, etc.).

## Building for Windows (Electron)

```bash
npm run electron:dev        # run the desktop shell against a dev build
npm run electron:build:win  # produce a Windows .exe (NSIS installer + portable)
```

Output lands in `release/`. Building the actual Windows `.exe` **on Linux**
requires `wine` to be installed (`electron-builder` shells out to it for
resource signing); building on macOS or Windows itself needs no extra setup.
CI is the most reliable place to produce Windows binaries — e.g. a GitHub
Actions `windows-latest` runner calling `npm run electron:build:win`.

## Building for Android (Capacitor)

The native `android/` project isn't checked in (it's generated tooling, kept
out of git like `node_modules`). Generate it once on a machine with the
Android SDK installed:

```bash
npm run build              # build the web bundle first
npx cap init "Hunter Protocol" "com.huntersguild.hunterprotocol" --web-dir=dist
npm run cap:add:android    # scaffolds the android/ native project
npm run cap:sync           # rebuilds web bundle + copies it into android/
npm run cap:open:android   # opens Android Studio to build/run the APK
```

From Android Studio: **Build → Generate Signed Bundle / APK** to produce a
release `.apk`/`.aab`. For quick testing, `npx cap run android` installs a
debug build on a connected device/emulator directly.

## Roadmap / next steps

- Swap procedural placeholder art for real character/monster sprites and a
  proper System-window font
- Expand the Gate loop: multiple rooms, a boss per Gate, ranged skills, MP-based abilities
- Deepen the Shadow Army: naming, upgrading, and a dedicated command menu
- Sound design (hit/level-up/gate-clear stingers, ambient dungeon loop)
- Wire up cloud save / leaderboards if a backend is added later

> **Design source:** this MVP was scaffolded without access to the shared
> Claude Design file (`Hunter Protocol.dc.html`) — the design tool needs an
> interactive login this environment doesn't have. To bring in the real
> mockups (screens, palette, UI components), use **"Send to Claude Code
> Web"** from that Claude Design project, or share the screens/specs
> directly, and the visuals/UX here can be brought in line with it.
