import { defineConfig } from "vite";

// Relative base so the built bundle works when loaded from:
//  - a static web host (any subpath)
//  - Electron's file:// protocol
//  - Capacitor's local webview origin
export default defineConfig({
  base: "./",
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true
  }
});
