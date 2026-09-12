# Skill: video-as-code

Use when generating the motion teaser. The video is code: one `edit.json` describes every cut, zoom, mask and caption in frames; scripts render it deterministically; tests and measurements replace "watching it".

## Toolchain
ffmpeg/ffprobe, Python (Pillow, numpy), Node + Playwright + Chromium (rig in `$LOCALAPPDATA/Temp/demoforge-rig`).

## Layout
```
outputs/video/edit.json           EDL, the only project file
outputs/video/visual-events.json  sound cues
demoforge/video/overlay/overlay.html + render_overlay.mjs
demoforge/video/{edl,storyboard,assemble,mix,verify}.py
demoforge/video/capture/record_site.mjs
```

## Steps
1. **Style spec** comes from `motion_style.json` + `brand_kit`: canvas colour, window rect/radius/shadow, max zoom 1.5x, caption font/size/position, cut rhythm 2 to 3 s, SFX sparse, no music.
2. **Truthful footage.** Screenshots from `visual_assets` (stills animated by zoom keyframes) or a Playwright `recordVideo` of the live site (`newContext({recordVideo:{dir,size}, viewport})`, `waitForTimeout(1500-2500)` per screen, log `Date.now()-t0` events). Mockups are forbidden. Seeded data gets a "Demo data" pill.
3. **EDL** (`edit.json`): `fps, width, height, canvas_color, frames{layout: rect}, total_frames, scenes[]`. Scene: `id, layout (graphic|desktop|phone|passthrough), source, source_in_seconds, duration_frames, chapter, caption, zoom[{frame,scale,cx,cy}], spotlight{frame,hold,x,y}, masks[{id,kind:blur|box,rect}]`. Tests: contiguous, sum == total, spotlight inside scene, sources exist, zoom <= max.
4. **Base picture** (`assemble.py`), per scene: `trim,setpts=PTS-STARTPTS,fps=30` -> masks in source pixels (`split;crop;boxblur=r:3;overlay`, `r <= min(24, h//6, w//6)` or 4:2:0 chroma breaks) -> zoom: ease-out interpolated keyframes into per-frame `crop=W/z:H/z:cx-W/(2z):cy-H/(2z)` using `n`, then `scale` -> window: `format=rgba`, rounded alpha via `geq`, shadow, `overlay` on `color=c=canvas:s=1920x1080` -> `libx264 -crf 16`; concat demuxer -> `base.mp4`. Check `ffprobe -count_frames` == total.
5. **Overlay** (`overlay.html`): `configureTimeline(edit)` builds one `<section>` per scene; `renderFrame(n)` sets opacity/transform from the local frame (14-frame fade-in, 8-frame fade-out before the cut, ring only during `[frame, frame+hold)`). Same `n`, same pixels. `render_overlay.mjs` loops frames, `page.screenshot({omitBackground:true})`, pipes into `ffmpeg -f image2pipe -c:v qtrle -pix_fmt argb overlay.mov`. node:test: timeline valid, no overlay pixels inside the window rect, ring present exactly during hold, fonts/logo load.
6. **Composite**: `ffmpeg -i base.mp4 -i overlay.mov -filter_complex overlay -c:v libx264 -crf 16 picture-lock.mp4`.
7. **Sound** (`mix.py`): `visual-events.json` `[{scene, local_frame, kind: tick|swish|brand}]`, synthesised 48 kHz bursts with envelopes, <= 14 cues/min, `mix.wav`; mux `-c:v copy -c:a aac -b:a 192k`; true peak <= -1 dBTP via `ffmpeg -af ebur128=peak=true -f null -` on the FINAL decoded file.
8. **Gates** (`verify.py`, never skipped): full decode `ffmpeg -v error -i final.mp4 -f null -` prints nothing; frame count == total and duration == total/fps; loudness/peak; contact sheet of the final read with vision (blank frames, clipped window, style consistency); privacy list masked. Fix by editing `edit.json` and rerunning from step 4. Never patch a video by hand.
9. **Deliverables**: `final.mp4`, `README.md` (sources, scene table with timecodes, gate numbers, reproduce commands), variants 9:16 and 1:1 from `frames` presets.

## Pitfalls (already paid for)
- Background node on git-bash dies ("no job control"); render in the foreground.
- Zoom centres must be measured on an extracted frame; 60 px off is visible.
- Blank frames come from `source_in` landing on a page load; move it, do not stretch.
- Solid black masks look like censorship; use blur or a surface-coloured box.
- Keep every duration in frames to avoid concat drift.
- ffmpeg `drawtext` crashes (Fontconfig) on this Windows build: all text via the HTML overlay.

## Reference implementation to port
`C:\Users\hp\smart-network-assistant\scripts\assemble-anim-v9.py`, `render-anim-v9.mjs`, `mix-anim-v9-merge.py`, `video_v8\tests\animation.spec.mjs`; Hermes skill `demo-video-production` and its references.
