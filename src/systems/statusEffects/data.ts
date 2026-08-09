import { createRegistry } from "../../services/registry";
import type { ActiveStatusEffect } from "../../types";
import type { StatusEffectDef } from "./types";

/** Starter roster, item 1 of the new Feature Expansion Specification's
 *  Phase 1 (Combat Depth) - 13 named statuses built from 9 reusable
 *  mechanical kinds (see StatusEffectKind), the same "few kinds, many
 *  flavored entries" shape every other bonus-granting system in this
 *  codebase already uses. Every number here is small and hand-tuned,
 *  matching the 3-20% scale Talents/Relics/Sets/equipment affixes
 *  already sit in - no exponential stat inflation, per the standing
 *  guardrail. */
export const STATUS_EFFECTS: StatusEffectDef[] = [
  {
    id: "bleed", name: "Bleed", description: "Takes physical damage each round - stacks with repeated hits.",
    icon: "sword", positive: false, defaultDuration: 3,
    stackRule: { kind: "stack", maxStacks: 5 },
    kind: { type: "dot" }, baseMagnitude: 6
  },
  {
    id: "poison", name: "Poison", description: "Takes toxin damage each round - stacks high over a long window.",
    icon: "flask", positive: false, defaultDuration: 5,
    stackRule: { kind: "stack", maxStacks: 8 },
    kind: { type: "dot" }, baseMagnitude: 3
  },
  {
    id: "burn", name: "Burn", description: "Takes fire damage each round and receives 30% less healing.",
    icon: "flame", positive: false, defaultDuration: 3,
    stackRule: { kind: "refresh" },
    kind: { type: "dot", healingReducedPct: 0.3 }, baseMagnitude: 14
  },
  {
    id: "freeze", name: "Freeze", description: "40% chance each round its action does nothing.",
    icon: "moon-stars", positive: false, defaultDuration: 2,
    stackRule: { kind: "refresh" },
    kind: { type: "chanceToSkipAction" }, baseMagnitude: 0.4
  },
  {
    id: "stun", name: "Stun", description: "Cannot act this round.",
    icon: "sparkles", positive: false, defaultDuration: 1,
    stackRule: { kind: "ignore" },
    kind: { type: "stun" }, baseMagnitude: 0
  },
  {
    id: "silence", name: "Silence", description: "Cannot use Skills or special attacks.",
    icon: "circle-dashed", positive: false, defaultDuration: 2,
    stackRule: { kind: "refresh" },
    kind: { type: "silence" }, baseMagnitude: 0
  },
  {
    id: "weakness", name: "Weakness", description: "Deals 15% less damage.",
    icon: "boots", positive: false, defaultDuration: 3,
    stackRule: { kind: "refresh" },
    kind: { type: "damageDealtPct" }, baseMagnitude: -0.15
  },
  {
    id: "vulnerability", name: "Vulnerability", description: "Takes 20% more damage.",
    icon: "shield-checkered", positive: false, defaultDuration: 3,
    stackRule: { kind: "refresh" },
    kind: { type: "damageTakenPct" }, baseMagnitude: 0.20
  },
  {
    id: "regeneration", name: "Regeneration", description: "Restores HP each round.",
    icon: "plus", positive: true, defaultDuration: 4,
    stackRule: { kind: "refresh" },
    kind: { type: "hot" }, baseMagnitude: 10
  },
  {
    id: "shield", name: "Shield", description: "Absorbs the next 60 damage before it reaches HP.",
    icon: "shield", positive: true, defaultDuration: 3,
    stackRule: { kind: "refresh" },
    kind: { type: "shield" }, baseMagnitude: 60
  },
  {
    id: "attack_up", name: "Attack Up", description: "Deals 15% more damage.",
    icon: "lightning", positive: true, defaultDuration: 3,
    stackRule: { kind: "refresh" },
    kind: { type: "damageDealtPct" }, baseMagnitude: 0.15
  },
  {
    id: "defense_up", name: "Defense Up", description: "Takes 15% less damage.",
    icon: "helmet", positive: true, defaultDuration: 3,
    stackRule: { kind: "refresh" },
    kind: { type: "damageTakenPct" }, baseMagnitude: -0.15
  },
  {
    id: "crit_up", name: "Crit Up", description: "+10% Crit Chance.",
    icon: "chart-bar", positive: true, defaultDuration: 3,
    stackRule: { kind: "refresh" },
    kind: { type: "critChanceFlat" }, baseMagnitude: 0.10
  }
];

export const STATUS_EFFECT_REGISTRY = createRegistry(STATUS_EFFECTS, (s) => s.id, "Status Effect");

/** Every status-granting buff named in the roster (Regeneration, Shield,
 *  Attack Up, Defense Up, Crit Up) - the pool Random Events' new
 *  "Blessing" effect (see systems/events/) picks one from. */
export const BLESSING_STATUS_IDS = ["regeneration", "shield", "attack_up", "defense_up", "crit_up"];

function sumBonus(effects: ActiveStatusEffect[], match: (def: StatusEffectDef) => number): number {
  return effects.reduce((sum, e) => {
    const def = STATUS_EFFECT_REGISTRY.get(e.defId);
    return def ? sum + match(def) : sum;
  }, 0);
}

export function statusDamageDealtPct(effects: ActiveStatusEffect[]): number {
  return sumBonus(effects, (d) => (d.kind.type === "damageDealtPct" ? d.baseMagnitude : 0));
}

export function statusDamageTakenPct(effects: ActiveStatusEffect[]): number {
  return sumBonus(effects, (d) => (d.kind.type === "damageTakenPct" ? d.baseMagnitude : 0));
}

export function statusCritChanceFlat(effects: ActiveStatusEffect[]): number {
  return sumBonus(effects, (d) => (d.kind.type === "critChanceFlat" ? d.baseMagnitude : 0));
}

export function statusHealingReducedPct(effects: ActiveStatusEffect[]): number {
  return sumBonus(effects, (d) => (d.kind.type === "dot" ? (d.kind.healingReducedPct ?? 0) : 0));
}

export function hasStun(effects: ActiveStatusEffect[]): boolean {
  return effects.some((e) => STATUS_EFFECT_REGISTRY.get(e.defId)?.kind.type === "stun");
}

export function hasSilence(effects: ActiveStatusEffect[]): boolean {
  return effects.some((e) => STATUS_EFFECT_REGISTRY.get(e.defId)?.kind.type === "silence");
}

/** Rolls every active `chanceToSkipAction` (Freeze) effect on a unit -
 *  true if any one of them procs this round. In practice a unit only
 *  ever has at most one Freeze active (its stack rule is "refresh", not
 *  "stack"), but this stays correct even if that ever changes. */
export function rollFreezeSkip(effects: ActiveStatusEffect[]): boolean {
  return effects.some((e) => {
    const def = STATUS_EFFECT_REGISTRY.get(e.defId);
    return def?.kind.type === "chanceToSkipAction" && Math.random() < def.baseMagnitude;
  });
}

/** Total active Shield absorb pool remaining across every Shield
 *  instance on a unit (in practice at most one, "refresh" stack rule). */
export function activeShieldPool(effects: ActiveStatusEffect[]): number {
  return effects.reduce((sum, e) => sum + (STATUS_EFFECT_REGISTRY.get(e.defId)?.kind.type === "shield" ? e.magnitude : 0), 0);
}
