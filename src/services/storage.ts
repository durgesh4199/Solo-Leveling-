/** Thin localStorage wrapper - the only file that touches `localStorage`
 *  directly, so swapping the backend later (e.g. a real cloud save once a
 *  server exists - see EXPANSION_ROADMAP.md) means changing this file
 *  alone. Every call is defensive: private browsing, quota-exceeded, and
 *  disabled storage all fail closed (return null / false) instead of
 *  throwing into game logic. */

const KEY = "hunter-protocol-save";

export function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeRaw(json: string): boolean {
  try {
    localStorage.setItem(KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function clearRaw(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to do - if it couldn't be read/written, it can't matter that it wasn't cleared
  }
}
