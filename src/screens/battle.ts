import type { Game } from "../store";
import type { ScreenModule } from "./types";
import { icon } from "../art/icons";
import { enemyPortrait, hunterPortrait } from "../art/portraits";
import { ShaderFX } from "../fx/ShaderFX";

const VIOLET = "#d2cefd";
const VIOLET_SOFT = "#b5abfc";
const VIOLET_DEEP = "#9184d9";
const VIOLET_PALE = "#e7e5fe";

function center(canvas: HTMLElement, target: HTMLElement) {
  const c = canvas.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  return { x: t.left + t.width / 2 - c.left, y: t.top + t.height / 2 - c.top };
}

export const battleScreen: ScreenModule = (root, game) => {
  const battle = game.state.battle;
  if (!battle) {
    // Shouldn't happen, but keep the screen renderable defensively.
    root.innerHTML = "";
    return { update() {} };
  }

  root.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;min-height:0;background:radial-gradient(120% 80% at 50% 0%, var(--color-section-glow) 0%, var(--color-bg) 60%);">
      <div style="display:flex;align-items:center;gap:var(--space-2);padding:var(--space-4) var(--space-6) 0;">
        <button class="btn btn-icon" data-action="retreat-battle">${icon("arrow-left")}</button>
        <div id="battle-gate-name" style="font-size:13px;color:var(--color-neutral-400);"></div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:var(--space-4) var(--space-6);gap:var(--space-4);min-height:0;">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
            <div id="enemy-name" style="font-size:15px;font-weight:500;"></div>
            <div id="enemy-hp-text" style="font-size:11px;color:var(--color-neutral-500);"></div>
          </div>
          <div id="enemy-hp-track" class="bar-track"><div id="enemy-hp-fill" class="bar-fill" style="background:var(--color-neutral-400);"></div></div>
        </div>

        <div class="arena-row" style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);padding:var(--space-4) 0;">
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

          <span style="font-size:20px;color:var(--color-accent-400);flex-shrink:0;">${icon("lightning")}</span>

          <div id="enemy-portrait" class="arena-portrait">
            <div id="enemy-glow" class="impact-glow"></div>
            <div class="lighten" style="width:100%;height:100%;border-radius:50%;overflow:hidden;">${enemyPortrait(battle.enemyName)}</div>
            <div id="enemy-vfx" class="vfx-layer" style="display:none;">
              <div class="slash-bar"></div><div class="slash-bar"></div><div class="slash-bar"></div>
              <div id="enemy-flare" class="flurry-flare" style="display:none;"></div>
            </div>
            <div id="enemy-float" class="float-num" style="display:none;"></div>
          </div>
        </div>
      </div>

      <div id="battle-log" style="flex:0 0 74px;margin:0 var(--space-6);background:var(--color-neutral-900);border-radius:var(--radius-md);padding:var(--space-2) var(--space-3);overflow-y:auto;display:flex;flex-direction:column-reverse;gap:var(--space-1);"></div>

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
          <button class="btn btn-secondary" style="flex:1;justify-content:center;" data-action="retreat-battle">Continue</button>
        </div>
      </div>

      <div id="battle-actions" style="padding:var(--space-4) var(--space-6) var(--space-6);display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">
        <button class="btn btn-secondary action-btn" data-action="battle-attack">${icon("sword")} Attack</button>
        <button class="btn btn-secondary action-btn" data-action="battle-skill">${icon("flame")} Dagger Rush (15 MP)</button>
        <button class="btn btn-secondary action-btn" data-action="battle-guard">${icon("shield")} Guard</button>
        <button class="btn btn-secondary action-btn" data-action="battle-item">${icon("flask")} Potion (<span id="potion-count"></span>)</button>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const gateNameEl = $("#battle-gate-name");
  const enemyNameEl = $("#enemy-name");
  const enemyHpText = $("#enemy-hp-text");
  const enemyHpFill = $("#enemy-hp-fill");
  const enemyHpTrack = $("#enemy-hp-track");
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
  const actionsRow = $("#battle-actions");
  const attackBtn = $<HTMLButtonElement>('[data-action="battle-attack"]');
  const skillBtn = $<HTMLButtonElement>('[data-action="battle-skill"]');
  const guardBtn = $<HTMLButtonElement>('[data-action="battle-guard"]');
  const itemBtn = $<HTMLButtonElement>('[data-action="battle-item"]');

  const playerPortrait = $("#player-portrait");
  const enemyPortraitEl = $("#enemy-portrait");
  const playerGlow = $("#player-glow");
  const enemyGlow = $("#enemy-glow");
  const playerVfx = $("#player-vfx");
  const enemyVfx = $("#enemy-vfx");
  const enemyFlare = $("#enemy-flare");
  const playerGuardRing = $("#player-guard-ring");
  const playerFloat = $("#player-float");
  const enemyFloat = $("#enemy-float");
  const arenaFlash = $("#arena-flash");
  const arenaRow = $(".arena-row");
  const logEl = $("#battle-log");
  const fxCanvas = $<HTMLCanvasElement>("#fx-canvas");

  const shaderFx = new ShaderFX(fxCanvas);

  root.querySelectorAll<HTMLElement>("[data-action]").forEach((el) => {
    const action = el.dataset.action;
    if (!action || action === "enter-gate" || action === "add-stat") return;
    el.addEventListener("click", () => {
      switch (action) {
        case "battle-attack": return game.battleAttack();
        case "battle-skill": return game.battleSkill();
        case "battle-guard": return game.battleGuard();
        case "battle-item": return game.battleItem();
        case "arise-shadow": return game.ariseShadow();
        case "retreat-battle": return game.retreatBattle();
      }
    });
  });

  let renderedLogLen = -1;

  const unsubFx = game.onFx((e) => {
    switch (e.kind) {
      case "slash": {
        const c = e.side === "enemy" ? center(fxCanvas, enemyPortraitEl) : center(fxCanvas, playerPortrait);
        shaderFx.slash(c.x, c.y, VIOLET, e.side === "enemy" ? 20 : 160);
        break;
      }
      case "flurry": {
        const c = e.side === "enemy" ? center(fxCanvas, enemyPortraitEl) : center(fxCanvas, playerPortrait);
        shaderFx.flurry(c.x, c.y, VIOLET, e.side === "enemy" ? 20 : 160);
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
        const c = center(fxCanvas, enemyPortraitEl);
        shaderFx.dissolve(c.x, c.y, VIOLET);
        break;
      }
      case "portal": {
        const c = center(fxCanvas, enemyPortraitEl);
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

  const update = () => {
    const b = game.state.battle;
    const p = game.state.player;
    if (!b) return;

    gateNameEl.textContent = b.gateName;
    enemyNameEl.textContent = b.enemyName;
    enemyHpText.textContent = `${b.enemyHp} / ${b.enemyMaxHp}`;
    enemyHpFill.style.width = `${Math.round((b.enemyHp / b.enemyMaxHp) * 100)}%`;
    enemyHpTrack.classList.toggle("hit", !!b.enemyHit);

    playerNameEl.textContent = p.name;
    playerHpText.textContent = `${p.hp} / ${p.maxHp} HP`;
    playerHpFill.style.width = `${Math.round((p.hp / p.maxHp) * 100)}%`;
    playerHpTrack.classList.toggle("hit", !!b.playerHit);
    playerMpFill.style.width = `${Math.round((p.mp / p.maxMp) * 100)}%`;
    potionCountEl.textContent = String(game.state.inventory.potions);

    attackBtn.disabled = b.locked;
    guardBtn.disabled = b.locked;
    skillBtn.disabled = b.locked || p.mp < 15;
    itemBtn.disabled = b.locked || game.state.inventory.potions <= 0;

    playerGlow.classList.toggle("show", !!b.playerGlow);
    enemyGlow.classList.toggle("show", !!b.enemyGlow);

    playerVfx.style.display = b.vfxPlayer ? "block" : "none";
    playerVfx.className = `vfx-layer ${b.vfxPlayer ?? ""}`;
    enemyVfx.style.display = b.vfxEnemy ? "block" : "none";
    enemyVfx.className = `vfx-layer ${b.vfxEnemy ?? ""}`;
    enemyFlare.style.display = b.vfxEnemy === "flurry" ? "block" : "none";

    playerGuardRing.style.display = b.guardRing ? "block" : "none";

    playerPortrait.classList.toggle("lunge-right", b.lunge === "player");
    enemyPortraitEl.classList.toggle("lunge-left", b.lunge === "enemy");

    arenaFlash.style.display = b.flash ? "block" : "none";

    if (b.floatPlayer) {
      playerFloat.textContent = b.floatPlayer.text;
      playerFloat.className = `float-num ${b.floatPlayer.kind}`;
      playerFloat.style.display = "block";
    } else {
      playerFloat.style.display = "none";
    }
    if (b.floatEnemy) {
      enemyFloat.textContent = b.floatEnemy.text;
      enemyFloat.className = `float-num ${b.floatEnemy.kind}`;
      enemyFloat.style.display = "block";
    } else {
      enemyFloat.style.display = "none";
    }

    if (b.log.length !== renderedLogLen) {
      renderedLogLen = b.log.length;
      logEl.innerHTML = [...b.log].reverse()
        .map((entry) => `<div class="log-line" style="font-size:12px;color:var(--color-neutral-300);">${entry.text}</div>`)
        .join("");
    }

    if (b.over) {
      actionsRow.style.display = "none";
      resultPanel.style.display = "flex";
      const victory = b.result === "victory";
      resultTitle.textContent = victory ? "Victory" : "You Fell";
      resultTitle.style.color = victory ? "var(--color-accent-300)" : "var(--color-neutral-400)";
      resultSubtitle.textContent = victory ? `+${b.xpReward} XP earned` : "Retreat and recover before trying again.";
      ariseBtn.style.display = victory ? "inline-flex" : "none";
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
