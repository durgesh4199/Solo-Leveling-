import type { Game } from "../store";
import type { ScreenModule } from "./types";
import { icon } from "../art/icons";
import { enemyPortrait, hunterPortrait } from "../art/portraits";
import { ShaderFX } from "../fx/ShaderFX";
import { SKILLS } from "../data";
import type { EnemyUnit } from "../types";

const VIOLET = "#d2cefd";
const VIOLET_SOFT = "#b5abfc";
const VIOLET_DEEP = "#9184d9";
const VIOLET_PALE = "#e7e5fe";

function center(canvas: HTMLElement, target: HTMLElement) {
  const c = canvas.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  return { x: t.left + t.width / 2 - c.left, y: t.top + t.height / 2 - c.top };
}

function enemySlotHtml(unit: EnemyUnit, art: string, isBoss: boolean, small: boolean): string {
  return `
    <div class="enemy-slot" data-uid="${unit.uid}" style="display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div class="arena-portrait ${isBoss ? "is-boss" : ""} ${small ? "small" : ""}">
        <div class="impact-glow"></div>
        <div class="art-slot lighten" style="width:100%;height:100%;border-radius:50%;overflow:hidden;">${art}</div>
        <div class="vfx-layer" style="display:none;">
          <div class="slash-bar"></div><div class="slash-bar"></div><div class="slash-bar"></div>
          <div class="flurry-flare" style="display:none;"></div>
        </div>
        <div class="float-num" style="display:none;"></div>
      </div>
      <div class="mini-hp-track bar-track" style="width:${small ? 68 : 100}px;height:5px;"><div class="mini-hp-fill bar-fill" style="background:var(--color-neutral-400);"></div></div>
    </div>
  `;
}

