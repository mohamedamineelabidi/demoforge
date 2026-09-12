# Motion Production Knowledge Base

Status: user-supplied inspiration adapted into planned production guidance, 2026-09-12.
This is not a frame-by-frame analysis verified by DemoForge. The linked videos have not been watched,
downloaded or measured in this task. Titles, creators and classifications below are supplied by the user.
Do not attribute exact timings, camera settings or implementation techniques to a film without inspecting it.
References convey direction, not permission to copy footage, sound, typography, logos or compositions.

Read with [PRD](../PRD.md), [data contracts](DATA_CONTRACTS.md), [quality bar](QUALITY_BAR.md),
[video recipe](../.agents/skills/video-as-code.md) and [task order](../TASKS.md).
This knowledge does not override evidence, approvals, licensing, security or the renderer-selection ADR.

## 1. What we are building

DemoForge creates source-linked, editable release-demo videos for real developer tools and web apps.
Input: public repository revision, audience/feature brief, authorized footage or demo, and optional
existing brand assets. Output: a 30-second 16:9 video first, versioned scenes, evidence report and review.
Flow: sanitized evidence -> approved claims/scenario -> verified footage -> approved storyboard ->
render -> technical gates -> full human review -> approved export. No autonomous production swarm.

The differentiating quality goal is a clear, truthful starting state -> action -> observable result,
presented with deliberate motion and readable product detail. A technically valid export is not proof
of professional motion quality; repeated tests and human review are required. No promise of perfection.
DemoForge's own frontend is a separate application theme: see [frontend design](FRONTEND_DESIGN.md).
Never stamp its indigo palette, fonts or status badges onto a customer's video by default.

## 2. Reference archive

All rows have review status `user_supplied_unreviewed`. Record measured observations later in an
evaluation report with URL, reviewed interval, date, reviewer and a description of the technique.

| Reference title | Creator attribution supplied by user | URL |
|---|---|---|
| ChatGPT SaaS Product Demo Ad | Motion Swell | https://www.youtube.com/watch?v=ylEyGoNF3VU |
| Infinity SaaS Explainer Video | What a Story | https://www.youtube.com/watch?v=ZK-rNEhJIDs |
| LangEase SaaS Product Launch Ad Video | Zelios | https://www.youtube.com/watch?v=SgmuplXU2iY |
| Vaylens Brand Launch | Buff Motion | https://www.youtube.com/watch?v=Hbj6WMhVByQ |
| LangEase B2B Corporate Video Ad | Zelios | https://www.youtube.com/watch?v=-uHLJY66PDM |
| Lovio AI SaaS Product Launch Video Ad | Zelios | https://www.youtube.com/watch?v=z9Zt8-PdZ4g |
| Heygrow 2D and 3D SaaS Launch Animation | Juan Blanco | https://www.youtube.com/watch?v=AxX0BHrEFJw |
| ConverseBank Banking App Launch Video | Burnwe | https://www.youtube.com/watch?v=VwxpmC4zhqo |
| Google Vids Product Launch | Google Workspace | https://www.youtube.com/watch?v=4SCjXcBeW1E |
| Numtera AI Support OS Launch Video | ObiN Studio | https://www.youtube.com/watch?v=awUYikrGsKk |
| Backboard.io AI Memory Platform Launch | Beliv8 Motion | https://www.youtube.com/watch?v=3Kcihys0gUY |
| OpenAI Refreshed Brand Identity | OpenAI | https://www.youtube.com/watch?v=k3d_xeVxEOE |
| Every Product Carbon Neutral by 2030 | Apple | https://www.youtube.com/watch?v=66XwG1CLHuU |

## 3. Archetypes and adoption

These are creative categories from the supplied analysis, not measured labels for the films above.

| Archetype | Useful techniques | DemoForge boundary |
|---|---|---|
| Spatial UI | Controlled push-in, hierarchy, layer separation, restrained surface depth | Keep actual UI pixels legible; do not redraw a product into a fictitious glass dashboard |
| Editorial typography | Masked headline reveals, clear grid, deliberate cuts tied to emphasis | Only approved factual copy; zero tracking, adequate reading time, no clipping or rapid flashing |
| State and workflow | Observed cursor events, connectors, input/action/result progression | Actual recorded events only; no fake token streams, latency counters, generated data or completion percentages |
| 2.5D/3D product | Perspective and depth for approved assets, carefully composed camera moves | Deferred experiment; not a pilot dependency or evidence of runtime behavior; avoid unreadable oblique UI |

