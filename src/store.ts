import { ARCHETYPE_BY_RANK, GATE_REGISTRY, POTION_REGISTRY, STAT_TUNING, SHADOW_RANK_POWER, SKILL_REGISTRY, TYPE_VARIANTS, buildWavePlan, generateLoot, priceForItem, rankForLevel, rankRarityBonus, rollGateModifier, rollRarity, rollShopStock, sellPriceForItem, statsForBoss, statsForUnit, sumEquipmentAffix, totalEnemiesForGate } from "./data";
import type { AffixKey, BattleState, BattleToast, EnemyAction, EnemyUnit, FloatKind, GameState, GateDef, GateModifier, GlobalToast, ItemSlot, LootItem, LungeSide, Rank, ShadowRecord, StatKey, VfxKind, WavePlanEntry } from "./types";
import { evaluateCondition } from "./systems/progress/conditions";
import type { ProgressContext } from "./systems/progress/types";
import { COUNTER_KEYS } from "./systems/progress/types";
import { TITLE_REGISTRY } from "./systems/titles/data";
import type { TitleDef } from "./systems/titles/types";
import { ACHIEVEMENTS } from "./systems/achievements/data";
import { clearSave, loadSave, writeSave } from "./systems/save";
import type { SavedGameState } from "./systems/save/types";
import { SHADOW_EVOLUTION_COST, SHADOW_MAX_LEVEL, SHADOW_NAME_MAX_LENGTH, SHADOW_SKILLS, effectiveShadowPower, nextShadowRank, shadowXpToNext } from "./systems/shadows/data";
import { TALENT_POINTS_PER_LEVEL, TALENT_REGISTRY, canUnlockTalent, talentCritFlat, talentGoldPct, talentStatPct, talentXpPct } from "./systems/talents/data";
import { CLASS_REGISTRY, CLASS_UNLOCK_LEVEL } from "./systems/classes/data";
import type { HunterClassDef } from "./systems/classes/types";
import { EXAM_GATE_ID, PROMOTION_REWARD, examEligibleRank as computeExamEligibleRank, nextRank } from "./systems/exams/data";
import { RANDOM_EVENT_RANK_MULT, rollRandomEvent } from "./systems/events/data";
import type { RandomEventDef } from "./systems/events/types";

/** Events the shader/particle FX layer cares about, separate from the
 *  CSS-driven battle state flags (which the DOM screens read directly).
 *  `targetUid` identifies which enemy slot an enemy-side effect belongs to
 *  (a wave can have up to 3 simultaneous enemies). */
export type FxEvent =
  | { kind: "slash"; side: "player" | "enemy"; targetUid?: string }
  | { kind: "flurry"; side: "player" | "enemy"; targetUid?: string }
  | { kind: "smash"; side: "player" | "enemy"; targetUid?: string }
  | { kind: "guard"; side: "player" | "enemy"; targetUid?: string }
  | { kind: "shake"; intensity: "light" | "heavy" }
  | { kind: "dissolve"; side: "enemy"; targetUid?: string }
  | { kind: "portal" }
  | { kind: "levelup" };

type Listener = () => void;
type FxListener = (e: FxEvent) => void;

/** How often the Shop's stock restocks itself for free, in real time. */
const SHOP_AUTO_RESTOCK_MS = 10 * 60 * 1000;

const INITIAL_STATE: GameState = {
  screen: "title",
  player: {
    name: "Hunter", level: 1, xp: 0, xpToNext: 80,
    hp: 100, maxHp: 100, mp: 30, maxMp: 30,
    statPoints: 0, str: 10, agi: 10, int: 10, vit: 10, per: 10,
    gold: 0, equipment: {}, hunterClass: null, rank: "E"
  },
  gatesCleared: {},
  shadowArmy: [],
  inventory: { potions: { hp_minor: 3, mp_minor: 1 } },
  bag: [],
  shop: { stock: [], rerollCost: 60, lastRerollAt: 0 },
  battle: null,
  progress: { counters: {}, unlockedTitleIds: [], equippedTitleId: null, unlockedAchievementIds: [] },
  talents: { points: 0, unlockedIds: [] },
  globalToast: null
};

/**
 * Central game state + all mutating actions. Plain observer pattern:
 * mutate `state`, call `notify()`, the renderer re-reads state and updates
 * the DOM. No vdom/diffing - screens do targeted DOM updates so CSS
 * keyframe animations never get interrupted by node recreation.
 *
 * Each gate is a run of 10-20 enemies (rank-scaled), grouped into waves of
 * up to 3 simultaneous enemies, ramping in strength across the whole run,
 * capped by a solo boss wave. HP/MP carry over between waves within a run.
 * Every wave clear (trash or boss) offers Arise for that wave's monster;
 * "Continue" advances to the next wave, or ends the run on the boss/defeat.
 *
 * On top of that: a random modifier is rolled per gate attempt, ~12% of
 * trash units roll as tougher "Elite" variants, kills can drop loot/gold,
 * player hits can crit, and one deployed Shadow auto-assists every action.
 */
export class Game {
  state: GameState = structuredClone(INITIAL_STATE);
  private listeners = new Set<Listener>();
  private fxListeners = new Set<FxListener>();
  private vfxSeq = 0;
  private floatSeq = 0;
  private unitSeq = 0;
  private toastSeq = 0;
  private globalToastSeq = 0;
  /** A save loaded from disk at boot, held here (not yet applied to
   *  `state`) until the player picks Continue on the Title screen - so a
   *  returning player still sees the same "choose to continue" moment a
   *  fresh one does, rather than being silently dropped back into an old
   *  run. Cleared (one way or the other) the moment that choice is made. */
  private pendingSave: SavedGameState | null = null;
  private saveDirty = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.pendingSave = loadSave();
    // First stock is free - a fresh Hunter shouldn't open the Shop to
    // nothing for sale. (Continuing from a save replaces this with the
    // save's own stock in continueSave().)
    this.rerollShop(true);
    // Checked periodically rather than with a single long-lived timer tied
    // to one specific restock, so it stays correct even across however
    // many manual (paid) rerolls happen in between.
    setInterval(() => this.checkShopAutoRestock(), 15000);
    // Best-effort final save on tab close, on top of the regular debounced
    // autosave - catches whatever happened in the last <3s window.
    window.addEventListener("beforeunload", () => this.persistNow());
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onFx(fn: FxListener): () => void {
    this.fxListeners.add(fn);
    return () => this.fxListeners.delete(fn);
  }

  private notify() {
    // Runs synchronously before listeners so a just-unlocked Title/
    // Achievement (and its toast) is visible in the very same render pass
    // that triggered it, not one frame later.
    this.refreshProgress();
    for (const fn of this.listeners) fn();
    this.scheduleAutosave();
  }

  private emitFx(e: FxEvent) {
    for (const fn of this.fxListeners) fn(e);
  }

  goto(screen: GameState["screen"]) {
    this.state.screen = screen;
    this.notify();
  }

  beginGame() {
    this.state.screen = "gates";
    this.notify();
  }

  /** Base stat + whatever's equipped anywhere rolled a matching affix,
   *  then the equipped Title's percentage bonus and every unlocked
   *  Talent's percentage bonus (#8) - combined into *one* percentage and
   *  applied as a single multiply, not two nested multiplies, so two
   *  small bonuses stack additively (title 3% + talent 3% = 6%) instead
   *  of quietly compounding (1.03 x 1.03 = 6.09%) - the "no multiplier
   *  chains" guardrail in EXPANSION_ROADMAP.md applies just as much
   *  between systems as within one. Public - the battle UI reads this
   *  too, for the combat-details readout. */
  effectiveStat(key: StatKey): number {
    const p = this.state.player;
    let value = p[key];
    for (const item of Object.values(p.equipment)) {
      if (!item) continue;
      for (const affix of item.affixes) {
        if (affix.key === key) value += affix.value;
      }
    }
    const title = this.equippedTitle();
    let pct = 0;
    if (title) {
      if (title.bonus.kind === "statPct" && title.bonus.stat === key) pct += title.bonus.value;
      else if (title.bonus.kind === "allStatsPct") pct += title.bonus.value;
    }
    pct += talentStatPct(this.state.talents.unlockedIds, key);
    if (pct > 0) value *= 1 + pct;
    return value;
  }

  /** Sum of a non-core-stat affix across every equipped slot - hp/mp/crit
   *  are passive bonuses folded into effectiveMaxHp/effectiveMaxMp/
   *  critChance; lifeSteal/attackSpeed/manaRegen/fireDamage are combat-
   *  round affixes applied directly where they act (see battleAttack,
   *  useSkill, enemyTurn, and the applyLifeSteal/rollBasicAttack helpers
   *  below). */
  private equipmentAffixSum(key: Exclude<AffixKey, StatKey>): number {
    return sumEquipmentAffix(this.state.player.equipment, key);
  }

  /** Base max HP/MP (level + VIT/INT stat points) plus flat "hp"/"mp"
   *  equipment affixes *and* whatever VIT/INT gear itself grants - a point
   *  of VIT converts to HP the same way whether it came from a stat point
   *  or a ring, so the two systems never feel inconsistent with each
   *  other. Public - the battle/status screens display against this
   *  rather than the raw player.maxHp/maxMp. */
  effectiveMaxHp(): number {
    const equipmentVit = this.effectiveStat("vit") - this.state.player.vit;
    return this.state.player.maxHp + this.equipmentAffixSum("hp") + equipmentVit * STAT_TUNING.vitHpPerPoint;
  }

  effectiveMaxMp(): number {
    const equipmentInt = this.effectiveStat("int") - this.state.player.int;
    return this.state.player.maxMp + this.equipmentAffixSum("mp") + equipmentInt * STAT_TUNING.intMpPerPoint;
  }

  /** Current hp/mp can end up above a just-lowered effective max (e.g.
   *  unequipping a +HP item) - clamp both down after any equipment change
   *  so the HP/MP bars can never show over 100%. */
  private clampVitals() {
    const player = { ...this.state.player };
    player.hp = Math.min(player.hp, this.effectiveMaxHp());
    player.mp = Math.min(player.mp, this.effectiveMaxMp());
    this.state.player = player;
  }

