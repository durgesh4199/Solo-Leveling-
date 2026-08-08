import type { Game } from "../store";
import { simpleScreen } from "./types";
import { icon } from "../art/icons";
import { gatePortrait } from "../art/portraits";
import { RANK_TAG_CLASS, totalEnemiesForGate } from "../data";

export const gatesScreen = simpleScreen((game: Game) => {
  const examRank = game.examEligibleRank();

  // Promotion Exam banner (#10) - only ever rendered when a Hunter has
  // out-leveled their confirmed rank, above the normal gate list rather
  // than mixed into it (it isn't one of the 20 explorable gates - see
  // Game.gates's doc comment).
  const examBanner = examRank
    ? `
      <div style="border:1px solid var(--color-accent-600);border-radius:var(--radius-md);padding:var(--space-4);display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);background:color-mix(in srgb, var(--color-accent) 8%, transparent);margin:0 var(--space-6) var(--space-3);" data-action="start-exam">
        <div style="display:flex;align-items:center;gap:var(--space-3);min-width:0;">
          <div class="tag ${RANK_TAG_CLASS[examRank]}" style="min-width:28px;justify-content:center;flex-shrink:0;">${examRank}</div>
          <div style="min-width:0;">
            <div style="font-size:15px;font-weight:600;color:var(--color-accent-200);">${examRank}-Rank Promotion Exam Available</div>
            <div style="font-size:12px;color:var(--color-neutral-400);">A single, tougher solo trial - pass it to be officially recognized as ${examRank}-Rank.</div>
          </div>
        </div>
        <button class="btn btn-primary action-btn" style="flex-shrink:0;padding:8px 14px;font-size:12px;" data-action="start-exam">${icon("lightning")} Begin Exam</button>
      </div>`
    : "";

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
      ${examBanner}
      <div style="flex:1;overflow-y:auto;padding:0 var(--space-6) var(--space-4);display:flex;flex-direction:column;gap:var(--space-3);">
        ${rows}
      </div>
    </div>
  `;
}, (root, game) => {
  root.querySelectorAll<HTMLElement>('[data-action="enter-gate"]').forEach((el) => {
    el.addEventListener("click", () => {
      const gate = el.dataset.gateId ? game.getGate(el.dataset.gateId) : undefined;
      if (gate) game.startBattle(gate);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-action="start-exam"]').forEach((el) => {
    el.addEventListener("click", () => game.startPromotionExam());
  });
});
