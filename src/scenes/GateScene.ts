import Phaser from "phaser";
import { Player } from "../entities/Player";
import { Monster } from "../entities/Monster";
import { Shadow } from "../entities/Shadow";
import { monstersForRank } from "../data/monsters";
import type { MonsterTemplate, Rank, SaveData } from "../types";
import { grantXp } from "../systems/LevelSystem";
import { saveGame } from "../systems/SaveSystem";
import { RANK_ORDER, nextRank } from "../data/ranks";
import { showToast, SystemWindow } from "../ui/SystemWindow";
import { PALETTE } from "../config";

interface GateSceneData {
  rank: Rank;
}

const ARENA_MARGIN = 60;

export class GateScene extends Phaser.Scene {
  private save!: SaveData;
  private rank: Rank = "E";
  private player!: Player;
  private monsters!: Phaser.Physics.Arcade.Group;
  private shadows: Shadow[] = [];
  private monstersRemaining = 0;
  private totalMonsters = 0;
  private gateEnded = false;
  private arenaBounds!: Phaser.Geom.Rectangle;

  constructor() {
    super("Gate");
  }

  init(data: GateSceneData) {
    this.rank = data.rank ?? "E";
    this.gateEnded = false;
    this.shadows = [];
  }

  create() {
    this.save = this.game.registry.get("save") as SaveData;
    this.save.player.hp = this.save.player.maxHp;
    this.save.player.mp = this.save.player.maxMp;

    const w = this.scale.width;
    const h = this.scale.height;
    this.arenaBounds = new Phaser.Geom.Rectangle(ARENA_MARGIN, ARENA_MARGIN, w - ARENA_MARGIN * 2, h - ARENA_MARGIN * 2);

    this.buildArena();

    this.player = new Player(this, w / 2, h - ARENA_MARGIN - 60, this.save.player);
    this.player.onAttack = (range) => this.resolvePlayerAttack(range);
    this.physics.world.setBounds(this.arenaBounds.x, this.arenaBounds.y, this.arenaBounds.width, this.arenaBounds.height);
    this.player.setCollideWorldBounds(true);

    this.monsters = this.physics.add.group();
    this.spawnWave();

    this.spawnShadowsFromRoster();

    this.scene.launch("UI", { rank: this.rank, totalMonsters: this.totalMonsters });

    showToast(this, w / 2, 100, `Gate Rank ${this.rank} — Clear all threats`, "#6ee3ff");

    this.events.on("shutdown", () => this.scene.stop("UI"));
  }

  private buildArena() {
    const { x, y, width, height } = this.arenaBounds;
    const floor = this.add.tileSprite(x + width / 2, y + height / 2, width, height, "tile_floor");
    floor.setDepth(0);

    const wallThickness = 24;
    const g = this.add.graphics();
    g.setDepth(1);
    g.fillStyle(PALETTE.systemPurple, 0.5);
    g.fillRect(x - wallThickness, y - wallThickness, width + wallThickness * 2, wallThickness);
    g.fillRect(x - wallThickness, y + height, width + wallThickness * 2, wallThickness);
    g.fillRect(x - wallThickness, y, wallThickness, height);
    g.fillRect(x + width, y, wallThickness, height);
  }

  private spawnWave() {
    const pool = monstersForRank(this.rank);
    const rankIndex = RANK_ORDER.indexOf(this.rank);
    const count = 4 + rankIndex * 2;
    this.totalMonsters = count;
    this.monstersRemaining = count;

    for (let i = 0; i < count; i++) {
      const template = Phaser.Utils.Array.GetRandom(pool) as MonsterTemplate;
      const pos = this.randomArenaPoint(90);
      const monster = new Monster(this, pos.x, pos.y, template);
      this.monsters.add(monster);
    }
  }

  private spawnShadowsFromRoster() {
    const roster = this.save.shadows.slice(0, 6);
    roster.forEach((record, idx) => {
      const shadow = new Shadow(this, this.player.x - 30, this.player.y + 20, record, idx);
      this.shadows.push(shadow);
    });
  }

  private randomArenaPoint(margin: number) {
    const b = this.arenaBounds;
    return {
      x: Phaser.Math.Between(b.x + margin, b.x + b.width - margin),
      y: Phaser.Math.Between(b.y + margin, b.y + b.height - margin)
    };
  }

  private resolvePlayerAttack(range: number) {
    if (!this.player.isAlive) return;
    let hitAny = false;
    for (const child of this.monsters.getChildren()) {
      const monster = child as Monster;
      if (!monster.active || !monster.isAlive) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
      if (dist <= range) {
        hitAny = true;
        const damage = this.save.player.strength + Phaser.Math.Between(-2, 4);
        const killed = monster.takeDamage(damage);
        showToast(this, monster.x, monster.y - 20, `-${damage}`, "#ffdd66");
        if (killed) {
          this.onMonsterKilled(monster);
        }
      }
    }
    if (!hitAny) return;
  }

