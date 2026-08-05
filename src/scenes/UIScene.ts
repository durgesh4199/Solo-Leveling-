import Phaser from "phaser";
import type { SaveData } from "../types";
import { RANK_COLOR } from "../data/ranks";
import { PALETTE } from "../config";

interface UISceneData {
  rank: string;
  totalMonsters: number;
}

/** Runs in parallel with GateScene, drawing the HP/MP/XP HUD and rank badge. */
export class UIScene extends Phaser.Scene {
  private save!: SaveData;
  private hpBar!: Phaser.GameObjects.Graphics;
  private mpBar!: Phaser.GameObjects.Graphics;
  private xpBar!: Phaser.GameObjects.Graphics;
  private infoText!: Phaser.GameObjects.Text;
  private controlsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "UI", active: false });
  }

  create(data: UISceneData) {
    this.save = this.game.registry.get("save") as SaveData;

    const panelW = 260;
    const g = this.add.graphics();
    g.fillStyle(PALETTE.bgPanel, 0.75);
    g.fillRoundedRect(14, 14, panelW, 92, 10);
    g.lineStyle(1.5, PALETTE.systemBorder, 0.8);
    g.strokeRoundedRect(14, 14, panelW, 92, 10);

    this.infoText = this.add.text(26, 20, "", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "14px",
      color: "#e6f7ff"
    });

    this.hpBar = this.add.graphics();
    this.mpBar = this.add.graphics();
    this.xpBar = this.add.graphics();

    this.controlsText = this.add.text(
      this.scale.width - 16,
      16,
      "WASD / Arrows: Move\nSpace / Click: Attack",
      {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "13px",
        color: "#8fa3b0",
        align: "right"
      }
    );
    this.controlsText.setOrigin(1, 0);

    void data;
  }

  update() {
    const p = this.save.player;
    const rankColor = Phaser.Display.Color.IntegerToColor(RANK_COLOR[p.rank]).rgba;

    this.infoText.setText(
      `${p.name}  •  Lv.${p.level}  •  Rank ${p.rank}\nShadows: ${this.save.shadows.length}   Gates cleared: ${p.gatesCleared}`
    );

    const barX = 26;
    const barW = 236;

    this.hpBar.clear();
    this.hpBar.fillStyle(0x1a0505, 1);
    this.hpBar.fillRoundedRect(barX, 62, barW, 10, 4);
    this.hpBar.fillStyle(0xe03a3a, 1);
    this.hpBar.fillRoundedRect(barX, 62, barW * Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1), 10, 4);

    this.mpBar.clear();
    this.mpBar.fillStyle(0x051222, 1);
    this.mpBar.fillRoundedRect(barX, 76, barW, 8, 4);
    this.mpBar.fillStyle(0x3a8cff, 1);
    this.mpBar.fillRoundedRect(barX, 76, barW * Phaser.Math.Clamp(p.mp / p.maxMp, 0, 1), 8, 4);

    this.xpBar.clear();
    this.xpBar.fillStyle(0x221a05, 1);
    this.xpBar.fillRoundedRect(barX, 90, barW, 6, 3);
    this.xpBar.fillStyle(0xffce3a, 1);
    this.xpBar.fillRoundedRect(barX, 90, barW * Phaser.Math.Clamp(p.xp / p.xpToNext, 0, 1), 6, 3);

    void rankColor;
  }
}
