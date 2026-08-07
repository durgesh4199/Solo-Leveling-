import type { Game } from "../store";
import type { ScreenModule } from "./types";
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

/** Not a `simpleScreen` - "Start a New Hunter" needs an inline confirm
 *  step (below), so it needs closure-held view state to redraw against,
 *  the same pattern as every other confirm-gated action in the game
 *  (Inventory's sell, Shadow Army's merge/evolve). This screen used to
 *  gate the wipe behind a native `window.confirm()` instead; that reads
 *  fine in a normal browser tab but silently does nothing inside the
 *  sandboxed iframe the published Claude Artifact runs in (no
 *  `allow-modals`, so `confirm()` returns false without ever showing a
 *  dialog) - from the player's side, the button just didn't work. An
 *  in-app confirm works everywhere, so it replaces the native one
 *  outright rather than living alongside it. */
export const titleScreen: ScreenModule = (root, game) => {
  // Only ever relevant when a save exists to wipe - reset if a save gets
  // consumed (continueSave) or cleared out from under this flag.
  let confirmingNewHunter = false;

  const draw = () => {
    // A save loaded at boot hasn't been applied to game.state yet (see
    // Game.continueSave) - preview *its* name/level/rank here rather than
    // the fresh default player, so "Continue" doesn't lie about who
    // you're continuing as. Power score needs live equipment/title
    // bonuses this peek doesn't have, so it's only shown for a true
    // fresh start.
    const saved = game.peekSave();
    const hasSave = saved !== null;
    if (!hasSave) confirmingNewHunter = false;
    const p = hasSave ? saved!.player : game.state.player;
    const rank = rankForLevel(p.level);

    const summaryLine = hasSave
      ? `<div style="font-size:12px;color:var(--color-accent-300);margin-top:2px;">Continue to resume this Hunter</div>`
      : `<div style="font-size:12px;color:var(--color-accent-300);margin-top:2px;">${icon("lightning")} Power ${game.powerScore.toLocaleString()}</div>`;

    const actions = hasSave
      ? confirmingNewHunter
        ? `
          <div style="font-size:12px;color:var(--color-accent-300);text-align:center;">Start a New Hunter? This permanently deletes your current save.</div>
          <div style="display:flex;gap:var(--space-2);">
            <button class="btn btn-secondary action-btn" style="flex:1;justify-content:center;padding:var(--space-2);font-size:12px;" data-action="cancel-new-hunter">Cancel</button>
            <button class="btn btn-primary action-btn" style="flex:1;justify-content:center;padding:var(--space-2);font-size:12px;" data-action="confirm-new-hunter">Confirm</button>
          </div>`
        : `
          <button class="btn btn-primary btn-block" style="justify-content:center;padding:var(--space-3);" data-action="continue-save">${icon("door-open")} Continue</button>
          <button class="btn btn-secondary action-btn" style="justify-content:center;padding:var(--space-2);font-size:12px;" data-action="new-hunter">Start a New Hunter</button>`
      : `<button class="btn btn-primary btn-block" style="justify-content:center;padding:var(--space-3);" data-action="begin-game">${icon("door-open")} Enter the System</button>`;

    root.innerHTML = `
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
              ${summaryLine}
            </div>
            <div class="tag tag-accent">${hasSave ? "Welcome Back" : "Awakened"}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">${actions}</div>
        </div>
      </div>
    `;

    root.querySelector('[data-action="begin-game"]')?.addEventListener("click", () => game.beginGame());
    root.querySelector('[data-action="continue-save"]')?.addEventListener("click", () => game.continueSave());
    root.querySelector('[data-action="new-hunter"]')?.addEventListener("click", () => { confirmingNewHunter = true; draw(); });
    root.querySelector('[data-action="cancel-new-hunter"]')?.addEventListener("click", () => { confirmingNewHunter = false; draw(); });
    root.querySelector('[data-action="confirm-new-hunter"]')?.addEventListener("click", () => {
      confirmingNewHunter = false;
      game.startNewHunter();
    });
  };

  draw();
  return { update: draw };
};
