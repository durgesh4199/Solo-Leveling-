import type { Rank } from "../types";

/**
 * Original stylized portrait art: circular vignette + bold dark silhouette
 * + rank-tinted rim glow. No external images — everything here is inline
 * SVG generated in code, matching the Nocturne dark-violet palette. Swap
 * any of these for real artwork later by replacing the returned markup.
 */

const RANK_GLOW: Record<Rank, string> = {
  E: "#9397ab",
  D: "#9397ab",
  C: "#968ae0",
  B: "#968ae0",
  A: "#b5afe8",
  S: "#d2cefd"
};

let uidSeq = 0;

function frame(uid: string, glow: string, silhouette: string, extras = ""): string {
  return `<svg class="portrait-svg" viewBox="0 0 100 100" role="img" aria-hidden="true">
    <defs>
      <radialGradient id="bg-${uid}" cx="50%" cy="42%" r="65%">
        <stop offset="0%" stop-color="${glow}" stop-opacity="0.35"/>
        <stop offset="55%" stop-color="#1c1e2c" stop-opacity="1"/>
        <stop offset="100%" stop-color="#0d0e16" stop-opacity="1"/>
      </radialGradient>
      <radialGradient id="eye-${uid}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${glow}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#bg-${uid})"/>
    <g fill="#12131d" stroke="${glow}" stroke-width="1.1" stroke-opacity="0.55">${silhouette}</g>
    ${extras}
    <circle cx="50" cy="50" r="48.5" fill="none" stroke="${glow}" stroke-opacity="0.28" stroke-width="1.5"/>
  </svg>`;
}

function eyes(uid: string, cx1: number, cx2: number, cy: number, r = 5.5): string {
  return `<circle cx="${cx1}" cy="${cy}" r="${r}" fill="url(#eye-${uid})"/>
    <circle cx="${cx2}" cy="${cy}" r="${r}" fill="url(#eye-${uid})"/>
    <circle cx="${cx1}" cy="${cy}" r="${r * 0.28}" fill="#fff"/>
    <circle cx="${cx2}" cy="${cy}" r="${r * 0.28}" fill="#fff"/>`;
}

/** The player's hunter portrait: hooded cloak, twin violet eyes, dagger at hip. */
export function hunterPortrait(): string {
  const uid = `hunter-${uidSeq++}`;
  const glow = "#b5abfc";
  const silhouette = `
    <path d="M50 20c-13 0-21 10-21 22 0 8 3 13 6 17-9 5-16 13-16 24v7h62v-7c0-11-7-19-16-24 3-4 6-9 6-17 0-12-8-22-21-22Z"/>
    <path d="M50 20c-13 0-21 10-21 22 0 5 1.2 9 3 12.5C36 46 40 33 50 30c10 3 14 16 18 24.5 1.8-3.5 3-7.5 3-12.5 0-12-8-22-21-22Z" fill="#171826" stroke-opacity="0.4"/>
    <path d="M67 66c6 6 9 10 9 17M33 66c-6 6-9 10-9 17" fill="none" stroke-width="1.1"/>
  `;
  const extras = `
    ${eyes(uid, 43, 57, 46, 4.6)}
    <g transform="translate(74 66) rotate(30)">
      <rect x="-2" y="-14" width="4" height="16" rx="1.4" fill="${glow}" fill-opacity="0.85"/>
      <rect x="-4.5" y="2" width="9" height="4" rx="1.4" fill="${glow}" fill-opacity="0.6"/>
    </g>
  `;
  return frame(uid, glow, silhouette, extras);
}

