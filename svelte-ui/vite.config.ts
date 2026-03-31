import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    port: 5174,
    hmr: {
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
