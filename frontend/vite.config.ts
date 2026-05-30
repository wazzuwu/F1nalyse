import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  optimizeDeps: {
    include: ["react-plotly.js"],
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
