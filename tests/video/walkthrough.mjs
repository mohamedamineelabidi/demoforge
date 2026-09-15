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
const HEIGHT = 720;
const CAMERA = {lead: 6, ramp: 12, amount: .2};
const POINTER = {duration: 400, steps: 20};
const motionProfile = () => ({pointer_ms: POINTER.duration, zoom_frames: CAMERA.ramp,
  lead_frames: CAMERA.lead, maximum_zoom: 1 + CAMERA.amount});
const pointers = new WeakMap();
const movementLogs = new WeakMap();
const native = value => path.resolve(value).replaceAll('\\', '/');
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const run = (command, args) => execFileSync(command, args, {
  timeout: 240000, maxBuffer: 16 * 1024 * 1024, encoding: 'utf8', windowsHide: true
});

export function cameraAt(frame, frames, focus) {
  assert.ok(Number.isInteger(frame) && frame >= 0 && frame < frames);
  assert.ok(Number.isFinite(focus.x) && Number.isFinite(focus.y));
  const ramp = Math.max(0, Math.min(1, (frame - CAMERA.lead) / CAMERA.ramp,
    (frames - CAMERA.lead - 1 - frame) / CAMERA.ramp));
  const zoom = 1 + CAMERA.amount * ramp * ramp * (3 - 2 * ramp);
  return {zoom, x: Math.max(0, Math.min(WIDTH - WIDTH / zoom, focus.x - WIDTH / zoom / 2)),
    y: Math.max(0, Math.min(HEIGHT - HEIGHT / zoom, focus.y - HEIGHT / zoom / 2))};
}

export function pointerPath(start, end) {
  for (const point of [start, end]) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
  return Array.from({length: POINTER.steps + 1}, (_, index) => {
    const progress = index / POINTER.steps;
    const eased = progress * progress * (3 - 2 * progress);
    return {x: start.x + (end.x - start.x) * eased,
      y: start.y + (end.y - start.y) * eased, time: progress * POINTER.duration};
  });
}

async function movePointer(page, focus, paced) {
  const start = pointers.get(page) || {x: WIDTH / 2, y: HEIGHT / 2};
  if (paced) {
    const times = [];
    const started = performance.now();
    for (const point of pointerPath(start, focus)) {
      const remaining = point.time - (performance.now() - started);
      if (remaining > 0) await page.waitForTimeout(remaining);
      await page.mouse.move(point.x, point.y);
      times.push(performance.now() - started);
    }
    const logs = movementLogs.get(page) || [];
    logs.push({start, end: focus, event_count: times.length,
      duration_ms: times.at(-1), max_gap_ms: Math.max(...times.slice(1).map(
        (time, index) => time - times[index]))});
    movementLogs.set(page, logs);
  } else await page.mouse.move(focus.x, focus.y);
  pointers.set(page, focus);
}

export function videoFilter(shot) {
  const ramp = `max(0,min(1,min((on-${CAMERA.lead})/${CAMERA.ramp},`
    + `(${shot.frames}-${CAMERA.lead + 1}-on)/${CAMERA.ramp})))`;
  const zoom = `1+${CAMERA.amount}*(${ramp})*(${ramp})*(3-2*(${ramp}))`;
  return `fps=30,tpad=stop_mode=clone:stop_duration=0.1,format=yuv444p,`
    + `scale=3840:2160:flags=lanczos,zoompan=z='${zoom}':`
    + `x='max(0,min(iw-iw/zoom,${shot.focus.x / WIDTH}*iw-iw/zoom/2))':`
    + `y='max(0,min(ih-ih/zoom,${shot.focus.y / HEIGHT}*ih-ih/zoom/2))':`
    + 'd=1:s=1920x1080:fps=30,format=yuv420p';
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
  return {schema_version: 3, style: 'edge-to-edge', motion: motionProfile(),
    scope: 'owned-demoforge-fixture', url: URL,
    human_approved: false, fps: 30, width: 1920, height: 1080,
    shots: entries.map(([id, title, caption], index) => ({id, title, caption,
      evidence_id: `observed-${index + 1}`, source: `${id}.webm`, source_in: 0,
      frames: [180, 270, 330, 180, 180, 210, 210, 240][index],
      focus: {x: 760, y: 420}}))};
}

