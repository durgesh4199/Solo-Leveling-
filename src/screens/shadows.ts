import type { Game } from "../store";
import type { ScreenModule } from "./types";
import { icon } from "../art/icons";
import { shadowPortrait } from "../art/portraits";
import { effectiveShadowPower, shadowMood, shadowXpToNext, nextShadowRank, SHADOW_EVOLUTION_COST, SHADOW_MAX_LEVEL, SHADOW_SKILLS } from "../systems/shadows/data";
import type { Rank, ShadowRecord } from "../types";

const RANK_ORDER: Rank[] = ["E", "D", "C", "B", "A", "S"];

/** Not a `simpleScreen` - the rank/species filters and the merge-confirm
 *  state are pure view state with nothing to do with the game store, so
 *  they live in a closure here (same pattern as the Inventory bag
 *  filters/sell-confirm). */
export const shadowsScreen: ScreenModule = (root, game) => {
  let rankFilter: Rank | "all" = "all";
  let typeFilter: string | "all" = "all";
  // Shadow id currently showing its "merge with your weakest duplicate?"
  // confirmation - merging consumes a Shadow permanently.
  let mergeConfirmId: string | null = null;
  // Shadow id currently showing its "evolve into the next rank?"
  // confirmation - costs gold and resets the Shadow's level to 1.
  let evolveConfirmId: string | null = null;

  const selectOption = (value: string, label: string, selected: boolean) =>
    `<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;

  const weakestDuplicate = (army: ShadowRecord[], shadow: ShadowRecord): ShadowRecord | null => {
    const duplicates = army.filter((s) => s.id !== shadow.id && s.type === shadow.type);
    if (duplicates.length === 0) return null;
    return duplicates.reduce((lowest, s) => (s.level < lowest.level ? s : lowest), duplicates[0]);
  };

  const draw = () => {
    const { shadowArmy } = game.state;
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
        <div style="font-size:14px;font-weight:500;">${shadow.name}</div>
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

        <button class="btn ${shadow.deployed ? "btn-primary" : "btn-secondary"} action-btn" style="justify-content:center;padding:6px;font-size:12px;" data-action="deploy-shadow" data-id="${shadow.id}">
          ${shadow.deployed ? "Recall" : "Deploy"}
        </button>
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
