# Hunter Protocol — Game Summary

*Written for an AI model to read cold and understand what the game currently is, so it can suggest new features that fit the existing design rather than duplicate or clash with it.*

## What it is

A turn-based, *Solo Leveling*-inspired browser RPG. TypeScript + Vite, no game engine, no external art/font dependencies — runs as a static site, an Electron desktop app, a Capacitor Android app, and also ships as a single self-contained HTML Claude Artifact. Procedural SVG portraits stand in for real art; the whole thing is a dark "Nocturne" theme, System-window UI aesthetic straight out of the source material.

**Core fantasy:** clear ranked Gates in turn-based battles, level up, gear up, and **Arise** the monsters you defeat as permanent Shadow allies who fight alongside you.

## Architecture

- **`Game` class** (`src/store.ts`) is the single source of truth — plain observer pattern (`subscribe()`/`notify()`), no vdom. Screens do targeted DOM updates or full `innerHTML` redraws; a shared `redraw()` helper (`screens/types.ts`) preserves scroll position across redraws so in-list actions don't jump the view.
- **Content registry pattern**: every static content table (gates, skills, potions, titles, achievements, talents, classes, relics, equipment sets…) is wrapped in a `Registry<T>` (`services/registry.ts`) — O(1) lookup, throws at load time on duplicate ids. Only for content fixed at build time; player state (bag, shop stock, spawned enemies) stays plain arrays.
- **`systems/<feature>/`** convention: every roadmap item that needed new content data got its own folder (`types.ts` + `data.ts`), imported into `store.ts` for game-logic wiring and into `screens/*.ts` for display.
- **Save system**: versioned localStorage (`src/systems/save/`), schema-migration-ready (`CURRENT_SCHEMA_VERSION`), debounced autosave (~3s) plus a flush on tab close. Never resumes mid-battle — Continue always lands on Gates. Three established migration patterns for adding new state: (a) brand-new slice with a retroactive catch-up grant, (b) brand-new slice with a safe empty default, (c) a new field on an already-persisted object that needs explicit backfill because it participates in arithmetic.
- **Screens**: `title`, `gates`, `battle`, `tower`, `stats` (Status), `shadows` (Shadow Army), `inventory` (Items). Bottom tab bar with 5 tabs, hidden on Title/Battle.

## Core gameplay loop

1. Pick a Gate (20 total, ranks E→S) or an Infinite Tower floor.
2. Fight through waves of trash (up to 3 simultaneous enemies, ramping difficulty across the whole run) to a boss, in turn-based combat: Attack / Skills / Guard / Items.
3. Win → gold, XP, a chance at loot, and the option to **Arise** the fallen boss as a Shadow.
4. Spend gold/gear on stronger equipment, spend stat/talent points, manage a growing Shadow Army, and push into harder content.
5. At the very top: **Reawaken** — reset your run for a permanent account-wide power boost, then do it all again.

## Combat

- Turn-based, auto-targets the frontmost living enemy. Player actions: **Attack**, **Skills** (4 unlocked by level: Dagger Rush, Piercing Thrust, Shadow Execute, Umbral Storm), **Guard** (1–3 rounds of halved damage, but a guard-miss chance on the *next* Attack, mitigated by AGI/PER), **Items** (HP/MP potions).
- HP/MP carry across waves within one run — no free heals between fights.
- Enemies: 5 named trash species per gate + a boss, each species rolling one of 5 stat-weight variants (glass-cannon/tanky/balanced/etc.), ~12% base Elite chance (tougher, more aggressive AI).
- **Enemy AI**: boss enrage at ≤25% HP (always uses its special attack from then on, one-time toast announces it), Elites guard less than plain trash, and *all* enemies get less cautious (less guard, more special) when the player drops below 30% HP.
- One deployed Shadow auto-assists every player action, using its archetype's passive+active combat skill.
- Crits, Life Steal, Attack Speed procs, Mana Regen, Fire Damage all live in the combat resolution loop, driven by equipment affixes.

## Progression systems (all shipped)

