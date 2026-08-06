# Hunter Protocol — Long-Term RPG Expansion Roadmap

This is the working backlog for turning Hunter Protocol from a ~1-hour demo
into a long-term RPG (Solo Leveling Arise / PoE / Diablo-depth
progression), per the full systems brief. It exists so **nothing from that
brief gets lost** even though it can't land in one pass without either
breaking what already works or shipping shallow stubs — both of which were
explicitly ruled out.

Every system below gets its own folder, its own data model, and plugs into
the existing screens/combat loop rather than replacing them. Check
`AI_CONTEXT.md` first for how the current game is built before touching
anything here.

## Architecture decision

The brief asks for `Data / Systems / Managers / UI / Components / Models /
Services / Storage` separation. Rather than mass-relocating the existing,
working `types.ts` / `data.ts` / `store.ts` / `screens/` into a brand new
tree (pure churn risk, zero player-facing value, and the #1 way to
accidentally break "everything already implemented must continue to
function exactly as before"), the shape going forward is:

```
src/
  systems/<name>/        One folder per new system (save, titles,
                          achievements, ... talents, relics, crafting,
                          tower, promotion, prestige, classes, events,
                          modifiers, shadowEvolution). Each owns its own
                          types.ts + data.ts + logic.ts (pure functions
                          where possible) + index.ts (public API).
  services/               Cross-cutting infra a system leans on -
                          storage.ts (localStorage wrapper) today, room
                          for more (audio, analytics) later.
  store.ts                Stays the single composition root / Game class.
                          Grows to *call into* systems/* instead of
                          implementing their logic inline - this is what
                          "modular" means in practice here: store.ts
                          orchestrates and holds cross-system state,
                          systems/* own their own rules.
  types.ts / data.ts       Stay the shared root for the systems that
                          already live there (combat, gates, itemization,
                          skills, potions). New systems get their own
                          types/data files under systems/<name>/ instead
                          of growing these two files without bound.
  screens/                 Stays the UI layer. New screens/sub-tabs follow
                          the two existing patterns (simpleScreen full
                          rebuild, or closure-state custom module) - see
                          AI_CONTEXT.md. No screen count explosion: new
                          systems nest as sub-tabs inside an existing
                          screen (like Inventory's Gear/Shop/Potions)
                          rather than each claiming a new bottom-tab slot.
```

## Phases

Sequenced by: what needs to exist before anything else is worth building
(persistence), then lowest-risk/highest-leverage extensions of systems
that already exist, then the bigger net-new subsystems, then the systems
that depend on *those* being in place (endgame loop), then combat-feel
polish last since it can layer onto any of the above without being redone.

### Phase 1 — Foundation + meta-progression (this session)
- [x] **Save System** — `src/systems/save/`. Versioned schema, localStorage
  service, autosave, Continue/New Hunter on Title.
- [x] **Titles** — `src/systems/titles/`. Unlock conditions, one equipped
  title, passive bonus folds into `effectiveStat`-style calculation.
- [x] **Achievements** — `src/systems/achievements/`. Lifetime counters,
  condition checks, reward grants.
- [x] **Progress screen** — Titles + Achievements UI, nested as new
  sub-tabs (Status screen gains a sub-tab bar, matching Inventory's
  pattern: Status / Titles / Achievements).

### Phase 2 — Itemization & Gate depth
(Extends systems that already exist - `LootItem`/`ItemAffix`,
`GateModifier` - lower structural risk than net-new subsystems.)
- **Equipment Sets** — named sets (Goblin Slayer, Dragon Lord, Void
  Walker, Shadow Monarch, ...), 2/4/6-piece bonuses, checked off
  `player.equipment` slot names matching a set + own aura color.
  `systems/sets/`.
- **Expanded random affixes** — life steal, fire/poison damage over time,
  attack speed, mana regen, cooldown reduction, sockets (a socket is an
  empty affix slot filled by a future Crafting gem). Extends
  `AffixKey`/`rollAffixValue` in `data.ts` rather than a new system.
- **Dungeon Modifiers** — Blood Moon / Frozen / Dark Mist / Elite Horde /
  Mana Storm / Double Boss / Treasure Rush, replacing the current 5-entry
  `GATE_MODIFIERS` table with a bigger one and real gameplay hooks (not
  just numeric multipliers - Elite Horde forces every trash unit elite,
  Double Boss runs the boss wave twice, etc). `systems/modifiers/`.
- **Random Events** — a per-wave-clear chance (alongside the existing
  Arise offer) of Merchant / Treasure Room / Hidden Boss / Ambush /
  Ancient Shrine / Mysterious Chest / Cursed Fountain, each a choice
  interstitial. `systems/events/`.

### Phase 3 — Shadow depth & Talents
- **Shadow Collection expansion** — every `ShadowRecord` gains its own
  level/xp/mood/loyalty, a passive + active skill, real equipment slots
  (separate from the player's), and duplicate handling (merge / upgrade /
  convert to Shadow Essence). `systems/shadow/` (the existing
  `shadowArmy`/`deployShadow` stays the interaction surface, this system
  owns what a Shadow *is*).
- **Shadow Evolution** — stage chains per species (Goblin → Elite Goblin →
  Goblin Captain → Goblin Commander → Shadow General → Shadow King, one
  chain per archetype), each stage swapping portrait tint/size, stat
  curve, skill, and aura tier - reusing the archetype-portrait +
  player-aura patterns already built rather than new art per stage.
  `systems/shadowEvolution/`.
- **Talent Tree** — large trees (Combat: Sword/Daggers/Critical/Defense,
  Magic, Shadow, Economy, Crafting, Exploration) unlocking passive bonuses
  and new mechanics, **layered on top of** the existing 5-stat-point
  system (per the "do not replace existing mechanics" constraint) rather
  than swapping it out - talent points are a second currency earned
  separately (levels past a threshold, achievements, promotion exams).
  `systems/talents/`.

### Phase 4 — Classes, Crafting, Relics
- **Hunter Class Advancement** — choose one class at Level 20 (Assassin /
  Necromancer / Berserker / Mage / Paladin, more later), each reshaping
  the skill tree, stat scaling, Shadow bonuses, and equipment preference.
  `systems/classes/`.
- **Crafting** — material drops (Bone, Iron, Crystal, Shadow Essence,
  Dragon Scale, ...) + recipes producing weapons/armor/potions/artifacts/
  legendary gear. `systems/crafting/`.
- **Relics** — permanent account-wide upgrades (+XP forever, +drop rate
  forever, +Shadow capacity, +potion capacity, +crit damage) that survive
  Prestige. `systems/relics/`.

### Phase 5 — Endgame loop
(Needs Phase 1-4's systems as scaffolding - a Tower/Prestige without
Relics/Talents/Classes to carry across a reset has nothing to be "endgame"
*about*.)
- **Promotion Exams** — rank stops being automatic on level; a dedicated
  Gate-like exam (elites + boss + a special mechanic + a time limit) gates
  each rank-up, with real failure/retry. `systems/promotion/`.
- **Infinite Tower** — unlocked after the story gates, procedural floors,
  boss every 10th, scaling forever, reward table, leaderboard-shaped data
  (local-only ranking for now - see Save System note on cloud below).
  `systems/tower/`.
- **Daily/Weekly/Monthly content** — generated mission lists with
  equipment/gold/material/essence/relic rewards, reset on a real-time
  clock (same pattern as the Shop's auto-restock timer). `systems/missions/`.
- **Prestige (Reawakening)** — at max level, reset Hunter level/equipment/
  gate progress; keep Relics/Titles/Collections + a permanent multiplier
  that stacks per Prestige; unlocks harder gate/tower content per
  Prestige tier. `systems/prestige/`.

### Phase 6 — Combat depth & polish
(Can land anytime after Phase 1, sequenced last so it isn't redone as
new systems add new things it needs to react to - e.g. status effects
should already know about Talents/Classes before being finalized.)
- **Status effects** — Bleed/Burn/Freeze/Poison/Fear/Silence/Taunt/
  Barrier, as a generic `StatusEffect` list on `EnemyUnit`/player rather
  than one-off flags, ticking each round alongside the existing
  guard-rounds mechanic.
- **Skill combos, Ultimate skills, chain attacks** — extends the existing
  `SkillDef`/`useSkill` system rather than a parallel one.
- **Enemy variety tiers** — Normal/Elite/Champion/Boss/Legendary per
  species (today's `isElite` boolean becomes a tier enum), each with its
  own AI weight profile extending `decideEnemyAction`.
- **Visual polish** — portrait breathing/blink (CSS, matches the existing
  procedural-SVG-no-new-assets approach), hit-stop, boss intro cards, rank
  promotion cinematics, better screen transitions.

## Save data & "cloud save" note

There is no backend for this project (it ships as a static site / a
single-file Claude Artifact) - "cloud save" as a literal server-backed
account system is out of scope unless a backend gets introduced
separately. What Phase 1 actually builds is a **versioned local save**
(localStorage, schema-versioned so future phases can migrate old saves
forward safely) - the right foundation *for* cloud save later (swap the
storage service's backend, keep everything else) without pretending a
server exists today.

## Balancing guardrails (apply to every phase, not just one)

- No exponential stat inflation - every new multiplicative system
  (Titles, Relics, Sets, Prestige) applies as **small additive-feeling
  percentages** stacked on the existing `effectiveStat` pipeline, the same
  way equipment affixes already do, not as new multiplier chains that
  compound unboundedly.
- Every rarity tier must stay worth using - Phase 2's expanded affixes and
  Phase 4's Crafting both need to make *common* materials/items relevant
  at every stage (crafting sinks for low-rarity mats, not just endgame
  ones), matching how the existing 7-tier rarity table already keeps
  common items sellable/useful rather than instantly obsolete.
- Every Gate stays useful - Dungeon Modifiers and Daily/Weekly missions
  are the two levers that pull a player back to an "early" E-rank gate at
  Level 40 (a modifier or a mission can make even Crumbling Ruins worth
  re-running), rather than only the newest content mattering.
