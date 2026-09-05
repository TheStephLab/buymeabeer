import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  // "/" for production (custom domain root); the PR-preview workflow sets
  // BASE_PATH to /pr-preview/pr-<N>/ so assets resolve under the preview subpath.
  base: process.env.BASE_PATH ?? "/",
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        legal: fileURLToPath(new URL("./legal.html", import.meta.url)),
      },
    },
  },
});
