import type { Game } from "../store";
import { simpleScreen } from "./types";
import { icon } from "../art/icons";
import { TOWER_MILESTONE_INTERVAL } from "../systems/tower/data";

/** Item #17 of the fixed roadmap. A lobby, not a list - unlike Gates
 *  (pick one of 20 fixed destinations), the Tower is a single endless
 *  track with nothing to choose: every attempt starts at floor 1 and
 *  climbs as far as it can in one continuous run (HP/MP carry floor-to-
 *  floor, same as Gates' wave-to-wave carryover), so the only real
 *  decision here is "begin". `simpleScreen` fits cleanly - the only state
 *  this screen shows (tower.highestFloor) lives on the store, not in any
 *  local UI-only variable. */
export const towerScreen = simpleScreen((game: Game) => {
  const highest = game.state.tower.highestFloor;
  return `
    <div data-scroll style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
      <div>
        <h4 style="margin-bottom:var(--space-1);">Infinite Tower</h4>
        <div style="font-size:13px;color:var(--color-neutral-400);">
          A single, unending column of Gate bosses. Climb as far as one run can carry you.
        </div>
      </div>

      <div class="card power-card" style="padding:var(--space-4);flex-direction:row;align-items:center;gap:var(--space-3);border:1px solid var(--color-accent-700);box-shadow:0 0 22px 1px color-mix(in srgb, var(--color-accent) 22%, transparent);">
        <span style="font-size:26px;color:var(--color-accent-300);flex-shrink:0;">${icon("skull")}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:var(--color-neutral-500);">Highest Floor Reached</div>
          <div style="font-size:26px;font-weight:600;font-family:var(--font-heading);color:var(--color-accent-200);font-variant-numeric:tabular-nums;">${highest}</div>
        </div>
      </div>

      <div class="card" style="padding:var(--space-4);display:flex;flex-direction:column;gap:var(--space-2);font-size:12px;color:var(--color-neutral-400);">
        <div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--color-accent-300);">${icon("lightning")}</span>Every floor fields one boss - no trash, and no fixed end.</div>
        <div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--color-accent-300);">${icon("shield")}</span>HP and MP carry from floor to floor - a fall ends the run, but never lowers your record.</div>
        <div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--color-accent-300);">${icon("sparkles")}</span>Every floor rolls its own Dungeon Modifier and a chance at a Random Event.</div>
        <div style="display:flex;align-items:center;gap:8px;"><span style="color:var(--color-accent-300);">${icon("coin")}</span>Every ${TOWER_MILESTONE_INTERVAL}th floor pays a bonus gold milestone on top of its normal reward.</div>
      </div>

      <button class="btn btn-primary action-btn" style="justify-content:center;padding:var(--space-3);font-size:14px;" data-action="begin-climb">
        ${icon("skull")} ${highest > 0 ? "Climb Again" : "Begin Climb"}
      </button>
    </div>
  `;
}, (root, game) => {
  root.querySelector<HTMLElement>('[data-action="begin-climb"]')?.addEventListener("click", () => game.startTowerFloor());
});
