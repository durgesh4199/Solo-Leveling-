import type { Game } from "../store";
import type { ScreenModule } from "./types";
import { icon } from "../art/icons";
import { rankForLevel, STAT_DEFS } from "../data";

export const statsScreen: ScreenModule = (root, game) => {
  root.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
      <div>
        <h4 style="margin-bottom:var(--space-1);">Status Window</h4>
        <div id="stats-sub" style="font-size:13px;color:var(--color-neutral-400);"></div>
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
    <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) var(--space-3);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);">
      <div style="font-size:13px;color:var(--color-neutral-300);">${d.label}</div>
      <div style="display:flex;align-items:center;gap:var(--space-3);">
        <div id="stat-val-${d.key}" style="font-size:16px;font-weight:500;min-width:24px;text-align:right;"></div>
        <button class="btn btn-icon stat-plus" style="width:28px;height:28px;border:1px solid var(--color-accent-700);color:var(--color-accent-300);" data-action="add-stat" data-stat="${d.key}">${icon("plus")}</button>
      </div>
    </div>
  `).join("");

  rowsContainer.querySelectorAll<HTMLElement>('[data-action="add-stat"]').forEach((btn) => {
    btn.addEventListener("click", () => game.addStat(btn.dataset.stat as any));
  });

  const els = {
    sub: root.querySelector<HTMLElement>("#stats-sub")!,
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
    els.sub.textContent = `${p.name} · ${rank}-Rank · Level ${p.level}`;
    els.hpText.textContent = `${p.hp} / ${p.maxHp}`;
    els.hpFill.style.width = `${Math.round((p.hp / p.maxHp) * 100)}%`;
    els.mpText.textContent = `${p.mp} / ${p.maxMp}`;
    els.mpFill.style.width = `${Math.round((p.mp / p.maxMp) * 100)}%`;
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
