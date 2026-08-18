import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/aravind-portfolio/" : "/",
  server: {
    port: 5173,
  },
}));
