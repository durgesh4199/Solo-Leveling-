import type { Game } from "../store";
import type { ScreenModule } from "./types";
import { icon } from "../art/icons";
import { shadowPortrait } from "../art/portraits";
import { effectiveShadowPower, shadowMood, shadowXpToNext, nextShadowRank, SHADOW_EVOLUTION_COST, SHADOW_MAX_LEVEL, SHADOW_NAME_MAX_LENGTH, SHADOW_SKILLS } from "../systems/shadows/data";
import { RARITY_META, affixText, priceForItem } from "../data";
import type { ItemSlot, LootItem, Rank, ShadowRecord } from "../types";

const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];

// Local to this screen - same values as Inventory's own SLOT_LABEL/
// SLOT_ICON, duplicated rather than imported (same call the codebase
// already made for RANK_ORDER above: a handful of tiny per-module
// constants beats a shared-export just to save six lines).
const SLOT_LABEL: Record<ItemSlot, string> = {
  weapon: "Weapon", helmet: "Helmet", chest: "Body Armor", legs: "Legs", ring: "Ring", amulet: "Amulet"
};
const SLOT_ICON: Record<ItemSlot, string> = {
  weapon: "sword", helmet: "helmet", chest: "shield-checkered", legs: "boots", ring: "circle-dashed", amulet: "moon-stars"
};
const SLOT_ORDER: ItemSlot[] = ["weapon", "helmet", "chest", "legs", "ring", "amulet"];

