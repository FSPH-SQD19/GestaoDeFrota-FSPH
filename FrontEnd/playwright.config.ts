import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.ROTA_QA_E2E_PORT ?? "4175";
const baseURL = process.env.ROTA_QA_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["tests/e2e/docker/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
    url: baseURL,
    reuseExistingServer: process.env.ROTA_QA_REUSE_SERVER === "true",
    timeout: 120_000,
    env: { VITE_API_URL: baseURL },
  },
});
