import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves at /latest-news/, local dev serves at /
  base: isGitHubPages ? "/latest-news/" : "/",
  server: {
    proxy: {
      "/api": "http://localhost:5000",
    },
  },
});
