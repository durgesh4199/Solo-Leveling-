import Phaser from "phaser";
import { PALETTE } from "../config";

export interface SystemWindowOptions {
  title?: string;
  width?: number;
  padding?: number;
}

/**
 * Recreates the "blue System window" popup aesthetic: a dark glass panel
 * with a glowing cyan/violet border and a title bar. Used for quest
 * notices, level-ups, gate results, and stat allocation.
 */
export class SystemWindow extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private titleText?: Phaser.GameObjects.Text;
  private bodyContainer: Phaser.GameObjects.Container;
  private winWidth: number;
  private winHeight: number;

  constructor(scene: Phaser.Scene, x: number, y: number, height: number, options: SystemWindowOptions = {}) {
    super(scene, x, y);
    this.winWidth = options.width ?? 420;
    this.winHeight = height;

    this.bg = scene.add.graphics();
    this.drawPanel();
    this.add(this.bg);

    if (options.title) {
      this.titleText = scene.add.text(0, -this.winHeight / 2 + 22, options.title, {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "20px",
        color: "#6ee3ff",
        fontStyle: "bold"
      });
      this.titleText.setOrigin(0.5, 0.5);
      this.titleText.setShadow(0, 0, "#3fd0ff", 8, true, true);
      this.add(this.titleText);
    }

    this.bodyContainer = scene.add.container(0, 0);
    this.add(this.bodyContainer);

    scene.add.existing(this);
    this.setDepth(1000);
  }

  private drawPanel() {
    const w = this.winWidth;
    const h = this.winHeight;
    this.bg.clear();

    // outer glow
    this.bg.fillStyle(PALETTE.systemPurple, 0.18);
    this.bg.fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 16);

    // panel body
    this.bg.fillStyle(PALETTE.bgPanel, 0.92);
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);

    // border
    this.bg.lineStyle(2, PALETTE.systemBorder, 1);
    this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.bg.lineStyle(1, PALETTE.systemPurple, 0.6);
    this.bg.strokeRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8, 9);
  }

  /** Add a line of body text, stacked top-to-bottom, returns the text object. */
  addLine(text: string, yOffset: number, style: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
    const t = this.scene.add.text(0, yOffset, text, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "16px",
      color: "#e6f7ff",
      align: "center",
      ...style
    });
    t.setOrigin(0.5, 0.5);
    this.bodyContainer.add(t);
    return t;
  }

  addButton(label: string, yOffset: number, onClick: () => void) {
    const btnWidth = this.winWidth - 80;
    const g = this.scene.add.graphics();
    g.fillStyle(PALETTE.systemBlue, 0.15);
    g.fillRoundedRect(-btnWidth / 2, yOffset - 18, btnWidth, 36, 8);
    g.lineStyle(1.5, PALETTE.systemBorder, 1);
    g.strokeRoundedRect(-btnWidth / 2, yOffset - 18, btnWidth, 36, 8);
    this.bodyContainer.add(g);

    const t = this.scene.add.text(0, yOffset, label, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "16px",
      color: "#6ee3ff",
      fontStyle: "bold"
    });
    t.setOrigin(0.5, 0.5);
    this.bodyContainer.add(t);

    const zone = this.scene.add.zone(0, yOffset, btnWidth, 36);
    zone.setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => g.setAlpha(1.6));
    zone.on("pointerout", () => g.setAlpha(1));
    zone.on("pointerdown", onClick);
    this.bodyContainer.add(zone);
    return zone;
  }

  closeWith(callback?: () => void) {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: 0.92,
      duration: 180,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.destroy();
        callback?.();
      }
    });
  }

  playIntro() {
    this.setScale(0.9);
    this.setAlpha(0);
    this.scene.tweens.add({
      targets: this,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: "Back.easeOut"
    });
  }
}

/** Fire-and-forget toast that fades in, holds, then fades out. */
export function showToast(scene: Phaser.Scene, x: number, y: number, text: string, color = "#6ee3ff") {
  const t = scene.add.text(x, y, text, {
    fontFamily: "Segoe UI, sans-serif",
    fontSize: "18px",
    color,
    fontStyle: "bold"
  });
  t.setOrigin(0.5, 0.5);
  t.setShadow(0, 0, color, 6, true, true);
  t.setDepth(2000);
  scene.tweens.add({
    targets: t,
    y: y - 40,
    alpha: 0,
    duration: 1400,
    ease: "Cubic.easeOut",
    onComplete: () => t.destroy()
  });
}
