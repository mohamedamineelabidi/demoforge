import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", testMatch: "teaser.spec.ts", workers: 1, fullyParallel: false,
  timeout: 1_500_000, expect: { timeout: 15_000 },
  use: { baseURL: "http://127.0.0.1:8018", channel: "chrome", trace: "retain-on-failure" },
  webServer: {
    command: "uv run python -m tests.api.browser_server --port 8018", cwd: "..",
    url: "http://127.0.0.1:8018/api/health", reuseExistingServer: false, timeout: 30_000,
  },
  reporter: "list",
});