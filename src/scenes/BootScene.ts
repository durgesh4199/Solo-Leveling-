import Phaser from "phaser";
import { MONSTER_TEMPLATES } from "../data/monsters";
import { PALETTE } from "../config";

/**
 * Generates every sprite texture procedurally at boot so the game ships
 * with zero external art dependencies. Swap these out later for real
 * artwork by replacing the generateTexture calls with scene.load.image().
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create() {
    this.makePlayerTexture();
    this.makeShadowTexture();
    this.makeParticleTexture();
    this.makeFloorTile();
    this.makeWallTile();
    this.makeAttackArcTexture();

    for (const template of MONSTER_TEMPLATES) {
      this.makeMonsterTexture(template.key, template.color, template.scale);
    }

    this.scene.start("MainMenu");
  }

  private makePlayerTexture() {
    const g = this.add.graphics();
    const size = 40;
    // glow
    g.fillStyle(PALETTE.systemBlue, 0.25);
    g.fillCircle(size / 2, size / 2, size / 2);
    // body (cloak)
    g.fillStyle(0x1a1a2e, 1);
    g.fillRoundedRect(size / 2 - 9, size / 2 - 10, 18, 22, 6);
    // head
    g.fillStyle(0xe8d9c4, 1);
    g.fillCircle(size / 2, size / 2 - 12, 7);
    // eyes glow (violet, hunter-of-shadows motif)
    g.fillStyle(PALETTE.systemPurple, 1);
    g.fillCircle(size / 2 - 2.5, size / 2 - 12, 1.4);
    g.fillCircle(size / 2 + 2.5, size / 2 - 12, 1.4);
    // blade
    g.lineStyle(3, 0xd8f7ff, 1);
    g.lineBetween(size / 2 + 9, size / 2 - 4, size / 2 + 20, size / 2 - 16);
    g.generateTexture("player", size, size);
    g.destroy();
  }

  private makeShadowTexture() {
    const g = this.add.graphics();
    const size = 36;
    g.fillStyle(0x2a1a40, 0.55);
    g.fillCircle(size / 2, size / 2, size / 2 - 2);
    g.fillStyle(0x120a1e, 0.9);
    g.fillRoundedRect(size / 2 - 8, size / 2 - 9, 16, 20, 6);
    g.fillStyle(PALETTE.systemPurple, 1);
    g.fillCircle(size / 2 - 2.5, size / 2 - 11, 1.3);
    g.fillCircle(size / 2 + 2.5, size / 2 - 11, 1.3);
    g.generateTexture("shadow", size, size);
    g.destroy();
  }

  private makeMonsterTexture(key: string, color: number, scale: number) {
    const g = this.add.graphics();
    const size = Math.round(36 * scale);
    const r = size / 2;
    g.fillStyle(color, 0.25);
    g.fillCircle(r, r, r);
    g.fillStyle(color, 1);
    g.fillRoundedRect(r - r * 0.55, r - r * 0.6, r * 1.1, r * 1.3, r * 0.35);
    g.fillStyle(0x0a0a0a, 1);
    g.fillCircle(r - r * 0.22, r - r * 0.35, Math.max(1.5, r * 0.08));
    g.fillCircle(r + r * 0.22, r - r * 0.35, Math.max(1.5, r * 0.08));
    g.fillStyle(0xff4444, 1);
    g.fillCircle(r - r * 0.22, r - r * 0.35, Math.max(0.8, r * 0.04));
    g.fillCircle(r + r * 0.22, r - r * 0.35, Math.max(0.8, r * 0.04));
    g.generateTexture(`m_${key}`, size, size);
    g.destroy();
  }

  private makeParticleTexture() {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture("particle", 8, 8);
    g.destroy();
  }

  private makeAttackArcTexture() {
    const g = this.add.graphics();
    const size = 64;
    g.fillStyle(PALETTE.systemBorder, 0.5);
    g.slice(size / 2, size / 2, size / 2, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50), false);
    g.fillPath();
    g.generateTexture("attack_arc", size, size);
    g.destroy();
  }

  private makeFloorTile() {
    const g = this.add.graphics();
    const size = 64;
    g.fillStyle(0x0b0b16, 1);
    g.fillRect(0, 0, size, size);
    g.lineStyle(1, 0x161628, 1);
    g.strokeRect(0, 0, size, size);
    g.fillStyle(0x111120, 0.5);
    g.fillRect(4, 4, size - 8, size - 8);
    g.generateTexture("tile_floor", size, size);
    g.destroy();
  }

  private makeWallTile() {
    const g = this.add.graphics();
    const size = 64;
    g.fillStyle(0x1c1030, 1);
    g.fillRect(0, 0, size, size);
    g.lineStyle(2, PALETTE.systemPurple, 0.35);
    g.strokeRect(2, 2, size - 4, size - 4);
    g.generateTexture("tile_wall", size, size);
    g.destroy();
  }
}
