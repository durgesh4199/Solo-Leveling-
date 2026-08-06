import type { Game } from "../store";
import type { Screen } from "../types";
import type { ScreenController, ScreenModule } from "./types";
import { icon } from "../art/icons";
import { titleScreen } from "./title";
import { gatesScreen } from "./gates";
import { battleScreen } from "./battle";
import { statsScreen } from "./stats";
import { shadowsScreen } from "./shadows";
import { inventoryScreen } from "./inventory";

const SCREENS: Record<Screen, ScreenModule> = {
  title: titleScreen,
  gates: gatesScreen,
  battle: battleScreen,
  stats: statsScreen,
  shadows: shadowsScreen,
  inventory: inventoryScreen
};

const TABS: { screen: Screen; label: string; iconName: Parameters<typeof icon>[0] }[] = [
  { screen: "gates", label: "GATES", iconName: "door-open" },
  { screen: "stats", label: "STATUS", iconName: "chart-bar" },
  { screen: "shadows", label: "SHADOWS", iconName: "ghost" },
  { screen: "inventory", label: "ITEMS", iconName: "bag" }
];

export function mountApp(appRoot: HTMLElement, game: Game) {
  appRoot.innerHTML = `
    <div class="app-frame" style="position:relative;">
      <div id="global-toast" class="global-toast" style="display:none;"></div>
      <div id="screen-slot" style="flex:1;display:flex;flex-direction:column;min-height:0;"></div>
      <div id="tab-bar" style="display:none;border-top:1px solid var(--color-neutral-800);background:var(--color-surface);"></div>
    </div>
  `;

  const screenSlot = appRoot.querySelector<HTMLElement>("#screen-slot")!;
  const tabBar = appRoot.querySelector<HTMLElement>("#tab-bar")!;
  const globalToastEl = appRoot.querySelector<HTMLElement>("#global-toast")!;
  let renderedToastId = 0;

  tabBar.innerHTML = TABS.map((t) => `
    <button class="tab-btn" data-tab="${t.screen}">
      <span style="font-size:18px;">${icon(t.iconName)}</span>${t.label}
    </button>
  `).join("");
  tabBar.querySelectorAll<HTMLElement>("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => game.goto(btn.dataset.tab as Screen));
  });

  let currentScreen: Screen | null = null;
  let controller: ScreenController | null = null;

  const render = () => {
    const screen = game.state.screen;
    if (screen !== currentScreen) {
      controller?.unmount?.();
      currentScreen = screen;
      controller = SCREENS[screen](screenSlot, game);

      const showTabs = screen !== "title" && screen !== "battle";
      tabBar.style.display = showTabs ? "flex" : "none";
      tabBar.querySelectorAll<HTMLElement>("[data-tab]").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.tab === screen);
      });
    } else {
      controller?.update();
    }

    // App-wide notification (Title/Achievement unlocks, ...) - lives here
    // rather than any one screen so it's visible no matter what's open.
    const toast = game.state.globalToast;
    if (toast && toast.id !== renderedToastId) {
      renderedToastId = toast.id;
      globalToastEl.textContent = toast.text;
      globalToastEl.className = `global-toast show ${toast.kind}`;
      globalToastEl.style.display = "block";
    } else if (!toast) {
      globalToastEl.style.display = "none";
    }
  };

  render();
  game.subscribe(render);
}
