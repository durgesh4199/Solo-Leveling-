import { GATES_DATA, rankForLevel, statsForWave, waveCountForGate } from "./data";
import type { BattleState, GameState, GateDef, StatKey } from "./types";

/** Events the shader/particle FX layer cares about, separate from the
 *  CSS-driven battle state flags (which the DOM screens read directly). */
export type FxEvent =
  | { kind: "slash"; side: "player" | "enemy" }
  | { kind: "flurry"; side: "player" | "enemy" }
  | { kind: "guard" }
  | { kind: "shake"; intensity: "light" | "heavy" }
  | { kind: "dissolve"; side: "enemy" }
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
  inventory: { potions: 3 },
  battle: null
};

/**
 * Central game state + all mutating actions. Plain observer pattern:
 * mutate `state`, call `notify()`, the renderer re-reads state and updates
 * the DOM. No vdom/diffing - screens do targeted DOM updates so CSS
 * keyframe animations never get interrupted by node recreation.
 *
 * Each gate is a run of several waves (see data.ts): easier trash enemies
 * first, escalating stats, a boss on the final wave. HP/MP carry over
 * between waves within one gate run (only refilled when a level-up happens
 * or you start a fresh gate) - only the boss kill ends the run and offers
 * Arise.
 */
export class Game {
  state: GameState = structuredClone(INITIAL_STATE);
  private listeners = new Set<Listener>();
  private fxListeners = new Set<FxListener>();
  private vfxSeq = 0;
  private floatSeq = 0;

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

  startBattle(gate: GateDef) {
    const totalWaves = waveCountForGate(gate);
    const wave1 = statsForWave(gate, 1, totalWaves);
    this.state.player.hp = this.state.player.maxHp;
    this.state.player.mp = this.state.player.maxMp;
    this.state.screen = "battle";
    this.state.battle = {
      gateId: gate.id, gateName: gate.name, monsterKey: gate.monsterName,
      enemyName: wave1.name, enemyHp: wave1.hp, enemyMaxHp: wave1.hp,
      enemyAtk: wave1.atk, enemyDef: wave1.def, xpReward: wave1.xp,
      waveIndex: 1, totalWaves, isBoss: totalWaves === 1,
      over: false, result: null, guarding: false, locked: false,
      enemyHit: false, playerHit: false
    };
    this.notify();
  }

  private playVfx(battle: BattleState, opts: { enemy?: "slash" | "flurry"; player?: "slash" | "flurry"; guard?: boolean; lunge?: "player" | "enemy"; flash?: boolean }) {
    this.vfxSeq += 1;
    const id = this.vfxSeq;
    battle.vfxId = id;
    battle.vfxEnemy = opts.enemy ?? null;
    battle.vfxPlayer = opts.player ?? null;
    battle.guardRing = !!opts.guard;
    battle.lunge = opts.lunge ?? null;
    battle.flash = !!opts.flash;

    if (opts.enemy) this.emitFx({ kind: opts.enemy, side: "enemy" });
    if (opts.player) this.emitFx({ kind: opts.player, side: "player" });
    if (opts.guard) this.emitFx({ kind: "guard" });
    if (opts.flash) this.emitFx({ kind: "shake", intensity: opts.enemy === "flurry" || opts.player === "flurry" ? "heavy" : "light" });

    setTimeout(() => {
      if (this.state.battle && this.state.battle.vfxId === id) {
        this.state.battle = { ...this.state.battle, lunge: null, flash: false };
        this.notify();
      }
    }, 380);
    setTimeout(() => {
      if (this.state.battle && this.state.battle.vfxId === id) {
        this.state.battle = { ...this.state.battle, vfxEnemy: null, vfxPlayer: null, guardRing: false };
        this.notify();
      }
    }, 900);
  }

  private triggerFloat(battle: BattleState, side: "player" | "enemy", text: string, kind: "dmg" | "heal") {
    const floatKey = side === "enemy" ? "floatEnemy" : "floatPlayer";
    const glowKey = side === "enemy" ? "enemyGlow" : "playerGlow";
    (battle as any)[floatKey] = { text, kind };
    (battle as any)[glowKey] = true;
    this.floatSeq += 1;
    const id = this.floatSeq;
    (battle as any)[`${floatKey}Id`] = id;

    setTimeout(() => {
      if (this.state.battle && (this.state.battle as any)[`${floatKey}Id`] === id) {
        this.state.battle = { ...this.state.battle, [floatKey]: null } as BattleState;
        this.notify();
      }
    }, 900);
    setTimeout(() => {
      if (this.state.battle) {
        this.state.battle = { ...this.state.battle, [glowKey]: false } as BattleState;
        this.notify();
      }
    }, 450);
  }

  private enemyTurn(battle: BattleState) {
    if (battle.over) return;
    const player = { ...this.state.player };
    let dmg = Math.max(1, Math.round(battle.enemyAtk + (Math.random() * 6 - 3)));
    const wasGuarding = battle.guarding;
    if (wasGuarding) dmg = Math.round(dmg * 0.4);
    this.playVfx(battle, { player: "slash", lunge: "enemy", flash: true, guard: wasGuarding });
    player.hp = Math.max(0, player.hp - dmg);
    battle.guarding = false;
    battle.playerHit = true;
    this.triggerFloat(battle, "player", `-${dmg}`, "dmg");
    if (player.hp <= 0) {
      battle.over = true;
      battle.result = "defeat";
    }
    battle.locked = false;
    this.state.player = player;
    this.state.battle = { ...battle };
    this.notify();
    setTimeout(() => {
      if (this.state.battle) {
        this.state.battle = { ...this.state.battle, playerHit: false };
        this.notify();
      }
    }, 250);
  }

