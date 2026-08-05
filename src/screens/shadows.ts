import type { Game } from "../store";
import { simpleScreen } from "./types";
import { icon } from "../art/icons";
import { shadowPortrait } from "../art/portraits";

export const shadowsScreen = simpleScreen((game: Game) => {
  const { shadowArmy } = game.state;
  const deployed = shadowArmy.find((s) => s.deployed);
  const empty = shadowArmy.length === 0
    ? `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);color:var(--color-neutral-500);text-align:center;">
        <span style="font-size:40px;color:var(--color-neutral-700);">${icon("ghost", "1em")}</span>
        <div style="font-size:13px;max-width:24ch;">No shadows yet. Defeat a monster in battle and choose "Arise" to command it.</div>
      </div>`
    : "";

  const cards = shadowArmy.map((shadow) => `
    <div class="card elev-sm" style="padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2); ${shadow.deployed ? "box-shadow:0 0 0 1.5px var(--color-accent-400);" : ""}">
      <div style="width:100%;height:80px;border-radius:8px;overflow:hidden;position:relative;" class="lighten">
        ${shadowPortrait(shadow.type)}
        ${shadow.deployed ? `<div style="position:absolute;top:4px;right:4px;background:var(--color-accent-800);color:var(--color-accent-100);font-size:9px;padding:2px 6px;border-radius:4px;">ACTIVE</div>` : ""}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:16px;color:var(--color-accent-300);">${icon("skull")}</span>
        <div class="tag tag-outline" style="font-size:10px;">${shadow.rank}</div>
      </div>
      <div style="font-size:14px;font-weight:500;">${shadow.name}</div>
      <div style="font-size:11px;color:var(--color-neutral-500);">${shadow.type} · Power ${shadow.power}</div>
      <button class="btn ${shadow.deployed ? "btn-primary" : "btn-secondary"} action-btn" style="justify-content:center;padding:6px;font-size:12px;" data-action="deploy-shadow" data-id="${shadow.id}">
        ${shadow.deployed ? "Recall" : "Deploy"}
      </button>
    </div>
  `).join("");

  return `
    <div style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
      <div>
        <h4 style="margin-bottom:var(--space-1);">Shadow Army</h4>
        <div style="font-size:13px;color:var(--color-neutral-400);">
          ${shadowArmy.length} shadows arisen${deployed ? ` · <span style="color:var(--color-accent-300);">${deployed.name} deployed</span>` : ""}
        </div>
      </div>
      ${empty}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">${cards}</div>
    </div>
  `;
}, (root, game) => {
  root.querySelectorAll<HTMLElement>('[data-action="deploy-shadow"]').forEach((el) => {
    el.addEventListener("click", () => game.deployShadow(el.dataset.id!));
  });
});
