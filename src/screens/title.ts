import type { Game } from "../store";
import { simpleScreen } from "./types";
import { icon } from "../art/icons";
import { hunterPortrait } from "../art/portraits";
import { rankForLevel } from "../data";

export const titleScreen = simpleScreen((game: Game) => {
  const p = game.state.player;
  const rank = rankForLevel(p.level);
  return `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:var(--space-8);
      background:radial-gradient(120% 90% at 20% 0%, var(--color-section-glow) 0%, var(--color-bg) 55%);">
      <div>
        <div style="width:96px;height:96px;margin-bottom:var(--space-4);border-radius:50%;overflow:hidden;">${hunterPortrait()}</div>
        <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--color-accent-300);margin-bottom:var(--space-3);">System Notice</div>
        <h1 style="font-size:38px;margin-bottom:var(--space-3);">Hunter Protocol</h1>
        <p style="color:var(--color-neutral-400);max-width:30ch;font-size:15px;">You have been chosen to break the loop. Clear the gates, raise your rank, and arise the shadows you defeat.</p>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-4);">
        <div class="hr" style="margin:0;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:20px;font-weight:500;">${p.name}</div>
            <div style="font-size:13px;color:var(--color-neutral-400);">${rank}-Rank Hunter · Level ${p.level}</div>
          </div>
          <div class="tag tag-accent">Awakened</div>
        </div>
        <button class="btn btn-primary btn-block" style="justify-content:center;padding:var(--space-3);" data-action="begin-game">${icon("door-open")} Enter the System</button>
      </div>
    </div>
  `;
}, (root, game) => {
  root.querySelector('[data-action="begin-game"]')?.addEventListener("click", () => game.beginGame());
});
