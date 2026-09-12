import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { TeaserRun } from "../src/teaser/api";

function fixtureRun(overrides: Partial<TeaserRun> = {}): TeaserRun {
  return {
    run_id: `teaser-${"d".repeat(32)}`, state: "awaiting_approval", stage: "teaser-storyboard",
    repository_url: "https://github.com/fixture/taskroom", created_at: "2026-09-12T00:00:00Z",
    approved: false, error: null, preview_url: null, downloads: {},
    checkpoint: { subject_type: "storyboard", subject_id: "storyboard-test",
      subject_revision: 1, subject_sha256: "c".repeat(64) },
    catalog: { repository: { commit_sha: "a".repeat(40) }, evidence: [{
      evidence_id: "source-0", source: "README.md", quote: "Organize team tasks.\n".repeat(100),
      line_start: 1, line_end: 100,
    }] },
    storyboard: { scenes: [{ scene_id: "title", kind: "title", start_frame: 0,
      end_frame: 180, evidence_id: "source-0", text: "Organize team tasks." }] },
    ...overrides,
  };
}

for (const state of ["failed", "cancelled", "complete"]) {
  test(`same repository starts a fresh request after ${state}`, async ({ page }) => {
    const requestIds: string[] = [];
    await page.route("**/api/runs", async route => {
      if (route.request().method() === "GET") return route.fulfill({ json: { runs: [] } });
      const body = route.request().postDataJSON();
      requestIds.push(body.request_id);
      await route.fulfill({ json: fixtureRun({ state, run_id: `teaser-${body.request_id}` }) });
    });
    await page.goto("/#teaser");
    await page.getByLabel("Public GitHub repository").fill("https://github.com/fixture/taskroom");
    await page.getByRole("button", { name: "Prepare source teaser", exact: true }).click();
    await page.getByRole("button", { name: "Prepare source teaser again", exact: true }).click();
    await expect.poll(() => requestIds.length).toBe(2);
    expect(requestIds[0]).toMatch(/^[a-f0-9]{32}$/);
    expect(requestIds[1]).not.toBe(requestIds[0]);
  });
}

test("ambiguous create and advance failures retain the request ID", async ({ page }) => {
  const requestIds: string[] = [];
  await page.route("**/api/runs", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { runs: [] } });
    requestIds.push(route.request().postDataJSON().request_id);
    if (requestIds.length === 1) return route.abort();
    await route.fulfill({ json: fixtureRun(requestIds.length === 2 ? { state: "pending" } : {}) });
  });
  await page.route("**/advance", route => route.abort());
  await page.goto("/#teaser");
  await page.getByLabel("Public GitHub repository").fill("https://github.com/fixture/taskroom");
  const prepare = page.getByRole("button", { name: "Prepare source teaser", exact: true });
  await prepare.click();
  await expect(page.getByRole("alert")).toContainText("Local backend unavailable");
  await prepare.click();
  await expect(page.getByRole("alert")).toContainText("Local backend unavailable");
  await prepare.click();
  await expect(page.getByRole("heading", { name: "Combined source and storyboard approval" })).toBeVisible();
  expect(requestIds).toHaveLength(3);
  expect(new Set(requestIds).size).toBe(1);
});