  /** 0..1 chance any given Attack/Skill hit crits. */
  get critChance(): number {
    const equipmentCrit = this.equipmentAffixSum("crit") / 100;
    const title = this.equippedTitle();
    const titleCrit = title?.bonus.kind === "critFlat" ? title.bonus.value : 0;
    const talentCrit = talentCritFlat(this.state.talents.unlockedIds);
    return Math.min(0.65, 0.08 + this.effectiveStat("agi") * STAT_TUNING.agiCritPerPoint + this.effectiveStat("per") * STAT_TUNING.perCritPerPoint + equipmentCrit + titleCrit + talentCrit);
  }

  private rollCrit(): boolean {
    return Math.random() < this.critChance;
  }

  /** A single "how strong am I" number - level, every effective core stat
   *  (so gear folds in automatically), effective max HP/MP, crit chance,
   *  and the combined power of every Shadow you've arisen (not just the
   *  deployed one - your whole army counts). Purely a vanity/progress
   *  readout, not consulted by any combat formula, so the weights below
   *  are a display tuning knob, not a balance one. */
  get powerScore(): number {
    const p = this.state.player;
    const statSum = (["str", "agi", "int", "vit", "per"] as StatKey[])
      .reduce((sum, key) => sum + this.effectiveStat(key), 0);
    const shadowPower = this.state.shadowArmy.reduce((sum, s) => sum + effectiveShadowPower(s), 0);
    return Math.round(
      p.level * 15 +
      statSum * 8 +
      this.effectiveMaxHp() * 2 +
      this.effectiveMaxMp() * 3 +
      this.critChance * 100 * 12 +
      shadowPower * 10
    );
  }

  // ---- save / load (src/systems/save/) ----

  /** True once a save has been loaded from disk at boot and not yet
   *  consumed by continueSave()/startNewHunter() - drives the Title
   *  screen's Continue/New Hunter choice. */
  hasSave(): boolean {
    return this.pendingSave !== null;
  }

  /** Read-only peek at the not-yet-applied save (name/level/rank for the
   *  Title screen's Continue preview) without touching live state -
   *  `continueSave()` is still the only thing that actually loads it. */
  peekSave(): SavedGameState | null {
    return this.pendingSave;
  }

  /** Applies the save loaded at boot and drops straight into Gates - a
   *  save never resumes mid-battle (see SavedGameState's comment), so
   *  Gates is always the right landing spot for "pick up where you left
   *  off". */
  continueSave() {
    if (!this.pendingSave) return;
    const saved = this.pendingSave;
    this.pendingSave = null;
    this.state = {
      ...this.state,
      // Older saves predate PlayerState.rank (#10) - unlike hunterClass
      // (where a missing field safely reads as "none chosen"), rank has
      // no meaningful falsy state, so it's backfilled from the Hunter's
      // current level rather than defaulting to a bare "E" that would
      // wrongly demote an already-leveled character.
      player: { ...saved.player, rank: saved.player.rank ?? rankForLevel(saved.player.level) },
      gatesCleared: saved.gatesCleared,
      // Older saves predate evolutionStage (#6) and equipment (#7) -
      // default them rather than leaving them undefined on a record read
      // directly off disk.
      shadowArmy: saved.shadowArmy.map((s) => ({ ...s, evolutionStage: s.evolutionStage ?? 0, equipment: s.equipment ?? {} })),
      inventory: saved.inventory,
      bag: saved.bag,
      shop: saved.shop,
      progress: saved.progress ?? structuredClone(INITIAL_STATE.progress),
      // Older saves predate the Talent Tree (#8) entirely - rather than
      // just defaulting to 0 points and leaving an already-leveled
      // Hunter permanently behind on a currency that didn't exist yet
      // when they earned those levels, a save missing `talents` gets a
      // one-time catch-up grant of 1 point per level already reached
      // (the same TALENT_POINTS_PER_LEVEL rate grantXp uses going
      // forward) instead of a bare empty state.
      talents: saved.talents ?? { points: Math.max(0, saved.player.level - 1) * TALENT_POINTS_PER_LEVEL, unlockedIds: [] },
      screen: "gates",
      battle: null
    };
    this.notify();
  }

  /** Wipes any save on disk and starts completely fresh - the Title
   *  screen gates this behind a confirmation since it's destructive. */
  startNewHunter() {
    clearSave();
    this.pendingSave = null;
    this.state = structuredClone(INITIAL_STATE);
    this.rerollShop(true);
    this.state.screen = "gates";
    this.notify();
  }

  private persistNow() {
    writeSave({
      player: this.state.player,
      gatesCleared: this.state.gatesCleared,
      shadowArmy: this.state.shadowArmy,
      inventory: this.state.inventory,
      bag: this.state.bag,
      shop: this.state.shop,
      progress: this.state.progress,
      talents: this.state.talents
    });
  }

