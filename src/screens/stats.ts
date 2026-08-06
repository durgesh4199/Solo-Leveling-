import type { Game } from "../store";
import type { ScreenModule } from "./types";
import { icon } from "../art/icons";
import { rankForLevel, STAT_DEFS, STAT_TUNING } from "../data";
import type { StatKey } from "../types";

/** What a single point in this stat actually buys, in concrete numbers -
 *  previewed on hover (before you commit) and floated as a confirmation
 *  the moment you spend the point, so "+1 STR" is never a guess. */
function gainText(stat: StatKey): string {
  const t = STAT_TUNING;
  switch (stat) {
    case "str": return `+${t.strAtkPerPoint.toFixed(1)} ATK`;
    case "vit": return `+${t.vitHpPerPoint} Max HP`;
    case "int": return `+${t.intMpPerPoint} Max MP`;
    case "agi": return `+${(t.agiCritPerPoint * 100).toFixed(1)}% Crit · -${(t.agiMissReductionPerPoint * 100).toFixed(0)}% Guard Miss`;
    case "per": return `+${(t.perCritPerPoint * 100).toFixed(1)}% Crit · -${(t.perMissReductionPerPoint * 100).toFixed(1)}% Guard Miss`;
  }
}

export const statsScreen: ScreenModule = (root, game) => {
  root.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
      <div>
        <h4 style="margin-bottom:var(--space-1);">Status Window</h4>
        <div id="stats-sub" style="font-size:13px;color:var(--color-neutral-400);"></div>
      </div>
      <div class="card power-card" style="padding:var(--space-4);flex-direction:row;align-items:center;gap:var(--space-3);border:1px solid var(--color-accent-700);box-shadow:0 0 22px 1px color-mix(in srgb, var(--color-accent) 22%, transparent);">
        <span style="font-size:26px;color:var(--color-accent-300);flex-shrink:0;">${icon("lightning")}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-500);">Power</div>
          <div id="power-score" style="font-size:26px;font-weight:600;font-family:var(--font-heading);color:var(--color-accent-200);font-variant-numeric:tabular-nums;"></div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-3);">
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-neutral-400);margin-bottom:4px;"><span>HP</span><span id="stat-hp-text"></span></div>
          <div class="bar-track"><div id="stat-hp-fill" class="bar-fill" style="background:var(--color-accent-400);"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-neutral-400);margin-bottom:4px;"><span>MP</span><span id="stat-mp-text"></span></div>
          <div class="bar-track"><div id="stat-mp-fill" class="bar-fill" style="background:var(--color-neutral-500);"></div></div>
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--color-neutral-400);margin-bottom:4px;"><span>XP</span><span id="stat-xp-text"></span></div>
          <div class="bar-track"><div id="stat-xp-fill" class="bar-fill" style="background:var(--color-accent-600);"></div></div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <h5 style="margin:0;">Stat Points</h5>
        <div id="stat-points" class="tag tag-outline"></div>
      </div>
      <div id="stat-rows" style="display:flex;flex-direction:column;gap:var(--space-2);"></div>
    </div>
  `;

  const rowsContainer = root.querySelector<HTMLElement>("#stat-rows")!;
  rowsContainer.innerHTML = STAT_DEFS.map((d) => `
    <div class="stat-row" style="position:relative;display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);">
      <div class="stat-gain-toast" style="display:none;position:absolute;right:var(--space-3);top:0;font-size:11px;font-weight:600;color:var(--color-accent-300);white-space:nowrap;pointer-events:none;text-shadow:0 2px 8px rgba(0,0,0,0.7);"></div>
      <div style="display:flex;align-items:center;gap:var(--space-2);">
        <span style="font-size:16px;color:var(--color-accent-400);flex-shrink:0;">${icon(d.icon as any)}</span>
        <div style="font-size:13px;color:var(--color-neutral-300);">${d.label}</div>
      </div>
      <div style="display:flex;align-items:center;gap:var(--space-3);">
        <div id="stat-val-${d.key}" style="font-size:16px;font-weight:500;min-width:24px;text-align:right;"></div>
        <button class="btn btn-icon stat-plus" style="width:28px;height:28px;border:1px solid var(--color-accent-700);color:var(--color-accent-300);" data-action="add-stat" data-stat="${d.key}">${icon("plus")}</button>
      </div>
    </div>
  `).join("");

  rowsContainer.querySelectorAll<HTMLButtonElement>('[data-action="add-stat"]').forEach((btn) => {
    const stat = btn.dataset.stat as StatKey;
    const toast = btn.closest(".stat-row")?.querySelector<HTMLElement>(".stat-gain-toast");

    // Hover previews the payoff *before* you commit the point - "what am
    // I about to buy", not just "what did I just buy".
    btn.addEventListener("mouseenter", () => {
      if (!toast || btn.disabled) return;
      toast.textContent = gainText(stat);
      toast.classList.remove("show");
      toast.style.display = "block";
    });
    btn.addEventListener("mouseleave", () => {
      if (!toast || toast.dataset.animating === "1") return;
      toast.style.display = "none";
    });

    btn.addEventListener("click", () => {
      if (game.state.player.statPoints <= 0) return;
      game.addStat(stat);
      if (toast) {
        toast.textContent = gainText(stat);
        toast.style.display = "block";
        toast.dataset.animating = "1";
        toast.classList.remove("show");
        void toast.offsetWidth; // restart the animation on repeat clicks
        toast.classList.add("show");
        setTimeout(() => {
          toast.dataset.animating = "0";
          toast.style.display = "none";
        }, 1000);
      }
    });
  });

  let lastPower: number | null = null;

  const els = {
    sub: root.querySelector<HTMLElement>("#stats-sub")!,
    powerScore: root.querySelector<HTMLElement>("#power-score")!,
    hpText: root.querySelector<HTMLElement>("#stat-hp-text")!,
    hpFill: root.querySelector<HTMLElement>("#stat-hp-fill")!,
    mpText: root.querySelector<HTMLElement>("#stat-mp-text")!,
    mpFill: root.querySelector<HTMLElement>("#stat-mp-fill")!,
    xpText: root.querySelector<HTMLElement>("#stat-xp-text")!,
    xpFill: root.querySelector<HTMLElement>("#stat-xp-fill")!,
    points: root.querySelector<HTMLElement>("#stat-points")!
  };

  const update = () => {
    const p = game.state.player;
    const rank = rankForLevel(p.level);
    const maxHp = game.effectiveMaxHp();
    const maxMp = game.effectiveMaxMp();
    els.sub.textContent = `${p.name} · ${rank}-Rank · Level ${p.level}`;

    const power = game.powerScore;
    els.powerScore.textContent = power.toLocaleString();
    if (lastPower !== null && power > lastPower) {
      els.powerScore.classList.remove("power-up");
      void els.powerScore.offsetWidth;
      els.powerScore.classList.add("power-up");
    }
    lastPower = power;

    els.hpText.textContent = `${p.hp} / ${maxHp}`;
    els.hpFill.style.width = `${Math.round((p.hp / maxHp) * 100)}%`;
    els.mpText.textContent = `${p.mp} / ${maxMp}`;
    els.mpFill.style.width = `${Math.round((p.mp / maxMp) * 100)}%`;
    els.xpText.textContent = `${p.xp} / ${p.xpToNext}`;
    els.xpFill.style.width = `${Math.round((p.xp / p.xpToNext) * 100)}%`;
    els.points.textContent = `${p.statPoints} available`;

    for (const d of STAT_DEFS) {
      const valEl = root.querySelector<HTMLElement>(`#stat-val-${d.key}`);
      if (valEl) valEl.textContent = String(p[d.key]);
      const btn = root.querySelector<HTMLButtonElement>(`[data-action="add-stat"][data-stat="${d.key}"]`);
      if (btn) btn.disabled = p.statPoints <= 0;
    }
  };

  update();
  return { update };
};
