import type { Game } from "../store";

export interface ScreenController {
  /** Called after every store notify while this screen is mounted. */
  update(): void;
  /** Called right before this screen is torn down (screen change). */
  unmount?(): void;
}

export type ScreenModule = (root: HTMLElement, game: Game) => ScreenController;

/** For screens with no meaningful same-screen state changes: every
 *  update() just rebuilds the innerHTML from scratch via `render`. */
export function simpleScreen(render: (game: Game) => string, wire?: (root: HTMLElement, game: Game) => void): ScreenModule {
  return (root, game) => {
    const draw = () => {
      root.innerHTML = render(game);
      wire?.(root, game);
    };
    draw();
    return { update: draw };
  };
}
