import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const URL = 'http://127.0.0.1:8001/';
const WIDTH = 1280;
const HEIGHT = 800;
const native = value => path.resolve(value).replaceAll('\\', '/');
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const run = (command, args) => execFileSync(command, args, {
  timeout: 240000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8', windowsHide: true
});

export function cameraAt(frame, frames, focus) {
  assert.ok(Number.isInteger(frame) && frame >= 0 && frame < frames);
  assert.ok(Number.isFinite(focus.x) && Number.isFinite(focus.y));
  const ramp = Math.max(0, Math.min(1, (frame - 20) / 40, (frames - 21 - frame) / 40));
  const zoom = 1 + .35 * ramp * ramp * (3 - 2 * ramp);
  return {zoom, x: Math.max(0, Math.min(WIDTH - WIDTH / zoom, focus.x - WIDTH / zoom / 2)),
    y: Math.max(0, Math.min(HEIGHT - HEIGHT / zoom, focus.y - HEIGHT / zoom / 2))};
}

export function makeEdit() {
  const entries = [
    ['library', 'Project library', 'Open the built-in demo project.'],
    ['canvas', 'Storyboard canvas', 'Edit a caption in a local browser draft.'],
    ['frames', 'Frame editor', 'Save a caption against the scene timeline.'],
    ['evidence', 'Evidence', 'Inspect demo claims. No catalog is imported.'],
    ['footage', 'Footage', 'A real recording must be supplied and reviewed.'],
    ['approvals', 'Approvals', 'Local review controls. No approvals are submitted.'],
    ['review', 'Review', 'Draft checks are visible. Video export is disabled.'],
    ['teaser', 'Source teaser', 'Connected repository entry. No run is submitted.']
  ];
  return {schema_version: 1, scope: 'owned-demoforge-fixture', url: URL,
    human_approved: false, fps: 30, width: 1920, height: 1080,
    shots: entries.map(([id, title, caption], index) => ({id, title, caption,
      evidence_id: `observed-${index + 1}`, source: `${id}.webm`, source_in: 0,
      frames: 225, focus: {x: 760, y: 420}}))};
}

export function validateEdit(edit) {
  assert.equal(edit.scope, 'owned-demoforge-fixture');
  assert.equal(edit.url, URL);
  assert.equal(edit.human_approved, false);
  assert.equal(edit.fps, 30);
  assert.equal(edit.shots.length, 8);
  assert.equal(new Set(edit.shots.map(shot => shot.id)).size, 8);
  for (const shot of edit.shots) {
    assert.match(shot.id, /^[a-z]+$/);
    assert.equal(shot.source, `${shot.id}.webm`);
    assert.ok(Number.isFinite(shot.source_in) && shot.source_in >= 0);
    assert.ok(Number.isInteger(shot.frames) && shot.frames >= 90 && shot.frames <= 450);
    for (const text of [shot.title, shot.caption, shot.evidence_id]) {
      assert.ok(typeof text === 'string' && text.length > 0 && text.length <= 80);
      assert.doesNotMatch(text, /[<>\x00-\x1f]/);
    }
    assert.ok(Number.isFinite(shot.focus.x) && shot.focus.x >= 0 && shot.focus.x <= WIDTH);
    assert.ok(Number.isFinite(shot.focus.y) && shot.focus.y >= 0 && shot.focus.y <= HEIGHT);
  }
  assert.equal(edit.shots.reduce((total, shot) => total + shot.frames, 0), 1800);
}

async function cursor(page) {
  await page.evaluate(() => {
    const element = document.createElement('div');
    element.id = 'demo-cursor';
    element.style.cssText = 'position:fixed;left:640px;top:400px;z-index:2147483647;'
      + 'width:26px;height:30px;pointer-events:none;filter:drop-shadow(1px 2px 2px #0005)';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 28');
    const arrow = document.createElementNS(svg.namespaceURI, 'path');
    arrow.setAttribute('d', 'M3 2 L20 15 L12 16 L8 24 Z');
    arrow.setAttribute('fill', 'white');
    arrow.setAttribute('stroke', '#172d38');
    arrow.setAttribute('stroke-width', '1.5');
    svg.append(arrow);
    element.append(svg);
    document.body.append(element);
    document.addEventListener('mousemove', event => {
      element.style.left = `${event.clientX}px`;
      element.style.top = `${event.clientY}px`;
    });
    document.addEventListener('mousedown', () => {
      element.animate([{scale: '1'}, {scale: '.82'}, {scale: '1'}], {duration: 260});
    });
  });
}

