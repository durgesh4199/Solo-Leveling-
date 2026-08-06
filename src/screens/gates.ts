import type { Game } from "../store";
import { simpleScreen } from "./types";
import { icon } from "../art/icons";
import { gatePortrait } from "../art/portraits";
import { RANK_TAG_CLASS, totalEnemiesForGate } from "../data";

export const gatesScreen = simpleScreen((game: Game) => {
  const rows = game.gates.map((gate) => {
    const cleared = !!game.state.gatesCleared[gate.id];
    const total = totalEnemiesForGate(gate);
    return `
      <div class="gate-row ${cleared ? "cleared" : ""}" style="border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);padding:var(--space-4);display:flex;align-items:center;justify-content:space-between;" data-action="enter-gate" data-gate-id="${gate.id}">
        <div style="display:flex;align-items:center;gap:var(--space-3);">
          <div style="width:44px;height:44px;flex-shrink:0;border-radius:8px;overflow:hidden;" class="lighten">${gatePortrait(gate.rank)}</div>
          <div class="tag ${RANK_TAG_CLASS[gate.rank]}" style="min-width:28px;justify-content:center;">${gate.rank}</div>
          <div>
            <div style="font-size:15px;font-weight:500;">${gate.name}</div>
            <div style="font-size:12px;color:var(--color-neutral-500);">${gate.enemyTypes.length} enemy types · ${total - 1} + boss · Rec. Lv ${gate.recommendedLevel}</div>
          </div>
        </div>
        ${cleared
          ? `<span style="color:var(--color-accent-300);font-size:18px;">${icon("check-circle")}</span>`
          : `<span style="color:var(--color-neutral-500);font-size:18px;">${icon("caret-right")}</span>`}
      </div>
    `;
  }).join("");

  return `
    <div style="flex:1;display:flex;flex-direction:column;min-height:0;">
      <div style="padding:var(--space-6) var(--space-6) var(--space-3);">
        <h4 style="margin-bottom:var(--space-1);">Gate Selection</h4>
        <div style="font-size:13px;color:var(--color-neutral-400);">Choose a gate to enter. Higher ranks hit harder.</div>
      </div>
      <div style="flex:1;overflow-y:auto;padding:0 var(--space-6) var(--space-4);display:flex;flex-direction:column;gap:var(--space-3);">
        ${rows}
      </div>
    </div>
  `;
}, (root, game) => {
  root.querySelectorAll<HTMLElement>('[data-action="enter-gate"]').forEach((el) => {
    el.addEventListener("click", () => {
      const gate = game.gates.find((g) => g.id === el.dataset.gateId);
      if (gate) game.startBattle(gate);
    });
  });
});
