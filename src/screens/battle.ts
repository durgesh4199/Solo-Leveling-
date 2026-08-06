import type { Game } from "../store";
import type { ScreenModule } from "./types";
import { icon } from "../art/icons";
import { AURA_TIER, PLAYER_RANK_GLOW, enemyPortrait, hunterPortrait, playerAuraHtml, shadowPortrait } from "../art/portraits";
import { ShaderFX } from "../fx/ShaderFX";
import { ARCHETYPE_BY_RANK, POTIONS, RARITY_META, SKILLS, rankForLevel } from "../data";
import type { EnemyUnit } from "../types";

const VIOLET = "#d2cefd";
const VIOLET_SOFT = "#b5abfc";
const VIOLET_DEEP = "#9184d9";
const VIOLET_PALE = "#e7e5fe";
// Every hit that actually lands (slash/flurry/smash) reads as blood-red -
// violet stays reserved for the non-damage effects (guard, portal, dissolve,
// level-up) so "damage happened" has one consistent, unmistakable color.
const BLOOD = "#e0342b";

function center(canvas: HTMLElement, target: HTMLElement) {
  const c = canvas.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  return { x: t.left + t.width / 2 - c.left, y: t.top + t.height / 2 - c.top };
}

function enemySlotHtml(unit: EnemyUnit, art: string, isBoss: boolean, small: boolean): string {
  return `
    <div class="enemy-slot" data-uid="${unit.uid}" style="display:flex;flex-direction:column;align-items:center;gap:4px;">
      <div class="arena-portrait ${isBoss ? "is-boss" : ""} ${unit.isElite ? "is-elite" : ""} ${small ? "small" : ""}">
        <div class="impact-glow dmg"></div>
        <div class="art-slot lighten" style="width:100%;height:100%;border-radius:50%;overflow:hidden;">${art}</div>
        ${unit.isElite ? `<div class="elite-badge">${icon("sparkles")}</div>` : ""}
        <div class="vfx-layer" style="display:none;">
          <div class="slash-bar"></div><div class="slash-bar"></div><div class="slash-bar"></div>
          <div class="flurry-flare" style="display:none;"></div>
        </div>
        <div class="float-num" style="display:none;"></div>
        <div class="guard-badge" style="display:none;" title="Blocking">${icon("shield")}</div>
      </div>
      <div class="mini-enemy-name" style="font-size:10px;color:var(--color-neutral-400);max-width:${small ? 72 : 110}px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${unit.name}</div>
      <div class="mini-hp-track bar-track" style="width:${small ? 68 : 100}px;height:5px;"><div class="mini-hp-fill bar-fill" style="background:var(--color-neutral-400);"></div></div>
      <div class="mini-hp-text" style="font-size:10px;color:var(--color-neutral-500);font-variant-numeric:tabular-nums;"></div>
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
        <div style="flex:1;min-width:0;">
          <div id="battle-gate-name" style="font-size:13px;color:var(--color-neutral-400);"></div>
          <div id="modifier-tag" style="font-size:10px;color:var(--color-accent-300);display:none;"></div>
        </div>
        <div id="wave-progress" style="font-size:11px;color:var(--color-neutral-500);letter-spacing:0.04em;"></div>
      </div>

      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:var(--space-4) var(--space-6);gap:var(--space-4);min-height:0;position:relative;">
        <div id="battle-toast" style="display:none;position:absolute;top:2px;left:50%;transform:translateX(-50%);z-index:10;padding:5px 12px;border-radius:999px;background:var(--color-surface);border:1px solid var(--color-neutral-800);font-size:12px;font-weight:500;white-space:nowrap;box-shadow:var(--shadow-md);"></div>

        <div style="display:flex;align-items:center;gap:6px;">
          <div id="enemy-name" style="font-size:15px;font-weight:500;"></div>
          <span id="boss-tag" class="tag tag-accent" style="display:none;flex-shrink:0;">BOSS</span>
        </div>
        <div id="combat-details" style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-neutral-500);font-variant-numeric:tabular-nums;"></div>

        <div class="arena-row" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-2);">
          <canvas id="fx-canvas" class="fx-canvas"></canvas>
          <div id="arena-flash" class="arena-flash" style="display:none;"></div>

          <div id="enemy-group" style="display:flex;align-items:flex-end;justify-content:center;gap:10px;flex-wrap:wrap;"></div>

          <span style="font-size:14px;color:var(--color-accent-400);flex-shrink:0;">${icon("lightning")}</span>

          <div id="player-row" style="display:flex;align-items:flex-end;justify-content:center;gap:var(--space-3);">
            <div id="player-portrait" class="arena-portrait">
              ${playerAuraHtml(rankForLevel(game.state.player.level))}
              <div id="player-glow" class="impact-glow"></div>
              <div class="lighten" style="width:100%;height:100%;border-radius:50%;overflow:hidden;">${hunterPortrait(rankForLevel(game.state.player.level))}</div>
              <div id="player-vfx" class="vfx-layer" style="display:none;">
                <div class="slash-bar"></div><div class="slash-bar"></div><div class="slash-bar"></div>
                <div class="power-ring"></div>
              </div>
              <div id="player-guard-ring" class="guard-ring" style="display:none;"></div>
              <div id="player-float" class="float-num" style="display:none;"></div>
              <div id="player-guard-badge" style="display:none;" title="Guarding - incoming hits reduced">${icon("shield")}<span id="player-guard-count"></span></div>
            </div>

            <div id="shadow-companion" style="display:none;flex-direction:column;align-items:center;gap:4px;">
              <div id="shadow-companion-portrait" class="arena-portrait small">
                <div id="shadow-companion-art" class="lighten" style="width:100%;height:100%;border-radius:50%;overflow:hidden;"></div>
              </div>
              <div id="shadow-companion-name" style="font-size:10px;color:var(--color-accent-300);max-width:76px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>
            </div>
          </div>
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
        <button class="btn btn-secondary action-btn" data-action="toggle-items">${icon("flask")} Items</button>

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

        <div id="item-panel" style="display:none;position:absolute;left:var(--space-6);right:var(--space-6);bottom:100%;margin-bottom:var(--space-2);max-height:264px;overflow-y:auto;background:var(--color-surface);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);">
          ${POTIONS.map((p) => `
            <div class="item-row" data-potion="${p.id}" style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border-bottom:1px solid var(--color-neutral-800);cursor:pointer;">
              <span style="font-size:18px;color:var(--color-accent-300);flex-shrink:0;">${icon(p.icon as any)}</span>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:500;">${p.name}</div>
                <div style="font-size:11px;color:var(--color-neutral-500);">Restores ${p.amount} ${p.kind.toUpperCase()}</div>
              </div>
              <div class="tag tag-outline item-count" style="font-size:10px;flex-shrink:0;">x<span></span></div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;

  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const gateNameEl = $("#battle-gate-name");
  const modifierTagEl = $("#modifier-tag");
  const battleToastEl = $("#battle-toast");
  const shadowCompanionEl = $("#shadow-companion");
  const shadowCompanionArt = $("#shadow-companion-art");
  const shadowCompanionName = $("#shadow-companion-name");
  const waveProgressEl = $("#wave-progress");
  const enemyNameEl = $("#enemy-name");
  const bossTag = $("#boss-tag");
  const combatDetailsEl = $("#combat-details");
  const playerNameEl = $("#player-name");
  const playerHpText = $("#player-hp-text");
  const playerHpFill = $("#player-hp-fill");
  const playerHpTrack = $("#player-hp-track");
  const playerMpFill = $("#player-mp-fill");
  const resultPanel = $("#battle-result");
  const resultTitle = $("#result-title");
  const resultSubtitle = $("#result-subtitle");
  const ariseBtn = $<HTMLButtonElement>("#arise-btn");
  const continueBtn = $<HTMLButtonElement>("#continue-btn");
  const actionsRow = $("#battle-actions");
  const attackBtn = $<HTMLButtonElement>('[data-action="battle-attack"]');
  const skillsToggleBtn = $<HTMLButtonElement>('[data-action="toggle-skills"]');
  const guardBtn = $<HTMLButtonElement>('[data-action="battle-guard"]');
  const itemsToggleBtn = $<HTMLButtonElement>('[data-action="toggle-items"]');
  const skillPanel = $("#skill-panel");
  const itemPanel = $("#item-panel");

  const playerPortrait = $("#player-portrait");
  const playerGlow = $("#player-glow");
  const playerVfx = $("#player-vfx");
  const playerGuardRing = $("#player-guard-ring");
  const playerFloat = $("#player-float");
  const playerGuardBadge = $("#player-guard-badge");
  const playerGuardCount = $("#player-guard-count");
  const shadowCompanionPortrait = $("#shadow-companion-portrait");
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
        case "toggle-items": return game.toggleItemPanel();
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

  root.querySelectorAll<HTMLElement>(".item-row").forEach((row) => {
    row.addEventListener("click", () => {
      if (row.classList.contains("is-disabled")) return;
      const id = row.dataset.potion;
      if (id) game.useItem(id);
    });
  });

  const unsubFx = game.onFx((e) => {
    switch (e.kind) {
      case "slash":
      case "flurry": {
        if (e.side === "player") {
          const c = center(fxCanvas, playerPortrait);
          if (e.kind === "slash") shaderFx.slash(c.x, c.y, BLOOD, 160);
          else shaderFx.flurry(c.x, c.y, BLOOD, 160);
        } else if (e.targetUid) {
          const slot = findEnemySlot(e.targetUid);
          if (slot) {
            const c = center(fxCanvas, slot);
            if (e.kind === "slash") shaderFx.slash(c.x, c.y, BLOOD, 20);
            else shaderFx.flurry(c.x, c.y, BLOOD, 20);
          }
        }
        break;
      }
      case "smash": {
        // Enemy specials only ever land on the player (side is always
        // "player" here - see enemyTurn) but keep the shape consistent
        // with slash/flurry in case that changes later.
        if (e.side === "player") {
          const c = center(fxCanvas, playerPortrait);
          shaderFx.smash(c.x, c.y, BLOOD);
        } else if (e.targetUid) {
          const slot = findEnemySlot(e.targetUid);
          if (slot) {
            const c = center(fxCanvas, slot);
            shaderFx.smash(c.x, c.y, BLOOD);
          }
        }
        break;
      }
      case "guard": {
        if (e.side === "player") {
          const c = center(fxCanvas, playerPortrait);
          shaderFx.guardRing(c.x, c.y, VIOLET_SOFT);
        } else if (e.targetUid) {
          const slot = findEnemySlot(e.targetUid);
          if (slot) {
            const c = center(fxCanvas, slot);
            shaderFx.guardRing(c.x, c.y, VIOLET_SOFT);
          }
        }
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
            const isSmall = !!slot.querySelector(".arena-portrait.small");
            const c = center(fxCanvas, slot);
            shaderFx.dissolve(c.x, c.y, VIOLET, isSmall ? 0.55 : 1);
          }
        }
        break;
      }
      case "portal": {
        const small = !!enemyGroup.querySelector(".arena-portrait.small");
        const c = enemyGroup.children.length > 0 ? center(fxCanvas, enemyGroup) : center(fxCanvas, playerPortrait);
        shaderFx.arisePortal(c.x, c.y, VIOLET_DEEP, small ? 0.6 : 1);
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
  let renderedShadowId = "";
  let renderedPlayerRank = "";

  const update = () => {
    const b = game.state.battle;
    const p = game.state.player;
    if (!b) return;

    // The portrait's own art is only drawn once at mount (regenerating its
    // SVG mid-battle would risk cutting off whatever's animating on it
    // right now) - but a rank-up crossing a rank boundary mid-fight is real,
    // so the aura wrapped around it still tracks rank live, cheaply (just a
    // CSS var + class, no DOM rebuild).
    const rank = rankForLevel(p.level);
    if (rank !== renderedPlayerRank) {
      renderedPlayerRank = rank;
      const aura = playerPortrait.querySelector<HTMLElement>(".player-aura");
      if (aura) {
        aura.style.setProperty("--aura", PLAYER_RANK_GLOW[rank]);
        aura.className = `player-aura tier-${AURA_TIER[rank]}`;
      }
    }

    gateNameEl.textContent = b.gateName;
    if (b.modifier && b.modifier.key !== "none") {
      modifierTagEl.textContent = b.modifier.label;
      modifierTagEl.title = b.modifier.description;
      modifierTagEl.style.display = "block";
    } else {
      modifierTagEl.style.display = "none";
    }

    if (b.toast) {
      const color = b.toast.kind === "gold" ? "#f5c451" : b.toast.rarity ? RARITY_META[b.toast.rarity].color : "var(--color-accent-300)";
      battleToastEl.textContent = b.toast.kind === "loot" ? `Found: ${b.toast.text}` : b.toast.text;
      battleToastEl.style.color = color;
      battleToastEl.style.borderColor = color;
      battleToastEl.style.display = "block";
    } else {
      battleToastEl.style.display = "none";
    }

    const deployedShadow = game.state.shadowArmy.find((s) => s.deployed);
    if (deployedShadow) {
      shadowCompanionEl.style.display = "flex";
      if (renderedShadowId !== deployedShadow.id) {
        renderedShadowId = deployedShadow.id;
        shadowCompanionArt.innerHTML = shadowPortrait(deployedShadow.rank);
      }
      shadowCompanionName.textContent = deployedShadow.name;
    } else {
      shadowCompanionEl.style.display = "none";
      renderedShadowId = "";
    }

    waveProgressEl.textContent = b.isBossWave ? "FINAL WAVE" : `WAVE ${b.waveIndex} / ${b.totalWaves}`;
    const currentTarget = b.enemies.find((u) => u.alive);
    // Trash waves can field up to 3 differently-named units at once now, so
    // the header follows whichever one is actually the current target
    // (each portrait also carries its own name label below it).
    enemyNameEl.textContent = currentTarget?.name ?? b.enemies[0]?.name ?? "";
    bossTag.style.display = b.isBossWave ? "inline-flex" : "none";

    if (currentTarget && !b.over) {
      const critPct = Math.round(game.critChance * 100);
      combatDetailsEl.style.visibility = "visible";
      combatDetailsEl.innerHTML = `
        <span>Target — ATK ${currentTarget.atk} · DEF ${currentTarget.def}</span>
        <span>You — STR ${game.effectiveStat("str")} · CRIT ${critPct}%</span>
      `;
    } else {
      combatDetailsEl.style.visibility = "hidden";
    }

    const waveKey = `${b.gateId}:${b.waveIndex}`;
    if (waveKey !== renderedWaveKey) {
      renderedWaveKey = waveKey;
      const small = b.enemies.length > 1;
      const archetype = ARCHETYPE_BY_RANK[b.rank];
      // A fresh enemyPortrait() call per unit (not one shared string) - each
      // generates its own unique gradient-id suffix so simultaneous enemy
      // portraits never collide on <defs> ids within the same DOM.
      enemyGroup.innerHTML = b.enemies
        .map((u) => enemySlotHtml(u, enemyPortrait(archetype, b.rank), b.isBossWave, small))
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
      const nameEl = slot.querySelector<HTMLElement>(".mini-enemy-name")!;
      const hpFill = slot.querySelector<HTMLElement>(".mini-hp-fill")!;
      const hpText = slot.querySelector<HTMLElement>(".mini-hp-text")!;
      const guardBadgeEl = slot.querySelector<HTMLElement>(".guard-badge")!;

      slot.style.opacity = unit.alive ? "1" : "0.18";
      slot.style.filter = unit.alive ? "none" : "grayscale(1)";
      nameEl.classList.toggle("is-target", unit.uid === firstAliveUid);
      hpFill.style.width = `${Math.round((unit.hp / unit.maxHp) * 100)}%`;
      hpText.textContent = `${unit.hp}/${unit.maxHp}`;
      glowEl.classList.toggle("show", !!unit.glow);
      vfxEl.style.display = unit.vfx ? "block" : "none";
      vfxEl.className = `vfx-layer ${unit.vfx ?? ""}`;
      flareEl.style.display = unit.vfx === "flurry" ? "block" : "none";
      portraitEl.classList.toggle("lunge-down", unit.lunging);
      guardBadgeEl.style.display = unit.guardRounds > 0 ? "flex" : "none";

      if (unit.floatText) {
        floatEl.textContent = unit.floatText.text;
        floatEl.className = `float-num ${unit.floatText.kind}`;
        floatEl.style.display = "block";
      } else {
        floatEl.style.display = "none";
      }
    }

    const maxHp = game.effectiveMaxHp();
    const maxMp = game.effectiveMaxMp();
    playerNameEl.textContent = p.name;
    playerHpText.textContent = `${p.hp} / ${maxHp} HP`;
    playerHpFill.style.width = `${Math.round((p.hp / maxHp) * 100)}%`;
    playerHpTrack.classList.toggle("hit", !!b.playerHit);
    playerMpFill.style.width = `${Math.round((p.mp / maxMp) * 100)}%`;

    attackBtn.disabled = b.locked;
    guardBtn.disabled = b.locked;
    skillsToggleBtn.disabled = b.locked;
    itemsToggleBtn.disabled = b.locked;

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

    itemPanel.style.display = b.itemPanelOpen ? "block" : "none";
    root.querySelectorAll<HTMLElement>(".item-row").forEach((row) => {
      const id = row.dataset.potion!;
      const count = game.state.inventory.potions[id] ?? 0;
      const disabled = count <= 0 || b.locked;
      row.classList.toggle("is-disabled", disabled);
      row.style.opacity = disabled ? "0.45" : "1";
      row.style.cursor = disabled ? "not-allowed" : "pointer";
      row.querySelector<HTMLElement>(".item-count span")!.textContent = String(count);
    });

    // playerGlow doubles for damage-taken *and* heal - only tint it blood
    // red while the active float is a hit landing, not a potion's +HP/MP.
    playerGlow.classList.toggle("show", !!b.playerGlow);
    playerGlow.classList.toggle("dmg", b.floatPlayer?.kind === "dmg" || b.floatPlayer?.kind === "crit");
    playerVfx.style.display = b.vfxPlayer ? "block" : "none";
    playerVfx.className = `vfx-layer ${b.vfxPlayer ?? ""}`;
    playerGuardRing.style.display = b.guardRing ? "block" : "none";
    playerPortrait.classList.toggle("lunge-up", b.lunge === "player");
    shadowCompanionPortrait.classList.toggle("lunge-up", !!b.shadowLunge);
    arenaFlash.style.display = b.flash ? "block" : "none";

    if (b.guardRounds > 0) {
      playerGuardBadge.style.display = "flex";
      playerGuardCount.textContent = String(b.guardRounds);
    } else {
      playerGuardBadge.style.display = "none";
    }

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
      itemPanel.style.display = "none";
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
