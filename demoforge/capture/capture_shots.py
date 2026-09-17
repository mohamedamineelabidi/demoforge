"""Captures real UI viewport screenshots of target applications using Playwright."""

from __future__ import annotations

import subprocess
from pathlib import Path


def capture_app_shots(
    target_url: str,
    output_dir: Path,
    shot_count: int = 4,
    viewport_width: int = 1280,
    viewport_height: int = 720,
) -> list[str]:
    """Capture real full-resolution screenshots of the target application using Playwright.

    Returns list of paths relative to the Remotion public dir (e.g. 'captured/rec-123/shot-1.png').
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    clean_out = str(output_dir).replace("\\", "/")

    node_script = f"""
const path = require('path');
const fs = require('fs');
const rig = process.env.DEMOFORGE_RIG || path.join(process.env.LOCALAPPDATA, 'Temp/demoforge-rig');
let req;
try {{
  req = require('module').createRequire(path.join(rig, 'package.json'));
}} catch {{
  req = require;
}}
const {{ chromium }} = req('playwright');

(async () => {{
  const outDir = '{clean_out}';
  const browser = await chromium.launch({{ channel: 'chrome', headless: true }});
  const page = await browser.newPage({{
    viewport: {{ width: {viewport_width}, height: {viewport_height} }}
  }});

  try {{
    await page.goto('{target_url}', {{ waitUntil: 'networkidle', timeout: 15000 }});
  }} catch {{
    try {{
      await page.goto('{target_url}', {{ waitUntil: 'load', timeout: 10000 }});
    }} catch (e) {{
      console.error('Navigation warning:', e.message);
    }}
  }}

  await page.waitForTimeout(600);

  // Shot 1: Top Hero
  await page.screenshot({{ path: path.join(outDir, 'shot-1.png') }});

  // Shot 2: First scroll section
  await page.evaluate(() => window.scrollBy(0, 520));
  await page.waitForTimeout(400);
  await page.screenshot({{ path: path.join(outDir, 'shot-2.png') }});

  // Shot 3: Second scroll section
  await page.evaluate(() => window.scrollBy(0, 550));
  await page.waitForTimeout(400);
  await page.screenshot({{ path: path.join(outDir, 'shot-3.png') }});

  // Shot 4: Third scroll section
  await page.evaluate(() => window.scrollBy(0, 550));
  await page.waitForTimeout(400);
  await page.screenshot({{ path: path.join(outDir, 'shot-4.png') }});

  await browser.close();
  console.log('CAPTURED_SUCCESS');
}})().catch(err => {{
  console.error('CAPTURE_ERROR:', err);
  process.exit(1);
}});
"""
    try:
        subprocess.run(
            ["node", "-e", node_script],
            capture_output=True,
            text=True,
            timeout=45,
            check=True,
        )
        files = []
        for i in range(1, shot_count + 1):
            p = output_dir / f"shot-{i}.png"
            if p.exists():
                files.append(p)
        if files:
            rel_folder = output_dir.name
            parent_folder = output_dir.parent.name
            return [f"{parent_folder}/{rel_folder}/{f.name}" for f in files]
    except Exception as exc:
        print(f"Warning: Playwright capture failed ({exc}), falling back to default footage.")

    return []

