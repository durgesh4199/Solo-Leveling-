import type { Game } from "../store";
import { redraw, type ScreenModule } from "./types";
import { icon } from "../art/icons";
import { hunterPortrait } from "../art/portraits";
import { POTIONS, RARITY_META, affixDeltaText, affixText, compareItemAffixes, priceForItem, sellPriceForItem } from "../data";
import { CRAFT_EQUIPMENT_COST, REFORGE_COST_BY_RARITY } from "../systems/crafting/data";
import { EQUIPMENT_SETS, EQUIPMENT_SET_REGISTRY, equippedSetCounts } from "../systems/sets/data";
import type { ItemRarity, ItemSlot, LootItem } from "../types";

const SLOT_LABEL: Record<ItemSlot, string> = {
  weapon: "Weapon", helmet: "Helmet", chest: "Body Armor", legs: "Legs", ring: "Ring", amulet: "Amulet"
};
const SLOT_ICON: Record<ItemSlot, string> = {
  weapon: "sword", helmet: "helmet", chest: "shield-checkered", legs: "boots", ring: "circle-dashed", amulet: "moon-stars"
};
/** Grid position (see .paperdoll in effects.css) for each of the 6 slots
 *  around the center portrait. Weapon/Ring flank the portrait on the same
 *  row so the row's connector line has a real tile at both ends; Amulet/
 *  Helmet sit above, Body Armor/Legs stack below - a "body" column down
 *  the middle, echoing the reference equipment-grid layout scaled to the
 *  gear this game has. */
const PAPERDOLL_POS: Record<ItemSlot, string> = {
  amulet: "grid-column:1;grid-row:1;",
  helmet: "grid-column:2;grid-row:1;",
  weapon: "grid-column:1;grid-row:2;",
  ring: "grid-column:3;grid-row:2;",
  chest: "grid-column:2;grid-row:3;",
  legs: "grid-column:2;grid-row:4;"
};
const SLOT_ORDER: ItemSlot[] = ["weapon", "helmet", "chest", "legs", "ring", "amulet"];
const RARITY_ORDER: ItemRarity[] = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "godly"];
type SubTab = "gear" | "shop" | "potions" | "craft";
type SortBy = "default" | "rarity" | "value" | "newest";
const SORT_LABEL: Record<SortBy, string> = {
  default: "Sort: Default", rarity: "Sort: Rarity", value: "Sort: Value", newest: "Sort: Newest"
};

function rarityTag(item: LootItem): string {
  const meta = RARITY_META[item.rarity];
  return `<span class="tag" style="font-size:9px;border:1px solid ${meta.color};color:${meta.color};">${meta.label}</span>`;
}

function affixSummary(item: LootItem): string {
  return item.affixes.map(affixText).join(" · ");
}

function sortItems(items: LootItem[], sortBy: SortBy): LootItem[] {
  const sorted = [...items];
  if (sortBy === "rarity") sorted.sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity));
  else if (sortBy === "value") sorted.sort((a, b) => priceForItem(b) - priceForItem(a));
  else if (sortBy === "newest") sorted.reverse(); // items are always appended, so array order is oldest-first already
  return sorted;
}

/** A tap-to-expand comparison against whatever's currently equipped in the
 *  item's slot (or "nothing" - a pure gain preview) - the same block is
 *  used from both the bag and the Shop, since "should I equip/buy this"
 *  is the same question either place. */
function comparisonHtml(item: LootItem, equipped: LootItem | undefined, slotLabel: string): string {
  const deltas = compareItemAffixes(item, equipped ?? null).filter((d) => d.delta !== 0);
  const header = equipped ? `Vs. equipped ${equipped.name}` : `${slotLabel} slot is empty — pure gain`;
  const lines = deltas.length === 0
    ? `<div style="font-size:11px;color:var(--color-neutral-500);">No stat difference from what's equipped.</div>`
    : deltas.map((d) => `<div style="font-size:11px;font-weight:500;color:${d.delta > 0 ? "var(--color-accent-300)" : "#ff6b5b"};">${affixDeltaText(d)}</div>`).join("");
  return `
    <div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--color-neutral-800);display:flex;flex-direction:column;gap:2px;">
      <div style="font-size:10px;color:var(--color-neutral-600);text-transform:uppercase;letter-spacing:0.04em;">${header}</div>
      ${lines}
    </div>`;
}

