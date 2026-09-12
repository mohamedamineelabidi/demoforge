"""Teaser rendering checks; the expensive real-media gate is explicitly opt-in."""

import hashlib
import json
import os
from html.parser import HTMLParser
from pathlib import Path
from types import SimpleNamespace

import pytest

from demoforge.teaser.render import _inspect_generated, render_teaser, teaser_html
from demoforge.video.import_media import MediaError


def sample_spec(text="Source-linked, editable release-demo videos"):
    return SimpleNamespace(
        schema_version=1,
        revision=1,
        product_name="DemoForge",
        repository_url="https://github.com/example/demoforge",
        commit_sha="a" * 40,
        catalog_sha256="b" * 64,
        fps=30,
        width=1920,
        height=1080,
        total_frames=900,
        scenes=[
            SimpleNamespace(
                scene_id=f"scene-{index}", kind=kind, start_frame=start, end_frame=end,
                text=caption, evidence_id=f"evidence-{index}",
            )
            for index, (kind, start, end, caption) in enumerate([
                ("title", 0, 180, text),
                ("feature", 180, 660, "Every text line is linked to repository evidence."),
                ("end", 660, 900, "Source-linked, editable release-demo videos"),
            ])
        ],
    )


class Elements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.policies = []

    def handle_starttag(self, tag, attrs):
        self.tags.append(tag)
        attributes = dict(attrs)
        if attributes.get("http-equiv", "").lower() == "content-security-policy":
            self.policies.append(attributes["content"])


def test_html_is_offline_and_source_strings_cannot_escape_script():
    hostile = '</script><img src="https://invalid.test" onerror="alert(1)">'
    spec = sample_spec(hostile)
    spec.product_name = hostile
    spec.repository_url = hostile
    spec.scenes[1].evidence_id = hostile
    page = teaser_html(spec)
    parsed = Elements()
    parsed.feed(page)
    assert parsed.tags.count("script") == 1
    assert "img" not in parsed.tags
    assert hostile not in page
    assert "\\u003c/script\\u003e" in page
    assert "default-src 'none'" in parsed.policies[0]
    assert "connect-src 'none'" in parsed.policies[0]
    assert "script-src 'sha256-" in parsed.policies[0]
    assert "unsafe-eval" not in page
    assert "Motion-design teaser / Not a recording" in page
    assert "window.renderFrame" in page
    assert "textContent" in page
    assert "innerHTML" not in page
    assert teaser_html(spec) == page


def test_existing_target_is_not_overwritten(tmp_path):
    target = tmp_path / "existing.mp4"
    target.write_bytes(b"keep this")
    with pytest.raises(MediaError, match="new MP4"):
        render_teaser(sample_spec(), target)
    assert target.read_bytes() == b"keep this"


def test_non_mp4_target_is_rejected(tmp_path):
    with pytest.raises(MediaError, match="new MP4"):
        render_teaser(sample_spec(), tmp_path / "video.webm")


@pytest.mark.parametrize("frozen", [False, True])
def test_media_samples_compare_motion_pairs_not_unrelated_holds(tmp_path, monkeypatch, frozen):
    target = tmp_path / "sample.mp4"
    target.write_bytes(b"synthetic encoded artifact")

    def fake_run(command, timeout):
        if command[0] == "ffprobe":
            return json.dumps({
                "streams": [{"codec_type": "video", "width": 1920, "height": 1080,
                             "avg_frame_rate": "30/1", "nb_read_frames": "900"}],
                "format": {"duration": "30.0"},
            }).encode()
        if "framemd5" in command:
            selection = command[command.index("-vf") + 1]
            count = selection.count("eq(n,")
            hashes = ["same" if frozen else f"motion-{index}" for index in range(count)]
            hashes[-1] = hashes[-2]
            return "\n".join(f"0, 0, 0, 1, 1, {digest}" for digest in hashes).encode()
        return b""

    monkeypatch.setattr("demoforge.teaser.render._run", fake_run)
    if frozen:
        with pytest.raises(MediaError, match="motion samples"):
            _inspect_generated(target)
    else:
        result = _inspect_generated(target)
        assert result["sample_frame_md5"]["810"] == result["sample_frame_md5"]["899"]