async function click(page, locator, label, paced) {
  await locator.waitFor({state: 'visible'});
  assert.ok(await locator.isEnabled(), `${label} is disabled`);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box, `${label} has no geometry`);
  const focus = {x: box.x + box.width / 2, y: box.y + box.height / 2};
  await page.mouse.move(focus.x, focus.y, {steps: paced ? 24 : 1});
  if (paced) await page.waitForTimeout(350);
  await locator.click();
  console.log(`Verified control: ${label}`);
  return focus;
}

async function setup(page, shot) {
  await page.goto(URL, {waitUntil: 'networkidle'});
  await page.evaluate(() => document.fonts.ready);
  if (shot.id === 'library' || shot.id === 'teaser') return;
  await click(page, page.getByRole('button', {name: 'Open demo data', exact: true}).first(),
    'Open demo data', false);
  if (shot.id === 'canvas') return;
  if (shot.id === 'frames') {
    await click(page, page.getByRole('button', {name: 'Frames', exact: true}), 'Frames', false);
  } else {
    await click(page, page.locator('.view-tabs').getByRole('button', {
      name: shot.title, exact: true
    }), shot.title, false);
  }
}

async function act(page, shot, paced) {
  const button = name => page.getByRole('button', {name, exact: true});
  if (shot.id === 'library') {
    return click(page, button('Open demo data').first(), 'Open demo data', paced);
  }
  if (shot.id === 'canvas' || shot.id === 'frames') {
    const input = page.getByRole('textbox', {name: 'Caption', exact: true});
    const focus = await click(page, input, 'Caption', paced);
    await input.fill('');
    await input.pressSequentially('Review the starting state.', {delay: paced ? 35 : 0});
    if (shot.id === 'frames') await click(page, button('Save caption'), 'Save caption', paced);
    else await input.press('Tab');
    assert.equal(await input.inputValue(), 'Review the starting state.');
    return focus;
  }
  if (shot.id === 'teaser') {
    await click(page, button('Create source teaser'), 'Create source teaser', paced);
    const input = page.getByRole('textbox', {name: 'Public GitHub repository', exact: true});
    await input.waitFor({state: 'visible'});
    return click(page, input, 'Repository URL entry (not submitted)', paced);
  }
  const headings = {evidence: 'Evidence & claims', footage: 'Supplied footage',
    approvals: 'Approval review', review: 'Review before export'};
  const heading = page.getByRole('heading', {name: headings[shot.id], exact: true});
  await heading.waitFor({state: 'visible'});
  if (shot.id === 'review') assert.ok(await button('Export video').isDisabled());
  const box = await heading.boundingBox();
  const focus = {x: Math.min(WIDTH, box.x + 400), y: Math.min(HEIGHT, box.y + 210)};
  await page.mouse.move(focus.x, focus.y, {steps: paced ? 30 : 1});
  return focus;
}

async function fieldMap(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll(
    'input,select,textarea,button,[contenteditable=true]')).filter(el => el.offsetParent !== null)
    .map(el => ({tag: el.tagName, type: el.type || '', name: el.getAttribute('aria-label') || '',
      text: el.textContent.trim().slice(0, 70)})));
}

async function contextFor(browser, directory) {
  const context = await browser.newContext({viewport: {width: WIDTH, height: HEIGHT},
    deviceScaleFactor: 1, serviceWorkers: 'block',
    ...(directory ? {recordVideo: {dir: directory, size: {width: WIDTH, height: HEIGHT}}} : {})});
  await context.route('**/*', async route => {
    const request = route.request();
    if (!request.url().startsWith(URL) || request.method() !== 'GET') return route.abort();
    if (new globalThis.URL(request.url()).pathname === '/api/runs') {
      return route.fulfill({status: 200, contentType: 'application/json', body: '{"runs":[]}'});
    }
    return route.continue();
  });
  return context;
}

function probe(file) {
  return JSON.parse(run('ffprobe', ['-v', 'error', '-count_frames', '-show_streams',
    '-show_format', '-of', 'json', native(file)]));
}

async function overlays(browser, edit, folder) {
  const context = await browser.newContext({viewport: {width: 1920, height: 1080}, offline: true});
  const page = await context.newPage();
  try {
    for (const [index, shot] of edit.shots.entries()) {
      await page.setContent(`<html><style>*{box-sizing:border-box;letter-spacing:0}
        body{margin:0;color:#172d38;font-family:'Segoe UI',sans-serif;background:transparent}
        header{position:absolute;left:240px;right:240px;top:25px;display:flex;
          justify-content:space-between;align-items:center;font-size:22px}
        h1{font-size:30px;margin:0;font-weight:650} footer{position:absolute;left:240px;
          right:240px;top:1023px;display:flex;justify-content:space-between;font-size:19px}
        #caption{max-width:1100px} #tag{color:#537078;font-size:17px}
        #bar{position:absolute;left:240px;top:92px;width:${180 * (index + 1)}px;
          height:3px;background:#217565}</style><header><h1></h1><span></span></header>
        <div id="bar"></div><footer><div id="caption"></div><div id="tag">REVIEW DRAFT</div></footer>
        </html>`);
      await page.locator('h1').evaluate((el, text) => {el.textContent = text;},
        `DemoForge / ${shot.title}`);
      await page.locator('header span').evaluate((el, text) => {el.textContent = text;},
        `${String(index + 1).padStart(2, '0')} / 08`);
      await page.locator('#caption').evaluate((el, text) => {el.textContent = text;}, shot.caption);
      await page.screenshot({path: path.join(folder, `${shot.id}-overlay.png`), omitBackground: true});
    }
  } finally { await context.close(); }
}

