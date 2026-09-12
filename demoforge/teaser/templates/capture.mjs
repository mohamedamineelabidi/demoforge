import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const [html, output, rig] = process.argv.slice(2);
const require = createRequire(path.join(rig, "package.json"));
const { chromium } = require("playwright");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
    offline: true, serviceWorkers: "block", reducedMotion: "no-preference",
  });
  const documentUrl = pathToFileURL(html).href;
  await context.route("**/*", route => route.request().url() === documentUrl
    ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(documentUrl);
  await page.evaluate(() => document.fonts.ready);
  const captured = new Map();
  for (let frame = 0; frame < 900; frame += 1) {
    const state = await page.evaluate(frame => window.renderFrame(frame), frame);
    if (errors.length) throw new Error(errors.join("; "));
    const destination = path.join(output, `frame-${String(frame).padStart(4, "0")}.png`);
    if (captured.has(state.capture_key)) {
      await fs.link(captured.get(state.capture_key), destination);
    } else {
      await page.screenshot({ path: destination, type: "png", scale: "css" });
      captured.set(state.capture_key, destination);
    }
  }
  await fs.writeFile(path.join(output, "capture.json"), JSON.stringify({
    captured_frames: captured.size, browser_version: browser.version(),
  }));
  await context.close();
} finally {
  await browser.close();
}