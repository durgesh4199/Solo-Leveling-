import type { Game } from "../store";

export interface ScreenController {
  /** Called after every store notify while this screen is mounted. */
  update(): void;
  /** Called right before this screen is torn down (screen change). */
  unmount?(): void;
}

export type ScreenModule = (root: HTMLElement, game: Game) => ScreenController;

/** Every screen in this game redraws by reassigning some element's
 *  `innerHTML` wholesale (no DOM diffing) rather than patching individual
 *  nodes - simple and reliable, but it means the element carrying
 *  `overflow-y:auto` gets torn down and recreated as a brand-new node on
 *  *every* redraw, which the browser always starts at scrollTop 0. Left
 *  unhandled, that means clicking Sell/Disenchant/Deploy/Equip - or even
 *  an unrelated background tick calling `update()` - on anything below
 *  the fold of a long list snaps the whole view back to the top, away
 *  from what was just clicked.
 *
 *  `redraw` fixes this at the one place every screen's redraw already
 *  funnels through: it finds whichever descendant of `container` is
 *  marked `data-scroll` *before* `render()` tears it down, then restores
 *  that same scrollTop on its replacement afterward. Every screen's own
 *  render function should mark its single scrollable wrapper with
 *  `data-scroll` and call this instead of assigning `innerHTML` directly.
 *
 *  A genuine "show different content from the top" moment (switching
 *  Inventory's Gear/Shop/Craft/Potions sub-tab, or Status's Class/
 *  Talents/Relics/... sub-tab) is a deliberate navigation, not an
 *  in-place update - those call sites explicitly zero the region's
 *  scrollTop right after calling `redraw` instead of skipping it, so the
 *  restore-old-position default doesn't fight the new-panel intent. */
export function redraw(container: HTMLElement, render: () => void) {
  const prevScroll = container.querySelector<HTMLElement>("[data-scroll]")?.scrollTop ?? 0;
  render();
  const region = container.querySelector<HTMLElement>("[data-scroll]");
  if (region) region.scrollTop = prevScroll;
}

/** For screens with no meaningful same-screen state changes: every
 *  update() just rebuilds the innerHTML from scratch via `render`. */
export function simpleScreen(render: (game: Game) => string, wire?: (root: HTMLElement, game: Game) => void): ScreenModule {
  return (root, game) => {
    const draw = () => {
      redraw(root, () => {
        root.innerHTML = render(game);
        wire?.(root, game);
      });
    };
    draw();
    return { update: draw };
  };
}