test("busy state is truthful and quotations remain accessible at 320px", async ({ page }) => {
  await page.clock.install();
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/runs", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { runs: [] } });
    await gate;
    await route.fulfill({ json: fixtureRun() });
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/#teaser");
  const status = page.getByRole("region", { name: "Source teaser", exact: true }).getByRole("status");
  await expect(status).not.toContainText("30 seconds");
  await page.getByLabel("Public GitHub repository").fill("https://github.com/fixture/taskroom");
  await page.getByRole("button", { name: "Prepare source teaser", exact: true }).click();
  await expect(status).toContainText("Preparing the source storyboard");
  await expect(status).not.toContainText("after 30 seconds");
  await page.clock.fastForward(30_000);
  await expect(status).toContainText("Still waiting for the local server after 30 seconds");
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled();
  release();
  await expect(status).toHaveText("Review the source storyboard");
  await expect(page.locator('[aria-current="step"]')).toHaveText("2Storyboard");
  await expect(page.getByRole("button", { name: "Approve source storyboard", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Render approved storyboard", exact: true })).toHaveCount(0);
  const quotation = page.getByLabel("Source quotation for title");
  await expect(quotation).toBeHidden();
  await page.getByText("Quoted source", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(quotation).toBeVisible();
  await expect(page.getByText("source-0", { exact: true })).toBeVisible();
  await quotation.focus();
  await expect(quotation).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("both exact approvals require separate render and export actions", async ({ page }) => {
  let current = fixtureRun();
  let advances = 0;
  const approvals: unknown[] = [];
  await page.route("**/api/runs", route => route.fulfill({ json: { runs: [current] } }));
  await page.route("**/approve", async route => {
    approvals.push(route.request().postDataJSON());
    current = { ...current, approved: true };
    await route.fulfill({ json: current });
  });
  await page.route("**/advance", async route => {
    advances++;
    current = advances === 1 ? fixtureRun({ stage: "teaser-review", checkpoint: {
      subject_type: "output", subject_id: "output-test", subject_revision: 2,
      subject_sha256: "e".repeat(64),
    } }) : { ...current, state: "complete", downloads: { video: "/approved-video" } };
    await route.fulfill({ json: current });
  });
  await page.goto(`/#teaser/${current.run_id}`);
  const sourceSubject = current.checkpoint;
  await page.getByLabel("Reviewer", { exact: true }).fill("Fixture reviewer");
  await page.getByLabel("Review note").fill("Synthetic source decision.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve source storyboard", exact: true }).click();
  await expect(page.getByRole("region", { name: "Source teaser", exact: true }).getByRole("status")).toHaveText("Ready to render");
  expect(advances).toBe(0);
  expect(approvals[0]).toEqual({ subject: sourceSubject, actor: "Fixture reviewer",
    note: "Synthetic source decision.", reviewed: true });
  await page.getByRole("button", { name: "Render approved storyboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Final output approval" })).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await expect(page.getByRole("link", { name: "Video", exact: true })).toHaveCount(0);
  const outputSubject = current.checkpoint;
  await page.getByLabel("Review note").fill("Synthetic output decision.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve final output", exact: true }).click();
  await expect(page.getByRole("region", { name: "Source teaser", exact: true }).getByRole("status")).toHaveText("Ready to export");
  expect(advances).toBe(1);
  expect(approvals[1]).toEqual({ subject: outputSubject, actor: "Fixture reviewer",
    note: "Synthetic output decision.", reviewed: true });
  await expect(page.getByRole("link", { name: "Video", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Export approved output", exact: true }).click();
  await expect(page.getByRole("link", { name: "Video", exact: true })).toHaveAttribute("href",
    `/api/runs/${current.run_id}/artifacts/video`);
});

test("source fixture to actual rendered video, exact approvals and offline export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create source teaser", exact: true }).click();
  await page.getByLabel("Public GitHub repository").fill("https://github.com/fixture/taskroom");
  await page.getByRole("button", { name: "Prepare source teaser", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Combined source and storyboard approval" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Source-linked storyboard" }).locator("article")).toHaveCount(3);
  await expect(page.locator("video")).toHaveCount(0);
  await page.getByText("Quoted source", { exact: true }).first().click();
  await expect(page.getByText("Organize team tasks.", { exact: false }).first()).toBeVisible();
  const runHash = new URL(page.url()).hash;
  await page.reload();
  await expect(page.getByRole("heading", { name: "Combined source and storyboard approval" })).toBeVisible();
  expect(new URL(page.url()).hash).toBe(runHash);
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "test-results/teaser-mobile.png", fullPage: true });
  await page.getByLabel("Reviewer", { exact: true }).fill("Browser fixture test");
  await page.getByLabel("Review note").fill("Synthetic automated decision, not a human approval.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve source storyboard", exact: true }).click();
  await page.getByRole("button", { name: "Render approved storyboard", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Final output approval" })).toBeVisible({ timeout: 1_400_000 });
  const video = page.locator("video");
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(0);
  expect(await video.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBe(1920);
  expect(await video.evaluate(element => (element as HTMLVideoElement).duration)).toBe(30);
  await video.evaluate(element => { (element as HTMLVideoElement).currentTime = 8; });
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).readyState)).toBeGreaterThan(1);
  const pixels = await video.evaluate(element => {
    const canvas = document.createElement("canvas"); canvas.width = 192; canvas.height = 108;
    const context = canvas.getContext("2d")!;
    context.drawImage(element as HTMLVideoElement, 0, 0, 192, 108);
    return new Set(context.getImageData(0, 0, 192, 108).data).size;
  });
  expect(pixels).toBeGreaterThan(20);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/teaser-desktop.png", fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel("Review note").fill("Synthetic full-video test approval, not a human review.");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Approve final output", exact: true }).click();
  await page.getByRole("button", { name: "Export approved output", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Approved downloads" })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Offline review bundle" }).click();
  expect((await downloaded).suggestedFilename()).toBe("bundle.zip");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Approved downloads" })).toBeVisible();
});

test("backend unavailable is visible", async ({ page }) => {
  await page.route("**/api/runs", route => route.abort());
  await page.goto("/#teaser");
  await expect(page.getByRole("alert")).toContainText("Local backend unavailable");
});

test("double submission is guarded and hostile source strings stay text", async ({ page }) => {
  const runId = `teaser-${"b".repeat(32)}`;
  const hostile = '<img src=x onerror="window.injected=true">';
  const run = {
    run_id: runId, state: "awaiting_approval", stage: "teaser-storyboard",
    repository_url: "https://github.com/fixture/taskroom", created_at: "2026-09-12T00:00:00Z",
    approved: false, error: null, preview_url: null, downloads: {},
    checkpoint: { subject_type: "storyboard", subject_id: "storyboard-test",
      subject_revision: 1, subject_sha256: "c".repeat(64) },
    catalog: { repository: { commit_sha: "a".repeat(40) }, evidence: [{
      evidence_id: "source-0", source: "javascript:alert(1)", quote: hostile,
      line_start: 1, line_end: 1,
    }] },
    storyboard: { scenes: [{ scene_id: "title", kind: "title", start_frame: 0,
      end_frame: 180, evidence_id: "source-0", text: hostile }] },
  };
  let creates = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/runs", async route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { runs: [] } });
    creates++;
    await gate;
    await route.fulfill({ json: run });
  });
  await page.goto("/#teaser");
  await page.getByLabel("Public GitHub repository").fill("https://github.com/fixture/taskroom");
  await page.getByRole("button", { name: "Prepare source teaser", exact: true }).click();
  await expect(page.getByRole("button", { name: "Prepare source teaser", exact: true })).toBeDisabled();
  await page.locator(".teaser-source").evaluate(form => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  release();
  await expect(page.getByRole("heading", { name: hostile, exact: true })).toBeVisible();
  expect(creates).toBe(1);
  await page.getByText("Quoted source", { exact: true }).click();
  await expect(page.getByText("javascript:alert(1)", { exact: true })).toBeVisible();
  await expect(page.locator('.teaser-studio img, .teaser-studio a[href^="javascript:"]')).toHaveCount(0);
  expect(await page.evaluate(() => "injected" in window)).toBe(false);
});