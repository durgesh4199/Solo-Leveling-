import Phaser from "phaser";
import type { ShadowRecord } from "../types";

const FOLLOW_DISTANCE = 46;
const ENGAGE_RANGE = 160;
const ATTACK_RANGE = 34;
const ATTACK_COOLDOWN_MS = 700;

/**
 * An "arisen" shadow soldier: follows the player and autonomously engages
 * nearby monsters. Purely additive support unit, no player micromanagement.
 */
export class Shadow extends Phaser.Physics.Arcade.Sprite {
  record: ShadowRecord;
  private lastAttackAt = 0;
  private followOffset: { x: number; y: number };

  constructor(scene: Phaser.Scene, x: number, y: number, record: ShadowRecord, slotIndex: number) {
    super(scene, x, y, "shadow");
    this.record = record;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setCircle(10, 8, 9);
    this.setDepth(8);
    this.setAlpha(0.9);
    const angle = slotIndex * 1.3;
    this.followOffset = { x: Math.cos(angle) * 34, y: Math.sin(angle) * 34 + 20 };
  }

  update(
    time: number,
    playerX: number,
    playerY: number,
    nearestMonster: { x: number; y: number; takeDamage: (n: number) => boolean } | null
  ) {
    if (nearestMonster) {
      const dx = nearestMonster.x - this.x;
      const dy = nearestMonster.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ENGAGE_RANGE) {
        if (dist > ATTACK_RANGE) {
          const speed = 150;
          this.setVelocity((dx / dist) * speed, (dy / dist) * speed);
          this.setFlipX(dx < 0);
        } else {
          this.setVelocity(0, 0);
          if (time - this.lastAttackAt > ATTACK_COOLDOWN_MS) {
            this.lastAttackAt = time;
            nearestMonster.takeDamage(this.record.power);
            this.scene.tweens.add({ targets: this, scale: 1.2, duration: 60, yoyo: true });
          }
        }
        return;
      }
    }

    // otherwise, follow the player
    const tx = playerX + this.followOffset.x;
    const ty = playerY + this.followOffset.y;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > FOLLOW_DISTANCE * 0.3) {
      const speed = Phaser.Math.Clamp(dist * 2.4, 60, 220);
      this.setVelocity((dx / (dist || 1)) * speed, (dy / (dist || 1)) * speed);
    } else {
      this.setVelocity(0, 0);
    }
  }
}