| System | Mechanic |
|---|---|
| **Stats** | STR/AGI/INT/VIT/PER, 3 points/level, each does something concrete (STR→ATK, AGI/PER→crit chance + guard-miss reduction, VIT/INT→immediate max HP/MP) |
| **Rank** | `rankForLevel()` (what your level *implies*) vs `PlayerState.rank` (what's *confirmed* via Promotion Exam) — a deliberate duality; only confirmed rank gates Shop stock, Shadow power at Arise, and portrait aura |
| **Promotion Exams** | 5 single-boss trials (D→S rank), one-time gold+stat reward, always advances rank exactly one tier even if you've out-leveled several |
| **Talent Tree** | 15 nodes, 3 branches (Offense/Defense/Utility) × 5 tiers, linear-per-branch (tier N needs tier N-1 in the same branch), 1 point/level, permanent — no respec |
| **Hunter Class** | 5 classes (Fighter/Mage/Tank/Assassin/Healer) unlocked at level 5, one permanent pick, each bonus hits exactly one specific combat formula rather than the shared pct pipeline |
| **Titles** | 12 entries, milestone-gated (kill counts per monster family, Shadow collection size, gates cleared, boss kills, rank), one equipped at a time |
| **Achievements** | 28 entries, instant gold/stat reward the moment a condition is met, no claim step |
| **Relics** | 14 entries (6 minor/5 greater/3 ancient), **found** via a 15% roll on real Gate boss clears (never trash, never an exam, never a Tower floor), own as many as you find but equip only 3 at once, freely swappable for free |
| **Equipment Sets** | 3 named sets × 6 pieces each (weapon/helmet/chest/legs/ring/amulet, always legendary rarity), drop into the *same* gear slots as normal loot — genuinely competes with your best individually-rolled item — cumulative 2pc/4pc/6pc threshold bonuses |
| **Prestige / Reawakening** | Confirmed S-Rank + Level 30 → a partial reset (stats/gear/gold/Shadows/Talents/Gate-progress wiped, but Titles/Achievements/Relics/Tower-record kept) for permanent Monarch Shards — never spent, small uncapped All-Stats bonus |

**The shared additive-pct pipeline** is the single most important cross-system design rule: Title + Talent + Relic + Equipment Set + (effectiveStat-only) Prestige all sum into *one* combined percentage before a single multiply, everywhere it applies (`effectiveStat`, `critChance`, `grantXp`, `grantKillRewards`). Nested multiplies are explicitly forbidden — they'd silently compound instead of adding. Any new percentage-granting system should fold into this same pipeline the same way.

## Itemization

- 6 gear slots (Weapon/Helmet/Chest/Legs/Ring/Amulet), 7 rarity tiers (common→uncommon→rare→epic→legendary→mythic→godly), 1–4 affix rolls scaling with rarity and the rank it dropped at.
- Affixes: 5 core stats (fold into `effectiveStat` like a stat point) + flat HP/MP/Crit bonuses (don't cost a stat point) + 4 combat affixes with a real in-battle effect (Life Steal, Attack Speed, Mana Regen, Fire Damage).
- **Crafting**: Shadow Essence (earned by disenchanting Shadows) + gold buys a guaranteed item at a chosen slot with better rarity odds than the Shop, or Reforges an equipped item's affixes in place (same slot/rarity, costed by the item's own rarity).
- Shop restocks itself free every 10 real minutes, or pay to reroll early.

## Shadow Army

- Every wave clear (trash or boss) offers Arise, adding that monster as a permanent Shadow at your confirmed rank — not just the boss.
- 6 archetypes (goblin/orc/wraith/knight/beast/wyrm — one per gate rank), each with a genuinely distinct passive + active combat skill (e.g. Goblins strike twice sometimes and hit harder on low-HP targets; Wraiths trickle MP and can flurry-hit; Knights heal you off their damage and can ignore Defense).
- Shadows level from fighting, grow Loyalty (never decays, feeds a small power bonus + a Mood label), can be **Merged** (weakest duplicate consumed for levels+Loyalty on the survivor), **Evolved** (a real transformation into the next rank tier at max level — new archetype, new skills, level resets), given their own 6-slot gear loadout, renamed, or **Disenchanted** for Shadow Essence.

## Content variety systems

- **Dungeon Modifiers**: 12 entries (including "none", ~40% chance of a plain run), 7 tunable knobs (xpMult / loot / enemyAtkMult / enemyHpMult / enemyDefMult / eliteChanceBonus / goldMult), weighted rarity so the biggest risk/reward modifiers (e.g. the stacked-buff "Cursed Gate") actually feel rare.
- **Random Events**: 5 types (~25% chance on every wave-to-wave transition) — Gold Cache, Hidden Cache (bonus gear), Healing Spring, Ambush (one bonus enemy, never on a boss wave), Toll Shrine (HP cost for a bigger gold payout, floored so it can't end a run on its own). Deliberately all *instant* one-shot effects — there is no duration/status-effect system in the game at all yet.
- **Infinite Tower**: a new endless track, boss-only floors (no trash), one continuous run per attempt (always restarts at floor 1), HP/MP carry floor-to-floor the same way they carry wave-to-wave in a Gate, each floor rolls its own fresh Dungeon Modifier + Random Event, stat growth is linear (not exponential) so very deep climbs never overflow or need a hard cap, milestone gold every 10 floors, and a permanent "highest floor reached" record that only ever goes up.

## Standing design rules (worth knowing before suggesting anything)

- Never break or rewrite a working system unless necessary. Every feature must be production-quality, fully tested, and integrated with what already exists — no placeholders, no TODOs, no simplifications.
- If a feature genuinely needs infrastructure that doesn't exist yet, it gets **deferred with a documented reason** in `EXPANSION_ROADMAP.md` (which future item will deliver the missing piece) — never built as an inert stub.
- No exponential stat inflation. New multiplicative systems apply as small additive-feeling percentages stacked on the existing pipeline, never a new independent multiplier chain.
- A large feature gets split into smaller milestones, finishing one completely before starting the next.
- New top-level state needs a real save-migration story (see the three patterns above) before it ships.

## Current status

**The original fixed 20-item roadmap is 100% complete**, phase by phase: Save/Load, data-driven architecture, inventory improvements, equipment affix expansion, Shadow Collection, Shadow Evolution, Shadow Management UI, Talent Tree, Hunter Classes, Promotion Exams, Dungeon Modifiers, Random Events, Better Enemy AI, Crafting, Relics, Equipment Sets, Infinite Tower, Achievements, Titles, and Prestige/Reawakening are all shipped, tested, and live. A follow-on **Next-Generation Feature Expansion Spec** (19 more items, 4 phases) is now in progress on top of it — Phase 1.1, a full duration-based Status Effect Framework (13 statuses: Bleed, Poison, Burn, Freeze, Stun, Silence, Weakness, Attack Up, Vulnerability, Defense Up, Regeneration, Shield, Crit Up — live-triggered off enemy specials, Shadow strikes, and a new Random Event), is done; see `EXPANSION_ROADMAP.md` for the rest of the spec and current status.

## Known/explicit gaps (natural jumping-off points for new features)

- **No real art or sound.** Every visual is a procedural SVG silhouette; there is zero audio anywhere in the game.
- **No Sockets.** The equipment affix system has an obvious slot for a "Crafting gem" that fills an empty socket, but it was never built — Crafting shipped as Craft Equipment / Reforge / Shadow Essence instead, and sockets remain explicitly deferred.
- **No Daily/Weekly missions, no leaderboards, no social/multiplayer features of any kind** — this is a single-player, backend-less game (static site / self-contained Artifact). "Cloud save" as a real server-backed account system is explicitly out of scope unless a backend gets introduced separately.
- **Titles / Achievements / Relics / Equipment Sets are all deliberately *starter rosters*.** The content-registry architecture already supports growing any of them to "hundreds" of entries with zero structural change — pure content work, not a new system.
- **No trading, no crafting-material variety beyond Shadow Essence, no cosmetics.**
- **No New Game+-style content gating beyond Prestige** — there's no second currency shop, no seasonal content, no time-limited events.

---

*Generated by an AI coding session that built this game feature-by-feature against a fixed, project-owner-specified 20-item roadmap, now continuing into a larger follow-on expansion spec. If you're an AI reading this to suggest new features: prefer ideas that reuse the shared additive-pct pipeline, the content-registry pattern, the `systems/<feature>/` folder convention, and (for anything temporary/duration-based in battle) the Status Effect Framework over inventing new architecture — unless the feature genuinely needs something that doesn't exist yet, in which case say so explicitly rather than bolting it onto something it doesn't belong on.*
