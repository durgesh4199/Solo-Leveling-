import Phaser from "phaser";
import type { MonsterTemplate } from "../types";

const AGGRO_RANGE = 220;
const ATTACK_RANGE = 30;
const ATTACK_COOLDOWN_MS = 900;

export class Monster extends Phaser.Physics.Arcade.Sprite {
  template: MonsterTemplate;
  hp: number;
  private lastAttackAt = 0;
  private hpBar: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, x: number, y: number, template: MonsterTemplate) {
    super(scene, x, y, `m_${template.key}`);
    this.template = template;
    this.hp = template.maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(this.width * 0.28, this.width * 0.22, this.height * 0.22);
    this.setDepth(9);

    this.hpBar = scene.add.graphics();
    this.hpBar.setDepth(11);
    this.drawHpBar();
  }

  get isAlive() {
    return this.hp > 0;
  }

  private drawHpBar() {
    this.hpBar.clear();
    if (!this.isAlive) return;
    const w = 32;
    const pct = Phaser.Math.Clamp(this.hp / this.template.maxHp, 0, 1);
    const x = this.x - w / 2;
    const y = this.y - this.height / 2 - 10;
    this.hpBar.fillStyle(0x000000, 0.6);
    this.hpBar.fillRect(x, y, w, 5);
    this.hpBar.fillStyle(pct > 0.5 ? 0x4ade80 : pct > 0.25 ? 0xfacc15 : 0xef4444, 1);
    this.hpBar.fillRect(x, y, w * pct, 5);
  }

  update(time: number, playerX: number, playerY: number): "idle" | "chasing" | "attacking" {
    if (!this.isAlive) {
      this.hpBar.clear();
      return "idle";
    }
    this.drawHpBar();

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < ATTACK_RANGE) {
      this.setVelocity(0, 0);
      return "attacking";
    }

    if (dist < AGGRO_RANGE) {
      const len = dist || 1;
      this.setVelocity((dx / len) * this.template.speed, (dy / len) * this.template.speed);
      this.setFlipX(dx < 0);
      return "chasing";
    }

    this.setVelocity(0, 0);
    return "idle";
  }

  canAttack(time: number): boolean {
    if (time - this.lastAttackAt < ATTACK_COOLDOWN_MS) return false;
    this.lastAttackAt = time;
    return true;
  }

  takeDamage(amount: number): boolean {
    if (!this.isAlive) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    this.drawHpBar();
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die() {
    this.hpBar.clear();
    this.setVelocity(0, 0);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.4,
      duration: 220,
      onComplete: () => {
        this.destroy();
      }
    });
    if (this.body) {
      (this.body as Phaser.Physics.Arcade.Body).enable = false;
    }
  }

  destroy(fromScene?: boolean) {
    this.hpBar.destroy();
    super.destroy(fromScene);
  }
}
