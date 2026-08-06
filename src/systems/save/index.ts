import { readRaw, writeRaw, clearRaw } from "../../services/storage";
import { CURRENT_SCHEMA_VERSION, type SaveFile, type SavedGameState } from "./types";

/** Reads and validates the save on disk. Returns null for "no save" *and*
 *  for "unreadable/corrupt/future-schema save" - either way the caller's
 *  correct move is the same (offer a fresh start), so callers don't need
 *  to distinguish the two. A newer schema than this build understands is
 *  treated as unreadable rather than guessed at. */
export function loadSave(): SavedGameState | null {
  const raw = readRaw();
  if (!raw) return null;
  let parsed: SaveFile;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.schemaVersion !== "number") return null;
  if (parsed.schemaVersion > CURRENT_SCHEMA_VERSION) return null;
  // schemaVersion < CURRENT_SCHEMA_VERSION is where a future migration
  // chain would run; version 1 is the only version that has ever existed.
  if (!parsed.state || typeof parsed.state !== "object") return null;
  return parsed.state;
}

export function writeSave(state: SavedGameState): boolean {
  const file: SaveFile = { schemaVersion: CURRENT_SCHEMA_VERSION, savedAt: Date.now(), state };
  try {
    return writeRaw(JSON.stringify(file));
  } catch {
    return false;
  }
}

export function clearSave(): void {
  clearRaw();
}

export function hasSave(): boolean {
  return readRaw() !== null;
}
