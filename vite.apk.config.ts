import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-expect-error JS plugin
import { appEnvPlugin } from "./scripts/app-env-plugin.mjs";

export default defineConfig({
  base: "/",
  resolve: { tsconfigPaths: true },
  build: { outDir: "dist-apk", emptyOutDir: true },
  plugins: [
    appEnvPlugin(),
    tailwindcss(),
    tanstackStart({
      spa: { enabled: true },
    }),
    viteReact(),
  ],
});
