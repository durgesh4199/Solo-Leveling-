import { createRegistry } from "../../services/registry";
import type { HunterClassDef } from "./types";

/** All 5 classes unlock at the same level - a Hunter has had a few real
 *  fights by then (guarding, crits, potions, at least one Skill) so the
 *  choice means something instead of being the very first decision the
 *  game asks for. */
export const CLASS_UNLOCK_LEVEL = 5;

/** The 5 classes Solo Leveling itself uses for Hunters (Fighter/Mage/
 *  Tank/Assassin/Healer), each carrying exactly the one mechanic its
 *  name promises - no class is a strictly-better all-rounder than
 *  another, they're just different combat identities to build around. */
export const HUNTER_CLASSES: HunterClassDef[] = [
  {
    id: "fighter",
    name: "Fighter",
    description: "A frontline brawler - hits hardest with a blade in hand.",
    bonus: { kind: "attackDamagePct", value: 0.12 },
    bonusText: "+12% Attack damage",
    unlockLevel: CLASS_UNLOCK_LEVEL
  },
  {
    id: "mage",
    name: "Mage",
    description: "Channels raw power into devastating Skills.",
    bonus: { kind: "skillDamagePct", value: 0.12 },
    bonusText: "+12% Skill damage",
    unlockLevel: CLASS_UNLOCK_LEVEL
  },
  {
    id: "tank",
    name: "Tank",
    description: "Turns Guard into a real wall - takes far less damage while braced.",
    bonus: { kind: "guardMitigationPct", value: 0.15 },
    bonusText: "+15% Guard mitigation",
    unlockLevel: CLASS_UNLOCK_LEVEL
  },
  {
    id: "assassin",
    name: "Assassin",
    description: "Every critical strike lands harder.",
    bonus: { kind: "critMultiplierBonus", value: 0.3 },
    bonusText: "+30% Critical damage",
    unlockLevel: CLASS_UNLOCK_LEVEL
  },
  {
    id: "healer",
    name: "Healer",
    description: "Squeezes more out of every potion.",
    bonus: { kind: "potionHealPct", value: 0.2 },
    bonusText: "+20% Potion HP healing",
    unlockLevel: CLASS_UNLOCK_LEVEL
  }
];

export const CLASS_REGISTRY = createRegistry(HUNTER_CLASSES, (c) => c.id, "Hunter Class");
