import { GATES_DATA, POTIONS, STAT_TUNING, SHADOW_RANK_POWER, SKILLS, buildWavePlan, generateLoot, priceForItem, rankForLevel, rollGateModifier, rollRarity, rollShopStock, statsForBoss, statsForUnit, totalEnemiesForGate } from "./data";
import type { BattleState, BattleToast, EnemyAction, EnemyUnit, FloatKind, GameState, GateDef, GateModifier, ItemSlot, LungeSide, StatKey, VfxKind, WavePlanEntry } from "./types";

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

const INITIAL_STATE: GameState = {
  screen: "title",
  player: {
    name: "Hunter", level: 1, xp: 0, xpToNext: 80,
    hp: 100, maxHp: 100, mp: 30, maxMp: 30,
    statPoints: 0, str: 10, agi: 10, int: 10, vit: 10, per: 10,
    gold: 0, equipment: {}
  },
  gatesCleared: {},
  shadowArmy: [],
  inventory: { potions: { hp_minor: 3, mp_minor: 1 } },
  bag: [],
  shop: { stock: [], rerollCost: 60 },
  battle: null
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

  constructor() {
    // First stock is free - a fresh Hunter shouldn't open the Shop to
    // nothing for sale.
    this.rerollShop(true);
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
    for (const fn of this.listeners) fn();
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

  /** Base stat + whatever's equipped in every slot that boosts it. Public -
   *  the battle UI reads this too, for the combat-details readout. */
  effectiveStat(key: StatKey): number {
    const p = this.state.player;
    let value = p[key];
    for (const item of Object.values(p.equipment)) {
      if (item && item.statKey === key) value += item.statBonus;
    }
    return value;
  }

  /** 0..1 chance any given Attack/Skill hit crits. */
  get critChance(): number {
    return Math.min(0.5, 0.08 + this.effectiveStat("agi") * STAT_TUNING.agiCritPerPoint + this.effectiveStat("per") * STAT_TUNING.perCritPerPoint);
  }

  private rollCrit(): boolean {
    return Math.random() < this.critChance;
  }

  // ---- wave/enemy construction ----

  private freshUnit(hp: number, atk: number, def: number, xp: number, gold: number, isElite: boolean): EnemyUnit {
    this.unitSeq += 1;
    return {
      uid: `u${this.unitSeq}`, hp, maxHp: hp, atk, def, xp, gold, isElite,
      alive: true, hit: false, vfx: null, lunging: false,
      floatText: null, floatId: 0, glow: false, guardRounds: 0
    };
  }

  private makeEnemies(gate: GateDef, entry: WavePlanEntry, trashCount: number, modifier: GateModifier): EnemyUnit[] {
    if (entry.isBoss) {
      const s = statsForBoss(gate);
      const hp = Math.round(s.hp * modifier.enemyHpMult);
      const atk = Math.round(s.atk * modifier.enemyAtkMult);
      const gold = Math.round(s.xp * 0.9);
      return [this.freshUnit(hp, atk, s.def, s.xp, gold, false)];
    }
    const units: EnemyUnit[] = [];
    for (let i = 0; i < entry.count; i++) {
      const s = statsForUnit(gate, entry.unitStart + i, trashCount);
      const isElite = Math.random() < 0.12;
      const eliteMult = isElite ? 1.6 : 1;
      const hp = Math.round(s.hp * eliteMult * modifier.enemyHpMult);
      const atk = Math.round(s.atk * eliteMult * modifier.enemyAtkMult);
      const xp = Math.round(s.xp * (isElite ? 1.8 : 1));
      const gold = Math.round(xp * 0.6);
      units.push(this.freshUnit(hp, atk, s.def, xp, gold, isElite));
    }
    return units;
  }

  startBattle(gate: GateDef) {
    const plan = buildWavePlan(gate);
    const trashCount = totalEnemiesForGate(gate) - 1;
    const entry = plan[0];
    const modifier = rollGateModifier();
    this.state.player.hp = this.state.player.maxHp;
    this.state.player.mp = this.state.player.maxMp;
    this.state.screen = "battle";
    this.state.battle = {
      gateId: gate.id, gateName: gate.name, monsterKey: gate.monsterName,
      enemyName: entry.isBoss ? gate.bossName : gate.monsterName,
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
    const gate = GATES_DATA.find((g) => g.id === battle.gateId);
    if (!gate) return;
    const plan = buildWavePlan(gate);
    const trashCount = totalEnemiesForGate(gate) - 1;
    const nextIdx0 = battle.waveIndex; // current waveIndex is 1-based; next 0-based entry is the same number
    if (nextIdx0 >= plan.length) return;
    const entry = plan[nextIdx0];
    const modifier = battle.modifier ?? rollGateModifier();
    this.state.battle = {
      ...battle,
      waveIndex: battle.waveIndex + 1,
      isBossWave: entry.isBoss,
      enemyName: entry.isBoss ? gate.bossName : gate.monsterName,
      enemies: this.makeEnemies(gate, entry, trashCount, modifier),
      over: false, result: null, locked: false, guardRounds: 0,
      playerHit: false, skillPanelOpen: false, itemPanelOpen: false,
      vfxPlayer: null, guardRing: false, lunge: null, flash: false,
      floatPlayer: null, playerGlow: false, shadowLunge: false
    };
    this.notify();
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
   *  points). Deliberately does *not* top off current HP/MP - leveling up
   *  mid-fight is a milestone, not a free heal, so a level-up in a rough
   *  battle still leaves you in that rough battle. Returns whether a
   *  level-up happened. */
  private grantXp(amount: number): boolean {
    const player = { ...this.state.player };
    player.xp += amount;
    let leveled = false;
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      // 1.18 (was 1.25) - a gentler curve, so leveling stays frequent deep into a run.
      player.xpToNext = Math.round(player.xpToNext * 1.18);
      player.maxHp += 15; player.maxMp += 5;
      player.statPoints += 3;
      leveled = true;
    }
    this.state.player = player;
    return leveled;
  }

  /** Gold + a chance at loot on a kill. Elites, bosses, and "generous"
   *  gate modifiers all push the odds and rarity up. */
  private grantKillRewards(battle: BattleState, unit: EnemyUnit) {
    if (unit.gold > 0) {
      this.state.player = { ...this.state.player, gold: this.state.player.gold + unit.gold };
    }

    const modifier = battle.modifier;
    const lootBonus = (modifier?.loot ?? 0) + (unit.isElite ? 0.35 : 0) + (battle.isBossWave ? 1 : 0);
    const baseChance = battle.isBossWave ? 1 : 0.22;
    const chance = Math.min(1, baseChance + lootBonus);
    if (Math.random() >= chance) return;

    const rarityBonus = (unit.isElite ? 0.15 : 0) + (battle.isBossWave ? 0.3 : 0);
    const rarity = rollRarity(rarityBonus);
    const gate = GATES_DATA.find((g) => g.id === battle.gateId);
    const item = generateLoot(gate?.rank ?? "E", rarity);
    this.state.bag = [...this.state.bag, item];
    this.showBattleToast(battle, { text: item.name, kind: "loot", rarity });
  }

  /** Applies damage to one enemy unit; grants its XP/gold/loot and fires
   *  the dissolve fx if it dies. A unit currently guarding (AI-chosen)
   *  halves the hit and spends one round of its guard on it. */
  private applyDamage(battle: BattleState, unit: EnemyUnit, dmg: number, isCrit = false) {
    if (unit.guardRounds > 0) {
      dmg = Math.max(1, Math.round(dmg * 0.5));
      unit.guardRounds -= 1;
    }
    unit.hp = Math.max(0, unit.hp - dmg);
    unit.hit = true;
    this.triggerUnitFloat(unit, `-${dmg}`, isCrit ? "crit" : "dmg");
    if (unit.hp <= 0 && unit.alive) {
      unit.alive = false;
      const leveled = this.grantXp(Math.round(unit.xp * (battle.modifier?.xpMult ?? 1)));
      if (leveled) this.emitFx({ kind: "levelup" });
      this.emitFx({ kind: "dissolve", side: "enemy", targetUid: unit.uid });
      this.grantKillRewards(battle, unit);
    }
  }

  /** A deployed Shadow auto-assists every player action, striking whatever
   *  is currently targeted right after the player's own hit lands - with
   *  its own lunge animation so it visibly joins the fight too. */
  private companionStrike(battle: BattleState) {
    const shadow = this.state.shadowArmy.find((s) => s.deployed);
    if (!shadow) return;
    const target = this.currentTarget(battle);
    if (!target) return;
    const dmg = Math.max(1, Math.round(shadow.power + (Math.random() * 4 - 2) - target.def * 0.5));
    this.setUnitVfx(target, "slash");
    this.applyDamage(battle, target, dmg);
    this.clearHitFlagLater(target.uid);

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
    if (battle.isBossWave) {
      this.state.gatesCleared = { ...this.state.gatesCleared, [battle.gateId]: true };
      this.state.battle = { ...battle, over: true, result: "gate-clear", locked: false };
    } else {
      this.state.battle = { ...battle, over: true, result: "wave-clear", locked: false };
    }
    this.notify();
  }

  /** Chooses what an attacking enemy does this round. Not pure chance:
   *  a badly hurt unit is more likely to turtle up, and any unit is more
   *  likely to bust out its special the instant the player is guarding -
   *  it's the difference between "smarter" and "random". */
  private decideEnemyAction(unit: EnemyUnit, battle: BattleState, playerGuarding: boolean): EnemyAction {
    const threatening = unit.isElite || battle.isBossWave;
    const lowHp = unit.hp < unit.maxHp * 0.3;
    const guardChance = 0.12 + (lowHp ? 0.15 : 0);
    const specialChance = (threatening ? 0.28 : 0.16) + (playerGuarding ? 0.15 : 0);
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
      const action = this.decideEnemyAction(attacker, next, wasGuardingRound);

      if (action === "guard") {
        attacker.guardRounds = 1;
        this.emitFx({ kind: "guard", side: "enemy", targetUid: attacker.uid });
        this.showBattleToast(next, { text: `${next.enemyName} braces for impact`, kind: "info" });
        this.state.battle = next;
        this.notify();
        setTimeout(() => step(i + 1), 480);
        return;
      }

      const isSpecial = action === "special";
      let dmg = Math.max(1, Math.round(attacker.atk * (isSpecial ? 1.7 : 1) + (Math.random() * 6 - 3)));
      if (wasGuardingRound) dmg = Math.round(dmg * (isSpecial ? 0.75 : 0.4));

      attacker.lunging = true;
      // "smash" is its own vfx (a red shockwave ring, not the flurry slashes
      // a player crit uses) - a special reads as a distinct kind of threat,
      // not just "the same hit, but harder".
      next.vfxPlayer = isSpecial ? "smash" : "slash";
      next.lunge = null;
      this.emitFx({ kind: isSpecial ? "smash" : "slash", side: "player" });
      this.emitFx({ kind: "shake", intensity: isSpecial ? "heavy" : "light" });
      if (isSpecial) this.showBattleToast(next, { text: `${next.enemyName} unleashes a fierce strike!`, kind: "info" });

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

    const isCrit = this.rollCrit();
    let dmg = Math.max(1, Math.round(6 + this.effectiveStat("str") * STAT_TUNING.strAtkPerPoint - target.def + (Math.random() * 4 - 2)));
    if (isCrit) dmg = Math.round(dmg * 1.8);
    this.playPlayerVfx(battle, { lunge: "player", flash: true, heavy: isCrit });
    this.setUnitVfx(target, isCrit ? "flurry" : "slash");
    this.applyDamage(battle, target, dmg, isCrit);
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
    const skillDef = SKILLS.find((s) => s.key === skillKey);
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
    for (const target of targets) {
      const isCrit = this.rollCrit();
      let dmg = Math.max(1, Math.round(skillDef.base + str * skillDef.scale - target.def + (Math.random() * 4 - 2)));
      if (skillDef.kind === "execute" && target.hp <= target.maxHp * 0.3) dmg *= 2;
      if (isCrit) dmg = Math.round(dmg * 1.8);
      this.setUnitVfx(target, skillDef.kind === "single" && !isCrit ? "slash" : "flurry");
      this.applyDamage(battle, target, dmg, isCrit);
      this.clearHitFlagLater(target.uid);
    }
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
    const def = POTIONS.find((p) => p.id === potionId);
    if (!def) return;

    const battle = this.cloneBattle(src);
    battle.locked = true;
    battle.itemPanelOpen = false;
    const player = { ...this.state.player };
    if (def.kind === "hp") player.hp = Math.min(player.maxHp, player.hp + def.amount);
    else player.mp = Math.min(player.maxMp, player.mp + def.amount);
    const potions = { ...this.state.inventory.potions, [potionId]: count - 1 };
    this.triggerFloatPlayer(battle, `+${def.amount}`, "heal");
    this.state.battle = battle;
    this.state.player = player;
    this.state.inventory = { potions };
    this.notify();
    setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  ariseShadow() {
    const battle = this.state.battle;
    if (!battle || (battle.result !== "wave-clear" && battle.result !== "gate-clear")) return;
    const rank = rankForLevel(this.state.player.level);
    const shadow = {
      id: `${battle.gateId}-w${battle.waveIndex}-${Date.now()}`,
      name: `Shadow of the ${battle.enemyName}`,
      rank,
      type: battle.monsterKey,
      power: SHADOW_RANK_POWER[rank],
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
    this.notify();
  }

  unequipItem(slot: ItemSlot) {
    const player = { ...this.state.player, equipment: { ...this.state.player.equipment } };
    const item = player.equipment[slot];
    if (!item) return;
    delete player.equipment[slot];
    this.state.player = player;
    this.state.bag = [...this.state.bag, item];
    this.notify();
  }

  discardItem(itemId: string) {
    this.state.bag = this.state.bag.filter((i) => i.id !== itemId);
    this.notify();
  }

  /** Rerolls the Shop's equipment stock at the player's current rank.
   *  `free` skips the gold cost - used only for the very first stock. */
  rerollShop(free = false) {
    if (!free) {
      if (this.state.player.gold < this.state.shop.rerollCost) return;
      this.state.player = { ...this.state.player, gold: this.state.player.gold - this.state.shop.rerollCost };
    }
    const rank = rankForLevel(this.state.player.level);
    this.state.shop = { ...this.state.shop, stock: rollShopStock(rank) };
    this.notify();
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
    const def = POTIONS.find((p) => p.id === potionId);
    if (!def || this.state.player.gold < def.cost) return;
    this.state.player = { ...this.state.player, gold: this.state.player.gold - def.cost };
    const potions = { ...this.state.inventory.potions, [potionId]: (this.state.inventory.potions[potionId] ?? 0) + 1 };
    this.state.inventory = { potions };
    this.notify();
  }

  get gates(): GateDef[] {
    return GATES_DATA;
  }
}
