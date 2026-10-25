import { defineConfig } from "vite";
import { runtimePlugin } from "./runtime.ts";

export default defineConfig({
  plugins: [runtimePlugin()],
  server: {
    proxy: {
      "/runtime-ws": {
        target: "http://127.0.0.1:8080", ws: true,
        // Preserve Host so esp32sim can verify the matching loopback Origin.
        changeOrigin: false, rewrite: () => "/ws",
      },
    },
  },
  build: { outDir: "../tmp/platform-dist", emptyOutDir: true },
});
