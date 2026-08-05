import type { Game } from "../store";
import { simpleScreen } from "./types";
import { icon } from "../art/icons";
import { shadowPortrait } from "../art/portraits";

export const shadowsScreen = simpleScreen((game: Game) => {
  const { shadowArmy } = game.state;
  const empty = shadowArmy.length === 0
    ? `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);color:var(--color-neutral-500);text-align:center;">
        <span style="font-size:40px;color:var(--color-neutral-700);">${icon("ghost", "1em")}</span>
        <div style="font-size:13px;max-width:24ch;">No shadows yet. Defeat a monster in battle and choose "Arise" to command it.</div>
      </div>`
    : "";

  const cards = shadowArmy.map((shadow) => `
    <div class="card elev-sm" style="padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2);">
      <div style="width:100%;height:80px;border-radius:8px;overflow:hidden;" class="lighten">${shadowPortrait(shadow.type)}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:16px;color:var(--color-accent-300);">${icon("skull")}</span>
        <div class="tag tag-outline" style="font-size:10px;">${shadow.rank}</div>
      </div>
      <div style="font-size:14px;font-weight:500;">${shadow.name}</div>
      <div style="font-size:11px;color:var(--color-neutral-500);">${shadow.type}</div>
    </div>
  `).join("");

  return `
    <div style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
      <div>
        <h4 style="margin-bottom:var(--space-1);">Shadow Army</h4>
        <div style="font-size:13px;color:var(--color-neutral-400);">${shadowArmy.length} shadows arisen</div>
      </div>
      ${empty}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">${cards}</div>
    </div>
  `;
});
