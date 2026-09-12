import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "teaser.spec.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.FRONTEND_URL ?? "http://127.0.0.1:5174",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  reporter: "list",
});
