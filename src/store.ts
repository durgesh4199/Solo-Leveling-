import { GATES_DATA, SKILLS, buildWavePlan, rankForLevel, statsForBoss, statsForUnit, totalEnemiesForGate } from "./data";
import type { BattleState, EnemyUnit, FloatKind, GameState, GateDef, LungeSide, StatKey, VfxKind, WavePlanEntry } from "./types";

/** Events the shader/particle FX layer cares about, separate from the
 *  CSS-driven battle state flags (which the DOM screens read directly).
 *  `targetUid` identifies which enemy slot an enemy-side effect belongs to
 *  (a wave can have up to 3 simultaneous enemies). */
export type FxEvent =
  | { kind: "slash"; side: "player" | "enemy"; targetUid?: string }
  | { kind: "flurry"; side: "player" | "enemy"; targetUid?: string }
  | { kind: "guard" }
  | { kind: "shake"; intensity: "light" | "heavy" }
  | { kind: "dissolve"; side: "enemy"; targetUid?: string }
  | { kind: "portal" }
  | { kind: "levelup" };

type Listener = () => void;
type FxListener = (e: FxEvent) => void;

const INITIAL_STATE: GameState = {
  screen: "title",
  player: {
    name: "Hunter", level: 1, xp: 0, xpToNext: 100,
    hp: 100, maxHp: 100, mp: 30, maxMp: 30,
    statPoints: 0, str: 10, agi: 10, int: 10, vit: 10, per: 10
  },
  gatesCleared: {},
  shadowArmy: [],
  inventory: { potions: 5 },
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
 */
export class Game {
  state: GameState = structuredClone(INITIAL_STATE);
  private listeners = new Set<Listener>();
  private fxListeners = new Set<FxListener>();
  private vfxSeq = 0;
  private floatSeq = 0;
  private unitSeq = 0;

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

  // ---- wave/enemy construction ----

  private freshUnit(hp: number, atk: number, def: number, xp: number): EnemyUnit {
    this.unitSeq += 1;
    return {
      uid: `u${this.unitSeq}`, hp, maxHp: hp, atk, def, xp,
      alive: true, hit: false, vfx: null, lunging: false,
      floatText: null, floatId: 0, glow: false
    };
  }

  private makeEnemies(gate: GateDef, entry: WavePlanEntry, trashCount: number): EnemyUnit[] {
    if (entry.isBoss) {
      const s = statsForBoss(gate);
      return [this.freshUnit(s.hp, s.atk, s.def, s.xp)];
    }
    const units: EnemyUnit[] = [];
    for (let i = 0; i < entry.count; i++) {
      const s = statsForUnit(gate, entry.unitStart + i, trashCount);
      units.push(this.freshUnit(s.hp, s.atk, s.def, s.xp));
    }
    return units;
  }

  startBattle(gate: GateDef) {
    const plan = buildWavePlan(gate);
    const trashCount = totalEnemiesForGate(gate) - 1;
    const entry = plan[0];
    this.state.player.hp = this.state.player.maxHp;
    this.state.player.mp = this.state.player.maxMp;
    this.state.screen = "battle";
    this.state.battle = {
      gateId: gate.id, gateName: gate.name, monsterKey: gate.monsterName,
      enemyName: entry.isBoss ? gate.bossName : gate.monsterName,
      isBossWave: entry.isBoss,
      waveIndex: 1, totalWaves: plan.length,
      enemies: this.makeEnemies(gate, entry, trashCount),
      over: false, result: null, guarding: false, locked: false,
      playerHit: false, skillPanelOpen: false
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
    this.state.battle = {
      ...battle,
      waveIndex: battle.waveIndex + 1,
      isBossWave: entry.isBoss,
      enemyName: entry.isBoss ? gate.bossName : gate.monsterName,
      enemies: this.makeEnemies(gate, entry, trashCount),
      over: false, result: null, locked: false, guarding: false,
      playerHit: false, skillPanelOpen: false,
      vfxPlayer: null, guardRing: false, lunge: null, flash: false,
      floatPlayer: null, playerGlow: false
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
    if (opts.guard) this.emitFx({ kind: "guard" });
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

  /** Adds XP, rolling over levels (each grants stat points + a full
   *  heal - a welcome mid-run second wind). Returns whether a level-up
   *  happened. */
  private grantXp(amount: number): boolean {
    const player = { ...this.state.player };
    player.xp += amount;
    let leveled = false;
    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      player.xpToNext = Math.round(player.xpToNext * 1.25);
      player.maxHp += 15; player.maxMp += 5;
      player.hp = player.maxHp; player.mp = player.maxMp;
      player.statPoints += 3;
      leveled = true;
    }
    this.state.player = player;
    return leveled;
  }

  /** Applies damage to one enemy unit; grants its XP and fires the
   *  dissolve fx if it dies. */
  private applyDamage(battle: BattleState, unit: EnemyUnit, dmg: number) {
    unit.hp = Math.max(0, unit.hp - dmg);
    unit.hit = true;
    this.triggerUnitFloat(unit, `-${dmg}`, "dmg");
    if (unit.hp <= 0 && unit.alive) {
      unit.alive = false;
      const leveled = this.grantXp(unit.xp);
      if (leveled) this.emitFx({ kind: "levelup" });
      this.emitFx({ kind: "dissolve", side: "enemy", targetUid: unit.uid });
    }
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

  private enemyTurn(startBattle: BattleState) {
    const wasGuardingRound = startBattle.guarding;
    const attackers = startBattle.enemies.filter((u) => u.alive).map((u) => u.uid);

    const step = (i: number) => {
      const battle = this.state.battle;
      if (!battle || battle.over) return;
      if (i >= attackers.length) {
        this.state.battle = { ...battle, guarding: false, locked: false };
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
      let dmg = Math.max(1, Math.round(attacker.atk + (Math.random() * 6 - 3)));
      if (wasGuardingRound) dmg = Math.round(dmg * 0.4);

      attacker.lunging = true;
      next.vfxPlayer = "slash";
      next.lunge = null;
      this.emitFx({ kind: "slash", side: "player" });
      this.emitFx({ kind: "shake", intensity: "light" });

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

  battleAttack() {
    const src = this.state.battle;
    if (!src || src.over || src.locked) return;
    const battle = this.cloneBattle(src);
    const target = this.currentTarget(battle);
    if (!target) return;
    battle.locked = true;
    const dmg = Math.max(1, Math.round(6 + this.state.player.str * 1.1 - target.def + (Math.random() * 4 - 2)));
    this.playPlayerVfx(battle, { lunge: "player", flash: true });
    this.setUnitVfx(target, "slash");
    this.applyDamage(battle, target, dmg);
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
      let dmg = Math.max(1, Math.round(skillDef.base + player.str * skillDef.scale - target.def + (Math.random() * 4 - 2)));
      if (skillDef.kind === "execute" && target.hp <= target.maxHp * 0.3) dmg *= 2;
      this.setUnitVfx(target, skillDef.kind === "single" ? "slash" : "flurry");
      this.applyDamage(battle, target, dmg);
      this.clearHitFlagLater(target.uid);
    }

    this.state.battle = battle;
    this.state.player = player;
    this.notify();
    if (battle.enemies.every((u) => !u.alive)) this.onWaveCleared(battle);
    else setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  toggleSkillPanel() {
    const b = this.state.battle;
    if (!b || b.over || b.locked) return;
    this.state.battle = { ...b, skillPanelOpen: !b.skillPanelOpen };
    this.notify();
  }

  battleGuard() {
    const src = this.state.battle;
    if (!src || src.over || src.locked) return;
    const battle = this.cloneBattle(src);
    battle.locked = true;
    battle.guarding = true;
    battle.skillPanelOpen = false;
    this.playPlayerVfx(battle, { guard: true });
    this.state.battle = battle;
    this.notify();
    setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  battleItem() {
    const src = this.state.battle;
    if (!src || src.over || src.locked || this.state.inventory.potions <= 0) return;
    const battle = this.cloneBattle(src);
    battle.locked = true;
    battle.skillPanelOpen = false;
    const player = { ...this.state.player };
    player.hp = Math.min(player.maxHp, player.hp + 35);
    const inventory = { ...this.state.inventory, potions: this.state.inventory.potions - 1 };
    this.triggerFloatPlayer(battle, "+35", "heal");
    this.state.battle = battle;
    this.state.player = player;
    this.state.inventory = inventory;
    this.notify();
    setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  ariseShadow() {
    const battle = this.state.battle;
    if (!battle || (battle.result !== "wave-clear" && battle.result !== "gate-clear")) return;
    const shadow = {
      id: `${battle.gateId}-w${battle.waveIndex}-${Date.now()}`,
      name: `Shadow of the ${battle.enemyName}`,
      rank: rankForLevel(this.state.player.level),
      type: battle.monsterKey
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

  addStat(stat: StatKey) {
    if (this.state.player.statPoints <= 0) return;
    const player = { ...this.state.player };
    player[stat] += 1;
    player.statPoints -= 1;
    this.state.player = player;
    this.notify();
  }

  get gates(): GateDef[] {
    return GATES_DATA;
  }
}
