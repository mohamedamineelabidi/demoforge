import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const [manifestPath, output, rig] = process.argv.slice(2);
const requireRig = createRequire(join(rig, "package.json"));
const { chromium } = requireRig("playwright");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (!Array.isArray(manifest.captions) || manifest.captions.length !== 3 ||
    manifest.captions.some(caption => typeof caption !== "string" || [...caption].length > 60) ||
    !/^#[a-fA-F0-9]{6}$/.test(manifest.foreground)) throw new Error("Invalid overlay manifest");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1, serviceWorkers: "block", offline: true });
  await context.route("**/*", route => route.abort());
  const page = await context.newPage();
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
    <style>html,body{margin:0;background:transparent;width:1920px;height:1080px}
    #caption{position:absolute;left:160px;top:935px;width:1600px;height:120px;
    font:48px/1.15 'Segoe UI',sans-serif;letter-spacing:0;overflow-wrap:anywhere;
    text-align:center;color:${manifest.foreground}}</style></head><body><div id="caption"></div></body></html>`);
  for (const [index, caption] of manifest.captions.entries()) {
    await page.locator("#caption").evaluate((element, text) => { element.textContent = text; }, caption);
    const fits = await page.locator("#caption").evaluate(element =>
      element.scrollHeight <= element.clientHeight && element.scrollWidth <= element.clientWidth);
    if (!fits) throw new Error("Caption does not fit overlay");
    await page.screenshot({ path: join(output, `caption-${index}.png`), omitBackground: true });
  }
  await context.close();
} finally {
  await browser.close();
}