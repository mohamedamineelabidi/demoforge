import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { createProject, STORAGE_KEY } from "../src/model";
import catalog from "../test-fixtures/catalog.json" with { type: "json" };

async function prepare(page: Page) {
  await page.goto("/");
  await page.evaluate(({ project, key }) => localStorage.setItem(key, JSON.stringify({ version: 1, projects: [project] })), {
    key: STORAGE_KEY, project: createProject("Release review"),
  });
  await page.reload();
  await page.getByRole("button", { name: /Release review/ }).first().click();
  await view(page, "Evidence");
  await page.getByRole("checkbox", { name: /I confirm this evidence catalog/ }).check();
  await page.getByLabel("Import evidence catalog", { exact: true }).setInputFiles({ name: "catalog.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(catalog)) });
  await expect(page.locator(".artifact-heading")).toContainText("test-catalog");
}

async function view(page: Page, name: string) {
  await page.locator(".view-tabs").getByRole("button", { name, exact: true }).click();
}

async function accessible(page: Page) {
  const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")]
    .filter(element => element.getBoundingClientRect().right > innerWidth)
    .map(element => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width })).slice(0, 12));
  await page.screenshot({ path: `test-results/review-layout-${page.viewportSize()?.width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(overflow)).toBe(true);
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(scan.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) }))).toEqual([]);
}

for (const width of [1440, 320]) {
  test(`local approval, frame editing and mock status at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 });
    await prepare(page);
    await view(page, "Approvals");
    await expect(page.locator(".approval-subject h3")).toHaveText(["Claims", "Storyboard", "Final output"]);
    const claims = page.getByRole("article", { name: "Claims review", exact: true });
    const storyboard = page.getByRole("article", { name: "Storyboard review", exact: true });
    await expect(claims.getByRole("button", { name: "Approve locally" })).toBeDisabled();
    await page.getByRole("textbox", { name: "Operator label" }).fill("Local operator");
    await expect(claims.getByRole("button", { name: "Approve locally" })).toBeEnabled();
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await claims.getByRole("button", { name: "Copy full SHA-256" }).first().click();
    await expect(claims.getByRole("status").filter({ hasText: "SHA-256 copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^[a-f0-9]{64}$/);
    await claims.getByRole("button", { name: "Approve locally" }).click();
    await expect(storyboard.getByRole("button", { name: "Reject locally" })).toBeDisabled();
    await storyboard.getByRole("button", { name: "Approve locally" }).click();
    await expect(storyboard.locator(".approval-records")).toContainText("Current snapshot / latest local decision");
    const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).projects[0], STORAGE_KEY);
    expect(stored.revision).toBe(1);
    expect(stored.approvalDrafts).toHaveLength(2);
    expect(stored.approvalDrafts[1].decided_at).toMatch(/Z$/);
    await accessible(page);
    await page.screenshot({ path: `test-results/approvals-${width}.png`, fullPage: true });
    await view(page, "Storyboard");
    await page.getByRole("button", { name: "Frames", exact: true }).click();
    await expect(page.locator(".fs-summary")).toContainText("900 / 900 frames");
    const caption = page.getByRole("textbox", { name: "Caption", exact: true });
    await caption.fill("A seamless update \u2014 finished.");
    await expect(caption).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("button", { name: "Save caption" })).toBeDisabled();
    await caption.fill("Filter completed work.");
    await page.getByRole("button", { name: "Save caption" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".fs-status")).toContainText("Storyboard changed, re-approval required");
    await expect(page.locator(".fs-scenes li").first()).toContainText("Changed since approval");
    await page.getByRole("combobox", { name: "Highlight", exact: false }).selectOption("spotlight");
    await page.getByRole("textbox", { name: "Footage clip reference" }).fill("local-clip-01");
    await page.getByRole("textbox", { name: "Footage clip reference" }).press("Tab");
    await page.getByRole("spinbutton", { name: "End frame (exclusive)" }).fill("200");
    await page.getByRole("spinbutton", { name: "End frame (exclusive)" }).press("Enter");
    await expect(page.locator(".fs-summary")).toContainText("920 / 900 frames");
    await expect(page.locator(".fs-scenes li").nth(1)).toContainText("start_frame 200 / end_frame 680");
    await page.getByRole("button", { name: "Undo scene edit" }).click();
    await expect(page.locator(".fs-summary")).toContainText("900 / 900 frames");
    await expect(page.getByRole("textbox", { name: "Caption", exact: true })).toHaveCount(1);
    await accessible(page);
    await page.screenshot({ path: `test-results/frames-${width}.png`, fullPage: true });
    await view(page, "Approvals");
    await expect(storyboard.locator(".approval-records")).toContainText("Stale / local only");
    await page.getByRole("textbox", { name: "Operator label" }).fill("Local operator");
    await storyboard.getByRole("textbox", { name: /Review note/ }).fill("Revise the scene highlight.");
    await storyboard.getByRole("button", { name: "Reject locally" }).click();
    await expect(storyboard.locator(".approval-records")).toContainText("Rejected locally");
    await page.locator(".workspace-run-panel > summary").click();
    await expect(page.locator(".run-status")).toContainText("Mock run / Backend not connected");
    await expect(page.locator('.run-status [aria-current="step"]')).toHaveCount(1);
    await expect(page.locator('.run-status [aria-current="step"]')).toHaveAttribute("data-run-state", "awaiting_approval");
    await expect(page.locator(".run-status-attempts")).toContainText("/ 3");
    await accessible(page);
    await page.screenshot({ path: `test-results/run-status-${width}.png`, fullPage: true });
    await view(page, "Review");
    await expect(page.getByRole("button", { name: "Export video", exact: true })).toBeDisabled();
    await page.reload();
    await page.getByRole("button", { name: /Release review/ }).first().click();
    await page.getByRole("button", { name: "Frames", exact: true }).click();
    await expect(page.getByRole("combobox", { name: "Highlight", exact: false })).toHaveValue("spotlight");
    await view(page, "Approvals");
    await expect(storyboard.locator(".approval-records")).toContainText("Revise the scene highlight.");
    await expect(storyboard.getByRole("button", { name: "Approve locally" })).toBeDisabled();
  });
}

