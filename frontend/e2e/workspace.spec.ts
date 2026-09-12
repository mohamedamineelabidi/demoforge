import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("fixture contains a real completed filter and produces the local reference image", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/#fixture");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".fixture-task")).toHaveCount(4);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(page.locator(".fixture-task")).toHaveCount(2);
  await page.getByRole("button", { name: "All tasks", exact: true }).click();
  await page.screenshot({ path: "public/taskroom.png" });
});

test("create, edit, reorder, undo and persist a browser draft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Project name" })
    .fill("September launch");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "September launch" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Play footage", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Properties", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Caption", exact: true })
    .fill("Filter your completed work.");
  await page
    .getByRole("textbox", { name: "Caption", exact: true })
    .press("Tab");
  await expect(page.locator(".preview-caption")).toHaveText(
    "Filter your completed work.",
  );
  await page.getByRole("button", { name: "Scenes", exact: true }).click();
  await page
    .getByRole("button", { name: "Move scene 1 down", exact: true })
    .click();
  await expect(page.locator(".scene-select strong").first()).toHaveText(
    "One clear action",
  );
  await page
    .getByRole("button", { name: "Undo scene edit", exact: true })
    .click();
  await expect(page.locator(".scene-select strong").first()).toHaveText(
    "The starting point",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "September launch", exact: false })
    .first()
    .click();
  await expect(page.locator(".preview-caption")).toHaveText(
    "Filter your completed work.",
  );
  await page.getByRole("button", { name: "Review draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Export video", exact: true }),
  ).toBeDisabled();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download draft JSON", exact: true })
    .click();
  expect((await downloadPromise).suggestedFilename()).toMatch(
    /draft-r\d+\.json/,
  );
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`core workspaces fit ${viewport.width}px and pass accessibility checks`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const libraryScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(libraryScan.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) }))).toEqual([]);
    await page.screenshot({ path: `test-results/projects-${viewport.width}.png`, fullPage: true });
    await page
      .getByRole("button", { name: "Open demo data", exact: true })
      .first()
      .click();
    for (const view of ["Storyboard", "Evidence", "Footage", "Review"]) {
      await page
        .locator(".view-tabs")
        .getByRole("button", { name: view, exact: true })
        .click();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      expect(
        scan.violations.map((issue) => ({
          id: issue.id,
          nodes: issue.nodes.map((node) => node.target),
        })),
      ).toEqual([]);
      await page.screenshot({
        path: `test-results/${view.toLowerCase()}-${viewport.width}.png`,
        fullPage: true,
      });
    }
    await page
      .locator(".view-tabs")
      .getByRole("button", { name: "Storyboard", exact: true })
      .click();
    const preview = page.locator(".scene-preview");
    const bounds = await preview.boundingBox();
    expect(bounds!.width / bounds!.height).toBeCloseTo(16 / 9, 1);
    expect(
      await page
        .locator(".demo-preview")
        .evaluate(
          (image: HTMLImageElement) => image.complete && image.naturalWidth > 0,
        ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page.getByRole("button", { name: "Play footage", exact: true }),
    ).toBeDisabled();
  });
}

test("conflicting tabs cannot overwrite a draft and corrupt storage is preserved", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open demo data", exact: true })
    .first()
    .click();
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "New project", exact: true }).click();
  await other.getByRole("textbox", { name: "Project name" }).fill("Other tab");
  await other
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("another tab");
  await expect(
    page.getByRole("button", { name: "Move scene 1 down", exact: true }),
  ).toBeDisabled();
  await page.evaluate(() =>
    localStorage.setItem("demoforge.local-drafts.v1", "{corrupt"),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("could not be read");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("demoforge.local-drafts.v1"),
    ),
  ).toBe("{corrupt");
});

test("keyboard dialog escape returns focus and 200-percent-equivalent layout reflows", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", {
    name: "New project",
    exact: true,
  });
  await trigger.click();
  await expect(
    page.getByRole("textbox", { name: "Project name" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await page
    .getByRole("button", { name: "Open demo data", exact: true })
    .first()
    .click();
  await page.setViewportSize({ width: 640, height: 360 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("local footage requires permission, plays real frames and never persists its URL", async ({
  page,
}) => {
  await page.goto("/");
  const encoded = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#176b5b";
    context.fillRect(0, 0, 640, 360);
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" });
    const chunks: Blob[] = [];
    const result = new Promise<string>((resolve) => {
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.readAsDataURL(new Blob(chunks, { type: "video/webm" }));
      };
    });
    recorder.start();
    const started = performance.now();
    let recordedFrames = 0;
    function draw(now: number) {
      recordedFrames += 1;
      context.fillStyle = "#176b5b";
      context.fillRect(0, 0, 640, 360);
      context.fillStyle = "#ffffff";
      context.fillRect((now - started) / 8, 80, 80, 80);
      if (recordedFrames < 60 || now - started < 1500) requestAnimationFrame(draw);
      else recorder.stop();
    }
    requestAnimationFrame(draw);
    return result;
  });
  await page
    .getByRole("button", { name: "Open demo data", exact: true })
    .first()
    .click();
  await page
    .locator(".view-tabs")
    .getByRole("button", { name: "Footage", exact: true })
    .click();
  await page
    .getByLabel("Select product footage", { exact: true })
    .setInputFiles({
      name: "controlled-fixture.webm",
      mimeType: "video/webm",
      buffer: Buffer.from(encoded, "base64"),
    });
  await expect(
    page.getByRole("button", { name: "Open preview", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: "I have permission" }).check();
  await page
    .getByRole("checkbox", { name: "I reviewed the full recording" })
    .check();
  await page.getByRole("button", { name: "Open preview", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((element) => ({
          ready: element.readyState >= 2,
          error: element.error?.message ?? null,
        })),
    )
    .toEqual({ ready: true, error: null });
  await page.getByRole("button", { name: "Play footage", exact: true }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((element) => element.currentTime),
    )
    .toBeGreaterThan(0);
  expect(
    await page.locator("video").evaluate((element) => element.videoWidth),
  ).toBe(640);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("demoforge.local-drafts.v1"),
    ),
  ).not.toContain("blob:");
  await page
    .locator(".view-tabs")
    .getByRole("button", { name: "Footage", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: "I reviewed the full recording" })
    .uncheck();
  await page
    .locator(".view-tabs")
    .getByRole("button", { name: "Storyboard", exact: true })
    .click();
  await expect(
    page.getByText("Preview restricted", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
});

test("project library filters saved tiles without creating phantom projects", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo data", exact: true }).click();
  await page.locator(".breadcrumbs").getByRole("button", { name: "Projects", exact: true }).click();
  await expect(page.locator(".draft-tile")).toHaveCount(1);
  await page.getByRole("textbox", { name: "Search projects" }).fill("does not exist");
  await expect(page.getByRole("heading", { name: "No matching projects" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("combobox", { name: "Project filter" }).selectOption("real");
  await expect(page.locator(".draft-tile")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Project filter" }).selectOption("demo");
  await expect(page.locator(".draft-tile")).toHaveCount(1);
  await page.screenshot({ path: "test-results/projects-populated.png", fullPage: true });
});

test("deleting a project removes the browser draft", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Open demo data", exact: true })
    .first()
    .click();
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete local project", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your next release, in the making.", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("demoforge.local-drafts.v1")!).projects,
    ),
  ).toEqual([]);
});