Pilot uses restrained spatial framing plus editorial captions over authorized real footage. No
decorative aura orbs, particles, forced glassmorphism, deep blur over evidence, nested card layouts or
copied branded scenes. Preserve existing product geometry inside footage; supporting overlays use
compact radii and stable dimensions. Match customer BrandTokens, not a hard-coded blue/purple theme.
Material depth and hardware staging are optional creative experiments after the basic demo is useful.

## 4. Frame-based motion rules

| Property | Pilot rule | Reason/check |
|---|---|---|
| Timebase | 30 fps, 1920x1080, 900 frames | Current agreed 30-second milestone; frame ranges are half-open |
| Zoom | 1.0 to at most 1.5 | Preserve source resolution, text legibility and approved safe areas |
| Entrance | Candidate cubic-bezier(0.16, 1, 0.3, 1) | Fast start and deceleration; this curve is not an overshoot curve |
| Camera | Candidate cubic-bezier(0.65, 0, 0.35, 1) | Measured endpoints, no arbitrary drifting while reading |
| UI feedback | Candidate cubic-bezier(0.2, 0, 0, 1) | Use only for recorded/approved action emphasis |
| Captions | Short source-linked prose, fixed readable size, zero tracking | No viewport-scaled type, unsupported value props or clipped words |
| Sound | Optional, event-linked, <=14 cues/minute | Silent output is valid; final encoded audio peak <=-1 dBTP |

60 fps is not mandatory and does not restore missing source motion. A later 60 fps benchmark must use
suitable source footage, 1800 frames for 30 seconds, measured resource cost and reviewed benefit.
Do not simply duplicate 30 fps footage and claim smoother capture. New frame rate is a spec revision.

All animation is a pure function of frame index, fps and approved data. CSS infinite animation classes,
wall-clock timers, Date.now(), Math.random(), live network reads and real-time Framer Motion playback
must not drive export. Evaluate cubic-bezier time correctly (solve x for time), not y at the same raw
parameter. Use tested interpolation from the chosen runtime rather than a new physics engine.
Clamp before/after animation intervals and test first/last/transition frames and nonsequential seeking.
Spring stiffness/damping/mass do not guarantee zero wobble; supplied parameter sets may overshoot.
If springs are evaluated later, bound the result, test settling and prohibit content scale/position drift.

Evidence-bearing screen content stays readable through focus moves. Apply privacy masks before
transforms and ensure their source-space coverage persists during zoom and transitions. Prefer
sanitized demo data/opaque redaction to weak blur. No depth-of-field effect obscures a claimed result.

## 5. Reusable production elements

These are roles for future components under video/, not new packages or implemented APIs.

- Camera transform: frame-sampled pan/zoom over real footage with bounds and safe-area validation.
- Caption reveal: approved text/Claim IDs, deterministic masks and sufficient reading holds.
- Cursor emphasis: recorded cursor/click events; no synthetic interaction presented as captured behavior.
- State callout: annotation bound to an observed frame/result, not a simulated live product widget.
- Terminal excerpt: literal permitted captured output; preserve source wording and redact sensitive values.
- Transition and sound cues: frame-indexed, sparse, validated against scene duration and actual events.

Do not paste the supplied React scene as a production template: its sample metrics and pipeline are
not product evidence, its animate-pulse timing is not frame-deterministic, and its supplied framework
configuration is not a dependency decision. Use actual product footage rather than rebuilding invented UI.
Local proof retains HTML/Playwright plus FFmpeg. TASK-082 compares Remotion using the same approved
spec, source media and reference frames; license review precedes adoption. Select one production renderer.
True 3D experiments use Three.js only in an explicitly approved later task with an ADR and measurable
benefit. Blender/After Effects/Cinema 4D are optional external artist workflows, not required services;
any supplied result still needs permission, provenance and QA. No new framework is installed by this guide.

## 6. First test: fixture before customer promises

