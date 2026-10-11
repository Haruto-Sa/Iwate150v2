import { defineConfig, devices } from "@playwright/test";

const production = process.env.E2E_SERVER_MODE === "production";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: production ? "bun run start" : "bun run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI && !production,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
