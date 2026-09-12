import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import catalog from "../test-fixtures/catalog.json" with { type: "json" };
import report from "../test-fixtures/quality.json" with { type: "json" };
import { createProject, STORAGE_KEY } from "../src/model";

async function openView(page: Page, name: string) {
  await page.locator(".view-tabs").getByRole("button", { name, exact: true }).click();
}

async function upload(page: Page, kind: "evidence catalog" | "quality report", value: unknown) {
  await page.getByRole("checkbox", { name: `I confirm this ${kind} is sanitized and safe to display.` }).check();
  await page.getByLabel(`Import ${kind}`, { exact: true }).setInputFiles({ name: "artifact.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) });
}

for (const width of [1440, 320]) {
  test(`imports display safe contract data and preserve authority boundaries at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open demo data", exact: true }).first().click();
    await openView(page, "Evidence");
    await expect(page.getByLabel("Import evidence catalog", { exact: true })).toBeDisabled();
    const untrustedQuote = '<img src="https://untrusted.invalid/tracking" onerror="alert(1)">';
    const outbound: string[] = [];
    page.on("request", request => { if (request.url().includes("untrusted.invalid")) outbound.push(request.url()); });
    await upload(page, "evidence catalog", { ...catalog, evidence: [{ ...catalog.evidence[0], quote: untrustedQuote }] });
    await expect(page.locator(".evidence-record blockquote")).toHaveText(untrustedQuote);
    await expect(page.locator(".evidence-record img")).toHaveCount(0);
    await expect(page.locator(".claim-entry")).toHaveCount(0);
    await expect(page.locator(".evidence-record")).toContainText(catalog.evidence[0].content_sha256);
    expect(outbound).toEqual([]);
    await upload(page, "evidence catalog", { schema_version: 2, secret: "do-not-display" });
    await expect(page.getByRole("alert")).toContainText("Invalid evidence catalog");
    await expect(page.locator(".artifact-panel")).not.toContainText("do-not-display");
    await expect(page.locator(".evidence-record blockquote")).toHaveText(untrustedQuote);
    const storage = await page.evaluate(() => JSON.stringify(localStorage));
    expect(storage).not.toContain("test-catalog");
    expect(storage).not.toContain("untrusted.invalid");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const evidenceScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(evidenceScan.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
    await page.screenshot({ path: `test-results/imported-evidence-${width}.png`, fullPage: true });
    await openView(page, "Review");
    await upload(page, "quality report", { ...report, gate: "pass", checks: [{ ...report.checks[0], status: "pass", reason: "Synthetic result, not backend verification." }] });
    await expect(page.getByRole("status").filter({ hasText: "Matches imported catalog" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export video", exact: true })).toBeDisabled();
    const reviewScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(reviewScan.violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/imported-review-${width}.png`, fullPage: true });
    await openView(page, "Evidence");
    await upload(page, "evidence catalog", { ...catalog, revision: 2 });
    await openView(page, "Review");
    await expect(page.getByRole("status").filter({ hasText: "Stale report" })).toBeVisible();
    await page.getByRole("button", { name: "Remove report" }).click();
    await expect(page.getByText("No report loaded.", { exact: false })).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Open demo data", exact: true }).first().click();
    await openView(page, "Evidence");
    await expect(page.getByRole("heading", { name: "No imported catalog" })).toBeVisible();
  });
}

test("imports stay project-local and late reads cannot attach to another view", async ({ page }) => {
  await page.addInitScript(({ key, project }) => localStorage.setItem(key, JSON.stringify({ version: 1, projects: [project] })), { key: STORAGE_KEY, project: createProject("Separate draft") });
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo data", exact: true }).first().click();
  await openView(page, "Evidence");
  await upload(page, "evidence catalog", catalog);
  await expect(page.locator(".artifact-heading")).toContainText("test-catalog");
  await page.getByRole("button", { name: "Projects", exact: true }).first().click();
  await page.getByRole("button", { name: /Separate draft/ }).first().click();
  await openView(page, "Evidence");
  await expect(page.getByRole("heading", { name: "No imported catalog" })).toBeVisible();
  await page.evaluate(() => {
    const scope = window as unknown as { finishImport: () => void };
    File.prototype.text = function () { return new Promise(resolve => { scope.finishImport = () => resolve('{"schema_version":2}'); }); };
  });
  await upload(page, "evidence catalog", catalog);
  await openView(page, "Review");
  await page.evaluate(() => (window as unknown as { finishImport: () => void }).finishImport());
  await openView(page, "Evidence");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "No imported catalog" })).toBeVisible();
});

test("removing an artifact cancels a pending replacement", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo data", exact: true }).first().click();
  await openView(page, "Evidence");
  await upload(page, "evidence catalog", catalog);
  await expect(page.locator(".artifact-heading")).toContainText("test-catalog");
  await page.evaluate(raw => {
    const scope = window as unknown as { finishImport: () => void };
    File.prototype.text = function () { return new Promise(resolve => { scope.finishImport = () => resolve(raw); }); };
  }, JSON.stringify(catalog));
  await upload(page, "evidence catalog", catalog);
  await page.getByRole("button", { name: "Remove catalog" }).click();
  await page.evaluate(async () => {
    (window as unknown as { finishImport: () => void }).finishImport();
    await new Promise(requestAnimationFrame);
  });
  await expect(page.getByRole("heading", { name: "No imported catalog" })).toBeVisible();
});