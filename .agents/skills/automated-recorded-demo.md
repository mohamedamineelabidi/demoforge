# Skill: automated recorded demo pipeline & studio

Use this skill when developing, testing, or executing the automated recorded-demo workflow that transforms an application URL into an edited Google Workspace-style release demo video.

## Architecture & Workflow

The pipeline executes five connected stages coordinated by `demoforge/api/recorded_service.py`:

1. **Authorized Discovery (`demoforge/capture/discover.py`):**
   - Strictly validates target URLs against authorized loopback patterns (`127.0.0.1:*`, `localhost:*`) to prevent SSRF and egress violations.
   - Deterministically parses DOM landmarks, action targets (buttons, links, inputs, headings) without executing untrusted external scripts.

2. **Scenario & Camera Compilation (`demoforge/enrich/scenario_compiler.py`):**
   - Synthesizes discovered landmarks into sequential feature shots.
   - Automatically directs dynamic camera focus points `(focus_x, focus_y)` and bounded zoom scales (1.15x - 1.25x).
   - Generates spring-animated callout badges (`BadgeSpec`) highlighting key interactions.

3. **Feature Capture & Event Linkage:**
   - Event-linked screen capture with smooth pointer motion and pacing matching the motion production guide.

4. **Remotion Render & Integrity Gates (`demoforge/video/remotion_render.py`):**
   - Injects compiled scenario props into `HybridWalkthrough` composition.
   - Executes foreground rendering via Remotion CLI (`npx remotion render HybridWalkthrough ...`).
   - Hard verification gates:
     - `ffprobe` video stream metadata (resolution 1920x1080, framerate 30 fps, exact frame count).
     - `ffmpeg -v error -i <video> -f null -` full decode pass with zero errors.
     - SHA-256 content hashing for artifact integrity tracking.

5. **Recorded Demo Studio (`frontend/src/recorded/`):**
   - Clean interactive web UI allowing users to input an app URL, observe live progress across all 5 stages, inspect camera focus targets, preview the final 1080p MP4 directly in the browser, and download the artifact.

## Verification & Commands

```powershell
# Clean environment setup (Windows host)
$env:PYTHONPATH="."

# Hard backend gates
uv run pytest tests -q
uv run ruff check .

# Frontend build & typecheck
npm --prefix frontend run build

# Standalone Remotion render test
cd demo-video
npx remotion render HybridWalkthrough public/test-walkthrough.mp4
```

## Boundaries & Constraints

- Never execute arbitrary untrusted external URLs. Only authorized loopback or explicitly vetted origins are permitted.
- Background renders are forbidden on Windows git-bash hosts; render in the foreground with measured progress.
- Video binaries (`*.mp4`, `*.webm`) must never be committed to git repositories. Store in `%LOCALAPPDATA%/demoforge/reviews/` or `workspace/recorded_jobs/`.