async function render(browser, edit, folder) {
  validateEdit(edit);
  await overlays(browser, edit, folder);
  for (const shot of edit.shots) {
    const source = path.join(folder, shot.source);
    assert.equal(sha256(source), shot.source_sha256, 'Raw recording changed');
    const ramp = `max(0,min(1,min((on-20)/40,(${shot.frames}-21-on)/40)))`;
    const zoom = `1+0.35*(${ramp})*(${ramp})*(3-2*(${ramp}))`;
    const filters = `fps=30,tpad=stop_mode=clone:stop_duration=0.1,zoompan=z='${zoom}':`
      + `x='max(0,min(iw-iw/zoom,${shot.focus.x}-iw/zoom/2))':`
      + `y='max(0,min(ih-ih/zoom,${shot.focus.y}-ih/zoom/2))':`
      + 'd=1:s=1440x900:fps=30,pad=1920:1080:240:105:color=0xe8eef0[base];'
      + '[base][1:v]overlay=0:0:shortest=1,format=yuv420p[out]';
    run('ffmpeg', ['-v', 'error', '-ss', String(shot.source_in), '-i', native(source),
      '-loop', '1', '-i', native(path.join(folder, `${shot.id}-overlay.png`)),
      '-filter_complex_threads', '1', '-filter_complex', filters, '-map', '[out]',
      '-frames:v', String(shot.frames), '-an', '-c:v', 'libx264', '-threads', '2',
      '-preset', 'fast', '-crf', '18', '-map_metadata', '-1',
      native(path.join(folder, `${shot.id}-edit.mp4`))]);
    console.log(`Edited ${shot.id}`);
  }
  writeFileSync(path.join(folder, 'concat.txt'), edit.shots.map(shot =>
    `file '${shot.id}-edit.mp4'`).join('\n'));
  const target = path.join(folder, 'walkthrough-review.mp4');
  run('ffmpeg', ['-v', 'error', '-f', 'concat', '-safe', '1', '-i',
    native(path.join(folder, 'concat.txt')), '-c', 'copy', '-movflags', '+faststart', native(target)]);
  const info = probe(target);
  const video = info.streams.find(stream => stream.codec_type === 'video');
  assert.equal(Number(video.nb_read_frames), 1800);
  assert.equal(video.width, 1920);
  assert.equal(video.height, 1080);
  assert.equal(video.avg_frame_rate, '30/1');
  assert.equal(Number(info.format.duration), 60);
  assert.ok(!info.streams.some(stream => stream.codec_type === 'audio'));
  const decode = run('ffmpeg', ['-v', 'error', '-xerror', '-i', native(target), '-f', 'null', '-']);
  assert.equal(decode.trim(), '');
  const md5 = run('ffmpeg', ['-v', 'error', '-i', native(target), '-vf',
    "select='eq(mod(n,225),20)+eq(mod(n,225),90)'", '-fps_mode', 'passthrough',
    '-f', 'framemd5', '-']);
  const samples = md5.split('\n').filter(line => line && !line.startsWith('#'));
  assert.equal(samples.length, 16);
  for (let index = 0; index < samples.length; index += 2) {
    assert.notEqual(samples[index].split(',').at(-1), samples[index + 1].split(',').at(-1));
  }
  writeFileSync(path.join(folder, 'motion-framemd5.txt'), md5);
  const measurements = {frame_count: 1800, duration_seconds: 60, width: 1920, height: 1080,
    fps: 30, has_audio: false, full_decode: 'passed', motion_pairs: 'passed',
    human_review: 'pending', sha256: sha256(target), edit_sha256: sha256(path.join(folder, 'edit.json')),
    source_commit: edit.source_commit, shots: edit.shots};
  writeFileSync(path.join(folder, 'measurements.json'), JSON.stringify(measurements, null, 2));
  run('ffmpeg', ['-v', 'error', '-i', native(target), '-vf',
    'fps=1/7.5,scale=640:-1,tile=2x4', '-frames:v', '1', native(path.join(folder, 'contact.jpg'))]);
  writeFileSync(path.join(folder, 'review.html'), `<!doctype html><html lang="en"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src 'self'; style-src 'unsafe-inline'">
    <title>DemoForge recorded walkthrough / Review draft</title><style>
    body{margin:24px;background:#edf2f3;color:#172d38;font:16px 'Segoe UI',sans-serif}
    main{max-width:1200px;margin:auto}video{width:100%;aspect-ratio:16/9;background:#172d38}
    h1{font-size:24px}p{line-height:1.5}code{overflow-wrap:anywhere}</style><main>
    <h1>DemoForge / Recorded UI walkthrough</h1><p>Review draft. Real local app interactions with
    built-in demo data. Edited timing, added cursor and bounded zoom. Silent. The source-teaser run
    list was hidden for privacy; no run was submitted. Local approvals and export were not performed.</p>
    <video controls preload="metadata" src="walkthrough-review.mp4"></video>
    <p>60 seconds / 1920 x 1080 / 30 fps / 1800 frames. Full human review is pending.</p>
    <p>Video SHA-256: <code>${measurements.sha256}</code></p>
    <p>The adjacent edit.json stores the shot order, raw clips, trims, camera targets and evidence IDs.
    This test harness is not a general app recorder or a connected editing feature.</p></main></html>`);
  console.log(JSON.stringify(measurements, null, 2));
}

