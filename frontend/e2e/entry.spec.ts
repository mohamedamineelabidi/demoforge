import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const fixtureDir = join(process.cwd(), "test-results");
const fixture = join(fixtureDir, "entry-fixture.webm");

function ensureFixture() {
  if (existsSync(fixture)) return true;
  mkdirSync(fixtureDir, { recursive: true });
  try {
    execFileSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-f", "lavfi", "-i", "color=c=0x234e44:s=320x180:r=30:d=1",
        "-c:v", "libvpx-vp9", "-b:v", "50k", "-an",
        fixture.replace(/\\/g, "/"),
      ],
      { stdio: "ignore", timeout: 60_000 },
    );
    return existsSync(fixture);
  } catch {
    return false;
  }
}

async function walkToFootage(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole("heading", {
      name: /Turn a shipped feature, a brief and your own footage/,
    }),
  ).toBeVisible();
  await page.getByTestId("entry-new-project").click();

  await expect(page.getByRole("heading", { name: "Repository", exact: true })).toBeVisible();
  const url = page.getByRole("textbox", { name: "GitHub repository URL" });
  await url.fill("https://gitlab.com/nope/nope");
  await page.getByRole("button", { name: "Continue to brief" }).click();
  const urlError = page.getByRole("alert").filter({ hasText: "owner/repo" });
  await expect(urlError).toBeVisible();
  expect(await url.getAttribute("aria-describedby")).toContain(await urlError.getAttribute("id"));
  await url.fill("https://github.com/nousresearch/hermes-agent");
  await expect(page.locator(".entry-parsed")).toContainText("nousresearch / hermes-agent");
  await page.getByRole("textbox", { name: "Commit SHA (optional)" }).fill("abc");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: "40 hexadecimal" })).toBeVisible();
  await page.getByRole("textbox", { name: "Commit SHA (optional)" }).fill("");
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Brief", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Feature name" }).fill("Filter completed tasks");
  const changed = page.getByRole("textbox", { name: "What changed" });
  await changed.fill("A seamless filter \u2014 hides finished tasks.");
  await expect(page.locator(".entry-lint li")).toHaveCount(2);
  await changed.fill("Users can hide finished tasks with one click.");
  await expect(page.locator(".entry-lint")).toHaveCount(0);
  await expect(page.locator(".entry-counter").nth(1)).toHaveText("45/300");
  await page.getByRole("textbox", { name: "Who it is for" }).fill("Team leads");
  await page.getByRole("button", { name: "Continue to footage" }).click();
  await expect(page.getByRole("heading", { name: "Footage", exact: true })).toBeVisible();
}

test("landing, three steps, review and draft creation", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const hasFixture = ensureFixture();
  await walkToFootage(page);

  await page.getByRole("button", { name: "Review inputs" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Add one footage file" })).toBeVisible();

  if (hasFixture) {
    await page.locator('input[type="file"]').setInputFiles(fixture);
    await expect(page.getByTestId("footage-duration")).not.toHaveText("reading", { timeout: 10_000 });
    const duration = await page.getByTestId("footage-duration").textContent();
    if (duration !== "not readable") {
      expect(duration).toMatch(/^1\.0 s$/);
      await expect(page.getByTestId("footage-frame")).toHaveText("320 x 180");
    }
  } else {
    test.info().annotations.push({ type: "skip-footage", description: "ffmpeg unavailable" });
    await page.locator('input[type="file"]').setInputFiles({
      name: "clip.webm",
      mimeType: "video/webm",
      buffer: Buffer.from("not a real video"),
    });
    await expect(page.getByTestId("footage-duration")).not.toHaveText("reading", { timeout: 10_000 });
  }

  await page.getByRole("textbox", { name: "Recorded by" }).fill("Amine");
  await page.getByRole("button", { name: "Review inputs" }).click();
  const check = page.getByRole("checkbox", { name: "I am authorized to use this footage." });
  await expect(page.getByRole("alert").filter({ hasText: "authorized" })).toBeVisible();
  await check.focus();
  await page.keyboard.press("Space");
  await expect(check).toBeChecked();
  await page.getByRole("button", { name: "Review inputs" }).click();

  await expect(page.getByRole("heading", { name: "Review", exact: true })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Nothing has been sent yet" })).toBeVisible();
  await expect(page.locator(".entry-review")).toContainText("nousresearch / hermes-agent");
  await expect(page.locator(".entry-review")).toContainText("Filter completed tasks");
  await expect(page.locator(".entry-review")).toContainText("recorded by Amine");
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  await page.screenshot({ path: "test-results/entry-review-1280.png", fullPage: true });

  await page.getByTestId("entry-create").click();
  await expect(page.getByRole("heading", { name: "Filter completed tasks" })).toBeVisible();
  await expect(page.locator(".preview-heading .badge")).toHaveText("Local footage");
  const stored = await page.evaluate(() => localStorage.getItem("demoforge.local-drafts.v1") ?? "");
  expect(stored).toContain("https://github.com/nousresearch/hermes-agent");
  expect(stored).not.toContain("blob:");
});

test("entry flow fits 375px and passes accessibility checks", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await walkToFootage(page);
  for (const step of ["Footage"]) {
    await expect(page.getByRole("heading", { name: step, exact: true })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("heading", { name: "Brief", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/entry-brief-375.png", fullPage: true });
});
