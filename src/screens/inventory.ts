import type { Game } from "../store";
import { simpleScreen } from "./types";
import { icon } from "../art/icons";
import { EQUIPMENT } from "../data";

export const inventoryScreen = simpleScreen((game: Game) => {
  const items = EQUIPMENT.map((item) => `
    <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);">
      <span style="font-size:20px;color:var(--color-accent-300);">${icon(item.icon as any)}</span>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:500;">${item.name}</div>
        <div style="font-size:11px;color:var(--color-neutral-500);">${item.slot}</div>
      </div>
      <div class="tag tag-accent-2" style="font-size:10px;">${item.bonus}</div>
    </div>
  `).join("");

  return `
    <div style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
      <div>
        <h4 style="margin-bottom:var(--space-1);">Inventory</h4>
        <div style="font-size:13px;color:var(--color-neutral-400);">Equipment and consumables</div>
      </div>
      <div>
        <h5 style="margin-bottom:var(--space-2);color:var(--color-neutral-400);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Equipped</h5>
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">${items}</div>
      </div>
      <div>
        <h5 style="margin-bottom:var(--space-2);color:var(--color-neutral-400);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Consumables</h5>
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);">
          <span style="font-size:20px;color:var(--color-accent-300);">${icon("flask")}</span>
          <div style="flex:1;">
            <div style="font-size:13px;font-weight:500;">Healing Potion</div>
            <div style="font-size:11px;color:var(--color-neutral-500);">Restores 30 HP in battle</div>
          </div>
          <div class="tag tag-outline">x${game.state.inventory.potions}</div>
        </div>
      </div>
    </div>
  `;
});