  /** Applies damage to the current enemy; returns true if it died. */
  private resolvePlayerHit(battle: BattleState, dmg: number): boolean {
    battle.enemyHp = Math.max(0, battle.enemyHp - dmg);
    battle.enemyHit = true;
    this.triggerFloat(battle, "enemy", `-${dmg}`, "dmg");
    const defeated = battle.enemyHp <= 0;
    if (defeated) this.emitFx({ kind: "dissolve", side: "enemy" });
    return defeated;
  }

  /** Adds XP, rolling over levels (each grants stat points + a full
   *  heal - a welcome mid-run second wind on longer gates). Returns
   *  whether a level-up happened. */
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

  /** Called right after an enemy's HP hits 0: grants that wave's XP, then
   *  either ends the gate (boss) or brings in the next wave (trash). */
  private onEnemyDefeated(defeatedBattle: BattleState) {
    const leveled = this.grantXp(defeatedBattle.xpReward);
    if (leveled) this.emitFx({ kind: "levelup" });

    if (defeatedBattle.isBoss) {
      this.state.gatesCleared = { ...this.state.gatesCleared, [defeatedBattle.gateId]: true };
      this.state.battle = { ...defeatedBattle, over: true, result: "victory" };
      this.notify();
    } else {
      setTimeout(() => this.advanceWave(), 900);
    }
  }

  private advanceWave() {
    const battle = this.state.battle;
    if (!battle || battle.over) return;
    const gate = GATES_DATA.find((g) => g.id === battle.gateId);
    if (!gate) return;
    const nextIndex = battle.waveIndex + 1;
    const stats = statsForWave(gate, nextIndex, battle.totalWaves);
    this.state.battle = {
      ...battle,
      waveIndex: nextIndex,
      isBoss: nextIndex === battle.totalWaves,
      enemyName: stats.name,
      enemyHp: stats.hp, enemyMaxHp: stats.hp,
      enemyAtk: stats.atk, enemyDef: stats.def,
      xpReward: stats.xp,
      locked: false,
      enemyHit: false, playerHit: false,
      vfxEnemy: null, vfxPlayer: null, guardRing: false, lunge: null, flash: false,
      floatEnemy: null, floatPlayer: null, enemyGlow: false, playerGlow: false
    };
    this.notify();
  }

  battleAttack() {
    const battle = this.state.battle ? { ...this.state.battle } : null;
    if (!battle || battle.over || battle.locked) return;
    battle.locked = true;
    const dmg = Math.max(1, Math.round(6 + this.state.player.str * 1.1 - battle.enemyDef + (Math.random() * 4 - 2)));
    this.playVfx(battle, { enemy: "slash", lunge: "player", flash: true });
    const defeated = this.resolvePlayerHit(battle, dmg);
    this.state.battle = battle;
    this.notify();
    setTimeout(() => {
      if (this.state.battle) {
        this.state.battle = { ...this.state.battle, enemyHit: false };
        this.notify();
      }
    }, 250);
    if (defeated) this.onEnemyDefeated(battle);
    else setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  battleSkill() {
    const battle = this.state.battle ? { ...this.state.battle } : null;
    if (!battle || battle.over || battle.locked || this.state.player.mp < 15) return;
    battle.locked = true;
    const player = { ...this.state.player, mp: this.state.player.mp - 15 };
    const dmg = Math.max(1, Math.round(14 + player.str * 1.6 - battle.enemyDef + (Math.random() * 4 - 2)));
    this.playVfx(battle, { enemy: "flurry", lunge: "player", flash: true });
    const defeated = this.resolvePlayerHit(battle, dmg);
    this.state.battle = battle;
    this.state.player = player;
    this.notify();
    setTimeout(() => {
      if (this.state.battle) {
        this.state.battle = { ...this.state.battle, enemyHit: false };
        this.notify();
      }
    }, 250);
    if (defeated) this.onEnemyDefeated(battle);
    else setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  battleGuard() {
    const battle = this.state.battle ? { ...this.state.battle } : null;
    if (!battle || battle.over || battle.locked) return;
    battle.locked = true;
    battle.guarding = true;
    this.playVfx(battle, { guard: true });
    this.state.battle = battle;
    this.notify();
    setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  battleItem() {
    const battle = this.state.battle ? { ...this.state.battle } : null;
    if (!battle || battle.over || battle.locked || this.state.inventory.potions <= 0) return;
    battle.locked = true;
    const player = { ...this.state.player };
    player.hp = Math.min(player.maxHp, player.hp + 30);
    const inventory = { ...this.state.inventory, potions: this.state.inventory.potions - 1 };
    this.triggerFloat(battle, "player", "+30", "heal");
    this.state.battle = battle;
    this.state.player = player;
    this.state.inventory = inventory;
    this.notify();
    setTimeout(() => this.enemyTurn(this.state.battle!), 650);
  }

  ariseShadow() {
    const battle = this.state.battle;
    if (!battle) return;
    const shadow = {
      id: `${battle.gateId}-${Date.now()}`,
      name: `Shadow of the ${battle.enemyName}`,
      rank: rankForLevel(this.state.player.level),
      type: battle.monsterKey
    };
    this.emitFx({ kind: "portal" });
    this.state.shadowArmy = [...this.state.shadowArmy, shadow];
    this.state.screen = "gates";
    this.state.battle = null;
    this.notify();
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