/** Goblin Scout — E rank. Small, hunched, pointed ears. */
export function goblinScoutPortrait(): string {
  const uid = `g-${uidSeq++}`;
  const glow = RANK_GLOW.E;
  const silhouette = `
    <path d="M50 30c-10 0-17 8-17 18 0 6 2.5 10.5 6 13.5-6 4-10 10-10 17v6h42v-6c0-7-4-13-10-17 3.5-3 6-7.5 6-13.5 0-10-7-18-17-18Z"/>
    <path d="M31 40 21 30l4 15 6-3ZM69 40l10-10-4 15-6-3Z" fill="#12131d"/>
  `;
  const extras = `
    ${eyes(uid, 43, 57, 47, 4.4)}
    <path d="M45 56q5 4 10 0" fill="none" stroke="${glow}" stroke-width="1.1" stroke-opacity="0.5"/>
    <path d="m40 58-2 4M60 58l2 4" stroke="#e9e9ed" stroke-width="1.6" stroke-linecap="round"/>
  `;
  return frame(uid, glow, silhouette, extras);
}

/** Orc Brute — D rank. Wide shoulders, tusks. */
export function orcBrutePortrait(): string {
  const uid = `o-${uidSeq++}`;
  const glow = RANK_GLOW.D;
  const silhouette = `
    <path d="M50 24c-11 0-19 8-19 19 0 6 2 11 5.5 14.5-8 4-13.5 11-13.5 19v7h54v-7c0-8-5.5-15-13.5-19 3.5-3.5 5.5-8.5 5.5-14.5 0-11-8-19-19-19Z"/>
  `;
  const extras = `
    ${eyes(uid, 42, 58, 45, 4.8)}
    <path d="m38 58-3 8 6-2 3 6 3-6 3 6 3-6 6 2-3-8" fill="none" stroke="${glow}" stroke-width="1" stroke-opacity="0.4"/>
    <path d="M39 55q-4 8 1 11l3-7ZM61 55q4 8-1 11l-3-7Z" fill="#f3f5fe" fill-opacity="0.92" stroke="none"/>
  `;
  return frame(uid, glow, silhouette, extras);
}

/** Ice Wraith — C rank. Floating, jagged crystalline cloak, no legs. */
export function iceWraithPortrait(): string {
  const uid = `i-${uidSeq++}`;
  const glow = RANK_GLOW.C;
  const silhouette = `
    <path d="M50 22 40 34l-13-4 7 15-12 8 15 4-4 15 13-9 4 15 4-15 13 9-4-15 15-4-12-8 7-15-13 4Z" fill-opacity="0.9"/>
    <path d="M50 40c-8 0-14 7-14 15 0 10 6 17 14 22 8-5 14-12 14-22 0-8-6-15-14-15Z" fill="#12131d"/>
  `;
  const extras = `
    ${eyes(uid, 44, 56, 52, 4)}
  `;
  return frame(uid, glow, silhouette, extras);
}

/** Blood Knight — B rank. Helmet with brim, pauldrons, cape. */
export function bloodKnightPortrait(): string {
  const uid = `k-${uidSeq++}`;
  const glow = RANK_GLOW.B;
  const silhouette = `
    <path d="M50 66c14 0 24-6 24-6v18H26V60s10 6 24 6Z" opacity="0.9"/>
    <path d="M28 66c-6 4-9 10-9 17v5h62v-5c0-7-3-13-9-17Z" fill-opacity="0.95"/>
    <path d="M50 20c-11 0-19 8-19 18 0 9 5 15 10 18a30 30 0 0 0 18 0c5-3 10-9 10-18 0-10-8-18-19-18Z"/>
    <path d="M28 32h44l-3 8H31Z" fill="#0d0e16"/>
  `;
  const extras = `
    ${eyes(uid, 43, 57, 40, 3.8)}
    <path d="M50 44v14" stroke="${glow}" stroke-width="1.2" stroke-opacity="0.5"/>
  `;
  return frame(uid, glow, silhouette, extras);
}

