import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// CIはオンデマンドコンパイル・HMRの影響を受けない本番サーバーで検証する。
const production = process.env.CI === "true" || process.env.E2E_SERVER_MODE === "production";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: production ? "bun run build && bun run start" : "bun run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI && !production,
    timeout: 180_000,
    // テストサーバーだけに渡す毎回異なる鍵。本番設定への既定値は追加しない。
    env: { AUTH_SECRET: process.env.AUTH_SECRET ?? randomBytes(32).toString("hex") },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
