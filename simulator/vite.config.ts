import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL("./web", import.meta.url)),
  build: {
    assetsInlineLimit: 0,
    outDir: fileURLToPath(new URL("../tmp/simulator-web", import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL("./web/run.html", import.meta.url)),
    },
  },
});
