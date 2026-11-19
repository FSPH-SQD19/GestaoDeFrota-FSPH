import { defineConfig, devices } from "@playwright/test";

const e2ePort = process.env.ROTA_QA_E2E_PORT ?? "4173";
const baseURL = process.env.ROTA_QA_BASE_URL ?? `http://127.0.0.1:${e2ePort}`;
const webServer = process.env.ROTA_QA_BASE_URL
  ? {
      // Wait for the external Docker stack to answer before opening the SPA.
      command: 'node -e "setInterval(() => {}, 1000)"',
      url: `${baseURL}/api/v1/auth/csrf`,
      reuseExistingServer: true,
      timeout: 120_000,
    }
  : {
      command: `npm run dev -- --host 127.0.0.1 --port ${e2ePort} --strictPort`,
      url: baseURL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { VITE_API_URL: "http://127.0.0.1:3000" },
    };

export default defineConfig({
  testDir: "./tests/e2e/docker",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
  },
  projects: [{ name: "docker-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer,
});
