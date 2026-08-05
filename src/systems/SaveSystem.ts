import { SAVE_KEY } from "../config";
import type { SaveData } from "../types";
import { createNewPlayer } from "./LevelSystem";

const CURRENT_VERSION = 1;

/** Thin wrapper so we degrade gracefully if localStorage is unavailable
 *  (e.g. certain locked-down webviews) instead of crashing the game. */
function storageAvailable(): boolean {
  try {
    const testKey = "__hp_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function loadGame(): SaveData {
  if (storageAvailable()) {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SaveData;
        if (parsed.version === CURRENT_VERSION && parsed.player) {
          return parsed;
        }
      }
    } catch {
      // fall through to fresh save
    }
  }
  return createDefaultSave();
}

export function saveGame(data: SaveData): void {
  data.version = CURRENT_VERSION;
  data.updatedAt = Date.now();
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // storage full / unavailable - ignore, not fatal to gameplay
  }
}

export function createDefaultSave(): SaveData {
  return {
    version: CURRENT_VERSION,
    player: createNewPlayer("Hunter"),
    shadows: [],
    highestGateRank: "E",
    updatedAt: Date.now()
  };
}

export function resetGame(): SaveData {
  const fresh = createDefaultSave();
  saveGame(fresh);
  return fresh;
}