export function validateEdit(edit) {
  assert.equal(edit.schema_version, 3);
  assert.deepEqual(edit.motion, motionProfile());
  assert.equal(edit.style, 'edge-to-edge');
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
  pointers.set(page, {x: WIDTH / 2, y: HEIGHT / 2});
  await page.mouse.move(WIDTH / 2, HEIGHT / 2);
  await page.evaluate(() => {
    const element = document.createElement('div');
    element.id = 'demo-cursor';
    element.style.cssText = 'position:fixed;left:640px;top:360px;z-index:2147483647;'
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
  if (paced) {
    await locator.evaluate(element => element.scrollIntoView({behavior: 'smooth', block: 'nearest'}));
    await page.waitForTimeout(500);
  } else await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box, `${label} has no geometry`);
  const focus = {x: box.x + box.width / 2, y: box.y + box.height / 2};
  await movePointer(page, focus, paced);
  if (paced) await page.waitForTimeout(120);
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
  await movePointer(page, focus, paced);
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

async function render(edit, folder) {
  validateEdit(edit);
  for (const shot of edit.shots) {
    const source = path.join(folder, shot.source);
    assert.equal(sha256(source), shot.source_sha256, 'Raw recording changed');
    run('ffmpeg', ['-v', 'error', '-ss', String(shot.source_in), '-i', native(source),
      '-filter_threads', '1', '-vf', videoFilter(shot),
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
  let sampleOffset = 0;
  const sampleFrames = edit.shots.flatMap(shot => {
    const pair = [sampleOffset + CAMERA.lead, sampleOffset + CAMERA.lead + CAMERA.ramp];
    sampleOffset += shot.frames;
    return pair;
  });
  const md5 = run('ffmpeg', ['-v', 'error', '-i', native(target), '-vf',
    `select='${sampleFrames.map(frame => `eq(n,${frame})`).join('+')}'`, '-fps_mode', 'passthrough',
    '-f', 'framemd5', '-']);
  const samples = md5.split('\n').filter(line => line && !line.startsWith('#'));
  assert.equal(samples.length, 16);
  for (let index = 0; index < samples.length; index += 2) {
    assert.notEqual(samples[index].split(',').at(-1), samples[index + 1].split(',').at(-1));
  }
  writeFileSync(path.join(folder, 'motion-framemd5.txt'), md5);
  const measurements = {frame_count: 1800, duration_seconds: 60, width: 1920, height: 1080,
    style: edit.style, motion: edit.motion, pointer_timing: 'passed', working_resolution: '3840x2160',
    maximum_zoom: 1.2, capture_fps: edit.shots.map(shot => shot.capture_fps),
    fps: 30, has_audio: false, full_decode: 'passed', motion_pairs: 'passed',
    human_review: 'pending', sha256: sha256(target), edit_sha256: sha256(path.join(folder, 'edit.json')),
    source_commit: edit.source_commit, shots: edit.shots};
  writeFileSync(path.join(folder, 'measurements.json'), JSON.stringify(measurements, null, 2));
  const timestamp = frame => new Date(frame / 30 * 1000).toISOString().slice(11, 23);
  let offset = 0;
  const subtitles = edit.shots.map(shot => {
    const start = offset;
    offset += shot.frames;
    return `${timestamp(start)} --> ${timestamp(offset)}\n${shot.title}: ${shot.caption}\n`;
  });
  writeFileSync(path.join(folder, 'captions.vtt'), `WEBVTT\n\n${subtitles.join('\n')}`);
  run('ffmpeg', ['-v', 'error', '-i', native(target), '-vf',
    `select='${sampleFrames.filter((_, index) => index % 2 === 1).map(frame => `eq(n,${frame})`).join('+')}',`
      + 'scale=640:-1,tile=2x4', '-frames:v', '1', native(path.join(folder, 'contact.jpg'))]);
  writeFileSync(path.join(folder, 'review.html'), `<!doctype html><html lang="en"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; media-src 'self'; style-src 'unsafe-inline'">
    <title>DemoForge recorded walkthrough / Review draft</title><style>
    body{margin:24px;background:#edf2f3;color:#172d38;font:16px 'Segoe UI',sans-serif}
    main{max-width:1200px;margin:auto}video{width:100%;aspect-ratio:16/9;background:#172d38}
    h1{font-size:24px}p{line-height:1.5}code{overflow-wrap:anywhere}</style><main>
    <h1>DemoForge / Recorded UI walkthrough</h1><p>Review draft. Real local app interactions with
    built-in demo data. Full-screen footage, fast paced cursor and 0.4-second bounded 1.20x zoom
    transitions. Silent. The source-teaser run
    list was hidden for privacy; no run was submitted. Local approvals and export were not performed.</p>
    <video controls preload="metadata" src="walkthrough-review.mp4">
    <track kind="subtitles" src="captions.vtt" srclang="en" label="Section notes"></video>
    <p>60 seconds / 1920 x 1080 / 30 fps / 1800 frames. Full human review is pending.</p>
    <p>Video SHA-256: <code>${measurements.sha256}</code></p>
    <p>The adjacent edit.json stores the shot order, raw clips, trims, camera targets and evidence IDs.
    This test harness is not a general app recorder or a connected editing feature.</p>
    <ol>${edit.shots.map(shot => `<li>${shot.title}: ${shot.caption}</li>`).join('')}</ol></main></html>`);
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
    'Review draft, not final export', '1280x720 capture; edge-to-edge 16:9 edit',
    '400ms scheduled cursor; 12-frame zoom transitions; 4K working raster',
    'Optional subtitle track, no decorative frame; not a Remotion or cloud render',
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
              const durationMs = shot.frames / 30 * 1000;
              assert.ok(elapsed < durationMs - 500, `Action too slow for ${shot.id}: ${elapsed}ms`);
              await page.waitForTimeout(durationMs - elapsed);
              shot.recorded_seconds = (Date.now() - started) / 1000;
              shot.pointer_movements = movementLogs.get(page) || [];
              assert.ok(shot.pointer_movements.length > 0);
              for (const movement of shot.pointer_movements) {
                assert.equal(movement.event_count, POINTER.steps + 1);
                assert.ok(movement.duration_ms >= 350 && movement.duration_ms <= 800,
                  'Pointer movement missed fast timing budget');
                assert.ok(movement.max_gap_ms < 200, 'Capture host stalled during pointer movement');
              }
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
          shot.capture_fps = info.streams.find(stream => stream.codec_type === 'video').avg_frame_rate;
          shot.source_in = Math.max(0, Number(info.format.duration) - shot.recorded_seconds);
          shot.source_sha256 = sha256(path.join(folder, shot.source));
          shot.source_url = URL;
          assert.ok(Number(info.format.duration) >= shot.frames / 30);
        }
      }
      if (phase === 'discover') writeFileSync(path.join(folder, 'discovery.json'), JSON.stringify(fields, null, 2));
      if (phase === 'rehearse') writeFileSync(path.join(folder, 'rehearsal.json'), JSON.stringify({passed: true, shots: edit.shots.map(shot => shot.id)}));
    }
    validateEdit(edit);
    writeFileSync(path.join(folder, 'edit.json'), JSON.stringify(edit, null, 2));
    await render(edit, folder);
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}