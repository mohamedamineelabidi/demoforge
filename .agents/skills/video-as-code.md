# Skill: video-as-code

Initial implemented slice (2026-09-12): video/import_media.py, storyboard.py, assemble.py and review.py,
with workflow/pipeline.py adapters. docs/LOCAL_PIPELINE.md is the executable command guide. The detailed
motion procedure below remains a target, not a claim that masks/typewriter/audio parity are implemented.
Real tests need FFmpeg/ffprobe and installed Chrome plus Playwright 1.63.0 in the external rig:
`npm install --prefix "$LOCALAPPDATA/Temp/demoforge-rig" --save-exact playwright@1.63.0`.
Use the PowerShell `$env:LOCALAPPDATA` spelling on this host. Synthetic decisions in tests are not
human approvals. Tests/video and tests/workflow/test_pipeline.py run media tools in the foreground.

Use for TASK-073/075..081 video implementation. Approved StoryboardRevision is the source of truth;
edit.json is a derived render input, never an independent editable authority. Tests and measurements
complement full human viewing; they cannot replace privacy, truthfulness or motion review.

Before storyboarding or implementing motion, read [MOTION_PRODUCTION.md](../../docs/MOTION_PRODUCTION.md).
It contains user-supplied reference links, adapted archetypes, deterministic motion rules and the first
fixture-video test. Reference films remain unreviewed until actually inspected; no exact technique or
timing attribution is verified by the supplied analysis. Preserve 30 fps pilot scope and TASK-082 gating.

## Toolchain
### Owned-app walkthrough proof (ui-demo)

The user-requested [ui-demo](ui-demo/SKILL.md) skill is installed from affaan-m/ecc;
skills-lock.json records its source. Follow Discover -> Rehearse -> Record, with visible cursor,
measured control positions, deliberate reading holds and no silently skipped selectors.

`tests/video/walkthrough.mjs` is a reviewed test harness for the explicitly authorized
`http://127.0.0.1:8001/` DemoForge instance only. It is not an arbitrary-URL recorder and does not
change the production controller or its approval gates. It uses fresh contexts and built-in demo data,
blocks non-GET/external requests, and substitutes an empty run list to avoid recording user run data.
No approvals or server mutations are performed. The raw footage and review page disclose this scope.

Run the app, then run this foreground gate with a NEW directory outside OneDrive:

```powershell
$env:DEMOFORGE_WALKTHROUGH = '1'
$env:DEMOFORGE_WALKTHROUGH_OUTPUT = "$env:LOCALAPPDATA/demoforge/reviews/owned-ui-demo-NEW"
uv run pytest tests/video/test_walkthrough.py -q
Remove-Item Env:DEMOFORGE_WALKTHROUGH
Remove-Item Env:DEMOFORGE_WALKTHROUGH_OUTPUT
```

The harness first discovers fields, then rehearses every action, then records eight clips.
1280x800 capture intentionally differs from the skill's 1280x720 default to retain editor controls.
Subtitles are added after capture in a separate footer so zoom cannot enlarge/crop them over app UI.
The 60-second, 1920x1080 silent review draft has eight 225-frame shots, cuts, bounded 1.35x smoothstep
zoom-in/out and a visible arrow tied to actual mouse events. Raw clips, editable shot metadata,
source hashes, discovery/rehearsal records, measurements and offline review HTML remain local.
This is a fixture proof, not Tella/FocuSee parity, a public export, or a general capture/editor feature.
Human motion/privacy/creative review remains pending until the user watches the complete draft.

Camera geometry is checked in the default unit gate. The opt-in media gate requires exactly
1800 frames, 60 seconds, full decode, unchanged raw hashes and distinct intended motion samples.
Use `-fps_mode passthrough` for sampled MD5 on this FFmpeg build; `-vsync` is unavailable.
Playwright WebM rounding can lose the last 30 fps frame; at most 0.1 seconds of disclosed final-frame
padding is applied before the exact 225-frame shot cap. Never conceal a failed action with padding.

FFmpeg/ffprobe, Python/Pillow, pinned Node LTS + Playwright/Chromium (rig in
`$LOCALAPPDATA/Temp/demoforge-rig`). Add NumPy only if the audio task needs it. No Remotion until
TASK-082 benchmark/license selection. No media runtime is claimed installed by this recipe.

## Layout
```
curated/<revision>/storyboard.json     approved immutable specification
outputs/<revision>/video/edit.json    derived EDL with manifest linkage
outputs/<revision>/video/visual-events.json  derived sound cues
demoforge/video/overlay/overlay.html + render_overlay.mjs
demoforge/video/{edl,storyboard,assemble,mix,verify}.py
demoforge/video/capture/record_site.mjs
```

## Steps
1. **Style** comes from approved BrandTokens: reused assets or neutral fallback, max zoom 1.5x,
	readable captions and event-driven timing. No generated logo or fixed 2-3 second cut requirement.
