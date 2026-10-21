import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "../node_modules/.cache/vitest/backend",
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "html", "json-summary"],
      include: ["src/service/**/*.ts", "src/controller/**/*.ts"],
    },
  },
});
