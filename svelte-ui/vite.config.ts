import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("/echarts/core")) {
              return "echarts-core";
            }

            if (id.includes("/echarts/charts")) {
              return "echarts-charts";
            }

            if (id.includes("/echarts/components")) {
              return "echarts-components";
            }

            if (id.includes("/echarts/renderers")) {
              return "echarts-renderers";
            }

            if (id.includes("/react-dom")) {
              return "react-dom";
            }

            if (id.includes("/react")) {
              return "react";
            }
          }

          return undefined;
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5174,
    hmr: {
      host: "127.0.0.1",
      // When accessed via Elysia proxy (port 3100), tell the HMR client
      // to connect directly to the Vite dev server on port 5174
      clientPort: 5174,
    },
    proxy: {
      "/api": {
        target: "http://localhost:3100",
        ws: true,
      },
    },
  },
});