def test_browser_frames_and_responsive_bounds(tmp_path):
    rig = Path(os.environ.get("DEMOFORGE_RIG", str(
        Path(os.environ.get("LOCALAPPDATA", "")) / "Temp/demoforge-rig"
    )))
    if not (rig / "node_modules/playwright/package.json").exists():
        pytest.skip("external Playwright rig is unavailable")
    spec = sample_spec("W" * 60)
    spec.product_name = "M" * 60
    spec.repository_url = "https://github.com/" + "r" * 280
    for scene in spec.scenes:
        scene.evidence_id = "e" * 256
    page = tmp_path / "preview.html"
    page.write_text(teaser_html(spec), encoding="utf-8")
    hostile = tmp_path / "hostile.html"
    hostile.write_text(teaser_html(sample_spec('</script><img src=x onerror="alert(1)">')),
                       encoding="utf-8")
    script = r"""
const {createRequire} = require('node:module');
const {pathToFileURL} = require('node:url');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {chromium} = createRequire(path.join(process.argv[1], 'package.json'))('playwright');
(async () => {
 const browser = await chromium.launch({channel:'chrome', headless:true});
 try {
  const context = await browser.newContext({viewport:{width:1920,height:1080},
   deviceScaleFactor:1, offline:true, serviceWorkers:'block'});
    const documents = [process.argv[2], process.argv[3]].map(file => pathToFileURL(file).href);
    await context.route('**/*', route => documents.includes(route.request().url())
        ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(process.argv[2]).href);
  const digest = async frame => {
   await page.evaluate(frame => window.renderFrame(frame), frame);
   return crypto.createHash('md5').update(await page.screenshot()).digest('hex');
  };
  const first = await digest(60);
  assert.notEqual(first, await digest(12));
  await digest(390);
  assert.equal(first, await digest(60));
  assert.equal(await digest(810), await digest(899));
  assert.equal(await digest(100), await digest(179));
  assert.notEqual(await digest(210), await digest(540));
    await page.evaluate(() => window.renderFrame(240));
    assert.equal(await page.locator('#headline').textContent(),
     'Every text line is linked to repository evidence.');
    assert.match(await page.locator('#illustration-label').textContent(), /illustration/i);
    assert.equal(await page.locator('[data-document]').count(), 3);
    const geometry = async frame => {
     await page.evaluate(frame => window.renderFrame(frame), frame);
    return page.locator('#document-focus').evaluate(
     element => getComputedStyle(element).transform);
    };
    const assembled = await geometry(240);
    assert.notEqual(assembled, await geometry(420));
    assert.equal(assembled, await geometry(240));
    const keys = new Map();
    for (const frame of [0,12,60,179,180,192,240,359,360,372,420,509,510,522,600,659,
     660,672,750,809,810,850,899,240,12,600]) {
     const state = await page.evaluate(frame => window.renderFrame(frame), frame);
     const pixels = await digest(frame);
     if (keys.has(state.capture_key)) assert.equal(pixels, keys.get(state.capture_key));
     keys.set(state.capture_key, pixels);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await digest(192), await digest(240));
    assert.equal(await digest(372), await digest(420));
    assert.equal(await digest(522), await digest(600));
    assert.equal(await digest(672), await digest(899));
    await page.emulateMedia({reducedMotion:'no-preference'});
  for (const width of [1920, 1280, 390, 320]) {
   await page.setViewportSize({width, height:1080});
   for (const frame of [60, 179, 240, 420, 600, 750, 810, 899]) {
    await page.evaluate(frame => window.renderFrame(frame), frame);
    const issues = await page.evaluate(() => {
     const issues = [];
     if (document.documentElement.scrollWidth > innerWidth) issues.push('page overflow');
     for (const id of ['headline','caption','identity','evidence','revision','source']) {
      const element = document.getElementById(id);
      if (getComputedStyle(element).display === 'none') continue;
      if (element.scrollWidth > element.clientWidth + 1) issues.push(id + ' horizontal');
      if (element.scrollHeight > element.clientHeight + 1) issues.push(id + ' vertical');
     }
     const headline = document.getElementById('headline').getBoundingClientRect();
     const caption = document.getElementById('caption').getBoundingClientRect();
     const footer = document.querySelector('footer').getBoundingClientRect();
     if (Math.max(headline.bottom, caption.bottom) > footer.top) issues.push('footer overlap');
    const illustration = document.getElementById('illustration');
    if (getComputedStyle(illustration).display !== 'none') {
     const art = illustration.getBoundingClientRect();
     if (art.bottom > footer.top) issues.push('illustration footer overlap');
     if (innerWidth < 800 && headline.bottom > art.top) issues.push('illustration text overlap');
     if (innerWidth >= 800 && headline.right > art.left) issues.push('illustration text overlap');
    }
     return issues;
    });
    assert.deepEqual(issues, [], `${width}px frame ${frame}: ${issues}`);
   }
    await page.evaluate(() => window.renderFrame(600));
    await page.screenshot({path:path.join(path.dirname(process.argv[2]), `feature-${width}.png`),
     fullPage:true});
    await page.screenshot({path:path.join(path.dirname(process.argv[2]), `layout-${width}.png`)});
  }
  await page.goto(pathToFileURL(process.argv[3]).href);
  await page.evaluate(() => window.renderFrame(100));
  assert.equal(await page.locator('img').count(), 0);
  assert.match(await page.locator('#caption').textContent(), /<img/);
  await assert.rejects(page.evaluate(() => window.renderFrame(-1)));
  await assert.rejects(page.evaluate(() => window.renderFrame(900)));
  assert.deepEqual(errors, []);
 } finally { await browser.close(); }
})().catch(error => {console.log(error.stack); process.exitCode = 1;});
"""
    import subprocess

    completed = subprocess.run(
        ["node", "-e", script, rig.resolve().as_posix(), page.as_posix(), hostile.as_posix()],
        capture_output=True, timeout=120, check=False,
    )
    assert completed.returncode == 0, completed.stdout.decode() + completed.stderr.decode()


@pytest.mark.skipif(
    os.environ.get("DEMOFORGE_TEASER_MEDIA") != "1", reason="foreground real-media gate opt-in"
)
def test_real_teaser_media(tmp_path):
    folder = Path(os.environ.get("DEMOFORGE_TEASER_OUTPUT", str(tmp_path)))
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / "teaser.mp4"
    spec = sample_spec()
    (folder / "preview.html").write_text(teaser_html(spec), encoding="utf-8")
    result = render_teaser(spec, target)
    assert result["frame_count"] == 900
    assert result["duration_seconds"] == 30
    assert (result["width"], result["height"], result["fps"]) == (1920, 1080, 30)
    assert result["has_audio"] is False
    assert result["sha256"] == hashlib.sha256(target.read_bytes()).hexdigest()
    assert 3 < result["captured_frames"] < 900
    samples = result["sample_frame_md5"]
    for start, end in [(12, 60), (192, 240), (372, 420), (522, 600), (672, 750)]:
        assert samples[str(start)] != samples[str(end)]
    assert result["origin"] == "generated_typography"
    assert "permission" not in result
    (folder / "measurements.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"artifact": str(target), **result}, indent=2))