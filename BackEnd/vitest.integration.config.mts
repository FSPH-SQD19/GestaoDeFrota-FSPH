import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    pool: "threads",
    maxWorkers: 1,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