  /** Coalesces however many notify()s happen in a burst (e.g. a flurry of
   *  battle animation ticks) into at most one localStorage write every 3s,
   *  so autosave can't itself cause jank during fast-paced combat. */
  private scheduleAutosave() {
    this.saveDirty = true;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.saveDirty) {
        this.saveDirty = false;
        this.persistNow();
      }
    }, 3000);
  }

  // ---- meta-progression: counters, Titles, Achievements (src/systems/progress|titles|achievements/) ----

  private incrementCounter(key: string, amount = 1) {
    const counters = { ...this.state.progress.counters };
    counters[key] = (counters[key] ?? 0) + amount;
    this.state.progress = { ...this.state.progress, counters };
  }

  private progressContext(): ProgressContext {
    const p = this.state.player;
    return {
      counters: this.state.progress.counters,
      level: p.level,
      // Confirmed rank (#10), not the level-implied one - "Reach S-Rank"
      // means officially confirmed as S-Rank, not merely leveled enough
      // to be eligible for the exam.
      rank: p.rank,
      shadowCount: this.state.shadowArmy.length,
      gatesClearedCount: Object.values(this.state.gatesCleared).filter(Boolean).length,
      gold: p.gold
    };
  }

  /** Public - the Progress screen (Titles/Achievements sub-tabs) uses this
   *  to render "342 / 1,000" progress text on locked entries. */
  getProgressContext(): ProgressContext {
    return this.progressContext();
  }

  private equippedTitle(): TitleDef | null {
    const id = this.state.progress.equippedTitleId;
    if (!id) return null;
    return TITLE_REGISTRY.get(id) ?? null;
  }

  /** Equip one Title at a time (null clears it) - only an already-unlocked
   *  one can be equipped. Its bonus feeds effectiveStat/critChance/
   *  grantXp/grantKillRewards directly, no separate "apply" step. */
  equipTitle(id: string | null) {
    if (id !== null && !this.state.progress.unlockedTitleIds.includes(id)) return;
    this.state.progress = { ...this.state.progress, equippedTitleId: id };
    this.notify();
  }

  private equippedHunterClass(): HunterClassDef | null {
    const id = this.state.player.hunterClass;
    if (!id) return null;
    return CLASS_REGISTRY.get(id) ?? null;
  }

  /** Item #9 of the fixed roadmap. A one-time, permanent choice (no
   *  respec) available from `CLASS_UNLOCK_LEVEL` onward - rejects a
   *  second call once a class is already set, an unknown id, and a call
   *  before the unlock level, all without mutating state. Each class's
   *  bonus lands in exactly one combat formula (rollBasicAttack,
   *  useSkill, the shared crit multiplier, Guard's damage mitigation, or
   *  useItem's HP potion branch) rather than folding into the generic
   *  stat/crit/xp/gold pipeline Titles and Talents already share - see
   *  ClassBonus's doc comment in systems/classes/types.ts for why. */
  chooseHunterClass(classId: string): boolean {
    if (this.state.player.hunterClass) return false;
    if (this.state.player.level < CLASS_UNLOCK_LEVEL) return false;
    const def = CLASS_REGISTRY.get(classId as HunterClassDef["id"]);
    if (!def) return false;
    this.state.player = { ...this.state.player, hunterClass: def.id };
    this.notify();
    return true;
  }

  private showGlobalToast(text: string, kind: GlobalToast["kind"]) {
    this.globalToastSeq += 1;
    const id = this.globalToastSeq;
    this.state.globalToast = { id, text, kind };
    setTimeout(() => {
      if (this.state.globalToast?.id === id) {
        this.state.globalToast = null;
        this.notify();
      }
    }, 2600);
  }

  /** Runs on every notify() - cheap (a few dozen condition checks against
   *  a small context object) for a turn-based game with human-timescale
   *  interactions, so it isn't worth dirty-tracking which counter changed.
   *  A newly-met Title/Achievement unlocks immediately and floats a global
   *  toast; an Achievement's reward is granted the same instant, no
   *  separate "claim" step. If several unlock in the exact same pass
   *  (e.g. right after loading an old save into a fresh build with more
   *  content than it shipped with) only the last toast of the burst is
   *  visible - all of them still land correctly in the unlocked-id lists,
   *  the Progress screen is the source of truth, the toast is just a
   *  bonus nudge. */
  private refreshProgress() {
    const ctx = this.progressContext();

    const unlockedTitles = new Set(this.state.progress.unlockedTitleIds);
    let titlesChanged = false;
    for (const t of TITLE_REGISTRY.all()) {
      if (!unlockedTitles.has(t.id) && evaluateCondition(t.condition, ctx)) {
        unlockedTitles.add(t.id);
        titlesChanged = true;
        this.showGlobalToast(`Title Unlocked: ${t.name}`, "title");
      }
    }

    const unlockedAch = new Set(this.state.progress.unlockedAchievementIds);
    let achChanged = false;
    let goldGain = 0;
    let statPointGain = 0;
    for (const a of ACHIEVEMENTS) {
      if (!unlockedAch.has(a.id) && evaluateCondition(a.condition, ctx)) {
        unlockedAch.add(a.id);
        achChanged = true;
        if (a.reward.kind === "gold") goldGain += a.reward.amount;
        else statPointGain += a.reward.amount;
        this.showGlobalToast(`Achievement Unlocked: ${a.name}`, "achievement");
      }
    }

    if (titlesChanged || achChanged) {
      this.state.progress = {
        ...this.state.progress,
        unlockedTitleIds: Array.from(unlockedTitles),
        unlockedAchievementIds: Array.from(unlockedAch)
      };
    }
    if (goldGain > 0 || statPointGain > 0) {
      this.state.player = {
        ...this.state.player,
        gold: this.state.player.gold + goldGain,
        statPoints: this.state.player.statPoints + statPointGain
      };
    }
  }

  // ---- wave/enemy construction ----

  private freshUnit(name: string, hp: number, atk: number, def: number, xp: number, gold: number, isElite: boolean): EnemyUnit {
    this.unitSeq += 1;
    return {
      uid: `u${this.unitSeq}`, name, hp, maxHp: hp, atk, def, xp, gold, isElite,
      alive: true, hit: false, vfx: null, lunging: false,
      floatText: null, floatId: 0, glow: false, guardRounds: 0
    };
  }

  /** One trash unit's full stat roll - species/variant, Elite chance
   *  (modifier-adjusted, or forced for an Ambush's bonus unit, #12),
   *  every stat multiplier. Factored out of `makeEnemies` so an Ambush
   *  Random Event can reuse the exact same formula for its bonus unit
   *  instead of a second, drifting copy of it. */
  private makeTrashUnit(gate: GateDef, unitIndex: number, trashCount: number, modifier: GateModifier, forceElite = false): EnemyUnit {
    const s = statsForUnit(gate, unitIndex, trashCount);
    // Each trash unit rolls one of the gate's 5 species at random - its
    // pool position also picks a stat-weight variant (glass-cannon,
    // tanky, ...) so "5 different types" is felt in combat, not just read
    // off a name label.
    const typeIdx = Math.floor(Math.random() * gate.enemyTypes.length);
    const name = gate.enemyTypes[typeIdx];
    const variant = TYPE_VARIANTS[typeIdx % TYPE_VARIANTS.length];
    // A modifier's eliteChanceBonus (e.g. Elite Surge) stacks additively
    // onto the flat base chance, capped well short of "every unit is
    // Elite" so a trash wave never stops feeling like trash.
    const eliteChance = Math.min(0.6, 0.12 + modifier.eliteChanceBonus);
    const isElite = forceElite || Math.random() < eliteChance;
    const eliteMult = isElite ? 1.6 : 1;
    const hp = Math.round(s.hp * variant.hpMult * eliteMult * modifier.enemyHpMult);
    const atk = Math.round(s.atk * variant.atkMult * eliteMult * modifier.enemyAtkMult);
    const def = Math.round(s.def * variant.defMult * modifier.enemyDefMult);
    const xp = Math.round(s.xp * (isElite ? 1.8 : 1));
    const gold = Math.round(xp * 0.6);
    return this.freshUnit(name, hp, atk, def, xp, gold, isElite);
  }

  private makeEnemies(gate: GateDef, entry: WavePlanEntry, trashCount: number, modifier: GateModifier): EnemyUnit[] {
    if (entry.isBoss) {
      const s = statsForBoss(gate);
      const hp = Math.round(s.hp * modifier.enemyHpMult);
      const atk = Math.round(s.atk * modifier.enemyAtkMult);
      const def = Math.round(s.def * modifier.enemyDefMult);
      const gold = Math.round(s.xp * 0.9);
      return [this.freshUnit(gate.bossName, hp, atk, def, s.xp, gold, false)];
    }
    const units: EnemyUnit[] = [];
    for (let i = 0; i < entry.count; i++) {
      units.push(this.makeTrashUnit(gate, entry.unitStart + i, trashCount, modifier));
    }
    return units;
  }

  startBattle(gate: GateDef) {
    const plan = buildWavePlan(gate);
    const trashCount = totalEnemiesForGate(gate) - 1;
    const entry = plan[0];
    const modifier = rollGateModifier();
    this.state.player.hp = this.effectiveMaxHp();
    this.state.player.mp = this.effectiveMaxMp();
    this.state.screen = "battle";
    this.state.battle = {
      gateId: gate.id, gateName: gate.name, rank: gate.rank,
      isBossWave: entry.isBoss,
      waveIndex: 1, totalWaves: plan.length,
      enemies: this.makeEnemies(gate, entry, trashCount, modifier),
      modifier,
      over: false, result: null, guardRounds: 0, locked: false,
      playerHit: false, skillPanelOpen: false, itemPanelOpen: false
    };
    this.notify();
  }

  private advanceWave() {
    const battle = this.state.battle;
    if (!battle) return;
    const gate = GATE_REGISTRY.get(battle.gateId);
    if (!gate) return;
    const plan = buildWavePlan(gate);
    const trashCount = totalEnemiesForGate(gate) - 1;
    const nextIdx0 = battle.waveIndex; // current waveIndex is 1-based; next 0-based entry is the same number
    if (nextIdx0 >= plan.length) return;
    const entry = plan[nextIdx0];
    const modifier = battle.modifier ?? rollGateModifier();
    const enemies = this.makeEnemies(gate, entry, trashCount, modifier);

    // Random Events (#12) - rolled on every real wave-to-wave transition.
    // Never for a Promotion Exam trial (isPromotionExam gates are always
    // a single wave, so this method is never even called for one) and
    // never for the very first wave of a run (that's set up by
    // startBattle, not advanceWave) - only between wave 2+ of a normal
    // multi-wave gate.
    const event = rollRandomEvent(entry.isBoss);
    if (event) {
      this.incrementCounter(COUNTER_KEYS.randomEventsTriggered);
      this.applyRandomEvent(event, gate.rank);
      if (event.effect.kind === "ambush") {
        enemies.push(this.makeTrashUnit(gate, Math.max(0, trashCount - 1), trashCount, modifier, true));
      }
    }

    this.state.battle = {
      ...battle,
      waveIndex: battle.waveIndex + 1,
      isBossWave: entry.isBoss,
      enemies,
      over: false, result: null, locked: false, guardRounds: 0,
      playerHit: false, skillPanelOpen: false, itemPanelOpen: false,
      vfxPlayer: null, guardRing: false, lunge: null, flash: false,
      floatPlayer: null, playerGlow: false, shadowLunge: false,
      bossEnraged: false
    };
    this.notify();
  }

  /** Applies one rolled Random Event's instant effect (#12) - everything
   *  here is a one-shot state change plus a `global-toast.event`
   *  announcement, no temporary duration to track. The "ambush" case is
   *  deliberately a no-op here - it needs to push onto the *freshly
   *  generated* enemies array for the wave about to start, which only
   *  `advanceWave` (the caller) has in scope. */
  private applyRandomEvent(event: RandomEventDef, gateRank: Rank) {
    const mult = RANDOM_EVENT_RANK_MULT[gateRank];
    switch (event.effect.kind) {
      case "gold": {
        const amount = Math.round(event.effect.baseAmount * mult);
        this.state.player = { ...this.state.player, gold: this.state.player.gold + amount };
        this.incrementCounter(COUNTER_KEYS.goldEarnedTotal, amount);
        this.showGlobalToast(`${event.label}: +${amount}g`, "event");
        break;
      }
      case "loot": {
        const rarity = rollRarity(rankRarityBonus(gateRank) + 0.1);
        const item = generateLoot(gateRank, rarity);
        this.state.bag = [...this.state.bag, item];
        this.showGlobalToast(`${event.label}: found ${item.name}`, "event");
        break;
      }
      case "heal": {
        const maxHp = this.effectiveMaxHp();
        const maxMp = this.effectiveMaxMp();
        const player = { ...this.state.player };
        player.hp = Math.min(maxHp, player.hp + Math.round((maxHp - player.hp) * event.effect.hpPct));
        player.mp = Math.min(maxMp, player.mp + Math.round((maxMp - player.mp) * event.effect.mpPct));
        this.state.player = player;
        this.showGlobalToast(`${event.label}: recovered some HP/MP`, "event");
        break;
      }
      case "toll": {
        // Never lethal on its own - a flavor risk/reward event should
        // never be the thing that ends a run outright.
        const hpCost = Math.max(1, Math.round(this.effectiveMaxHp() * event.effect.hpCostPct));
        const goldReward = Math.round(event.effect.baseGoldReward * mult);
        this.state.player = {
          ...this.state.player,
          hp: Math.max(1, this.state.player.hp - hpCost),
          gold: this.state.player.gold + goldReward
        };
        this.incrementCounter(COUNTER_KEYS.goldEarnedTotal, goldReward);
        this.showGlobalToast(`${event.label}: -${hpCost} HP, +${goldReward}g`, "event");
        break;
      }
      case "ambush":
        this.showGlobalToast(`${event.label} An extra foe joins the fight!`, "event");
        break;
    }
  }

  // ---- vfx/float plumbing ----

  private cloneBattle(b: BattleState): BattleState {
    return { ...b, enemies: b.enemies.map((u) => ({ ...u })) };
  }

  private currentTarget(battle: BattleState): EnemyUnit | null {
    return battle.enemies.find((u) => u.alive) ?? null;
  }

  private playPlayerVfx(battle: BattleState, opts: { player?: VfxKind; guard?: boolean; lunge?: LungeSide; flash?: boolean; heavy?: boolean }) {
    this.vfxSeq += 1;
    const id = this.vfxSeq;
    battle.vfxId = id;
    battle.vfxPlayer = opts.player ?? null;
    battle.guardRing = !!opts.guard;
    battle.lunge = opts.lunge ?? null;
    battle.flash = !!opts.flash;

    if (opts.player) this.emitFx({ kind: opts.player, side: "player" });
    if (opts.guard) this.emitFx({ kind: "guard", side: "player" });
    if (opts.flash) this.emitFx({ kind: "shake", intensity: opts.heavy ? "heavy" : "light" });

    setTimeout(() => {
      if (this.state.battle && this.state.battle.vfxId === id) {
        this.state.battle = { ...this.state.battle, lunge: null, flash: false };
        this.notify();
      }
    }, 380);
    setTimeout(() => {
      if (this.state.battle && this.state.battle.vfxId === id) {
        this.state.battle = { ...this.state.battle, vfxPlayer: null, guardRing: false };
        this.notify();
      }
    }, 900);
  }

  private setUnitVfx(unit: EnemyUnit, kind: VfxKind) {
    unit.vfx = kind;
    if (kind) this.emitFx({ kind, side: "enemy", targetUid: unit.uid });
    const uid = unit.uid;
    setTimeout(() => {
      const b = this.state.battle;
      if (!b) return;
      const u = b.enemies.find((e) => e.uid === uid);
      if (u && u.vfx === kind) {
        this.state.battle = { ...b, enemies: b.enemies.map((e) => (e.uid === uid ? { ...e, vfx: null } : e)) };
        this.notify();
      }
    }, 900);
  }

  private clearHitFlagLater(uid: string) {
    setTimeout(() => {
      const b = this.state.battle;
      if (!b) return;
      this.state.battle = { ...b, enemies: b.enemies.map((u) => (u.uid === uid ? { ...u, hit: false } : u)) };
      this.notify();
    }, 250);
  }

  private triggerUnitFloat(unit: EnemyUnit, text: string, kind: FloatKind) {
    unit.floatText = { text, kind };
    unit.glow = true;
    this.floatSeq += 1;
    const id = this.floatSeq;
    unit.floatId = id;
    const uid = unit.uid;
    setTimeout(() => {
      const b = this.state.battle;
      if (!b) return;
      const u = b.enemies.find((e) => e.uid === uid);
      if (u && u.floatId === id) {
        this.state.battle = { ...b, enemies: b.enemies.map((e) => (e.uid === uid ? { ...e, floatText: null } : e)) };
        this.notify();
      }
    }, 900);
    setTimeout(() => {
      const b = this.state.battle;
      if (!b) return;
      this.state.battle = { ...b, enemies: b.enemies.map((e) => (e.uid === uid ? { ...e, glow: false } : e)) };
      this.notify();
    }, 450);
  }

  private triggerFloatPlayer(battle: BattleState, text: string, kind: FloatKind) {
    battle.floatPlayer = { text, kind };
    battle.playerGlow = true;
    this.floatSeq += 1;
    const id = this.floatSeq;
    battle.floatPlayerId = id;
    setTimeout(() => {
      const b = this.state.battle;
      if (b && b.floatPlayerId === id) {
        this.state.battle = { ...b, floatPlayer: null };
        this.notify();
      }
    }, 900);
    setTimeout(() => {
      if (this.state.battle) {
        this.state.battle = { ...this.state.battle, playerGlow: false };
        this.notify();
      }
    }, 450);
  }

  private showBattleToast(battle: BattleState, toast: BattleToast) {
    battle.toast = toast;
    this.toastSeq += 1;
    const id = this.toastSeq;
    battle.toastId = id;
    setTimeout(() => {
      const b = this.state.battle;
      if (b && b.toastId === id) {
        this.state.battle = { ...b, toast: null };
        this.notify();
      }
    }, 1500);
  }

  /** Adds XP, rolling over levels (each grants max HP/MP headroom + stat
   *  points + a Talent Point, #8). Deliberately does *not* top off
   *  current HP/MP - leveling up mid-fight is a milestone, not a free
   *  heal, so a level-up in a rough battle still leaves you in that rough
   *  battle. Returns whether a level-up happened. */
  private grantXp(amount: number): boolean {
    const title = this.equippedTitle();
    let pct = title?.bonus.kind === "xpPct" ? title.bonus.value : 0;
    pct += talentXpPct(this.state.talents.unlockedIds);
    if (pct > 0) amount = Math.round(amount * (1 + pct));
    const player = { ...this.state.player };
    player.xp += amount;
    let leveled = false;
    let talentPointsGained = 0;
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      // 1.18 (was 1.25) - a gentler curve, so leveling stays frequent deep into a run.
      player.xpToNext = Math.round(player.xpToNext * 1.18);
      player.maxHp += 15; player.maxMp += 5;
      player.statPoints += 3;
      talentPointsGained += TALENT_POINTS_PER_LEVEL;
      leveled = true;
    }
    this.state.player = player;
    if (talentPointsGained > 0) {
      this.state.talents = { ...this.state.talents, points: this.state.talents.points + talentPointsGained };
    }
    return leveled;
  }

  /** Gold + a chance at loot on a kill. Elites, bosses, and "generous"
   *  gate modifiers all push the odds and rarity up. */
  private grantKillRewards(battle: BattleState, unit: EnemyUnit) {
    if (unit.gold > 0) {
      const title = this.equippedTitle();
      let goldPct = title?.bonus.kind === "goldPct" ? title.bonus.value : 0;
      goldPct += talentGoldPct(this.state.talents.unlockedIds);
      // Wealthy/Cursed gate modifiers apply as their own separate
      // multiplier on top of the Title/Talent percentage bonus, the same
      // "gear-then-multiplier" layering effectiveStat already uses -
      // goldMult defaults to 1 (a no-op) for every modifier that isn't
      // specifically about gold.
      const goldMult = battle.modifier?.goldMult ?? 1;
      const gold = Math.round(unit.gold * (1 + goldPct) * goldMult);
      this.state.player = { ...this.state.player, gold: this.state.player.gold + gold };
      this.incrementCounter(COUNTER_KEYS.goldEarnedTotal, gold);
    }

    const modifier = battle.modifier;
    const lootBonus = (modifier?.loot ?? 0) + (unit.isElite ? 0.35 : 0) + (battle.isBossWave ? 1 : 0);
    const baseChance = battle.isBossWave ? 1 : 0.22;
    const chance = Math.min(1, baseChance + lootBonus);
    if (Math.random() >= chance) return;

    const gate = GATE_REGISTRY.get(battle.gateId);
    const rank = gate?.rank ?? "E";
    const rarityBonus = (unit.isElite ? 0.15 : 0) + (battle.isBossWave ? 0.3 : 0) + rankRarityBonus(rank);
    const rarity = rollRarity(rarityBonus);
    const item = generateLoot(rank, rarity);
    this.state.bag = [...this.state.bag, item];
    this.showBattleToast(battle, { text: item.name, kind: "loot", rarity });
  }

  /** Applies damage to one enemy unit; grants its XP/gold/loot and fires
   *  the dissolve fx if it dies. A unit currently guarding (AI-chosen)
   *  halves the hit and spends one round of its guard on it. Returns the
   *  damage actually dealt (post-guard-mitigation) - callers that need to
   *  know the real number (life steal) use this instead of the `dmg` they
   *  passed in, which may have since been halved. */
  private applyDamage(battle: BattleState, unit: EnemyUnit, dmg: number, isCrit = false): number {
    if (unit.guardRounds > 0) {
      dmg = Math.max(1, Math.round(dmg * 0.5));
      unit.guardRounds -= 1;
    }
    unit.hp = Math.max(0, unit.hp - dmg);
    unit.hit = true;
    this.triggerUnitFloat(unit, `-${dmg}`, isCrit ? "crit" : "dmg");
    if (isCrit) this.incrementCounter(COUNTER_KEYS.critsLandedTotal);
    if (unit.hp <= 0 && unit.alive) {
      unit.alive = false;
      this.incrementCounter(COUNTER_KEYS.killsTotal);
      this.incrementCounter(COUNTER_KEYS.killsByArchetype(ARCHETYPE_BY_RANK[battle.rank]));
      if (battle.isBossWave) this.incrementCounter(COUNTER_KEYS.bossesDefeatedTotal);
      const leveled = this.grantXp(Math.round(unit.xp * (battle.modifier?.xpMult ?? 1)));
      if (leveled) this.emitFx({ kind: "levelup" });
      this.emitFx({ kind: "dissolve", side: "enemy", targetUid: unit.uid });
      this.grantKillRewards(battle, unit);
    }
    return dmg;
  }

  /** 1.8 plus an Assassin's `critMultiplierBonus`, if that's the chosen
   *  class - shared by every *Hunter* crit (rollBasicAttack, useSkill),
   *  deliberately not the deployed Shadow's own crit in companionStrike
   *  (its own separate `* 1.8` literal) - same "it's the Hunter's own
   *  build, not the Shadow's" line equipment Life Steal already draws. */
  private critMultiplier(): number {
    const cls = this.equippedHunterClass();
    return 1.8 + (cls?.bonus.kind === "critMultiplierBonus" ? cls.bonus.value : 0);
  }

  /** Rolls one basic-Attack hit's damage + crit result against a target -
   *  shared by the primary Attack and an equipped Attack Speed affix's
   *  chance at an immediate follow-up strike (see battleAttack), so the
   *  two can never drift out of sync with each other. */
  private rollBasicAttack(target: EnemyUnit): { dmg: number; isCrit: boolean } {
    const isCrit = this.rollCrit();
    let dmg = Math.max(1, Math.round(
      6 + this.effectiveStat("str") * STAT_TUNING.strAtkPerPoint + this.equipmentAffixSum("fireDamage")
      - target.def + (Math.random() * 4 - 2)
    ));
    const cls = this.equippedHunterClass();
    if (cls?.bonus.kind === "attackDamagePct") dmg = Math.round(dmg * (1 + cls.bonus.value));
    if (isCrit) dmg = Math.round(dmg * this.critMultiplier());
    return { dmg, isCrit };
  }

  /** Heals the player for a % of damage a hit just dealt, if the relevant
   *  gear carries a Life Steal affix - `pct` is passed in explicitly
   *  rather than read internally so the same heal logic serves both the
   *  Hunter's own gear (battleAttack/useSkill, passing
   *  `equipmentAffixSum("lifeSteal")`) and a deployed Shadow's gear
   *  (companionStrike, passing that Shadow's own lifeSteal sum) without
   *  duplicating the heal math - either way it's the *gear* doing the
   *  stealing, whichever combatant is wearing it. No-ops (no float, no
   *  state write) when there's nothing to heal, including "already at
   *  full HP", so it can be called unconditionally after every hit
   *  without spamming a "+0" float. */
  private applyLifeSteal(battle: BattleState, damageDealt: number, pct: number) {
    if (damageDealt <= 0) return;
    if (pct <= 0) return;
    const rawHeal = Math.round(damageDealt * (pct / 100));
    if (rawHeal <= 0) return;
    const maxHp = this.effectiveMaxHp();
    const player = { ...this.state.player };
    const healed = Math.min(maxHp, player.hp + rawHeal) - player.hp;
    if (healed <= 0) return;
    player.hp += healed;
    this.state.player = player;
    this.triggerFloatPlayer(battle, `+${healed}`, "heal");
  }

  /** A deployed Shadow auto-assists every player action, striking whatever
   *  is currently targeted right after the player's own hit lands - with
   *  its own lunge animation so it visibly joins the fight too. */
  /** Adds XP to one Shadow (a small flat amount per strike, more on a
   *  kill) and rolls it over into levels exactly like the player's own
   *  grantXp - capped at SHADOW_MAX_LEVEL so a single Shadow's power
   *  can't grow without bound across a very long-lived save. Floats a
   *  global toast on level-up (visible from any screen, matching
   *  Title/Achievement unlocks) since leveling happens automatically
   *  mid-battle with no other feedback surface for it. */
  private grantShadowXp(shadowId: string, killedThisAction: boolean) {
    const idx = this.state.shadowArmy.findIndex((s) => s.id === shadowId);
    if (idx === -1) return;
    const shadow = { ...this.state.shadowArmy[idx] };
    if (shadow.level < SHADOW_MAX_LEVEL) {
      shadow.xp += 2 + (killedThisAction ? 4 : 0);
      let leveled = false;
      while (shadow.level < SHADOW_MAX_LEVEL && shadow.xp >= shadowXpToNext(shadow.level)) {
        shadow.xp -= shadowXpToNext(shadow.level);
        shadow.level += 1;
        leveled = true;
      }
      if (shadow.level >= SHADOW_MAX_LEVEL) shadow.xp = 0;
      if (leveled) this.showGlobalToast(`${shadow.name} reached Level ${shadow.level}!`, "shadow");
    }
    const army = [...this.state.shadowArmy];
    army[idx] = shadow;
    this.state.shadowArmy = army;
  }

  /** +1 Loyalty (capped 100), once per wave cleared while deployed - never
   *  decays (see the ShadowRecord.loyalty doc comment on why). */
  private growShadowLoyalty(shadowId: string) {
    const idx = this.state.shadowArmy.findIndex((s) => s.id === shadowId);
    if (idx === -1) return;
    const shadow = { ...this.state.shadowArmy[idx], loyalty: Math.min(100, this.state.shadowArmy[idx].loyalty + 1), battlesFought: this.state.shadowArmy[idx].battlesFought + 1 };
    const army = [...this.state.shadowArmy];
    army[idx] = shadow;
    this.state.shadowArmy = army;
  }

  /** A deployed Shadow auto-assists every player action, striking whatever
   *  is currently targeted right after the player's own hit lands - with
   *  its own lunge animation so it visibly joins the fight too. Which
   *  archetype it is (see SHADOW_SKILLS) decides *how* it fights: a
   *  passive that modifies every strike, and a % chance per action for an
   *  Active Skill to replace the normal single hit with something bigger
   *  (a second strike, an AoE, a guaranteed crit, ...) - six genuinely
   *  different Shadows to fight alongside, not one damage number reskinned
   *  six times. */
  private companionStrike(battle: BattleState) {
    const shadow = this.state.shadowArmy.find((s) => s.deployed);
    if (!shadow) return;
    const target = this.currentTarget(battle);
    if (!target) return;

    const { passive, active } = SHADOW_SKILLS[shadow.archetype];
    const power = effectiveShadowPower(shadow);
    const activeTriggers = Math.random() * 100 < active.effect.chance;
    let killedAny = false;

    // The Shadow's own equipped gear (#7) - crit/lifeSteal/attackSpeed/
    // fireDamage are combat-round affixes applied directly here, the same
    // way the Hunter's own gear works in battleAttack/useSkill (see
    // equipmentAffixSum's call sites); core-stat affixes already folded
    // into `power` above via effectiveShadowPower. Mana Regen is handled
    // separately in enemyTurn's round-completion tick, alongside the
    // Hunter's own.
    const gearFireDamage = sumEquipmentAffix(shadow.equipment, "fireDamage");
    const gearCritPct = sumEquipmentAffix(shadow.equipment, "crit");
    const gearLifeStealPct = sumEquipmentAffix(shadow.equipment, "lifeSteal");
    const gearAttackSpeedPct = sumEquipmentAffix(shadow.equipment, "attackSpeed");

    const strike = (tgt: EnemyUnit, dmgMult: number, ignoreDef: boolean, forceCrit: boolean) => {
      let dmg = Math.max(1, Math.round(power * dmgMult + gearFireDamage + (Math.random() * 4 - 2) - (ignoreDef ? 0 : tgt.def * 0.5)));
      if (passive.effect.key === "executeBonus" && tgt.hp <= tgt.maxHp * passive.effect.hpThresholdPct) {
        dmg = Math.round(dmg * (1 + passive.effect.bonusPct));
      } else if (passive.effect.key === "damageMult") {
        dmg = Math.round(dmg * (1 + passive.effect.pct));
      }
      const isCrit = forceCrit
        || (passive.effect.key === "critChance" && Math.random() * 100 < passive.effect.chance)
        || (gearCritPct > 0 && Math.random() * 100 < gearCritPct);
      if (isCrit) dmg = Math.round(dmg * 1.8);

      this.setUnitVfx(tgt, isCrit ? "flurry" : "slash");
      const dealt = this.applyDamage(battle, tgt, dmg, isCrit);
      if (!tgt.alive) killedAny = true;
      this.clearHitFlagLater(tgt.uid);
      this.applyLifeSteal(battle, dealt, gearLifeStealPct);

      if (passive.effect.key === "manaOnHit") {
        const maxMp = this.effectiveMaxMp();
        if (this.state.player.mp < maxMp) {
          this.state.player = { ...this.state.player, mp: Math.min(maxMp, this.state.player.mp + passive.effect.amount) };
        }
      } else if (passive.effect.key === "healOnHit") {
        const maxHp = this.effectiveMaxHp();
        const heal = Math.round(dealt * passive.effect.pct);
        const healed = Math.min(maxHp, this.state.player.hp + heal) - this.state.player.hp;
        if (healed > 0) {
          this.state.player = { ...this.state.player, hp: this.state.player.hp + healed };
          this.triggerFloatPlayer(battle, `+${healed}`, "heal");
        }
      }
    };

    if (activeTriggers && active.effect.key === "doubleStrike") {
      strike(target, 1, false, false);
      if (target.alive) strike(target, 1, false, false);
    } else if (activeTriggers && active.effect.key === "bigHit") {
      strike(target, active.effect.mult, false, false);
    } else if (activeTriggers && active.effect.key === "flurry") {
      for (let i = 0; i < active.effect.hits && target.alive; i++) strike(target, active.effect.eachPct, false, false);
    } else if (activeTriggers && active.effect.key === "armorPierce") {
      strike(target, 1, true, false);
    } else if (activeTriggers && active.effect.key === "guaranteedCrit") {
      strike(target, 1, false, true);
    } else if (activeTriggers && active.effect.key === "aoe") {
      for (const enemy of battle.enemies) {
        if (enemy.alive) strike(enemy, active.effect.eachPct, false, false);
      }
    } else {
      strike(target, 1, false, false);
    }

    // Attack Speed affix on the Shadow's own gear - a % chance at one more
    // strike against whatever's still standing, re-reading currentTarget
    // rather than reusing `target` since the primary action above may have
    // killed it (or, for the AoE active, hit several others instead).
    if (gearAttackSpeedPct > 0 && Math.random() * 100 < gearAttackSpeedPct) {
      const followUp = this.currentTarget(battle);
      if (followUp) strike(followUp, 1, false, false);
    }

    if (killedAny && passive.effect.key === "goldOnKill" && Math.random() * 100 < passive.effect.chance) {
      this.state.player = { ...this.state.player, gold: this.state.player.gold + passive.effect.amount };
      this.incrementCounter(COUNTER_KEYS.goldEarnedTotal, passive.effect.amount);
    }

    this.grantShadowXp(shadow.id, killedAny);

    battle.shadowLunge = true;
    this.vfxSeq += 1;
    const id = this.vfxSeq;
    battle.shadowVfxId = id;
    setTimeout(() => {
      if (this.state.battle && this.state.battle.shadowVfxId === id) {
        this.state.battle = { ...this.state.battle, shadowLunge: false };
        this.notify();
      }
    }, 380);
  }

  private onWaveCleared(battle: BattleState) {
    const deployed = this.state.shadowArmy.find((s) => s.deployed);
    if (deployed) this.growShadowLoyalty(deployed.id);
    const gate = GATE_REGISTRY.get(battle.gateId);
    if (battle.isBossWave && gate?.isPromotionExam) {
      this.completePromotionExam(battle, gate);
      return;
    }
    if (battle.isBossWave) {
      this.state.gatesCleared = { ...this.state.gatesCleared, [battle.gateId]: true };
      this.state.battle = { ...battle, over: true, result: "gate-clear", locked: false };
    } else {
      this.state.battle = { ...battle, over: true, result: "wave-clear", locked: false };
    }
    this.notify();
  }

  /** Item #10 of the fixed roadmap. Which rank tier a Promotion Exam is
   *  currently available for, or null if none is - see
   *  systems/exams/data.ts's examEligibleRank for the level-vs-confirmed-
   *  rank gap this closes one tier at a time. Public - the Gates screen
   *  uses this to show/hide the exam banner. */
  examEligibleRank(): Rank | null {
    return computeExamEligibleRank(this.state.player.rank, this.state.player.level);
  }

  /** Begins the single-boss "trial" battle for whichever rank the Hunter
   *  is currently exam-eligible for - a no-op (returns false) if not
   *  currently eligible. Reuses `startBattle` completely unchanged: a
   *  Promotion Exam is just a `GateDef` flagged `isPromotionExam`
   *  (EXAM_GATES_DATA in data.ts), so the whole battle engine - combat,
   *  loot, XP - already works for it with zero special-casing there.
   *  What's special only happens on victory, in completePromotionExam. */
  startPromotionExam(): boolean {
    const rank = this.examEligibleRank();
    const gateId = rank ? EXAM_GATE_ID[rank] : undefined;
    const gate = gateId ? GATE_REGISTRY.get(gateId) : undefined;
    if (!gate) return false;
    this.startBattle(gate);
    return true;
  }

  /** Defeating an exam's boss confirms the Hunter's rank one tier up
   *  (`PlayerState.rank`, not just the level-implied one) and pays out a
   *  one-time gold + stat point reward on top of whatever the fight
   *  itself already granted (XP/gold/loot via the normal applyDamage/
   *  grantKillRewards path, which already ran before this is called).
   *  The `nextRank` re-check guards against a stale battle instance
   *  somehow completing after the Hunter was already promoted some other
   *  way - if so, this just closes out the battle without promoting or
   *  paying out again. Deliberately does *not* mark the exam gate in
   *  `gatesCleared` - it isn't one of the 20 explorable gates the "clear
   *  every gate" Title/Achievement conditions count. */
  private completePromotionExam(battle: BattleState, gate: GateDef) {
    const newRank = gate.rank;
    if (nextRank(this.state.player.rank) === newRank) {
      const reward = PROMOTION_REWARD[newRank];
      this.state.player = {
        ...this.state.player,
        rank: newRank,
        gold: this.state.player.gold + (reward?.gold ?? 0),
        statPoints: this.state.player.statPoints + (reward?.statPoints ?? 0)
      };
      this.showGlobalToast(`Promoted to ${newRank}-Rank Hunter!`, "promotion");
    }
    this.state.battle = { ...battle, over: true, result: "exam-pass", locked: false };
    this.notify();
  }

  /** Below this HP fraction, a boss stops holding anything back - see
   *  `decideEnemyAction`'s enrage check. */
  private static readonly BOSS_ENRAGE_HP_PCT = 0.25;

  /** Chooses what an attacking enemy does this round. Three real, tuned
   *  behaviors on top of "roll a die" (#13, Better Enemy AI - deepening
   *  the original turtle-when-hurt/press-when-guarded smarts, not
   *  replacing them):
   *  - **Boss enrage**: a boss below `BOSS_ENRAGE_HP_PCT` always uses its
   *    special - a real phase change, not a boss playing exactly like a
   *    bigger trash unit all the way to 0. Bypasses the roll entirely.
   *  - **Elite aggression**: Elites are bruisers, not turtles - a lower
   *    base guard chance than plain trash, on top of the existing
   *    "threatening -> more special" bump they already shared with
   *    bosses.
   *  - **Pressing the advantage**: a badly hurt Hunter gets *less*
   *    cautious enemies, not equally-likely-to-guard ones - guard chance
   *    drops hard and special chance climbs when the player is low, so a
   *    close fight doesn't let the player stall it out against an AI
   *    that doesn't notice it's winning. */
  private decideEnemyAction(unit: EnemyUnit, battle: BattleState, playerGuarding: boolean): EnemyAction {
    if (battle.isBossWave && unit.hp <= unit.maxHp * Game.BOSS_ENRAGE_HP_PCT) return "special";

    const threatening = unit.isElite || battle.isBossWave;
    const lowHp = unit.hp < unit.maxHp * 0.3;
    const playerLowHp = this.state.player.hp < this.effectiveMaxHp() * 0.3;

    let guardChance = 0.12 + (lowHp ? 0.15 : 0) + (unit.isElite ? -0.06 : 0);
    let specialChance = (threatening ? 0.28 : 0.16) + (playerGuarding ? 0.15 : 0);
    if (playerLowHp) {
      guardChance -= 0.2;
      specialChance += 0.2;
    }
    guardChance = Math.max(0, guardChance);

    const roll = Math.random();
    if (roll < guardChance) return "guard";
    if (roll < guardChance + specialChance) return "special";
    return "attack";
  }

  private enemyTurn(startBattle: BattleState) {
    const wasGuardingRound = startBattle.guardRounds > 0;
    const attackers = startBattle.enemies.filter((u) => u.alive).map((u) => u.uid);

    const step = (i: number) => {
      const battle = this.state.battle;
      if (!battle || battle.over) return;
      if (i >= attackers.length) {
        const guardRounds = Math.max(0, battle.guardRounds - (wasGuardingRound ? 1 : 0));
        // Mana Regen affix - ticks once per completed round (every enemy
        // that's going to act this round has), not per player action, so
        // it restores MP even on a round where the player just Attacked
        // rather than cast a Skill. No float text - the MP bar filling a
        // little every round is feedback enough without a "+2" spam on
        // top of whatever else just happened. Counts both the Hunter's
        // own gear and the deployed Shadow's own gear (#7) - either
        // source is restoring the same MP pool.
        const deployedForRegen = this.state.shadowArmy.find((s) => s.deployed);
        const manaRegen = this.equipmentAffixSum("manaRegen")
          + (deployedForRegen ? sumEquipmentAffix(deployedForRegen.equipment, "manaRegen") : 0);
        if (manaRegen > 0 && this.state.player.mp < this.effectiveMaxMp()) {
          const maxMp = this.effectiveMaxMp();
          this.state.player = { ...this.state.player, mp: Math.min(maxMp, this.state.player.mp + manaRegen) };
        }
        this.state.battle = { ...battle, guardRounds, locked: false };
        this.notify();
        return;
      }
      const found = battle.enemies.find((u) => u.uid === attackers[i]);
      if (!found || !found.alive) {
        step(i + 1);
        return;
      }

      const next = this.cloneBattle(battle);
      const attacker = next.enemies.find((u) => u.uid === found.uid)!;
      // Computed *before* decideEnemyAction (which shares this exact
      // condition internally) so the toast below can tell "just entered
      // enrage" apart from "already enraged, still forced into special" -
      // the announcement only fires once per boss, not every enraged round.
      const enragingNow = battle.isBossWave && !battle.bossEnraged && attacker.hp <= attacker.maxHp * Game.BOSS_ENRAGE_HP_PCT;
      if (enragingNow) next.bossEnraged = true;
      const action = this.decideEnemyAction(attacker, next, wasGuardingRound);

      if (action === "guard") {
        attacker.guardRounds = 1;
        this.emitFx({ kind: "guard", side: "enemy", targetUid: attacker.uid });
        this.showBattleToast(next, { text: `${attacker.name} braces for impact`, kind: "info" });
        this.state.battle = next;
        this.notify();
        setTimeout(() => step(i + 1), 480);
        return;
      }

      const isSpecial = action === "special";
      let dmg = Math.max(1, Math.round(attacker.atk * (isSpecial ? 1.7 : 1) + (Math.random() * 6 - 3)));
      if (wasGuardingRound) {
        // A Tank's guardMitigationPct shaves further off the already-
        // reduced guard multiplier (0.4 normal / 0.75 special), floored
        // so Guard can never round all the way down to zero damage.
        const cls = this.equippedHunterClass();
        const classGuardPct = cls?.bonus.kind === "guardMitigationPct" ? cls.bonus.value : 0;
        const guardMult = Math.max(0.05, (isSpecial ? 0.75 : 0.4) - classGuardPct);
        dmg = Math.round(dmg * guardMult);
      }

      attacker.lunging = true;
      // "smash" is its own vfx (a red shockwave ring, not the flurry slashes
      // a player crit uses) - a special reads as a distinct kind of threat,
      // not just "the same hit, but harder".
      next.vfxPlayer = isSpecial ? "smash" : "slash";
      next.lunge = null;
      this.emitFx({ kind: isSpecial ? "smash" : "slash", side: "player" });
      this.emitFx({ kind: "shake", intensity: isSpecial ? "heavy" : "light" });
      if (enragingNow) this.showBattleToast(next, { text: `${attacker.name} grows desperate and unleashes a fierce strike!`, kind: "info" });
      else if (isSpecial) this.showBattleToast(next, { text: `${attacker.name} unleashes a fierce strike!`, kind: "info" });

      const player = { ...this.state.player };
      player.hp = Math.max(0, player.hp - dmg);
      next.playerHit = true;
      this.state.player = player;
      this.triggerFloatPlayer(next, `-${dmg}`, "dmg");

      if (player.hp <= 0) {
        next.over = true;
        next.result = "defeat";
        next.locked = false;
        this.state.battle = next;
        this.notify();
        return;
      }

      this.state.battle = next;
      this.notify();

      const uid = attacker.uid;
      setTimeout(() => {
        const b = this.state.battle;
        if (!b) return;
        this.state.battle = {
          ...b,
          playerHit: false, vfxPlayer: null,
          enemies: b.enemies.map((u) => (u.uid === uid ? { ...u, lunging: false } : u))
        };
        this.notify();
      }, 380);

      setTimeout(() => step(i + 1), 550);
    };

    step(0);
  }

  /** While the player is guarding, their footing is worse - the basic
   *  Attack can whiff outright. AGI/PER (the same stats that drive crit)
   *  cut the chance down, so a nimble build barely notices it. */
  private selfGuardMissChance(): number {
    return Math.max(0.05, 0.32 - this.effectiveStat("agi") * STAT_TUNING.agiMissReductionPerPoint - this.effectiveStat("per") * STAT_TUNING.perMissReductionPerPoint);
  }

  battleAttack() {
    const src = this.state.battle;
    if (!src || src.over || src.locked) return;
    const battle = this.cloneBattle(src);
    const target = this.currentTarget(battle);
    if (!target) return;
    battle.locked = true;

    if (battle.guardRounds > 0 && Math.random() < this.selfGuardMissChance()) {
      this.playPlayerVfx(battle, { lunge: "player" });
      this.triggerUnitFloat(target, "Miss", "miss");
      this.companionStrike(battle);
      this.state.battle = battle;
      this.notify();
      if (battle.enemies.every((u) => !u.alive)) this.onWaveCleared(battle);
      else setTimeout(() => this.enemyTurn(this.state.battle!), 650);
      return;
    }

    const { dmg, isCrit } = this.rollBasicAttack(target);
    this.playPlayerVfx(battle, { lunge: "player", flash: true, heavy: isCrit });
    this.setUnitVfx(target, isCrit ? "flurry" : "slash");
    const dealtDmg = this.applyDamage(battle, target, dmg, isCrit);
    this.applyLifeSteal(battle, dealtDmg, this.equipmentAffixSum("lifeSteal"));

    // Attack Speed affix - a % chance at an immediate follow-up strike on
    // the same target, scoped to the basic Attack only (Skills already
    // have their own fixed "cast" feel via base/scale). No extra lunge/
    // shake for the follow-up - it reads as a fast second hit landing
    // right on top of the first, the same restrained treatment
    // companionStrike already uses for the Shadow's own hit.
    const atkSpeedPct = this.equipmentAffixSum("attackSpeed");
    if (atkSpeedPct > 0 && target.alive && Math.random() * 100 < atkSpeedPct) {
      const extra = this.rollBasicAttack(target);
      this.setUnitVfx(target, extra.isCrit ? "flurry" : "slash");
      const extraDealt = this.applyDamage(battle, target, extra.dmg, extra.isCrit);
      this.applyLifeSteal(battle, extraDealt, this.equipmentAffixSum("lifeSteal"));
    }

    this.companionStrike(battle);
    this.state.battle = battle;
    this.notify();
    this.clearHitFlagLater(target.uid);
    if (battle.enemies.every((u) => !u.alive)) this.onWaveCleared(battle);
    else setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  useSkill(skillKey: string) {
    const src = this.state.battle;
    if (!src || src.over || src.locked) return;
    const skillDef = SKILL_REGISTRY.get(skillKey);
    if (!skillDef) return;
    if (this.state.player.level < skillDef.unlockLevel) return;
    if (this.state.player.mp < skillDef.mpCost) return;

    const battle = this.cloneBattle(src);
    battle.skillPanelOpen = false;
    const alive = battle.enemies.filter((u) => u.alive);
    if (alive.length === 0) return;
    battle.locked = true;

    const player = { ...this.state.player, mp: this.state.player.mp - skillDef.mpCost };
    const str = this.effectiveStat("str");

    let targets: EnemyUnit[];
    let heavy = false;
    switch (skillDef.kind) {
      case "cleave": targets = alive.slice(0, 2); heavy = targets.length > 1; break;
      case "aoe": targets = alive; heavy = true; break;
      case "execute": targets = [alive[0]]; heavy = true; break;
      default: targets = [alive[0]];
    }

    this.playPlayerVfx(battle, { lunge: "player", flash: true, heavy });
    const fireDamage = this.equipmentAffixSum("fireDamage");
    const cls = this.equippedHunterClass();
    const classSkillPct = cls?.bonus.kind === "skillDamagePct" ? cls.bonus.value : 0;
    let totalDealt = 0;
    for (const target of targets) {
      const isCrit = this.rollCrit();
      let dmg = Math.max(1, Math.round(skillDef.base + str * skillDef.scale + fireDamage - target.def + (Math.random() * 4 - 2)));
      if (skillDef.kind === "execute" && target.hp <= target.maxHp * 0.3) dmg *= 2;
      if (classSkillPct > 0) dmg = Math.round(dmg * (1 + classSkillPct));
      if (isCrit) dmg = Math.round(dmg * this.critMultiplier());
      this.setUnitVfx(target, skillDef.kind === "single" && !isCrit ? "slash" : "flurry");
      totalDealt += this.applyDamage(battle, target, dmg, isCrit);
      this.clearHitFlagLater(target.uid);
    }
    this.applyLifeSteal(battle, totalDealt, this.equipmentAffixSum("lifeSteal"));
    this.companionStrike(battle);

    this.state.battle = battle;
    this.state.player = player;
    this.notify();
    if (battle.enemies.every((u) => !u.alive)) this.onWaveCleared(battle);
    else setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  toggleSkillPanel() {
    const b = this.state.battle;
    if (!b || b.over || b.locked) return;
    this.state.battle = { ...b, skillPanelOpen: !b.skillPanelOpen, itemPanelOpen: false };
    this.notify();
  }

  toggleItemPanel() {
    const b = this.state.battle;
    if (!b || b.over || b.locked) return;
    this.state.battle = { ...b, itemPanelOpen: !b.itemPanelOpen, skillPanelOpen: false };
    this.notify();
  }

  battleGuard() {
    const src = this.state.battle;
    if (!src || src.over || src.locked) return;
    const battle = this.cloneBattle(src);
    battle.locked = true;
    battle.guardRounds = 1 + Math.floor(Math.random() * 3); // 1-3 rounds, re-rolled each use
    battle.skillPanelOpen = false;
    this.playPlayerVfx(battle, { guard: true });
    this.state.battle = battle;
    this.notify();
    setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  /** Uses one of the tiered HP/MP consumables from the Items panel. */
  useItem(potionId: string) {
    const src = this.state.battle;
    if (!src || src.over || src.locked) return;
    const count = this.state.inventory.potions[potionId] ?? 0;
    if (count <= 0) return;
    const def = POTION_REGISTRY.get(potionId);
    if (!def) return;

    const battle = this.cloneBattle(src);
    battle.locked = true;
    battle.itemPanelOpen = false;
    const player = { ...this.state.player };
    // A Healer's potionHealPct only applies to HP potions - MP is a
    // resource to spend, not something a "Healer" identity is about
    // restoring more of.
    const cls = this.equippedHunterClass();
    const classHealPct = def.kind === "hp" && cls?.bonus.kind === "potionHealPct" ? cls.bonus.value : 0;
    const amount = classHealPct > 0 ? Math.round(def.amount * (1 + classHealPct)) : def.amount;
    if (def.kind === "hp") player.hp = Math.min(this.effectiveMaxHp(), player.hp + amount);
    else player.mp = Math.min(this.effectiveMaxMp(), player.mp + amount);
    const potions = { ...this.state.inventory.potions, [potionId]: count - 1 };
    this.triggerFloatPlayer(battle, `+${amount}`, "heal");
    this.state.battle = battle;
    this.state.player = player;
    this.state.inventory = { potions };
    this.incrementCounter(COUNTER_KEYS.potionsUsedTotal);
    this.notify();
    setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  ariseShadow() {
    const battle = this.state.battle;
    if (!battle || (battle.result !== "wave-clear" && battle.result !== "gate-clear")) return;
    // Confirmed rank (#10) - a Shadow arises at your officially recognized
    // strength, not merely what your level alone would qualify for.
    const rank = this.state.player.rank;
    const sourceName = battle.enemies[0]?.name ?? "Unknown";
    const shadow: ShadowRecord = {
      id: `${battle.gateId}-w${battle.waveIndex}-${Date.now()}`,
      name: `Shadow of the ${sourceName}`,
      rank,
      type: sourceName,
      archetype: ARCHETYPE_BY_RANK[rank],
      power: SHADOW_RANK_POWER[rank],
      level: 1, xp: 0, loyalty: 0, battlesFought: 0, evolutionStage: 0, equipment: {},
      deployed: false
    };
    this.emitFx({ kind: "portal" });
    this.state.shadowArmy = [...this.state.shadowArmy, shadow];
    this.notify();
    if (battle.result === "gate-clear") {
      setTimeout(() => {
        this.state.screen = "gates";
        this.state.battle = null;
        this.notify();
      }, 650);
    } else {
      setTimeout(() => this.advanceWave(), 650);
    }
  }

  /** Only one Shadow assists in battle at a time - deploying a new one
   *  automatically recalls whichever was active before. */
  deployShadow(id: string) {
    this.state.shadowArmy = this.state.shadowArmy.map((s) => ({ ...s, deployed: s.id === id ? !s.deployed : false }));
    this.notify();
  }

  /** Duplicate-handling per EXPANSION_ROADMAP.md's item #5 scope: merges
   *  `keepId` with the lowest-level *other* Shadow sharing its species
   *  (`type`) - the weakest duplicate is the one consumed by default, so
   *  merging never costs you your best copy of a species by accident.
   *  The survivor gains levels (half the consumed one's, minimum 1) and
   *  a Loyalty bump; the consumed Shadow is removed outright. Returns the
   *  consumed Shadow's name for a confirmation UI, or null if `keepId`
   *  has no duplicate to merge with. ("Convert to Shadow Essence" is
   *  deferred to Crafting, #14 - there's nothing to spend Essence on
   *  yet.) Any gear equipped on the consumed Shadow (#7) returns to the
   *  Bag rather than vanishing with it - merging discards the Shadow, not
   *  its gear. */
  mergeShadow(keepId: string): { consumedName: string } | null {
    const army = this.state.shadowArmy;
    const keep = army.find((s) => s.id === keepId);
    if (!keep) return null;
    const duplicates = army.filter((s) => s.id !== keepId && s.type === keep.type);
    if (duplicates.length === 0) return null;
    const consume = duplicates.reduce((lowest, s) => (s.level < lowest.level ? s : lowest), duplicates[0]);

    const merged: ShadowRecord = {
      ...keep,
      level: Math.min(SHADOW_MAX_LEVEL, keep.level + Math.max(1, Math.floor(consume.level / 2))),
      loyalty: Math.min(100, keep.loyalty + 10)
    };
    const returnedGear = Object.values(consume.equipment).filter((item): item is LootItem => !!item);
    this.state.shadowArmy = army
      .filter((s) => s.id !== consume.id)
      .map((s) => (s.id === keepId ? merged : s));
    if (returnedGear.length > 0) this.state.bag = [...this.state.bag, ...returnedGear];
    this.notify();
    return { consumedName: consume.name };
  }

  /** Item #6 of the fixed roadmap. Evolving a fully-leveled Shadow advances
   *  it to the next rank tier - reusing the exact rank -> archetype -> power
   *  pipeline every Shadow already goes through once at Arise time
   *  (`ARCHETYPE_BY_RANK`, `SHADOW_RANK_POWER`), rather than inventing a
   *  second, parallel progression system. Because archetype is rank-locked
   *  everywhere else in the game (portrait, rim-glow, SHADOW_SKILLS), an
   *  evolution is a genuine transformation - new silhouette, new passive/
   *  active skill pair, higher power baseline - not just a bigger number.
   *
   *  Gated on being fully leveled (`SHADOW_MAX_LEVEL`) so it's a milestone
   *  earned through play, not a shortcut around leveling, and costs gold
   *  scaled to the rank being left behind (`SHADOW_EVOLUTION_COST`).
   *  `level`/`xp` reset to 1/0 on evolve so growth keeps meaning something
   *  in the new, stronger form; `name`/`type`/`loyalty`/`battlesFought` -
   *  the Shadow's identity and history - carry over unchanged. S-rank
   *  Shadows have nowhere further to evolve to. */
  evolveShadow(id: string): { ok: true; newRank: Rank } | { ok: false; reason: "not-maxed" | "max-rank" | "insufficient-gold" } {
    const idx = this.state.shadowArmy.findIndex((s) => s.id === id);
    if (idx === -1) return { ok: false, reason: "not-maxed" };
    const shadow = this.state.shadowArmy[idx];
    if (shadow.level < SHADOW_MAX_LEVEL) return { ok: false, reason: "not-maxed" };
    const newRank = nextShadowRank(shadow.rank);
    if (!newRank) return { ok: false, reason: "max-rank" };
    const cost = SHADOW_EVOLUTION_COST[shadow.rank];
    if (cost === undefined || this.state.player.gold < cost) return { ok: false, reason: "insufficient-gold" };

    const evolved: ShadowRecord = {
      ...shadow,
      rank: newRank,
      archetype: ARCHETYPE_BY_RANK[newRank],
      power: SHADOW_RANK_POWER[newRank],
      level: 1, xp: 0,
      evolutionStage: shadow.evolutionStage + 1
    };
    const army = [...this.state.shadowArmy];
    army[idx] = evolved;
    this.state.shadowArmy = army;
    this.state.player = { ...this.state.player, gold: this.state.player.gold - cost };
    this.emitFx({ kind: "portal" });
    this.showGlobalToast(`${shadow.name} evolved into a ${newRank}-Rank Shadow!`, "shadow");
    this.notify();
    return { ok: true, newRank };
  }

  /** Item #7 of the fixed roadmap - Shadow Management UI. A Shadow's own
   *  equipment (`ShadowRecord.equipment`), independent of the Hunter's
   *  `player.equipment` - the exact same Bag/LootItem/ItemSlot system,
   *  mirroring `equipItem`'s move-from-bag-swap-in-return-previous logic
   *  exactly (see below) rather than inventing a second itemization
   *  model. A piece of gear is worn by the Hunter or by one Shadow, never
   *  both - equipping it here removes it from the shared Bag. */
  equipShadowItem(shadowId: string, itemId: string) {
    const idx = this.state.shadowArmy.findIndex((s) => s.id === shadowId);
    if (idx === -1) return;
    const item = this.state.bag.find((i) => i.id === itemId);
    if (!item) return;
    const shadow = { ...this.state.shadowArmy[idx], equipment: { ...this.state.shadowArmy[idx].equipment } };
    const previous = shadow.equipment[item.slot];
    shadow.equipment[item.slot] = item;
    let bag = this.state.bag.filter((i) => i.id !== itemId);
    if (previous) bag = [...bag, previous];
    const army = [...this.state.shadowArmy];
    army[idx] = shadow;
    this.state.shadowArmy = army;
    this.state.bag = bag;
    this.notify();
  }

  unequipShadowItem(shadowId: string, slot: ItemSlot) {
    const idx = this.state.shadowArmy.findIndex((s) => s.id === shadowId);
    if (idx === -1) return;
    const shadow = { ...this.state.shadowArmy[idx], equipment: { ...this.state.shadowArmy[idx].equipment } };
    const item = shadow.equipment[slot];
    if (!item) return;
    delete shadow.equipment[slot];
    const army = [...this.state.shadowArmy];
    army[idx] = shadow;
    this.state.shadowArmy = army;
    this.state.bag = [...this.state.bag, item];
    this.notify();
  }

  /** Trims and length-caps (`SHADOW_NAME_MAX_LENGTH`); a blank result after
   *  trimming is rejected rather than accepted as an empty name. Returns
   *  whether the rename actually applied, so the UI can tell "you typed
   *  nothing" apart from "saved". */
  renameShadow(shadowId: string, name: string): boolean {
    const trimmed = name.trim().slice(0, SHADOW_NAME_MAX_LENGTH);
    if (!trimmed) return false;
    const idx = this.state.shadowArmy.findIndex((s) => s.id === shadowId);
    if (idx === -1) return false;
    const army = [...this.state.shadowArmy];
    army[idx] = { ...army[idx], name: trimmed };
    this.state.shadowArmy = army;
    this.notify();
    return true;
  }

  continueAfterWave() {
    const battle = this.state.battle;
    if (!battle) return;
    if (battle.result === "wave-clear") {
      this.advanceWave();
      return;
    }
    this.retreatBattle();
  }

  retreatBattle() {
    this.state.screen = "gates";
    this.state.battle = null;
    this.notify();
  }

  /** VIT/INT don't feed into any combat formula the way STR/AGI/PER do, so
   *  they buy their payoff directly here: immediate max (and current) HP/MP,
   *  rather than only mattering once you happen to level up. */
  addStat(stat: StatKey) {
    if (this.state.player.statPoints <= 0) return;
    const player = { ...this.state.player };
    player[stat] += 1;
    player.statPoints -= 1;
    if (stat === "vit") {
      player.maxHp += STAT_TUNING.vitHpPerPoint;
      player.hp += STAT_TUNING.vitHpPerPoint;
    } else if (stat === "int") {
      player.maxMp += STAT_TUNING.intMpPerPoint;
      player.mp += STAT_TUNING.intMpPerPoint;
    }
    this.state.player = player;
    this.notify();
  }

  /** Item #8 of the fixed roadmap - Talent Tree. Spends one Talent Point
   *  to permanently learn `nodeId`, provided its prerequisite (the
   *  previous tier in its branch, if any - see canUnlockTalent) is
   *  already learned and at least one point is available. Talents are
   *  never un-learned (no respec) - same "no take-backs" stance the
   *  Merge/Evolve confirms already take on their own permanent choices.
   *  Returns whether it applied, so the UI can tell a no-op click apart
   *  from a real one without needing to duplicate this method's checks. */
  learnTalent(nodeId: string): boolean {
    const node = TALENT_REGISTRY.get(nodeId);
    if (!node) return false;
    if (this.state.talents.unlockedIds.includes(nodeId)) return false;
    if (this.state.talents.points <= 0) return false;
    if (!canUnlockTalent(this.state.talents.unlockedIds, node)) return false;
    this.state.talents = {
      points: this.state.talents.points - 1,
      unlockedIds: [...this.state.talents.unlockedIds, nodeId]
    };
    this.notify();
    return true;
  }

  // ---- inventory / equipment ----

  equipItem(itemId: string) {
    const item = this.state.bag.find((i) => i.id === itemId);
    if (!item) return;
    const player = { ...this.state.player, equipment: { ...this.state.player.equipment } };
    const previous = player.equipment[item.slot];
    player.equipment[item.slot] = item;
    let bag = this.state.bag.filter((i) => i.id !== itemId);
    if (previous) bag = [...bag, previous];
    this.state.player = player;
    this.state.bag = bag;
    this.clampVitals();
    this.incrementCounter(COUNTER_KEYS.itemsEquippedTotal);
    this.notify();
  }

  unequipItem(slot: ItemSlot) {
    const player = { ...this.state.player, equipment: { ...this.state.player.equipment } };
    const item = player.equipment[slot];
    if (!item) return;
    delete player.equipment[slot];
    this.state.player = player;
    this.state.bag = [...this.state.bag, item];
    this.clampVitals();
    this.notify();
  }

  /** The bag has no free "discard" - the only way an item leaves it (short
   *  of equipping it) is selling for a tenth of its Shop price (see
   *  SELL_PRICE_RATIO in data.ts). */
  sellItem(itemId: string) {
    const item = this.state.bag.find((i) => i.id === itemId);
    if (!item) return;
    const price = sellPriceForItem(item);
    this.state.player = { ...this.state.player, gold: this.state.player.gold + price };
    this.state.bag = this.state.bag.filter((i) => i.id !== itemId);
    this.notify();
  }

  /** Rerolls the Shop's equipment stock at the player's *confirmed* rank
   *  (#10) - stock quality is gated the same way everything else keying
   *  off rank now is, an unfinished Promotion Exam holds it back same as
   *  a Shadow's rank or the portrait's aura. `free` skips the gold cost -
   *  used for the very first stock and the automatic 10-minute restock.
   *  Either way it resets the restock clock. */
  rerollShop(free = false) {
    if (!free) {
      if (this.state.player.gold < this.state.shop.rerollCost) return;
      this.state.player = { ...this.state.player, gold: this.state.player.gold - this.state.shop.rerollCost };
    }
    this.state.shop = { ...this.state.shop, stock: rollShopStock(this.state.player.rank), lastRerollAt: Date.now() };
    this.notify();
  }

  private checkShopAutoRestock() {
    if (Date.now() - this.state.shop.lastRerollAt >= SHOP_AUTO_RESTOCK_MS) {
      this.rerollShop(true);
    }
  }

  /** Milliseconds left until the Shop's free auto-restock - the Shop tab
   *  ticks a "Free restock in mm:ss" countdown off this. */
  shopRestockMsRemaining(): number {
    return Math.max(0, SHOP_AUTO_RESTOCK_MS - (Date.now() - this.state.shop.lastRerollAt));
  }

  buyShopItem(itemId: string) {
    const item = this.state.shop.stock.find((i) => i.id === itemId);
    if (!item) return;
    const price = priceForItem(item);
    if (this.state.player.gold < price) return;
    this.state.player = { ...this.state.player, gold: this.state.player.gold - price };
    this.state.bag = [...this.state.bag, item];
    this.state.shop = { ...this.state.shop, stock: this.state.shop.stock.filter((i) => i.id !== itemId) };
    this.notify();
  }

  buyPotion(potionId: string) {
    const def = POTION_REGISTRY.get(potionId);
    if (!def || this.state.player.gold < def.cost) return;
    this.state.player = { ...this.state.player, gold: this.state.player.gold - def.cost };
    const potions = { ...this.state.inventory.potions, [potionId]: (this.state.inventory.potions[potionId] ?? 0) + 1 };
    this.state.inventory = { potions };
    this.notify();
  }

  /** The 20 explorable gates for the Gates screen's normal list - the 5
   *  Promotion Exam trials (#10) live in the same `GATE_REGISTRY` (so
   *  `startBattle`/`getGate`/loot lookups all still resolve them by id
   *  unchanged) but are filtered out here, since they're not something
   *  you browse and pick - see `examEligibleRank()`/`startPromotionExam()`
   *  for how those actually surface. */
  get gates(): GateDef[] {
    return (GATE_REGISTRY.all() as GateDef[]).filter((g) => !g.isPromotionExam);
  }

  /** O(1) gate-by-id lookup for the UI (e.g. the Gates screen resolving a
   *  clicked row's id back to its GateDef) - the same registry startBattle
   *  and grantKillRewards already use internally. Covers exam gates too,
   *  even though `gates` above hides them from the normal list. */
  getGate(id: string): GateDef | undefined {
    return GATE_REGISTRY.get(id);
  }
}
