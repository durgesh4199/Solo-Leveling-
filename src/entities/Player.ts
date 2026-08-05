import Phaser from "phaser";
import type { PlayerStats } from "../types";

const ATTACK_COOLDOWN_MS = 380;
const ATTACK_RANGE = 46;
const INVULN_MS = 500;
const BASE_SPEED = 165;

export class Player extends Phaser.Physics.Arcade.Sprite {
  stats: PlayerStats;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys: { w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key; space: Phaser.Input.Keyboard.Key };
  private lastAttackAt = 0;
  private lastHitAt = 0;
  attackRange = ATTACK_RANGE;
  onAttack?: (range: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number, stats: PlayerStats) {
    super(scene, x, y, "player");
    this.stats = stats;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(11, 9, 11);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    };

    scene.input.on("pointerdown", () => this.tryAttack());
  }

  get isAlive() {
    return this.stats.hp > 0;
  }

  update(time: number) {
    if (!this.isAlive) {
      this.setVelocity(0, 0);
      return;
    }

    const left = this.cursors.left?.isDown || this.keys.a.isDown;
    const right = this.cursors.right?.isDown || this.keys.d.isDown;
    const up = this.cursors.up?.isDown || this.keys.w.isDown;
    const down = this.cursors.down?.isDown || this.keys.s.isDown;

    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;

    const speed = BASE_SPEED + this.stats.agility * 3;
    if (vx !== 0 || vy !== 0) {
      const len = Math.hypot(vx, vy);
      this.setVelocity((vx / len) * speed, (vy / len) * speed);
      if (vx !== 0) this.setFlipX(vx < 0);
    } else {
      this.setVelocity(0, 0);
    }

    if ((Phaser.Input.Keyboard.JustDown(this.keys.space) || time - this.lastAttackAt < 0) && time - this.lastAttackAt > ATTACK_COOLDOWN_MS) {
      this.tryAttack();
    }
  }

  tryAttack() {
    const time = this.scene.time.now;
    if (!this.isAlive) return;
    if (time - this.lastAttackAt < ATTACK_COOLDOWN_MS) return;
    this.lastAttackAt = time;
    this.onAttack?.(this.attackRange);

    // quick lunge flash for feedback
    this.scene.tweens.add({
      targets: this,
      scale: 1.15,
      duration: 70,
      yoyo: true
    });
  }

  takeDamage(amount: number): boolean {
    const time = this.scene.time.now;
    if (time - this.lastHitAt < INVULN_MS) return false;
    this.lastHitAt = time;
    this.stats.hp = Math.max(0, this.stats.hp - amount);
    this.setTint(0xff5a5a);
    this.scene.time.delayedCall(120, () => this.clearTint());
    this.scene.cameras.main.shake(120, 0.004);
    return true;
  }
}
