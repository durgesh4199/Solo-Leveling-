/**
 * Small original line-icon set (24x24, stroke=currentColor) replacing the
 * design file's Phosphor icon-font references. Kept as plain SVG so there's
 * no external font/icon-library dependency to ship or load offline.
 */
const ICONS: Record<string, string> = {
  sword: '<path d="M14.5 3 21 9.5l-2 2-1.2-1.2-7.1 7.1.9.9-2 2-1.6-1.6L3 23l-1-1 4.9-5-1.6-1.6 2-2 .9.9 7.1-7.1L14 5.9l2-2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  "shield-checkered": '<path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  "circle-dashed": '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 3.4"/>',
  flask: '<path d="M9 2h6M10 2v6.2L4.8 18a2 2 0 0 0 1.8 3h10.8a2 2 0 0 0 1.8-3L14 8.2V2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7.5 15h9" stroke="currentColor" stroke-width="1.6"/>',
  ghost: '<path d="M5 20V11a7 7 0 0 1 14 0v9l-2.3-1.8L14.5 20l-2.5-1.8L9.5 20l-2.2-1.8L5 20Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="9.5" cy="11" r="1.1" fill="currentColor"/><circle cx="14.5" cy="11" r="1.1" fill="currentColor"/>',
  skull: '<path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.1 4 2.3 5.2.5.5.7 1 .7 1.6V17a1 1 0 0 0 1 1h1v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2h1a1 1 0 0 0 1-1v-1.2c0-.6.2-1.1.7-1.6C17.9 13 19 11.4 19 9a7 7 0 0 0-7-7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="9.5" cy="9.5" r="1.3" fill="currentColor"/><circle cx="14.5" cy="9.5" r="1.3" fill="currentColor"/>',
  "moon-stars": '<path d="M20 12.5A8 8 0 1 1 11.5 4a6.3 6.3 0 0 0 8.5 8.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M19 3v3M17.5 4.5h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  "door-open": '<path d="M13 21V4l7-1v18M4 21h9M4 21V6l6-1.5V21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="11" cy="13" r="0.9" fill="currentColor"/>',
  "chart-bar": '<path d="M4 20V10M11 20V4M18 20v-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 20h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  bag: '<path d="M6 8h12l1 12.5a1.5 1.5 0 0 1-1.5 1.5H6.5A1.5 1.5 0 0 1 5 20.5L6 8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8V6a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  "check-circle": '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="m8.5 12.2 2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  "caret-right": '<path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  lightning: '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor"/>',
  flame: '<path d="M12 2c1 3-2 4-2 7a4 4 0 0 0 8 0c1.5 1.5 2 3.4 2 5a8 8 0 1 1-16 0c0-4 2-5 3-8 .5 2 1.5 2.5 2 1.5C10 5 11 3 12 2Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  coin: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="5.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="1.6 2"/>',
  sparkles: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  trash: '<path d="M5 7h14M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M7 7l1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
};

export function icon(name: keyof typeof ICONS, size = "1em"): string {
  const body = ICONS[name] ?? "";
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