2. **Footage.** Pilot imports authorized recordings with provenance, permission, integrity and privacy
	checks. Screenshots may supplement but cannot prove a runtime action. Later capture uses approved
	DemoScenario on trusted demos with reset/preconditions, locator readiness and result assertions.
	Set viewport/recordVideo size explicitly, log observations and await context.close() to finalize video.
	Viewing holds are deliberate, not readiness waits. Label seeded data. Never run submitted repositories.
3. **Storyboard/EDL.** Use docs/DATA_CONTRACTS.md section 9: frame-based trims, exact source bounds,
	contiguous scenes, total 900 frames, zoom <= 1.5, valid masks and approved claim/asset references.
	Normalize source frame rate before deriving FFmpeg trim seconds. Derived EDL may add renderer-specific
	geometry, never alter the approved captions/claims. Reject stale approvals before rendering.
4. **Base picture** (`assemble.py`), per scene: `trim,setpts=PTS-STARTPTS,fps=30` -> masks in source pixels (`split;crop;boxblur=r:3;overlay`, `r <= min(24, h//6, w//6)` or 4:2:0 chroma breaks) -> zoom: ease-out interpolated keyframes into per-frame `crop=W/z:H/z:cx-W/(2z):cy-H/(2z)` using `n`, then `scale` -> window: `format=rgba`, rounded alpha via `geq`, shadow, `overlay` on `color=c=canvas:s=1920x1080` -> `libx264 -crf 16`; concat demuxer -> `base.mp4`. Check `ffprobe -count_frames` == total.
5. **Overlay** (`overlay.html`): `configureTimeline(edit)` builds one `<section>` per scene; `renderFrame(n)` sets opacity/transform from the local frame (14-frame fade-in, 8-frame fade-out before the cut, ring only during `[frame, frame+hold)`). Same `n`, same pixels. `render_overlay.mjs` loops frames, `page.screenshot({omitBackground:true})`, pipes into `ffmpeg -f image2pipe -c:v qtrle -pix_fmt argb overlay.mov`. node:test: timeline valid, no overlay pixels inside the window rect, ring present exactly during hold, fonts/logo load.
6. **Composite**: `ffmpeg -i base.mp4 -i overlay.mov -filter_complex overlay -c:v libx264 -crf 16 picture-lock.mp4`.
7. **Sound** (`mix.py`): `visual-events.json` `[{scene, local_frame, kind: tick|swish|brand}]`, synthesised 48 kHz bursts with envelopes, <= 14 cues/min, `mix.wav`; mux `-c:v copy -c:a aac -b:a 192k`; true peak <= -1 dBTP via `ffmpeg -af ebur128=peak=true -f null -` on the FINAL decoded file.
8. **Gates**: full decode `ffmpeg -v error -i final.mp4 -f null -` exits 0 with no decode errors;
	exact frames/duration, asset/text integrity, audio peak when present. Inspect contact sheets AND the
	full video for motion/privacy. Record required not_run checks as blocking, never passed. Fix through
	a new storyboard revision and approval, then rerun affected stages; no manual final-video patches.
9. **Deliverables**: MP4, source-linked evidence report, offline review page, versioned scene specification,
	manifest and printed gate numbers. Final human approval binds artifact hash. 9:16/1:1 are TASK-088,
	not pilot requirements. Silent output is valid; synthesized audio is optional.

## Pitfalls (already paid for)
- For reference-directed edits, inspect the exact public media, not just post text or inherited notes.
	Record sampled intervals, dimensions and uncertainty. A contact sheet does not establish audio timing
	or full motion quality. Keep temporary reference media outside Git and never reuse copyrighted assets.
- Teaser template v3 uses sans-serif fields and feature-only linear trails. Background animation must
	not leak into title/end holds or invalidate capture keys. Run the browser test's nonsequential seeks,
	reduced-motion checks and mobile bounds before the full foreground media gate.
- Background node on git-bash dies ("no job control"); render in the foreground.
- Zoom centres must be measured on an extracted frame; 60 px off is visible.
- Blank frames come from `source_in` landing on a page load; move it, do not stretch.
- Prefer removing sensitive content from the demo dataset; otherwise opaque redaction is safer than
	weak blur. Validate masks throughout their entire time range before any sharable derivative.
- Rendering is network-disabled over sanitized local assets/templates. Raw uploads and browser jobs
	never receive production credentials. Pin tools/fonts; do not promise determinism for live capture.
- Keep every duration in frames to avoid concat drift.
- ffmpeg `drawtext` crashes (Fontconfig) on this Windows build: all text via the HTML overlay.

## Reference implementation to port
`C:\Users\hp\smart-network-assistant\scripts\assemble-anim-v9.py`, `render-anim-v9.mjs`, `mix-anim-v9-merge.py`, `video_v8\tests\animation.spec.mjs`; Hermes skill `demo-video-production` and its references.
