import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/effects.css";
import { Game } from "./store";
import { mountApp } from "./screens";

const root = document.getElementById("app");
if (!root) throw new Error("Missing #app root element");

const game = new Game();
mountApp(root, game);
