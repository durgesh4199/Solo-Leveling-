import Phaser from "phaser";
import { loadGame, saveGame, resetGame } from "../systems/SaveSystem";
import type { SaveData } from "../types";
import { PALETTE } from "../config";
import { RANK_ORDER } from "../data/ranks";
import { SystemWindow } from "../ui/SystemWindow";

export class MainMenuScene extends Phaser.Scene {
  private save!: SaveData;

  constructor() {
    super("MainMenu");
  }

  create() {
    this.save = loadGame();
    this.game.registry.set("save", this.save);

    const w = this.scale.width;
    const h = this.scale.height;

    this.cameras.main.setBackgroundColor(PALETTE.bgDeep);
    this.drawBackdrop(w, h);

    const title = this.add.text(w / 2, h * 0.2, "HUNTER PROTOCOL", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "56px",
      fontStyle: "bold",
      color: "#e6f7ff"
    });
    title.setOrigin(0.5);
    title.setShadow(0, 0, "#3fd0ff", 20, true, true);

    const subtitle = this.add.text(w / 2, h * 0.2 + 46, "A gate has opened. Answer the call.", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "16px",
      color: "#8fa3b0"
    });
    subtitle.setOrigin(0.5);

    const p = this.save.player;
    const infoText = this.add.text(
      w / 2,
      h * 0.38,
      `${p.name}   •   Level ${p.level}   •   Rank ${p.rank}\nShadows commanded: ${this.save.shadows.length}   •   Gates cleared: ${p.gatesCleared}`,
      {
        fontFamily: "Segoe UI, sans-serif",
        fontSize: "16px",
        color: "#c6e8f5",
        align: "center"
      }
    );
    infoText.setOrigin(0.5);

    this.makeButton(w / 2, h * 0.56, "ENTER GATE", () => {
      const gateRank = this.pickGateRank();
      this.scene.start("Gate", { rank: gateRank });
    });

    this.makeButton(w / 2, h * 0.56 + 58, "ALLOCATE STAT POINTS", () => {
      this.openStatAllocation();
    });

    this.makeButton(w / 2, h * 0.56 + 116, "RESET SAVE", () => {
      this.confirmReset();
    }, "#ff6b6b");

    const hint = this.add.text(w / 2, h - 24, "WASD / Arrows to move · Space or Click to attack", {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "13px",
      color: "#5b6b76"
    });
    hint.setOrigin(0.5);
  }

  private drawBackdrop(w: number, h: number) {
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a0a18, 0x0a0a18, 0x120a20, 0x120a20, 1);
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const r = Phaser.Math.FloatBetween(0.5, 1.8);
      g.fillStyle(0x6ee3ff, Phaser.Math.FloatBetween(0.1, 0.4));
      g.fillCircle(x, y, r);
    }
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void, color = "#6ee3ff") {
    const width = 300;
    const height = 44;
    const g = this.add.graphics();
    g.fillStyle(PALETTE.bgPanel, 0.9);
    g.fillRoundedRect(x - width / 2, y - height / 2, width, height, 8);
    g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(color).color, 1);
    g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 8);

    const text = this.add.text(x, y, label, {
      fontFamily: "Segoe UI, sans-serif",
      fontSize: "17px",
      fontStyle: "bold",
      color
    });
    text.setOrigin(0.5);

    const zone = this.add.zone(x, y, width, height);
    zone.setInteractive({ useHandCursor: true });
    zone.on("pointerover", () => {
      g.clear();
      g.fillStyle(PALETTE.systemBlue, 0.15);
      g.fillRoundedRect(x - width / 2, y - height / 2, width, height, 8);
      g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(color).color, 1);
      g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 8);
    });
    zone.on("pointerout", () => {
      g.clear();
      g.fillStyle(PALETTE.bgPanel, 0.9);
      g.fillRoundedRect(x - width / 2, y - height / 2, width, height, 8);
      g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(color).color, 1);
      g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 8);
    });
    zone.on("pointerdown", onClick);
  }

  private pickGateRank() {
    const idx = Math.min(RANK_ORDER.indexOf(this.save.player.rank), RANK_ORDER.length - 1);
    return RANK_ORDER[idx];
  }

  private openStatAllocation() {
    const w = this.scale.width;
    const h = this.scale.height;
    const p = this.save.player;
    const win = new SystemWindow(this, w / 2, h / 2, 230, { title: "STAT ALLOCATION", width: 380 });
    const pointsText = win.addLine(`Available points: ${p.statPoints}`, -75, { color: "#facc15" });
    const strText = win.addLine(`Strength: ${p.strength}`, -35);
    const agiText = win.addLine(`Agility: ${p.agility}`, -5);

    const refresh = () => {
      pointsText.setText(`Available points: ${p.statPoints}`);
      strText.setText(`Strength: ${p.strength}`);
      agiText.setText(`Agility: ${p.agility}`);
    };

    win.addButton("+1 Strength", 35, () => {
      if (p.statPoints <= 0) return;
      p.statPoints -= 1;
      p.strength += 1;
      refresh();
      saveGame(this.save);
    });
    win.addButton("+1 Agility", 75, () => {
      if (p.statPoints <= 0) return;
      p.statPoints -= 1;
      p.agility += 1;
      refresh();
      saveGame(this.save);
    });
    win.playIntro();
  }

  private confirmReset() {
    const w = this.scale.width;
    const h = this.scale.height;
    const win = new SystemWindow(this, w / 2, h / 2, 170, { title: "RESET SAVE?", width: 360 });
    win.addLine("This will permanently erase your hunter,", -35);
    win.addLine("shadows, and gate progress.", -12);
    win.addButton("Cancel", 40, () => win.closeWith());
    win.addButton("Erase & Restart", 82, () => {
      win.closeWith(() => {
        const fresh = resetGame();
        this.game.registry.set("save", fresh);
        this.scene.restart();
      });
    });
    win.playIntro();
  }
}
