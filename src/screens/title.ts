import type { Game } from "../store";
import { simpleScreen } from "./types";
import { icon } from "../art/icons";
import { hunterPortrait, playerAuraHtml } from "../art/portraits";
import { rankForLevel } from "../data";

/** A field of slow-drifting motes behind the title content - pure CSS,
 *  each one just gets a random horizontal position/duration/delay so the
 *  field doesn't look like a repeating tile. */
function motesHtml(count: number): string {
  let out = "";
  for (let i = 0; i < count; i++) {
    const left = Math.round(Math.random() * 100);
    const duration = (7 + Math.random() * 7).toFixed(1);
    const delay = (Math.random() * 9).toFixed(1);
    const size = (2 + Math.random() * 2).toFixed(1);
    out += `<span class="title-mote" style="left:${left}%;width:${size}px;height:${size}px;animation-duration:${duration}s;animation-delay:${delay}s;"></span>`;
  }
  return out;
}

export const titleScreen = simpleScreen((game: Game) => {
  const p = game.state.player;
  const rank = rankForLevel(p.level);
  return `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:var(--space-8);position:relative;overflow:hidden;
      background:radial-gradient(120% 90% at 20% 0%, var(--color-section-glow) 0%, var(--color-bg) 55%);">
      <div style="position:absolute;inset:0;pointer-events:none;overflow:hidden;">${motesHtml(16)}</div>

      <div style="position:relative;">
        <div style="position:relative;width:104px;height:104px;margin-bottom:var(--space-6);">
          ${playerAuraHtml(rank)}
          <div style="width:100%;height:100%;border-radius:50%;overflow:hidden;position:relative;z-index:1;">${hunterPortrait(rank)}</div>
        </div>
        <div class="title-reveal" style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:var(--color-accent-300);margin-bottom:var(--space-3);animation-delay:0.05s;">
          System Notice<span class="title-cursor"></span>
        </div>
        <h1 class="title-reveal title-glow" style="font-size:38px;margin-bottom:var(--space-3);animation-delay:0.15s;">Hunter Protocol</h1>
        <p class="title-reveal" style="color:var(--color-neutral-400);max-width:30ch;font-size:15px;animation-delay:0.25s;">You have been chosen to break the loop. Clear the gates, raise your rank, and arise the shadows you defeat.</p>
      </div>
      <div class="title-reveal" style="display:flex;flex-direction:column;gap:var(--space-4);position:relative;animation-delay:0.35s;">
        <div class="hr" style="margin:0;"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:20px;font-weight:500;">${p.name}</div>
            <div style="font-size:13px;color:var(--color-neutral-400);">${rank}-Rank Hunter · Level ${p.level}</div>
            <div style="font-size:12px;color:var(--color-accent-300);margin-top:2px;">${icon("lightning")} Power ${game.powerScore.toLocaleString()}</div>
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
