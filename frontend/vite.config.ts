import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
  optimizeDeps: {
    include: ["react-plotly.js"],
  },
  server: {
    allowedHosts: ["f1nalyse-backend.up.railway.app"],
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
  preview: {
    allowedHosts: ["f1nalyse-backend.up.railway.app"],
  },
});
