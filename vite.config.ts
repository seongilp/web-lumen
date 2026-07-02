import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Project page on GitHub Pages is served under /web-lumen/. Dev stays at /.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/web-lumen/" : "/",
  plugins: [react(), tailwindcss()],
  // Pin the port so OPFS (scoped per origin, port included) survives restarts.
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: "es",
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"), // landing
        app: path.resolve(__dirname, "app/index.html"), // viewer
      },
    },
  },
}));
