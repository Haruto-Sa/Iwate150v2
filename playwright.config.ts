import { randomBytes } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// CIはオンデマンドコンパイル・HMRの影響を受けない本番サーバーで検証する。
const production = process.env.CI === "true" || process.env.E2E_SERVER_MODE === "production";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  globalTimeout: 10 * 60_000,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: production ? "bun run build && bun run start" : "bun run dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 180_000,
    // テストサーバーだけに渡す毎回異なる鍵。本番設定への既定値は追加しない。
    env: {
      AUTH_URL: "http://127.0.0.1:3000",
      AUTH_SECRET: randomBytes(32).toString("hex"),
      // E2Eは公開モックデータ専用。ローカル.envから実DBやOAuthを引き継がない。
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      AUTH_GITHUB_ID: "",
      AUTH_GITHUB_SECRET: "",
      AUTH_EMAIL_SERVER_HOST: "",
    },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: "**/screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "screenshots",
      testMatch: "**/screenshots.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 414, height: 896 } },
    },
  ],
});
