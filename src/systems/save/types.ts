import type { GameState } from "../../types";

/** The persisted subset of GameState - deliberately excludes `screen` and
 *  `battle`. A screen is never meaningful to restore to (Continue always
 *  lands on Gates); an in-progress battle is full of live setTimeout-driven
 *  animation state that can't be reconstructed from cold storage, so a
 *  save mid-fight simply drops back to the gate list rather than trying
 *  (and failing) to resume mid-round. */
export type SavedGameState = Pick<
  GameState,
  "player" | "gatesCleared" | "shadowArmy" | "inventory" | "bag" | "shop" | "progress" | "talents"
>;

export interface SaveFile {
  schemaVersion: number;
  savedAt: number;
  state: SavedGameState;
}

/** Bump whenever SavedGameState's shape changes in a way older saves can't
 *  be read as-is. migrateSave() is the single place that would grow a
 *  switch-per-version to upgrade old saves forward; today there's only
 *  ever been version 1, so it's a no-op beyond the version check. */
export const CURRENT_SCHEMA_VERSION = 1;