async function main() {
  assert.equal(process.argv[2], '--capture');
  const folder = path.resolve(process.argv[3]);
  assert.ok(!folder.toLowerCase().includes('onedrive'), 'Output must be outside OneDrive');
  assert.ok(!existsSync(folder), 'Output folder must be new');
  const rig = process.env.DEMOFORGE_RIG || path.join(process.env.LOCALAPPDATA, 'Temp/demoforge-rig');
  const require = createRequire(path.join(rig, 'package.json'));
  assert.equal(require('playwright/package.json').version, '1.63.0');
  const {chromium} = require('playwright');
  const edit = makeEdit();
  edit.source_commit = run('git', ['-C', ROOT, 'rev-parse', 'HEAD']).trim();
  edit.authorization = 'User requested recording this owned local app in this conversation.';
  edit.disclosures = ['Built-in demo data', 'Local draft edits only',
    'Source teaser run list suppressed for privacy', 'No production approvals',
    'Review draft, not final export', '1280x800 capture for full editor controls',
    'Up to 0.1 seconds of final-frame padding for 25-to-30 fps rounding'];
  mkdirSync(folder, {recursive: true});
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  try {
    for (const phase of ['discover', 'rehearse', 'record']) {
      console.log(`PHASE ${phase}`);
      const fields = [];
      for (const shot of edit.shots) {
        const record = phase === 'record';
        const context = await contextFor(browser, record ? path.join(folder, 'raw') : null);
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          await setup(page, shot);
          if (phase === 'discover') {
            fields.push({id: shot.id, fields: await fieldMap(page)});
            await act(page, shot, false);
            fields.push({id: `${shot.id}-after`, fields: await fieldMap(page)});
          } else {
            if (record) await cursor(page);
            const started = Date.now();
            if (record) await page.waitForTimeout(1000);
            const focus = await act(page, shot, record);
            if (record) {
              const elapsed = Date.now() - started;
              assert.ok(elapsed < 6500, `Action too slow for ${shot.id}: ${elapsed}ms`);
              await page.waitForTimeout(7500 - elapsed);
              shot.recorded_seconds = (Date.now() - started) / 1000;
              shot.focus = focus;
              shot.observed = true;
              await page.screenshot({path: path.join(folder, `${shot.id}-observed.png`)});
            }
            assert.deepEqual(errors, []);
          }
        } finally { await context.close(); }
        if (record) {
          await page.video().saveAs(path.join(folder, shot.source));
          const info = probe(path.join(folder, shot.source));
          shot.source_in = Math.max(0, Number(info.format.duration) - shot.recorded_seconds);
          shot.source_sha256 = sha256(path.join(folder, shot.source));
          shot.source_url = URL;
          assert.ok(Number(info.format.duration) >= 7.5);
        }
      }
      if (phase === 'discover') writeFileSync(path.join(folder, 'discovery.json'), JSON.stringify(fields, null, 2));
      if (phase === 'rehearse') writeFileSync(path.join(folder, 'rehearsal.json'), JSON.stringify({passed: true, shots: edit.shots.map(shot => shot.id)}));
    }
    validateEdit(edit);
    writeFileSync(path.join(folder, 'edit.json'), JSON.stringify(edit, null, 2));
    await render(browser, edit, folder);
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}