/** Equipment Set progress (#16) - every set in the roster always shows,
 *  the same "locked but not hidden" convention Titles/Relics already use,
 *  so a player who's never found a single piece still knows the sets
 *  exist and what each piece is called (worth watching for while
 *  playing). Thresholds are cumulative (see SetThreshold's own doc
 *  comment) - a checkmark per tier already met, not just the highest. */
function drawSetBonuses(p: Game["state"]["player"]): string {
  const counts = equippedSetCounts(p.equipment);
  const cards = EQUIPMENT_SETS.map((set) => {
    const count = counts[set.id] ?? 0;
    const pieceNames = Object.values(set.pieces).map((piece) => piece.name).join(" · ");
    const thresholdRows = set.thresholds.map((t) => {
      const active = count >= t.count;
      return `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:${active ? "var(--color-accent-300)" : "var(--color-neutral-600)"};">
        ${icon(active ? "check-circle" : "circle-dashed")} ${t.count}pc: ${t.bonusText}
      </div>`;
    }).join("");
    return `
      <div style="padding:var(--space-3);border:1px solid ${count > 0 ? "var(--color-accent-700)" : "var(--color-neutral-800)"};border-radius:var(--radius-md);${count > 0 ? "" : "opacity:0.75;"}">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
          <div style="font-size:13px;font-weight:500;">${set.name}</div>
          <span class="tag tag-outline" style="font-size:10px;flex-shrink:0;">${count} / 6</span>
        </div>
        <div style="font-size:11px;color:var(--color-neutral-500);margin-top:2px;">${set.description}</div>
        <div style="font-size:10px;color:var(--color-neutral-600);margin-top:4px;">${pieceNames}</div>
        <div style="display:flex;flex-direction:column;gap:2px;margin-top:6px;">${thresholdRows}</div>
      </div>`;
  }).join("");

  return `
    <div>
      <h5 style="margin-bottom:var(--space-2);color:var(--color-neutral-400);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Equipment Sets</h5>
      <div style="display:flex;flex-direction:column;gap:var(--space-2);">${cards}</div>
    </div>`;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Not a `simpleScreen` - the sub-tab selection, the bag's filters, and the
 *  Shop's live restock countdown are all pure view state (or a UI-only
 *  ticking clock) that has nothing to do with the game store, so they live
 *  in a closure here instead of round-tripping through `game.notify()`. */