test("final MP4 decisions bind actual bytes and never authorize export", async ({ page }) => {
  const directory = join(process.cwd(), "test-results");
  mkdirSync(directory, { recursive: true });
  const output = join(directory, "approval-output.mp4");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", output.replaceAll("\\", "/")], { timeout: 60000 });
  const hash = createHash("sha256").update(readFileSync(output)).digest("hex");
  await prepare(page);
  await view(page, "Approvals");
  await page.getByRole("textbox", { name: "Operator label" }).fill("Local operator");
  const card = page.getByRole("article", { name: "Final output review" });
  await expect(card.getByLabel("Select local final MP4", { exact: true })).toBeDisabled();
  await card.getByRole("checkbox", { name: /authorized to use this supplied final MP4/ }).check();
  await card.getByRole("checkbox", { name: /confirm this file is safe/ }).check();
  await card.getByLabel("Select local final MP4", { exact: true }).setInputFiles(output);
  await expect(card.getByRole("checkbox", { name: /reviewed the entire supplied output/ })).toBeEnabled();
  await card.getByRole("checkbox", { name: /reviewed the entire supplied output/ }).check();
  await card.getByRole("button", { name: "Approve locally" }).click();
  const stored = await page.evaluate(key => localStorage.getItem(key)!, STORAGE_KEY);
  expect(stored).toContain(hash);
  expect(stored).not.toContain("blob:");
  expect(stored).not.toContain("approval-output.mp4");
  await expect(card.locator(".approval-records")).toContainText("Current snapshot / latest local decision");
  await card.getByRole("button", { name: "Remove output" }).click();
  await expect(card.locator("video")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Approve locally" })).toBeDisabled();
  await expect(card.locator(".approval-records")).toContainText("Stale / local only");
  await view(page, "Review");
  await expect(page.getByRole("button", { name: "Export video", exact: true })).toBeDisabled();
});