  private onMonsterKilled(monster: Monster) {
    this.monstersRemaining -= 1;
    const result = grantXp(this.save.player, monster.template.xpReward);
    showToast(this, monster.x, monster.y - 40, `+${monster.template.xpReward} XP`, "#4ade80");

    if (Math.random() < monster.template.extractChance && this.save.shadows.length < 12) {
      this.extractShadow(monster);
    }

    if (result.leveledUp) {
      this.showLevelUpWindow(result.levelsGained, result.rankChanged);
    }

    if (this.monstersRemaining <= 0 && !this.gateEnded) {
      this.gateEnded = true;
      this.time.delayedCall(500, () => this.showGateClearWindow());
    }
  }

  private extractShadow(monster: Monster) {
    const record = {
      id: `${monster.template.key}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `Shade of ${monster.template.name}`,
      sourceMonster: monster.template.key,
      rank: monster.template.rank,
      power: Math.max(3, Math.round(monster.template.attack * 0.5))
    };
    this.save.shadows.push(record);
    const shadow = new Shadow(this, monster.x, monster.y, record, this.shadows.length);
    this.shadows.push(shadow);
    showToast(this, monster.x, monster.y, "ARISE.", "#c084fc");
  }

  private showLevelUpWindow(levelsGained: number, rankChanged: boolean) {
    const w = this.scale.width;
    const h = this.scale.height;
    const win = new SystemWindow(this, w / 2, h / 2, 170, { title: "LEVEL UP", width: 360 });
    win.addLine(`Level ${this.save.player.level} reached${levelsGained > 1 ? ` (+${levelsGained})` : ""}`, -35);
    win.addLine(`+${levelsGained * 3} stat points available`, -5);
    if (rankChanged) {
      win.addLine(`Hunter Rank promoted to ${this.save.player.rank}!`, 25, { color: "#facc15" });
    }
    win.addButton("Continue", 60, () => win.closeWith());
    win.playIntro();
  }

  private showGateClearWindow() {
    this.save.player.gatesCleared += 1;
    const cleared = nextRank(this.rank) ?? this.rank;
    if (RANK_ORDER.indexOf(cleared) > RANK_ORDER.indexOf(this.save.highestGateRank)) {
      this.save.highestGateRank = this.rank;
    }
    saveGame(this.save);

    const w = this.scale.width;
    const h = this.scale.height;
    const win = new SystemWindow(this, w / 2, h / 2, 210, { title: "GATE CLEARED", width: 380 });
    win.addLine(`All threats in this Rank ${this.rank} gate eliminated.`, -55);
    win.addLine(`Gates cleared: ${this.save.player.gatesCleared}`, -25);
    win.addLine(`Shadows commanded: ${this.save.shadows.length}`, 0);
    win.addButton("Return to Hunter Base", 70, () => {
      win.closeWith(() => this.scene.start("MainMenu"));
    });
    win.playIntro();
  }

  private showGateFailedWindow() {
    if (this.gateEnded) return;
    this.gateEnded = true;
    saveGame(this.save);
    const w = this.scale.width;
    const h = this.scale.height;
    const win = new SystemWindow(this, w / 2, h / 2, 170, { title: "HUNTER DOWN", width: 360 });
    win.addLine("You were overwhelmed and pulled from the gate.", -30);
    win.addLine("No progress lost — rest up and try again.", 0);
    win.addButton("Return to Hunter Base", 45, () => {
      win.closeWith(() => this.scene.start("MainMenu"));
    });
    win.playIntro();
  }

  update(time: number, delta: number) {
    if (!this.player) return;
    this.player.update(time);

    let nearestMonster: Monster | null = null;
    let nearestDist = Infinity;

    for (const child of this.monsters.getChildren()) {
      const monster = child as Monster;
      if (!monster.active) continue;
      const state = monster.update(time, this.player.x, this.player.y);
      if (state === "attacking" && this.player.isAlive && monster.canAttack(time)) {
        if (this.player.takeDamage(monster.template.attack)) {
          showToast(this, this.player.x, this.player.y - 30, `-${monster.template.attack}`, "#ff6b6b");
        }
      }
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, monster.x, monster.y);
      if (monster.isAlive && dist < nearestDist) {
        nearestDist = dist;
        nearestMonster = monster;
      }
    }

    for (const shadow of this.shadows) {
      shadow.update(time, this.player.x, this.player.y, nearestMonster);
    }

    if (this.player.isAlive === false) {
      this.showGateFailedWindow();
    }
  }
}