There are two different first tests. **Next coding test is TASK-068:** typed Evidence/Claim/Approval/
Artifact/QualityReport round trips and rejection of invalid references/statuses. No renderer is needed.
**First visual test is TASK-071/073/075..078:** a real, locally controlled fixture app recorded by the
operator, then supplied to the production pipeline. The fixture is deliberately synthetic test data,
not a screenshot or claim about DemoForge's unbuilt editor or a customer product.

Proposed fixture: a small task list with a functioning "Completed" filter and deterministic seeded
items, visible "Demo data" label, no accounts, network dependencies, personal data or credentials.
This is a specification to implement in TASK-071, not an existing app. The fixture README/source
must substantiate its one claim: "Filter completed tasks." Record the real interaction without
executing an arbitrary submitted repository. Use a synthetic local catalog for the engineering test;
TASK-078 separately validates public-repository ingestion with an authorized real product.

| Scene | Output frame range | Content and motion | Required evidence |
|---|---|---|---|
| Starting state | [0, 180), 6 seconds | Real unfiltered fixture list; short caption reveal, stable view | Fixture source revision and permitted supplied footage |
| Action | [180, 660), 16 seconds | Real filter interaction; measured push-in <=1.5 and readable hold | Recorded input event and scenario action; no fabricated progress state |
| Result | [660, 900), 8 seconds | Completed items visible; hold on result and one supported caption | Assertion of expected visible items, associated frames and claim references |

These are output pacing targets, not claims about the duration of any reference video or app operation.
Keep input/action/result chronology intact. Disclose edited timing and never derive latency claims from it.
Capture enough usable source footage for every trim; do not invent additional motion or completion events.
Product footage may initially be user-attested; it becomes runtime_observed only with explicit passing
observation evidence. A supplied recording alone does not automatically upgrade claim status.

### Acceptance matrix

| Test | Expected outcome |
|---|---|
| Supported claim vs fabricated latency/progress | Supported claim survives with evidence; fabricated claims are rejected |
| Stale scenario/storyboard approval | Render/export blocked until the affected revision is approved |
| Timeline, trim bounds, missing asset | Exactly 900 contiguous frames; invalid sources/intervals fail before render |
| Frame-seek repeatability | Selected frames rendered in order and random order match within the pinned renderer |
| Full decode and ffprobe | Decode exits 0 with no errors; 1920x1080, 30 fps, 900 frames, 30 seconds |
| Motion and reading review | Starting state/action/result understandable; no clipped caption, blur-hidden result or unjustified camera motion |
| Masking across transforms | Sensitive fixture markers remain covered at all affected frames, including transitions |
| Sound when enabled | Cues align with events; peak measured on final encoded artifact <=-1 dBTP |
| Caption-only revision | Ingestion and footage artifacts reused; affected render/approval invalidated |
| Source/brand integrity | No reference-video assets copied; exported palette comes from approved fixture/customer brand |

Use exact hashes only for pixel outputs under the same pinned environment. Do not require byte-identical
MP4s across encoders/platforms. Repeated intended static frames are valid. Measure visual comparisons
on decoded frames and explicitly chosen tolerances if rendering environments differ.

Produce final video, scene specification, source/evidence report, contact sheet, full-review notes,
render timing/peak memory/cost measurements and artifact hashes. Store media under gitignored workspace,
not in Git. No test completion, visual similarity score or successful render is claimed by this document.

## 7. Agent operating checklist

1. Read the active task, customer brief, approved source catalog and BrandTokens; resolve missing permissions.
2. Select one restrained archetype appropriate to the real product, not a mixture of every reference.
3. Map each scene to a claim, permitted footage and a concrete observable result.
4. Specify frame ranges, crop/zoom, readable captions, masks and optional event-linked sound.
5. Validate and obtain exact-revision approvals; use the chosen deterministic renderer with bounded resources.
6. Run technical gates, inspect representative frames and watch the entire output. Record failures honestly.
7. Revise only affected stages, measure correction time and ask whether the intended user would publish it.
8. Update code/docs/tasks, pass repository checks, commit task-related source and push to GitHub.
   Never push captured media, secrets or customer raw data; the repository publication rule is not
   authorization to publish a customer's generated video.