export const battleScreen: ScreenModule = (root, game) => {
  const battle = game.state.battle;
  if (!battle) {
    root.innerHTML = "";
    return { update() {} };
  }

  root.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;min-height:0;position:relative;background:radial-gradient(120% 80% at 50% 0%, var(--color-section-glow) 0%, var(--color-bg) 60%);">
      <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-4) var(--space-6) 0;">
        <button class="btn btn-icon" data-action="retreat-battle">${icon("arrow-left")}</button>
        <div id="battle-gate-name" style="font-size:13px;color:var(--color-neutral-400);flex:1;"></div>
        <div id="wave-progress" style="font-size:11px;color:var(--color-neutral-500);letter-spacing:0.04em;"></div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:var(--space-4) var(--space-6);gap:var(--space-4);min-height:0;">
        <div style="display:flex;align-items:center;gap:6px;">
          <div id="enemy-name" style="font-size:15px;font-weight:500;"></div>
          <span id="boss-tag" class="tag tag-accent" style="display:none;flex-shrink:0;">BOSS</span>
        </div>

        <div class="arena-row" style="display:flex;align-items:center;justify-content:center;gap:var(--space-3);padding:var(--space-4) 0;">
          <canvas id="fx-canvas" class="fx-canvas"></canvas>
          <div id="arena-flash" class="arena-flash" style="display:none;"></div>

          <div id="player-portrait" class="arena-portrait">
            <div id="player-glow" class="impact-glow"></div>
            <div class="lighten" style="width:100%;height:100%;border-radius:50%;overflow:hidden;">${hunterPortrait()}</div>
            <div id="player-vfx" class="vfx-layer" style="display:none;">
              <div class="slash-bar"></div><div class="slash-bar"></div><div class="slash-bar"></div>
            </div>
            <div id="player-guard-ring" class="guard-ring" style="display:none;"></div>
            <div id="player-float" class="float-num" style="display:none;"></div>
          </div>

          <span style="font-size:18px;color:var(--color-accent-400);flex-shrink:0;">${icon("lightning")}</span>

          <div id="enemy-group" style="display:flex;align-items:flex-end;gap:10px;"></div>
        </div>
      </div>

      <div style="padding:var(--space-4) var(--space-6);">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
          <div id="player-name" style="font-size:15px;font-weight:500;"></div>
          <div id="player-hp-text" style="font-size:11px;color:var(--color-neutral-500);"></div>
        </div>
        <div id="player-hp-track" class="bar-track" style="margin-bottom:var(--space-2);"><div id="player-hp-fill" class="bar-fill" style="background:var(--color-accent-400);"></div></div>
        <div class="bar-track"><div id="player-mp-fill" class="bar-fill" style="background:var(--color-neutral-500);"></div></div>
      </div>

      <div id="battle-result" style="display:none;padding:var(--space-6);border-top:1px solid var(--color-neutral-800);flex-direction:column;gap:var(--space-3);">
        <div style="text-align:center;">
          <div id="result-title" style="font-size:18px;font-weight:500;"></div>
          <div id="result-subtitle" style="font-size:12px;color:var(--color-neutral-500);margin-top:2px;"></div>
        </div>
        <div style="display:flex;gap:var(--space-3);">
          <button id="arise-btn" class="btn btn-primary" style="flex:1;justify-content:center;display:none;" data-action="arise-shadow">${icon("moon-stars")} Arise</button>
          <button id="continue-btn" class="btn btn-secondary" style="flex:1;justify-content:center;" data-action="battle-continue">Continue</button>
        </div>
      </div>

      <div id="battle-actions" style="padding:var(--space-4) var(--space-6) var(--space-6);display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);position:relative;">
        <button class="btn btn-secondary action-btn" data-action="battle-attack">${icon("sword")} Attack</button>
        <button class="btn btn-secondary action-btn" data-action="toggle-skills">${icon("flame")} Skills</button>
        <button class="btn btn-secondary action-btn" data-action="battle-guard">${icon("shield")} Guard</button>
        <button class="btn btn-secondary action-btn" data-action="battle-item">${icon("flask")} Potion (<span id="potion-count"></span>)</button>

        <div id="skill-panel" style="display:none;position:absolute;left:var(--space-6);right:var(--space-6);bottom:100%;margin-bottom:var(--space-2);background:var(--color-surface);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);overflow:hidden;">
          ${SKILLS.map((s) => `
            <div class="skill-row" data-skill="${s.key}" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border-bottom:1px solid var(--color-neutral-800);cursor:pointer;">
              <span style="font-size:18px;color:var(--color-accent-300);flex-shrink:0;">${icon(s.icon as any)}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:500;">${s.name}</div>
                <div class="skill-desc" style="font-size:11px;color:var(--color-neutral-500);">${s.description}</div>
              </div>
              <div class="tag tag-outline skill-cost" style="font-size:10px;flex-shrink:0;">${s.mpCost} MP</div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const gateNameEl = $("#battle-gate-name");
  const waveProgressEl = $("#wave-progress");
  const enemyNameEl = $("#enemy-name");
  const bossTag = $("#boss-tag");
  const playerNameEl = $("#player-name");
  const playerHpText = $("#player-hp-text");
  const playerHpFill = $("#player-hp-fill");
  const playerHpTrack = $("#player-hp-track");
  const playerMpFill = $("#player-mp-fill");
  const potionCountEl = $("#potion-count");
  const resultPanel = $("#battle-result");
  const resultTitle = $("#result-title");
  const resultSubtitle = $("#result-subtitle");
  const ariseBtn = $<HTMLButtonElement>("#arise-btn");
  const continueBtn = $<HTMLButtonElement>("#continue-btn");
  const actionsRow = $("#battle-actions");
  const attackBtn = $<HTMLButtonElement>('[data-action="battle-attack"]');
  const skillsToggleBtn = $<HTMLButtonElement>('[data-action="toggle-skills"]');
  const guardBtn = $<HTMLButtonElement>('[data-action="battle-guard"]');
  const itemBtn = $<HTMLButtonElement>('[data-action="battle-item"]');
  const skillPanel = $("#skill-panel");

  const playerPortrait = $("#player-portrait");
  const playerGlow = $("#player-glow");
  const playerVfx = $("#player-vfx");
  const playerGuardRing = $("#player-guard-ring");
  const playerFloat = $("#player-float");
  const arenaFlash = $("#arena-flash");
  const arenaRow = $(".arena-row");
  const enemyGroup = $("#enemy-group");
  const fxCanvas = $<HTMLCanvasElement>("#fx-canvas");

  const shaderFx = new ShaderFX(fxCanvas);

  function findEnemySlot(uid: string): HTMLElement | null {
    return enemyGroup.querySelector(`.enemy-slot[data-uid="${uid}"]`);
  }

  root.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => {
    const action = el.dataset.action;
    if (!action || action === "enter-gate" || action === "add-stat") return;
    el.addEventListener("click", () => {
      switch (action) {
        case "battle-attack": return game.battleAttack();
        case "toggle-skills": return game.toggleSkillPanel();
        case "battle-guard": return game.battleGuard();
        case "battle-item": return game.battleItem();
        case "arise-shadow": return game.ariseShadow();
        case "battle-continue": return game.continueAfterWave();
        case "retreat-battle": return game.retreatBattle();
      }
    });
  });

  root.querySelectorAll<HTMLElement>(".skill-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("is-disabled")) return;
      const key = row.dataset.skill;
      if (key) game.useSkill(key);
    });
  });

  const unsubFx = game.onFx((e) => {
    switch (e.kind) {
      case "slash":
      case "flurry": {
        if (e.side === "player") {
          const c = center(fxCanvas, playerPortrait);
          if (e.kind === "slash") shaderFx.slash(c.x, c.y, VIOLET, 160);
          else shaderFx.flurry(c.x, c.y, VIOLET, 160);
        } else if (e.targetUid) {
          const slot = findEnemySlot(e.targetUid);
          if (slot) {
            const c = center(fxCanvas, slot);
            if (e.kind === "slash") shaderFx.slash(c.x, c.y, VIOLET, 20);
            else shaderFx.flurry(c.x, c.y, VIOLET, 20);
          }
        }
        break;
      }
      case "guard": {
        const c = center(fxCanvas, playerPortrait);
        shaderFx.guardRing(c.x, c.y, VIOLET_SOFT);
        break;
      }
      case "shake": {
        arenaRow.classList.remove("arena-shake", "arena-shake-heavy");
        void (arenaRow as HTMLElement).offsetWidth;
        arenaRow.classList.add(e.intensity === "heavy" ? "arena-shake-heavy" : "arena-shake");
        break;
      }
      case "dissolve": {
        if (e.targetUid) {
          const slot = findEnemySlot(e.targetUid);
          if (slot) {
            const c = center(fxCanvas, slot);
            shaderFx.dissolve(c.x, c.y, VIOLET);
          }
        }
        break;
      }
      case "portal": {
        const c = enemyGroup.children.length > 0 ? center(fxCanvas, enemyGroup) : center(fxCanvas, playerPortrait);
        shaderFx.arisePortal(c.x, c.y, VIOLET_DEEP);
        break;
      }
      case "levelup": {
        const c = center(fxCanvas, playerPortrait);
        shaderFx.levelUpBurst(c.x, c.y, VIOLET_PALE);
        break;
      }
    }
  });

  let renderedWaveKey = "";

  const update = () => {
    const b = game.state.battle;
    const p = game.state.player;
    if (!b) return;

    gateNameEl.textContent = b.gateName;
    waveProgressEl.textContent = b.isBossWave ? "FINAL WAVE" : `WAVE ${b.waveIndex} / ${b.totalWaves}`;
    const aliveCount = b.enemies.filter((u) => u.alive).length;
    enemyNameEl.textContent = b.enemies.length > 1 ? `${b.enemyName} ×${aliveCount}` : b.enemyName;
    bossTag.style.display = b.isBossWave ? "inline-flex" : "none";

    const waveKey = `${b.gateId}:${b.waveIndex}`;
    if (waveKey !== renderedWaveKey) {
      renderedWaveKey = waveKey;
      const small = b.enemies.length > 1;
      enemyGroup.innerHTML = b.enemies
        .map((u) => enemySlotHtml(u, enemyPortrait(b.monsterKey), b.isBossWave, small))
        .join("");
    }

    const firstAliveUid = b.enemies.find((u) => u.alive)?.uid;
    for (const unit of b.enemies) {
      const slot = findEnemySlot(unit.uid);
      if (!slot) continue;
      const portraitEl = slot.querySelector<HTMLElement>(".arena-portrait")!;
      const glowEl = slot.querySelector<HTMLElement>(".impact-glow")!;
      const vfxEl = slot.querySelector<HTMLElement>(".vfx-layer")!;
      const flareEl = slot.querySelector<HTMLElement>(".flurry-flare")!;
      const floatEl = slot.querySelector<HTMLElement>(".float-num")!;
      const hpFill = slot.querySelector<HTMLElement>(".mini-hp-fill")!;

      slot.style.opacity = unit.alive ? "1" : "0.18";
      slot.style.filter = unit.alive ? "none" : "grayscale(1)";
      portraitEl.classList.toggle("is-target", unit.uid === firstAliveUid);
      hpFill.style.width = `${Math.round((unit.hp / unit.maxHp) * 100)}%`;
      glowEl.classList.toggle("show", !!unit.glow);
      vfxEl.style.display = unit.vfx ? "block" : "none";
      vfxEl.className = `vfx-layer ${unit.vfx ?? ""}`;
      flareEl.style.display = unit.vfx === "flurry" ? "block" : "none";
      portraitEl.classList.toggle("lunge-left", unit.lunging);

      if (unit.floatText) {
        floatEl.textContent = unit.floatText.text;
        floatEl.className = `float-num ${unit.floatText.kind}`;
        floatEl.style.display = "block";
      } else {
        floatEl.style.display = "none";
      }
    }

    playerNameEl.textContent = p.name;
    playerHpText.textContent = `${p.hp} / ${p.maxHp} HP`;
    playerHpFill.style.width = `${Math.round((p.hp / p.maxHp) * 100)}%`;
    playerHpTrack.classList.toggle("hit", !!b.playerHit);
    playerMpFill.style.width = `${Math.round((p.mp / p.maxMp) * 100)}%`;
    potionCountEl.textContent = String(game.state.inventory.potions);

    attackBtn.disabled = b.locked;
    guardBtn.disabled = b.locked;
    skillsToggleBtn.disabled = b.locked;
    itemBtn.disabled = b.locked || game.state.inventory.potions <= 0;

    skillPanel.style.display = b.skillPanelOpen ? "block" : "none";
    root.querySelectorAll<HTMLElement>(".skill-row").forEach((row) => {
      const key = row.dataset.skill;
      const def = SKILLS.find((s) => s.key === key);
      if (!def) return;
      const locked = p.level < def.unlockLevel;
      const noMp = p.mp < def.mpCost;
      const disabled = locked || noMp || b.locked;
      row.classList.toggle("is-disabled", disabled);
      row.style.opacity = disabled ? "0.45" : "1";
      row.style.cursor = disabled ? "not-allowed" : "pointer";
      const desc = row.querySelector<HTMLElement>(".skill-desc")!;
      desc.textContent = locked ? `Unlocks at Level ${def.unlockLevel}` : def.description;
    });

    playerGlow.classList.toggle("show", !!b.playerGlow);
    playerVfx.style.display = b.vfxPlayer ? "block" : "none";
    playerVfx.className = `vfx-layer ${b.vfxPlayer ?? ""}`;
    playerGuardRing.style.display = b.guardRing ? "block" : "none";
    playerPortrait.classList.toggle("lunge-right", b.lunge === "player");
    arenaFlash.style.display = b.flash ? "block" : "none";

    if (b.floatPlayer) {
      playerFloat.textContent = b.floatPlayer.text;
      playerFloat.className = `float-num ${b.floatPlayer.kind}`;
      playerFloat.style.display = "block";
    } else {
      playerFloat.style.display = "none";
    }

    if (b.over) {
      actionsRow.style.display = "none";
      skillPanel.style.display = "none";
      resultPanel.style.display = "flex";
      if (b.result === "defeat") {
        resultTitle.textContent = "You Fell";
        resultTitle.style.color = "var(--color-neutral-400)";
        resultSubtitle.textContent = "Retreat and recover before trying again.";
        ariseBtn.style.display = "none";
        continueBtn.textContent = "Retreat";
      } else if (b.result === "gate-clear") {
        resultTitle.textContent = "Victory";
        resultTitle.style.color = "var(--color-accent-300)";
        resultSubtitle.textContent = "Gate cleared - the boss has fallen.";
        ariseBtn.style.display = "inline-flex";
        continueBtn.textContent = "Continue";
      } else {
        resultTitle.textContent = "Wave Cleared";
        resultTitle.style.color = "var(--color-accent-300)";
        resultSubtitle.textContent = `${b.waveIndex} / ${b.totalWaves} waves down.`;
        ariseBtn.style.display = "inline-flex";
        continueBtn.textContent = "Next Wave";
      }
    } else {
      actionsRow.style.display = "grid";
      resultPanel.style.display = "none";
    }
  };

  update();

  return {
    update,
    unmount() {
      unsubFx();
      shaderFx.destroy();
    }
  };
};
