import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: [
        "src/domain/**/*.ts",
        "src/services/**/*.ts",
        "src/ui/state.ts",
      ],
    },
  },
});