export const inventoryScreen: ScreenModule = (root, game) => {
  let subTab: SubTab = "gear";
  let slotFilter: ItemSlot | "all" = "all";
  let rarityFilter: ItemRarity | "all" = "all";
  let sortBy: SortBy = "default";
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  // Item id currently showing its "Confirm sell?" state - selling is
  // one-way (see game.sellItem), so a stray tap can't lose gear.
  let sellConfirmId: string | null = null;
  // Item id (bag or Shop - ids never collide) currently showing its
  // tap-to-compare panel. Shared across both since only one sub-tab is
  // ever visible at a time.
  let comparingId: string | null = null;

  const subTabBtn = (tab: SubTab, label: string, iconName: string) => `
    <button class="btn ${subTab === tab ? "btn-primary" : "btn-secondary"} action-btn" data-subtab="${tab}"
      style="flex:1;justify-content:center;padding:var(--space-2);font-size:12px;">${icon(iconName as any)} ${label}</button>`;

  const drawGear = (p: Game["state"]["player"]) => {
    const paperdollSlots = SLOT_ORDER.map((slot) => {
      const item = p.equipment[slot];
      const pos = PAPERDOLL_POS[slot];
      if (!item) {
        return `
          <div class="paperdoll-slot" style="${pos}" title="No ${SLOT_LABEL[slot]} equipped">
            <span class="slot-icon" style="color:var(--color-neutral-700);">${icon(SLOT_ICON[slot] as any)}</span>
            <span class="slot-label">${SLOT_LABEL[slot]}</span>
          </div>`;
      }
      const meta = RARITY_META[item.rarity];
      const setBadge = item.setId
        ? `<span style="position:absolute;top:2px;right:4px;font-size:8px;font-weight:700;letter-spacing:0.04em;color:#f0a340;" title="${EQUIPMENT_SET_REGISTRY.get(item.setId)?.name ?? "Set piece"}">SET</span>`
        : "";
      return `
        <div class="paperdoll-slot filled" style="${pos}border-color:${meta.color};box-shadow:0 0 0 1px ${meta.color} inset, 0 0 14px 1px color-mix(in srgb, ${meta.color} 35%, transparent);" data-action="unequip-item" data-slot="${slot}" title="${item.name} — ${affixSummary(item)} — click to unequip">
            ${setBadge}
            <span class="slot-icon" style="color:${meta.color};">${icon(item.icon as any)}</span>
            <span class="slot-label" style="color:${meta.color};">${affixText(item.affixes[0])}</span>
          </div>`;
    }).join("");

    const filteredBag = sortItems(game.state.bag.filter((item) =>
      (slotFilter === "all" || item.slot === slotFilter) &&
      (rarityFilter === "all" || item.rarity === rarityFilter)
    ), sortBy);

    const selectOption = (value: string, label: string, selected: boolean) =>
      `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;

    const bagFilters = game.state.bag.length === 0 ? "" : `
      <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-3);">
        <select class="select-filter" data-filter="slot" style="flex:1;">
          ${selectOption("all", "All Slots", slotFilter === "all")}
          ${SLOT_ORDER.map((s) => selectOption(s, SLOT_LABEL[s], slotFilter === s)).join("")}
        </select>
        <select class="select-filter" data-filter="rarity" style="flex:1;">
          ${selectOption("all", "All Rarities", rarityFilter === "all")}
          ${RARITY_ORDER.map((r) => selectOption(r, RARITY_META[r].label, rarityFilter === r)).join("")}
        </select>
      </div>`;

    const bagRows = game.state.bag.length === 0
      ? `<div style="font-size:12px;color:var(--color-neutral-600);padding:var(--space-3) 0;">Your bag is empty. Loot drops from kills, or buy gear in the Shop.</div>`
      : filteredBag.length === 0
      ? `<div style="font-size:12px;color:var(--color-neutral-600);padding:var(--space-3) 0;">Nothing matches that filter.</div>`
      : filteredBag.map((item) => {
        const meta = RARITY_META[item.rarity];
        const sellPrice = sellPriceForItem(item);
        const confirming = sellConfirmId === item.id;
        const comparing = comparingId === item.id;
        const actions = confirming
          ? `
            <button class="btn btn-secondary action-btn" style="flex-shrink:0;padding:5px 8px;font-size:10px;" data-action="cancel-sell" title="Cancel">Cancel</button>
            <button class="btn btn-primary action-btn" style="flex-shrink:0;padding:5px 8px;font-size:10px;" data-action="confirm-sell" data-item="${item.id}" title="Confirm sell">${icon("coin")} Sell ${sellPrice}g</button>`
          : `
            <button class="btn btn-icon" style="width:28px;height:28px;flex-shrink:0;color:var(--color-accent-300);" data-action="equip-item" data-item="${item.id}" title="Equip">${icon("check-circle")}</button>
            <button class="btn btn-secondary action-btn" style="flex-shrink:0;padding:5px 8px;font-size:10px;" data-action="sell-item" data-item="${item.id}" title="Sell">${icon("coin")} ${sellPrice}g</button>`;
        return `
          <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid ${confirming ? "var(--color-accent-600)" : comparing ? "var(--color-accent-700)" : "var(--color-neutral-800)"};border-radius:var(--radius-md);">
            <span style="font-size:18px;color:${meta.color};flex-shrink:0;">${icon(item.icon as any)}</span>
            <div style="flex:1;min-width:0;cursor:pointer;" data-action="toggle-compare" data-item="${item.id}" title="Tap to compare against equipped">
              <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap;">
                ${confirming
                  ? `<span style="font-size:11px;color:var(--color-accent-300);">Sell for ${sellPrice}g? This can't be undone.</span>`
                  : `${rarityTag(item)}<span style="font-size:11px;color:var(--color-neutral-500);">${SLOT_LABEL[item.slot]} · ${affixSummary(item)}</span>`}
              </div>
              ${!confirming && comparing ? comparisonHtml(item, p.equipment[item.slot], SLOT_LABEL[item.slot]) : ""}
            </div>
            ${actions}
          </div>`;
      }).join("");

    return `
      <div>
        <h5 style="margin-bottom:var(--space-3);color:var(--color-neutral-400);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;text-align:center;">Equipped</h5>
        <div class="paperdoll">
          <div class="paperdoll-line-h"></div>
          <div class="paperdoll-line-v"></div>
          <div class="paperdoll-center" style="grid-column:2;grid-row:2;">${hunterPortrait(p.rank)}</div>
          ${paperdollSlots}
        </div>
      </div>
      ${drawSetBonuses(p)}
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2);">
          <h5 style="margin:0;color:var(--color-neutral-400);font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">Bag (${game.state.bag.length})</h5>
          ${game.state.bag.length === 0 ? "" : `
            <select class="select-filter" data-filter="sort" style="font-size:11px;">
              ${(Object.keys(SORT_LABEL) as SortBy[]).map((s) => selectOption(s, SORT_LABEL[s], sortBy === s)).join("")}
            </select>`}
        </div>
        ${bagFilters}
        <div style="display:flex;flex-direction:column;gap:var(--space-2);">${bagRows}</div>
      </div>
    `;
  };

  const drawShop = (p: Game["state"]["player"]) => {
    const stock = game.state.shop.stock;
    const rows = stock.length === 0
      ? `<div style="font-size:12px;color:var(--color-neutral-600);padding:var(--space-3) 0;">Sold out. Reroll the stock to see new gear.</div>`
      : stock.map((item) => {
        const meta = RARITY_META[item.rarity];
        const price = priceForItem(item);
        const canBuy = p.gold >= price;
        const comparing = comparingId === item.id;
        return `
          <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid ${comparing ? "var(--color-accent-700)" : "var(--color-neutral-800)"};border-radius:var(--radius-md);">
            <span style="font-size:18px;color:${meta.color};flex-shrink:0;">${icon(item.icon as any)}</span>
            <div style="flex:1;min-width:0;cursor:pointer;" data-action="toggle-compare" data-item="${item.id}" title="Tap to compare against equipped">
              <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap;">
                ${rarityTag(item)}
                <span style="font-size:11px;color:var(--color-neutral-500);">${SLOT_LABEL[item.slot]} · ${affixSummary(item)}</span>
              </div>
              ${comparing ? comparisonHtml(item, p.equipment[item.slot], SLOT_LABEL[item.slot]) : ""}
            </div>
            <button class="btn btn-secondary action-btn" style="flex-shrink:0;padding:6px 10px;font-size:11px;" data-action="buy-shop-item" data-item="${item.id}" ${canBuy ? "" : "disabled"}>
              ${icon("coin")} ${price}g
            </button>
          </div>`;
      }).join("");

    const canReroll = p.gold >= game.state.shop.rerollCost;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);">
        <div>
          <h5 style="margin:0;">Merchant Stock</h5>
          <div style="font-size:11px;color:var(--color-neutral-500);">Free restock in <span id="shop-countdown"></span></div>
        </div>
        <button class="btn btn-secondary action-btn" style="padding:6px 10px;font-size:11px;flex-shrink:0;" data-action="reroll-shop" ${canReroll ? "" : "disabled"}>
          Reroll — ${game.state.shop.rerollCost}g
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-2);">${rows}</div>
    `;
  };

  const drawPotions = (p: Game["state"]["player"]) => {
    const rows = POTIONS.map((def) => {
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
    return `
      <div>
        <h5 style="margin:0;">Consumables</h5>
        <div style="font-size:11px;color:var(--color-neutral-500);">Used mid-battle from the Items panel</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-2);">${rows}</div>
    `;
  };

  /** Crafting (#14) - Craft Equipment (guaranteed item at a chosen slot,
   *  better rarity odds than the Shop) and Reforge (reroll an *equipped*
   *  item's affixes in place, same slot/rarity). Both spend Shadow
   *  Essence (earned by disenchanting Shadows - see the Shadow Army
   *  screen) plus gold, no confirm step - same "cost is right on the
   *  button, click to commit" pattern the Shop's own buy button already
   *  uses, not a permanent-choice confirm like Merge/Evolve/Disenchant. */
  const drawCraft = (p: Game["state"]["player"]) => {
    const equipCost = CRAFT_EQUIPMENT_COST[p.rank];
    const craftRows = SLOT_ORDER.map((slot) => {
      const canAfford = p.shadowEssence >= equipCost.essence && p.gold >= equipCost.gold;
      return `
        <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);">
          <span style="font-size:18px;color:var(--color-accent-300);flex-shrink:0;">${icon(SLOT_ICON[slot] as any)}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:500;">${SLOT_LABEL[slot]}</div>
            <div style="font-size:11px;color:var(--color-neutral-500);">Guaranteed ${p.rank}-Rank gear, better rarity odds than the Shop</div>
          </div>
          <button class="btn btn-secondary action-btn" style="flex-shrink:0;padding:6px 10px;font-size:11px;white-space:nowrap;" data-action="craft-equipment" data-slot="${slot}" ${canAfford ? "" : "disabled"}>
            ${icon("flame")} ${equipCost.essence} · ${icon("coin")} ${equipCost.gold}g
          </button>
        </div>`;
    }).join("");

    const equippedSlots = SLOT_ORDER.filter((s) => p.equipment[s]);
    const reforgeRows = equippedSlots.length === 0
      ? `<div style="font-size:12px;color:var(--color-neutral-600);padding:var(--space-3) 0;">Equip something first - Reforge only works on gear you're wearing.</div>`
      : equippedSlots.map((slot) => {
        const item = p.equipment[slot]!;
        const meta = RARITY_META[item.rarity];
        const cost = REFORGE_COST_BY_RARITY[item.rarity];
        const canAfford = p.shadowEssence >= cost.essence && p.gold >= cost.gold;
        return `
          <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-3);border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);">
            <span style="font-size:18px;color:${meta.color};flex-shrink:0;">${icon(item.icon as any)}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap;">
                ${rarityTag(item)}<span style="font-size:11px;color:var(--color-neutral-500);">${SLOT_LABEL[slot]} · rerolls all affixes</span>
              </div>
            </div>
            <button class="btn btn-secondary action-btn" style="flex-shrink:0;padding:6px 10px;font-size:11px;white-space:nowrap;" data-action="reforge-item" data-slot="${slot}" ${canAfford ? "" : "disabled"}>
              ${icon("flame")} ${cost.essence} · ${icon("coin")} ${cost.gold}g
            </button>
          </div>`;
      }).join("");

    return `
      <div>
        <h5 style="margin:0;">Craft Equipment</h5>
        <div style="font-size:11px;color:var(--color-neutral-500);margin-top:2px;">Spend Shadow Essence + gold on a guaranteed item at the slot you choose.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-2);">${craftRows}</div>
      <div>
        <h5 style="margin:0;">Reforge</h5>
        <div style="font-size:11px;color:var(--color-neutral-500);margin-top:2px;">Reroll an equipped item's affixes - same slot and rarity, everything else fresh.</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:var(--space-2);">${reforgeRows}</div>
    `;
  };

  const tickCountdown = () => {
    const el = root.querySelector<HTMLElement>("#shop-countdown");
    if (!el) return;
    el.textContent = formatCountdown(game.shopRestockMsRemaining());
  };

  const draw = () => {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    const p = game.state.player;
    const body = subTab === "gear" ? drawGear(p) : subTab === "shop" ? drawShop(p) : subTab === "craft" ? drawCraft(p) : drawPotions(p);

    redraw(root, () => {
    root.innerHTML = `
      <div data-scroll style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <h4 style="margin-bottom:var(--space-1);">Inventory</h4>
            <div style="font-size:13px;color:var(--color-neutral-400);">Equipment, loot, and consumables</div>
          </div>
          <div style="display:flex;gap:6px;">
            <div class="tag tag-outline" style="display:flex;align-items:center;gap:4px;" title="Shadow Essence">${icon("flame")} ${p.shadowEssence}</div>
            <div class="tag tag-outline" style="display:flex;align-items:center;gap:4px;">${icon("coin")} ${p.gold}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${subTabBtn("gear", "Gear", "bag")}
          ${subTabBtn("shop", "Shop", "coin")}
          ${subTabBtn("craft", "Craft", "flame")}
          ${subTabBtn("potions", "Potions", "flask")}
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-4);">${body}</div>
      </div>
    `;

    // Switching sub-tabs shows genuinely different content, so it's the
    // one interaction here that *should* jump to the top rather than
    // inheriting whatever scroll position the previous sub-tab had.
    root.querySelectorAll<HTMLElement>("[data-subtab]").forEach((el) => {
      el.addEventListener("click", () => {
        subTab = el.dataset.subtab as SubTab;
        draw();
        const region = root.querySelector<HTMLElement>("[data-scroll]");
        if (region) region.scrollTop = 0;
      });
    });
    root.querySelectorAll<HTMLElement>('[data-action="equip-item"]').forEach((el) => {
      el.addEventListener("click", () => { comparingId = null; game.equipItem(el.dataset.item!); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="sell-item"]').forEach((el) => {
      el.addEventListener("click", () => { sellConfirmId = el.dataset.item!; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="confirm-sell"]').forEach((el) => {
      el.addEventListener("click", () => { game.sellItem(el.dataset.item!); sellConfirmId = null; comparingId = null; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="cancel-sell"]').forEach((el) => {
      el.addEventListener("click", () => { sellConfirmId = null; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="toggle-compare"]').forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.item!;
        comparingId = comparingId === id ? null : id;
        draw();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-action="unequip-item"]').forEach((el) => {
      el.addEventListener("click", () => game.unequipItem(el.dataset.slot as ItemSlot));
    });
    root.querySelectorAll<HTMLElement>('[data-action="buy-potion"]').forEach((el) => {
      el.addEventListener("click", () => game.buyPotion(el.dataset.potion!));
    });
    root.querySelectorAll<HTMLElement>('[data-action="buy-shop-item"]').forEach((el) => {
      el.addEventListener("click", () => { comparingId = null; game.buyShopItem(el.dataset.item!); });
    });
    root.querySelector<HTMLElement>('[data-action="reroll-shop"]')?.addEventListener("click", () => game.rerollShop());
    root.querySelectorAll<HTMLElement>('[data-action="craft-equipment"]').forEach((el) => {
      el.addEventListener("click", () => game.craftEquipment(el.dataset.slot as ItemSlot));
    });
    root.querySelectorAll<HTMLElement>('[data-action="reforge-item"]').forEach((el) => {
      el.addEventListener("click", () => game.reforgeEquippedItem(el.dataset.slot as ItemSlot));
    });
    root.querySelectorAll<HTMLSelectElement>("[data-filter]").forEach((el) => {
      el.addEventListener("change", () => {
        const kind = el.dataset.filter;
        const value = el.value;
        if (kind === "slot") slotFilter = value as ItemSlot | "all";
        else if (kind === "rarity") rarityFilter = value as ItemRarity | "all";
        else if (kind === "sort") sortBy = value as SortBy;
        draw();
      });
    });
    });

    if (subTab === "shop") {
      tickCountdown();
      countdownTimer = setInterval(tickCountdown, 1000);
    }
  };

  draw();
  return {
    update: draw,
    unmount() {
      if (countdownTimer) clearInterval(countdownTimer);
    }
  };
};