/** Shadow Beast — A rank. Feral, clawed, spiked ridge. */
export function shadowBeastPortrait(): string {
  const uid = `b-${uidSeq++}`;
  const glow = RANK_GLOW.A;
  const silhouette = `
    <path d="M50 26c-14 0-24 11-24 24 0 9 4 16 10 20-3 4-6 8-6 12v3h40v-3c0-4-3-8-6-12 6-4 10-11 10-20 0-13-10-24-24-24Z"/>
    <path d="m30 30-8-10 2 13 6 1ZM70 30l8-10-2 13-6 1Z" fill="#12131d"/>
    <path d="M20 78c4-6 10-10 10-10M80 78c-4-6-10-10-10-10" fill="none" stroke="${glow}" stroke-width="1.3" stroke-opacity="0.5"/>
  `;
  const extras = `
    ${eyes(uid, 41, 59, 46, 5.2)}
    <path d="M40 58q10 6 20 0" fill="none" stroke="${glow}" stroke-width="1" stroke-opacity="0.4"/>
  `;
  return frame(uid, glow, silhouette, extras);
}

/** Ancient Wyrm — S rank. Dragon head, horns, flared wings. */
export function ancientWyrmPortrait(): string {
  const uid = `w-${uidSeq++}`;
  const glow = RANK_GLOW.S;
  const silhouette = `
    <path d="M10 55c10-8 18-6 22-2 4-10 12-19 18-19s14 9 18 19c4-4 12-6 22 2-8 2-14 6-16 10 2 6 2 12-2 17-6-4-10-9-12-14-4 4-8 6-12 6s-8-2-12-6c-2 5-6 10-12 14-4-5-4-11-2-17-2-4-8-8-16-10Z"/>
    <path d="M42 34 46 20l4 12ZM58 34l-4-14-4 12Z" fill="#e7e5fe" fill-opacity="0.85" stroke="none"/>
  `;
  const extras = `
    ${eyes(uid, 42, 58, 47, 4.6)}
    <path d="M35 58q15 8 30 0" fill="none" stroke="${glow}" stroke-width="1.1" stroke-opacity="0.45"/>
  `;
  return frame(uid, glow, silhouette, extras);
}

const ENEMY_PORTRAITS: Record<string, () => string> = {
  "Goblin Scout": goblinScoutPortrait,
  "Orc Brute": orcBrutePortrait,
  "Ice Wraith": iceWraithPortrait,
  "Blood Knight": bloodKnightPortrait,
  "Shadow Beast": shadowBeastPortrait,
  "Ancient Wyrm": ancientWyrmPortrait
};

export function enemyPortrait(monsterName: string): string {
  const fn = ENEMY_PORTRAITS[monsterName];
  return fn ? fn() : goblinScoutPortrait();
}

/** Small gate-list thumbnail: an arched portal glowing with the gate's rank color. */
export function gatePortrait(rank: Rank): string {
  const uid = `gate-${uidSeq++}`;
  const glow = RANK_GLOW[rank];
  const silhouette = `
    <path d="M30 78V46c0-12 9-22 20-22s20 10 20 22v32Z" fill="#12131d" stroke="${glow}" stroke-width="1.4" stroke-opacity="0.6"/>
    <path d="M38 78V48c0-8 5.5-15 12-15s12 7 12 15v30" fill="none" stroke="${glow}" stroke-width="1" stroke-opacity="0.4"/>
  `;
  const extras = `<ellipse cx="50" cy="50" rx="8" ry="16" fill="url(#eye-${uid})" opacity="0.8"/>`;
  return frame(uid, glow, silhouette, extras);
}

/** A "shadow" reuses its source monster's silhouette but desaturated,
 *  monochrome-violet, with a stronger glow — reads as "arisen"/ghostly. */
export function shadowPortrait(sourceMonster: string): string {
  const base = enemyPortrait(sourceMonster);
  const uid = `shadow-wrap-${uidSeq++}`;
  return `<svg class="portrait-svg" viewBox="0 0 100 100" role="img" aria-hidden="true">
    <defs>
      <filter id="mono-${uid}">
        <feColorMatrix type="matrix" values="0.6 0.6 0.6 0 0  0.55 0.55 0.55 0 0  0.7 0.7 0.7 0 0  0 0 0 1 0"/>
      </filter>
    </defs>
    <g filter="url(#mono-${uid})" opacity="0.92">
      ${base.replace(/<\/?svg[^>]*>/g, "")}
    </g>
  </svg>`;
}
