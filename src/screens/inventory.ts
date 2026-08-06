import type { Game } from "../store";
import type { ScreenModule } from "./types";
import { icon } from "../art/icons";
import { POTIONS, RARITY_META } from "../data";
import type { ItemRarity, ItemSlot, LootItem } from "../types";

const SLOT_LABEL: Record<ItemSlot, string> = {
  weapon: "Weapon", armor: "Armor", ring: "Ring", amulet: "Amulet"
};
const SLOT_ORDER: ItemSlot[] = ["weapon", "armor", "ring", "amulet"];
const RARITY_ORDER: ItemRarity[] = ["common", "rare", "epic", "legendary"];

function rarityTag(item: LootItem): string {
  const meta = RARITY_META[item.rarity];
  return `<span class="tag" style="font-size:9px;border:1px solid ${meta.color};color:${meta.color};">${meta.label}</span>`;
}

/** Not a `simpleScreen` - the bag's slot/rarity filters are pure view state
 *  that has nothing to do with the game store, so they live in a closure
 *  here instead of round-tripping through `game.notify()`. */
export const inventoryScreen: ScreenModule = (root, game) => {
  let slotFilter: ItemSlot | "all" = "all";
  let rarityFilter: ItemRarity | "all" = "all";

  const draw = () => {
    const p = game.state.player;

    const equippedRows = SLOT_ORDER.map((slot) => {
      const item = p.equipment[slot];
      if (!item) {
        return `
          <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px dashed var(--color-neutral-800);border-radius:var(--radius-md);">
            <span style="font-size:20px;color:var(--color-neutral-700);">${icon(slot === "weapon" ? "sword" : slot === "armor" ? "shield-checkered" : slot === "ring" ? "circle-dashed" : "moon-stars")}</span>
            <div style="flex:1;font-size:12px;color:var(--color-neutral-600);">No ${SLOT_LABEL[slot]} equipped</div>
          </div>`;
      }
      const meta = RARITY_META[item.rarity];
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid ${meta.color};border-radius:var(--radius-md);background:color-mix(in srgb, ${meta.color} 8%, transparent);">
          <span style="font-size:20px;color:${meta.color};">${icon(item.icon as any)}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:500;color:${meta.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>
            <div style="font-size:11px;color:var(--color-neutral-500);">${SLOT_LABEL[slot]} · +${item.statBonus} ${item.statKey.toUpperCase()}</div>
          </div>
          <button class="btn btn-icon" style="width:28px;height:28px;flex-shrink:0;" data-action="unequip-item" data-slot="${slot}" title="Unequip">${icon("caret-right")}</button>
        </div>`;
    }).join("");

    const filteredBag = game.state.bag.filter((item) =>
      (slotFilter === "all" || item.slot === slotFilter) &&
      (rarityFilter === "all" || item.rarity === rarityFilter)
    );

    const filterChip = (active: boolean, label: string, action: string, value: string) => `
      <button class="btn ${active ? "btn-primary" : "btn-secondary"} action-btn" data-filter="${action}" data-value="${value}"
        style="padding:4px 10px;font-size:11px;justify-content:center;">${label}</button>`;

    const bagFilters = game.state.bag.length === 0 ? "" : `
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:var(--space-2);">
        ${filterChip(slotFilter === "all", "All Slots", "slot", "all")}
        ${SLOT_ORDER.map((s) => filterChip(slotFilter === s, SLOT_LABEL[s], "slot", s)).join("")}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:var(--space-2);">
        ${filterChip(rarityFilter === "all", "All Rarities", "rarity", "all")}
        ${RARITY_ORDER.map((r) => filterChip(rarityFilter === r, RARITY_META[r].label, "rarity", r)).join("")}
      </div>`;

    const bagRows = game.state.bag.length === 0
      ? `<div style="font-size:12px;color:var(--color-neutral-600);padding:var(--space-3) 0;">Your bag is empty. Loot drops from kills - more from Elites and gate bosses.</div>`
      : filteredBag.length === 0
      ? `<div style="font-size:12px;color:var(--color-neutral-600);padding:var(--space-3) 0;">Nothing matches that filter.</div>`
      : filteredBag.map((item) => {
        const meta = RARITY_META[item.rarity];
        return `
          <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);">
            <span style="font-size:18px;color:${meta.color};flex-shrink:0;">${icon(item.icon as any)}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
                ${rarityTag(item)}
                <span style="font-size:11px;color:var(--color-neutral-500);">+${item.statBonus} ${item.statKey.toUpperCase()}</span>
              </div>
            </div>
            <button class="btn btn-icon" style="width:28px;height:28px;flex-shrink:0;color:var(--color-accent-300);" data-action="equip-item" data-item="${item.id}" title="Equip">${icon("check-circle")}</button>
            <button class="btn btn-icon" style="width:28px;height:28px;flex-shrink:0;color:var(--color-neutral-500);" data-action="discard-item" data-item="${item.id}" title="Discard">${icon("trash")}</button>
          </div>`;
      }).join("");

    const potionRows = POTIONS.map((def) => {
      const count = game.state.inventory.potions[def.id] ?? 0;
      const canBuy = p.gold >= def.cost;
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);">
          <span style="font-size:20px;color:var(--color-accent-300);flex-shrink:0;">${icon(def.icon as any)}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:500;">${def.name}</div>
            <div style="font-size:11px;color:var(--color-neutral-500);">Restores ${def.amount} ${def.kind.toUpperCase()} in battle · x${count} owned</div>
          </div>
          <button class="btn btn-secondary action-btn" style="flex-shrink:0;padding:6px 10px;font-size:11px;" data-action="buy-potion" data-potion="${def.id}" ${canBuy ? "" : "disabled"}>
            ${icon("coin")} ${def.cost}g
          </button>
        </div>`;
    }).join("");

    root.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <h4 style="margin-bottom:var(--space-1);">Inventory</h4>
            <div style="font-size:13px;color:var(--color-neutral-400);">Equipment, loot, and consumables</div>
          </div>
          <div class="tag tag-outline" style="display:flex;align-items:center;gap:4px;">${icon("coin")} ${p.gold}</div>
        </div>

        <div>
          <h5 style="margin-bottom:var(--space-2);color:var(--color-neutral-400);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Equipped</h5>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">${equippedRows}</div>
        </div>

        <div>
          <h5 style="margin-bottom:var(--space-2);color:var(--color-neutral-400);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Bag (${game.state.bag.length})</h5>
          ${bagFilters}
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">${bagRows}</div>
        </div>

        <div>
          <h5 style="margin-bottom:var(--space-2);color:var(--color-neutral-400);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Consumables</h5>
          <div style="display:flex;flex-direction:column;gap:var(--space-2);">${potionRows}</div>
        </div>
      </div>
    `;

    root.querySelectorAll<HTMLElement>('[data-action="equip-item"]').forEach((el) => {
      el.addEventListener("click", () => game.equipItem(el.dataset.item!));
    });
    root.querySelectorAll<HTMLElement>('[data-action="discard-item"]').forEach((el) => {
      el.addEventListener("click", () => game.discardItem(el.dataset.item!));
    });
    root.querySelectorAll<HTMLElement>('[data-action="unequip-item"]').forEach((el) => {
      el.addEventListener("click", () => game.unequipItem(el.dataset.slot as ItemSlot));
    });
    root.querySelectorAll<HTMLElement>('[data-action="buy-potion"]').forEach((el) => {
      el.addEventListener("click", () => game.buyPotion(el.dataset.potion!));
    });
    root.querySelectorAll<HTMLElement>('[data-filter]').forEach((el) => {
      el.addEventListener("click", () => {
        const kind = el.dataset.filter;
        const value = el.dataset.value!;
        if (kind === "slot") slotFilter = value as ItemSlot | "all";
        else if (kind === "rarity") rarityFilter = value as ItemRarity | "all";
        draw();
      });
    });
  };

  draw();
  return { update: draw };
};