function affixSummary(item: LootItem): string {
  return item.affixes.map(affixText).join(" · ");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Not a `simpleScreen` - the rank/species filters and the merge/evolve/
 *  rename/gear-panel state are pure view state with nothing to do with
 *  the game store, so they live in a closure here (same pattern as the
 *  Inventory bag filters/sell-confirm). */
export const shadowsScreen: ScreenModule = (root, game) => {
  let rankFilter: Rank | "all" = "all";
  let typeFilter: string | "all" = "all";
  // Shadow id currently showing its "merge with your weakest duplicate?"
  // confirmation - merging consumes a Shadow permanently.
  let mergeConfirmId: string | null = null;
  // Shadow id currently showing its "evolve into the next rank?"
  // confirmation - costs gold and resets the Shadow's level to 1.
  let evolveConfirmId: string | null = null;
  // Shadow id currently showing its name as an editable text input.
  let renamingId: string | null = null;
  // Shadow id currently showing its expanded gear-management panel (#7).
  let gearShadowId: string | null = null;
  // Slot (within gearShadowId's panel) currently showing its "pick a Bag
  // item to equip" list - always reset when the panel itself closes or
  // switches to a different Shadow.
  let pickerSlot: ItemSlot | null = null;

  const selectOption = (value: string, label: string, selected: boolean) =>
    `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;

  const weakestDuplicate = (army: ShadowRecord[], shadow: ShadowRecord): ShadowRecord | null => {
    const duplicates = army.filter((s) => s.id !== shadow.id && s.type === shadow.type);
    if (duplicates.length === 0) return null;
    return duplicates.reduce((lowest, s) => (s.level < lowest.level ? s : lowest), duplicates[0]);
  };

  const draw = () => {
    const { shadowArmy, bag } = game.state;
    const deployed = shadowArmy.find((s) => s.deployed);

    // Species filter only ever lists types actually in the army, so it
    // never shows a choice that would filter down to nothing.
    const types = Array.from(new Set(shadowArmy.map((s) => s.type))).sort();
    if (typeFilter !== "all" && !types.includes(typeFilter)) typeFilter = "all";

    const filtered = shadowArmy.filter((s) =>
      (rankFilter === "all" || s.rank === rankFilter) &&
      (typeFilter === "all" || s.type === typeFilter)
    );

    const empty = shadowArmy.length === 0
      ? `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--space-3);color:var(--color-neutral-500);text-align:center;">
          <span style="font-size:40px;color:var(--color-neutral-700);">${icon("ghost", "1em")}</span>
          <div style="font-size:13px;max-width:24ch;">No shadows yet. Defeat a monster in battle and choose "Arise" to command it.</div>
        </div>`
      : "";

    const filters = shadowArmy.length === 0 ? "" : `
      <div style="display:flex;gap:var(--space-2);">
        <select class="select-filter" data-filter="rank" style="flex:1;">
          ${selectOption("all", "All Ranks", rankFilter === "all")}
          ${RANK_ORDER.filter((r) => shadowArmy.some((s) => s.rank === r))
            .map((r) => selectOption(r, `${r}-Rank`, rankFilter === r)).join("")}
        </select>
        <select class="select-filter" data-filter="type" style="flex:1;">
          ${selectOption("all", "All Species", typeFilter === "all")}
          ${types.map((t) => selectOption(t, t, typeFilter === t)).join("")}
        </select>
      </div>`;

    const noMatch = shadowArmy.length > 0 && filtered.length === 0
      ? `<div style="font-size:12px;color:var(--color-neutral-600);padding:var(--space-3) 0;text-align:center;">Nothing matches that filter.</div>`
      : "";

    const cards = filtered.map((shadow) => {
      const power = effectiveShadowPower(shadow);
      const xpToNext = shadowXpToNext(shadow.level);
      const maxed = shadow.level >= SHADOW_MAX_LEVEL;
      const mood = shadowMood(shadow.loyalty);
      const skills = SHADOW_SKILLS[shadow.archetype];
      const merging = mergeConfirmId === shadow.id;
      const duplicate = weakestDuplicate(shadowArmy, shadow);

      const nameRow = renamingId === shadow.id
        ? `
          <div style="display:flex;gap:4px;align-items:center;">
            <input type="text" class="rename-input" data-id="${shadow.id}" value="${escapeAttr(shadow.name)}" maxlength="${SHADOW_NAME_MAX_LENGTH}" style="flex:1;min-width:0;background:var(--color-neutral-900);border:1px solid var(--color-accent-600);border-radius:6px;color:var(--color-neutral-100);font-size:13px;padding:4px 6px;" />
            <button class="btn btn-icon" style="width:24px;height:24px;flex-shrink:0;color:var(--color-accent-300);" data-action="save-rename" data-id="${shadow.id}" title="Save">${icon("check-circle")}</button>
            <button class="btn btn-icon" style="width:24px;height:24px;flex-shrink:0;" data-action="cancel-rename" title="Cancel">${icon("arrow-left")}</button>
          </div>`
        : `
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${shadow.name}</div>
            <button class="btn btn-icon" style="width:20px;height:20px;flex-shrink:0;color:var(--color-neutral-500);" data-action="start-rename" data-id="${shadow.id}" title="Rename">${icon("pencil")}</button>
          </div>`;

      const mergeAction = merging
        ? `
          <div style="font-size:11px;color:var(--color-accent-300);text-align:center;">Merge with ${duplicate?.name} (Lv ${duplicate?.level})? It will be consumed.</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-secondary action-btn" style="flex:1;justify-content:center;padding:6px;font-size:11px;" data-action="cancel-merge">Cancel</button>
            <button class="btn btn-primary action-btn" style="flex:1;justify-content:center;padding:6px;font-size:11px;" data-action="confirm-merge" data-id="${shadow.id}">Confirm</button>
          </div>`
        : duplicate
        ? `<button class="btn btn-secondary action-btn" style="justify-content:center;padding:6px;font-size:11px;" data-action="merge-shadow" data-id="${shadow.id}" title="Merge with your weakest ${shadow.type} duplicate">${icon("sparkles")} Merge Duplicate</button>`
        : "";

      // Evolve only ever surfaces once a Shadow has earned it (maxed
      // level) and has somewhere left to go (not already S-rank) - same
      // "only show what's actionable" rule the Merge button follows.
      const evolveRank = maxed ? nextShadowRank(shadow.rank) : null;
      const evolveCost = evolveRank ? SHADOW_EVOLUTION_COST[shadow.rank] : undefined;
      const canAffordEvolve = evolveCost !== undefined && game.state.player.gold >= evolveCost;
      const evolving = evolveConfirmId === shadow.id;

      const evolveAction = evolving && evolveRank
        ? `
          <div style="font-size:11px;color:var(--color-accent-300);text-align:center;">Evolve into a ${evolveRank}-Rank Shadow for ${evolveCost}g? Level resets to 1.</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-secondary action-btn" style="flex:1;justify-content:center;padding:6px;font-size:11px;" data-action="cancel-evolve">Cancel</button>
            <button class="btn btn-primary action-btn" style="flex:1;justify-content:center;padding:6px;font-size:11px;" data-action="confirm-evolve" data-id="${shadow.id}" ${canAffordEvolve ? "" : "disabled"}>Confirm</button>
          </div>`
        : evolveRank
        ? `<button class="btn btn-secondary action-btn" style="justify-content:center;padding:6px;font-size:11px;${canAffordEvolve ? "" : "opacity:0.55;"}" data-action="evolve-shadow" data-id="${shadow.id}" title="${canAffordEvolve ? `Evolve into a ${evolveRank}-Rank Shadow` : `Need ${evolveCost}g to evolve (have ${game.state.player.gold}g)`}">${icon("lightning")} Evolve to ${evolveRank}-Rank · ${evolveCost}g</button>`
        : "";

      // Gear panel (#7 - Shadow Management UI). Same Bag/LootItem system
      // the Hunter's own paperdoll (Inventory screen) uses, scoped to
      // this one Shadow's `equipment` map instead of `player.equipment`.
      const gearOpen = gearShadowId === shadow.id;
      const gearRows = SLOT_ORDER.map((slot) => {
        const item = shadow.equipment[slot];
        const meta = item ? RARITY_META[item.rarity] : null;
        const pickerOpen = gearOpen && pickerSlot === slot;
        const eligible = pickerOpen
          ? [...bag].filter((i) => i.slot === slot).sort((a, b) => priceForItem(b) - priceForItem(a))
          : [];

        const picker = pickerOpen
          ? `<div style="display:flex;flex-direction:column;gap:4px;padding:4px 0 4px 22px;">
              ${eligible.length === 0
                ? `<div style="font-size:10px;color:var(--color-neutral-600);">No ${SLOT_LABEL[slot]} items in your Bag.</div>`
                : eligible.map((i) => {
                    const m = RARITY_META[i.rarity];
                    return `
                      <div style="display:flex;align-items:center;gap:6px;">
                        <div style="flex:1;min-width:0;">
                          <div style="font-size:10px;color:${m.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i.name}</div>
                          <div style="font-size:9px;color:var(--color-neutral-600);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${affixSummary(i)}</div>
                        </div>
                        <button class="btn btn-secondary action-btn" style="flex-shrink:0;padding:3px 6px;font-size:10px;" data-action="equip-shadow-item" data-id="${shadow.id}" data-item="${i.id}">Equip</button>
                      </div>`;
                  }).join("")}
            </div>`
          : "";

        return `
          <div>
            <div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px dashed var(--color-neutral-800);">
              <span style="color:var(--color-neutral-500);width:16px;text-align:center;flex-shrink:0;">${icon(SLOT_ICON[slot] as any)}</span>
              <div style="flex:1;min-width:0;">
                ${item && meta
                  ? `<div style="font-size:11px;color:${meta.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name}</div>`
                  : `<div style="font-size:11px;color:var(--color-neutral-600);">${SLOT_LABEL[slot]} — Empty</div>`}
              </div>
              ${item
                ? `<button class="btn btn-icon" style="width:22px;height:22px;flex-shrink:0;" data-action="unequip-shadow-item" data-id="${shadow.id}" data-slot="${slot}" title="Unequip">${icon("trash")}</button>`
                : `<button class="btn btn-icon" style="width:22px;height:22px;flex-shrink:0;color:var(--color-accent-300);" data-action="toggle-shadow-picker" data-id="${shadow.id}" data-slot="${slot}" title="Equip ${SLOT_LABEL[slot]}">${icon("plus")}</button>`}
            </div>
            ${picker}
          </div>`;
      }).join("");

      const gearPanel = gearOpen
        ? `<div style="display:flex;flex-direction:column;padding-top:2px;">${gearRows}</div>`
        : "";

      return `
      <div class="card elev-sm" style="padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2); ${shadow.deployed ? "box-shadow:0 0 0 1.5px var(--color-accent-400);" : ""}">
        <div style="width:100%;height:80px;border-radius:8px;overflow:hidden;position:relative;" class="lighten">
          ${shadowPortrait(shadow.rank)}
          ${shadow.deployed ? `<div style="position:absolute;top:4px;right:4px;background:var(--color-accent-800);color:var(--color-accent-100);font-size:9px;padding:2px 6px;border-radius:4px;">ACTIVE</div>` : ""}
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:16px;color:var(--color-accent-300);">${icon("skull")}</span>
          <div style="display:flex;gap:4px;">
            ${shadow.evolutionStage > 0 ? `<div class="tag tag-outline" style="font-size:10px;color:var(--color-accent-300);" title="Evolved ${shadow.evolutionStage}x">${icon("lightning")} ${shadow.evolutionStage}</div>` : ""}
            <div class="tag tag-outline" style="font-size:10px;">${shadow.rank}</div>
          </div>
        </div>
        ${nameRow}
        <div style="font-size:11px;color:var(--color-neutral-500);">${shadow.type} · Power ${power}</div>

        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--color-neutral-500);">
          <span>Lv ${shadow.level}${maxed ? " (Max)" : ""}</span>
          <span title="${mood.label} · Loyalty ${shadow.loyalty}/100">${icon(mood.icon as any)} ${mood.label}</span>
        </div>
        <div class="bar-track" style="height:4px;"><div class="bar-fill" style="background:var(--color-accent-500);width:${maxed ? 100 : Math.round((shadow.xp / xpToNext) * 100)}%;"></div></div>

        <div style="display:flex;flex-direction:column;gap:2px;padding-top:2px;border-top:1px dashed var(--color-neutral-800);">
          <div style="font-size:10px;color:var(--color-accent-300);" title="${skills.passive.description}">${icon("shield")} ${skills.passive.name}</div>
          <div style="font-size:10px;color:var(--color-accent-300);" title="${skills.active.description}">${icon("flame")} ${skills.active.name}</div>
        </div>

        <div style="display:flex;gap:6px;">
          <button class="btn ${shadow.deployed ? "btn-primary" : "btn-secondary"} action-btn" style="flex:1;justify-content:center;padding:6px;font-size:12px;" data-action="deploy-shadow" data-id="${shadow.id}">
            ${shadow.deployed ? "Recall" : "Deploy"}
          </button>
          <button class="btn ${gearOpen ? "btn-primary" : "btn-secondary"} action-btn" style="padding:6px 8px;font-size:12px;" data-action="toggle-gear" data-id="${shadow.id}" title="Manage Gear">${icon("bag")}</button>
        </div>
        ${gearPanel}
        ${mergeAction}
        ${evolveAction}
      </div>
    `;
    }).join("");

    root.innerHTML = `
      <div style="flex:1;display:flex;flex-direction:column;padding:var(--space-6);gap:var(--space-4);overflow-y:auto;">
        <div>
          <h4 style="margin-bottom:var(--space-1);">Shadow Army</h4>
          <div style="font-size:13px;color:var(--color-neutral-400);">
            ${shadowArmy.length} shadows arisen${deployed ? ` · <span style="color:var(--color-accent-300);">${deployed.name} deployed</span>` : ""}
          </div>
        </div>
        ${filters}
        ${empty}
        ${noMatch}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);">${cards}</div>
      </div>
    `;

    root.querySelectorAll<HTMLElement>('[data-action="deploy-shadow"]').forEach((el) => {
      el.addEventListener("click", () => game.deployShadow(el.dataset.id!));
    });
    root.querySelectorAll<HTMLElement>('[data-action="merge-shadow"]').forEach((el) => {
      el.addEventListener("click", () => { mergeConfirmId = el.dataset.id!; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="cancel-merge"]').forEach((el) => {
      el.addEventListener("click", () => { mergeConfirmId = null; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="confirm-merge"]').forEach((el) => {
      el.addEventListener("click", () => { game.mergeShadow(el.dataset.id!); mergeConfirmId = null; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="evolve-shadow"]').forEach((el) => {
      el.addEventListener("click", () => { evolveConfirmId = el.dataset.id!; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="cancel-evolve"]').forEach((el) => {
      el.addEventListener("click", () => { evolveConfirmId = null; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="confirm-evolve"]').forEach((el) => {
      el.addEventListener("click", () => { game.evolveShadow(el.dataset.id!); evolveConfirmId = null; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="start-rename"]').forEach((el) => {
      el.addEventListener("click", () => { renamingId = el.dataset.id!; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="cancel-rename"]').forEach((el) => {
      el.addEventListener("click", () => { renamingId = null; draw(); });
    });
    root.querySelectorAll<HTMLElement>('[data-action="save-rename"]').forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.id!;
        const input = root.querySelector<HTMLInputElement>(`.rename-input[data-id="${id}"]`);
        if (input) game.renameShadow(id, input.value);
        renamingId = null;
        draw();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-action="toggle-gear"]').forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.dataset.id!;
        gearShadowId = gearShadowId === id ? null : id;
        pickerSlot = null;
        draw();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-action="toggle-shadow-picker"]').forEach((el) => {
      el.addEventListener("click", () => {
        const slot = el.dataset.slot as ItemSlot;
        pickerSlot = pickerSlot === slot ? null : slot;
        draw();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-action="equip-shadow-item"]').forEach((el) => {
      el.addEventListener("click", () => {
        game.equipShadowItem(el.dataset.id!, el.dataset.item!);
        pickerSlot = null;
        draw();
      });
    });
    root.querySelectorAll<HTMLElement>('[data-action="unequip-shadow-item"]').forEach((el) => {
      el.addEventListener("click", () => game.unequipShadowItem(el.dataset.id!, el.dataset.slot as ItemSlot));
    });
    root.querySelectorAll<HTMLSelectElement>("[data-filter]").forEach((el) => {
      el.addEventListener("change", () => {
        const kind = el.dataset.filter;
        const value = el.value;
        if (kind === "rank") rankFilter = value as Rank | "all";
        else if (kind === "type") typeFilter = value;
        draw();
      });
    });
  };

  draw();
  return { update: draw };
};
