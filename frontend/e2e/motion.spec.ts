import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const width of [1440, 320]) {
  test(`realestate repository source draft and motion study at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const external: string[] = [];
    page.on("request", request => {
      if (!request.url().startsWith("http://127.0.0.1:") && !request.url().startsWith("blob:")) external.push(request.url());
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Start from repository", exact: true }).click();
    await page.getByRole("button", { name: "Create source draft" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("textbox", { name: "Public GitHub repository URL" }).fill("https://github.com/mohamedamineelabidi/realestate-rag");
    await page.getByRole("textbox", { name: "Full commit SHA" }).fill("a9fa0fa285c0ecae0224ca15240ba95640f7d2a8");
    await page.getByRole("button", { name: "Create source draft" }).click();
    await expect(page.getByRole("heading", { name: "realestate-rag", exact: true })).toBeVisible();
    await expect(page.locator(".motion-preview")).toContainText("Not a product demonstration or generated video.");
    await expect(page.locator(".motion-preview video, .motion-preview img")).toHaveCount(0);
    const composition = page.locator(".motion-preview__composition");
    await expect(composition).toHaveAttribute("data-frame", "0");
    await page.getByRole("button", { name: "Play motion preview" }).click();
    await expect.poll(async () => Number(await composition.getAttribute("data-frame"))).toBeGreaterThan(3);
    await page.getByRole("button", { name: "Pause motion preview" }).click();
    await page.getByRole("slider", { name: "Preview frame" }).fill("180");
    await expect(composition).toHaveAttribute("data-scene", "1");
    await page.getByRole("slider", { name: "Preview frame" }).fill("660");
    await expect(composition).toHaveAttribute("data-scene", "2");
    await page.getByRole("button", { name: "Restart motion preview" }).click();
    await expect(composition).toHaveAttribute("data-frame", "0");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator(".motion-preview__metadata")).toContainText("Reduced motion");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const bounds = await composition.boundingBox();
    expect(bounds!.width / bounds!.height).toBeCloseTo(16 / 9, 1);
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    expect(scan.violations.map(issue => ({ id: issue.id, nodes: issue.nodes.map(node => node.target) }))).toEqual([]);
    await page.screenshot({ path: `test-results/motion-source-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Frames", exact: true }).click();
    await page.getByRole("textbox", { name: "Caption", exact: true }).fill("x".repeat(61));
    await expect(page.getByRole("button", { name: "Save caption" })).toBeDisabled();
    await page.getByRole("textbox", { name: "Caption", exact: true }).fill("A local scene label.");
    await page.getByRole("button", { name: "Save caption" }).click();
    await page.getByRole("combobox", { name: "Highlight" }).selectOption("caret");
    await page.getByRole("button", { name: "Motion", exact: true }).click();
    await page.getByRole("slider", { name: "Preview frame" }).fill("90");
    await expect(page.locator(".motion-preview__caption")).toHaveText("A local scene label.");
    const stored = await page.evaluate(() => localStorage.getItem("demoforge.local-drafts.v1")!);
    expect(stored).toContain("realestate-rag@a9fa0fa285c0ecae0224ca15240ba95640f7d2a8");
    expect(stored).not.toContain("blob:");
    expect(external).toEqual([]);
    await page.locator(".view-tabs").getByRole("button", { name: "Review", exact: true }).click();
    await expect(page.getByRole("button", { name: "Export video" })).toBeDisabled();
    await page.getByRole("button", { name: "Projects", exact: true }).first().click();
    await expect(page.getByRole("button", { name: "Start from repository" })).toBeVisible();
  });
}

test("motion study renders the owned demo still without calling it footage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open demo data", exact: true }).first().click();
  await page.getByRole("button", { name: "Motion", exact: true }).click();
  await expect(page.getByText("Demo still / Not footage", { exact: true })).toBeVisible();
  expect(await page.locator(".motion-preview img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.getByRole("slider", { name: "Preview frame" }).fill("90");
  await expect(page.locator(".motion-preview__caption")).toHaveText("Everything in one place.");
  await page.screenshot({ path: "test-results/motion-demo.png", fullPage: true });
});