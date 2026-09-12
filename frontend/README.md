# DemoForge frontend

Local React/TypeScript/Vite workspace. User-authorized parallel frontend workstream, separate from
Hermes's Python contracts/state work. See [ADR-0004](../docs/decisions/ADR-0004-parallel-local-frontend.md).

## Run

Validated with Node 24.11.1 and npm 11.6.2. Dependencies are pinned by package-lock.json.

```bash
npm --prefix frontend ci
npm --prefix frontend run dev -- --port 5174
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:browser
```

The dev server binds to loopback. Use its printed URL if the port is occupied. Browser tests expect
http://127.0.0.1:5174 by default; override FRONTEND_URL when needed. Tests use installed Chrome,
one foreground worker and isolated browser contexts. test-results/ contains screenshots and failure
traces and is ignored. The first browser test refreshes the permitted taskroom.png fixture screenshot.

## Implemented

- Visual project library: create, search, filter, open and delete local drafts.
- Three-scene storyboard with caption, duration, source-in, order and customer accent editing.
- Validated local storage, revision counters, bounded scene undo/redo, corrupt-storage warning and
  cross-tab conflict blocking. A local revision is not a backend artifact revision.
- Session-only video selection, local permission/privacy attestations, browser playback and scrubbing.
  Play is gated by decoder readiness. Raw media URLs and bytes never enter localStorage.
- Honest evidence/footage/review views, browser-only checks and JSON draft download.
- Session-only EvidenceCatalog and QualityReport JSON imports with strict version-1 validation,
  claim/source inspection, reported check status and exact catalog subject/revision comparison.
- Canvas and Frames editor modes: contiguous half-open frame ranges at 30 fps, a 900-frame target,
  shared entry-copy lint, highlight choices and explicit clip/claim references. References and highlight
  selections are draft metadata, not footage acquisition or implemented render effects.
- Ordered Claims, Storyboard and Final output local approval review with copyable hashes, explicit
  operator labels and mandatory rejection notes. Exact snapshot matches distinguish current/stale records.
- Read-only, explicitly mocked run-status rail with alternative terminal outcomes and bounded attempts.
- Demo data is explicitly labeled. The sample app really filters tasks; its still is not a recording
  or proof about customer software. Offline bundled fonts retain license notices under public/.

## Connected source teaser

The first-screen **Create source teaser** action and navigation entry open the connected local flow.
It is separate from browser drafts and does not import their local approvals. No footage or model
credentials are needed. A public GitHub URL is acquired through the bounded GitHubSource adapter,
pinned to a commit, sanitized, and prepared into three source-linked scenes. Review the quotations,
record **Combined source and storyboard approval**, then explicitly start rendering. Review the real
30-second video, record **Final output approval**, then export. These are two named checkpoints,
not the supplied-footage pipeline's four checkpoints. Approvals bind to exact artifact SHA-256 values.

The connected view shows Repository, Storyboard, Render and Review/download steps. Source quotations
and exact revision/hash details remain inspectable without filling the page. A delayed request has no
invented percentage. Retry after a terminal run creates a new request; uncertain network retries keep
the same key. Template v2 uses animated typography and a labelled document illustration, not product
screenshots. README selection prioritizes product purpose and features over sample document lists.

From the repository root:

```bash
npm --prefix frontend run build
uv run python -m demoforge serve --port 8000
```

Open http://127.0.0.1:8000. The server serves the built frontend and API on loopback only. For frontend
development, run `npm --prefix frontend run dev -- --port 5174`; Vite proxies `/api` to port 8000.
Only exact local origins on the API port and Vite ports 5173/5174 are accepted. There is no host
override, wildcard CORS, hosted authentication, queue, or remote render worker. Use one local server
and operator per workspace. State and hashed artifacts live outside OneDrive under the existing
workspace configuration; `DEMOFORGE_WORKSPACE` may select another non-synced local directory.

The API processes each request in the foreground. Rendering requires the pinned external Playwright
rig and FFmpeg. Cancel at a stage/approval boundary; an active render is not interrupted by the UI.
Reload restores the selected run from its URL and SQLite. After a process interruption, restarting
the server recovers interrupted teaser attempts; **Continue run** resumes them within controller
retry budgets. Downloads are manifest-declared and integrity checked, never arbitrary file paths.
The offline ZIP contains `video.mp4`, `evidence.json` and `review.html`; extract them together.
Individual review HTML expects the separately downloaded `video.mp4` beside it.

Endpoints:

- `GET /api/health`, `GET /api/runs`, `GET /api/runs/{run_id}`.
- `POST /api/runs`: `{repository_url, request_id}`; request ID is 32 lowercase hexadecimal digits.
- `POST /api/runs/{run_id}/advance` and `/cancel`: empty JSON object.
- `POST /api/runs/{run_id}/approve`: `{subject, actor, note, reviewed: true}`; subject is the exact
  returned checkpoint. Approval does not itself start rendering/export.
- `GET /api/runs/{run_id}/artifacts/preview`: verified MP4 preview with byte ranges.
- `GET /api/runs/{run_id}/artifacts/{video|evidence|review|bundle}`: final-approved downloads only.

POST requires JSON, a trusted Origin and Host, and at most 16 KiB. Source strings are rendered as
text, not HTML or executable links. Preparation errors can require two short, distinct product
excerpts in the README. Scene editing is not yet connected: cancel and create a new run after source
changes. Documentation quotations are not proof of runtime behavior or human approval.

GitHub acquisition is unauthenticated and shares the public API's 60-request hourly quota per IP.
Each run can use multiple requests. When the quota is exhausted, acquisition stops with a visible
failure; wait for the GitHub reset and create a new run. No token configuration is wired into this
local API yet. Do not repeatedly resubmit while the quota is empty.

Verification:

```bash
uv run python -m pytest tests/api tests/test_cli.py -q
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run test:teaser
```

The teaser browser suite starts a test-only loopback server on 8018, injecting a bounded README
snapshot into acquisition while using the real preparation, renderer, SQLite and artifact service.
It runs one foreground browser worker and renders actual media. Automated fixture decisions are not
human approvals. The ordinary `test:browser` suite keeps its existing running-Vite requirement.

## Browser draft boundary

The existing draft editor remains browser-only; its Export video action remains disabled. Do not
post its local DTOs directly to Python APIs. The connected teaser uses separate server subjects.
Unknown frame counts/hashes remain unknown. Browser media metadata is not an ffprobe/decode gate.
Saved drafts contain user text in localStorage; use trusted local data, not secrets. Closing/reloading
loses attached media, while draft text remains until the user deletes it. This is not hosted security.

## Local review workflow

Open a project, import a sanitized catalog in Evidence, then use Approvals to record local decisions.
The strict schema in src/approvals/schema.ts uses the requested claims/storyboard/output subset of the
backend contract; scenario approvals remain outside this UI. UTC timestamps, positive revisions,
lowercase SHA-256 and required nullable notes are validated. A rejection requires a nonblank note.
Never post these local subjects directly to the backend: local IDs and canonically serialized snapshot
hashes are not backend artifact IDs or file hashes. Final-output hashing uses the actual supplied bytes.

Up to 500 immutable approval drafts persist within the existing project storage and draft JSON export.
Recording a decision does not change its subject revision or scene edit history. A local storyboard
approval saves a scene/accent baseline; edits retain the prior decision and request re-approval. Undo
does not recreate a previously approved revision. Claims imports are still session-only and must be
reattached after reload before new decisions. Deleting a project removes its local review history.
Operator labels and review notes persist as user text; do not put secrets in them.

Final MP4 review accepts a nonempty local file up to 128 MiB, with authorization/privacy confirmation
before selection and full-review confirmation before a local decision. File bytes and blob URLs are
session-only; removal, view/project changes and unmount clear the output. Browser playback and operator
confirmation are not integrity or export gates. Export video remains disabled after all local decisions.

Frames mode derives starts from durations, shifts later scenes on an end-frame edit, warns when the
total differs from 900 and never silently stretches the sequence. Caption editing shares lintBrief
with onboarding. Changes compare against the saved local baseline, not an invented server approval.
The status panel reads src/mocks/run.ts, not a controller. Its created label is a local mock value;
backend pending must be mapped explicitly by a future adapter. Completed stages are explicit mock data,
not inferred from enum order. Transient attempts are 0..3 and repairs 0..1, both read-only.

Commit gates from frontend/: `npx tsc --noEmit`, `npx vitest run`, `npm run build`,
`npx playwright test`. Run terminal commands sequentially on this shared Windows shell. The integrated
review-flow.spec.ts exercises keyboard editing, rejection notes, clipboard hashes, stale decisions,
storage, mock status and actual MP4-byte hashing at desktop/mobile sizes. Sibling form keys must use
distinct prefixes even when their initial values are both empty strings.

## Evidence and quality imports

In Evidence or Review, confirm the file is sanitized before selecting a JSON artifact. Use serialized
`demoforge.schemas.claim.EvidenceCatalog` or `demoforge.schemas.quality.QualityReport` version 1, not a
context pack, manifest or local draft. Synthetic contract examples live in test-fixtures/ and are test
data only. The importer rejects unknown fields and missing required nullable fields; it applies the
backend defaults for optional arrays. Timestamps must be ISO strings with timezones, hashes lowercase,
and integers within JavaScript's safe range. Pydantic's coercion of input strings/numbers is not copied.

Browser safety limits are stricter than the backend schema: 2,000,000 UTF-8 bytes per file, at most
2,000 entries per ordinary array and 5,000 file records. Repository evidence must match the catalog
commit, repository metadata references must resolve, unscanned file records are rejected, and secret
measurement field names are rejected recursively. These are import policies, not changes to Python
contracts. Shape checks do not scan arbitrary prose for secrets or verify that a claimed scan occurred;
sanitization must happen before import. Raw repositories and unreviewed files are not supported.

Claims must resolve their evidence IDs; runtime and attested claims require the corresponding evidence
kind. Imported status is an assertion from the file, not verified truth. Sources/quotes render as text,
never as HTML or automatically fetched URLs. Quality gates reject inconsistent required checks and
empty ask_user reports. Measurements remain in memory but are not displayed. Matching catalog ID and
revision is only an association between imported files, not authenticated provenance, complete gate
coverage or approval of a local draft/rendered video. A report for another subject is unassociated;
a mismatched revision is stale. Even a passing imported report leaves Export video disabled.

Imports are isolated by project and held only in memory. They are absent from localStorage and draft
JSON downloads, survive view changes, and disappear on reload, removal or project deletion. Failed
replacements preserve the prior artifact; removal/view changes invalidate pending reads. Import does
not change draft revisions, attach claim IDs to scenes, or update repository references automatically.

## Visual reference and checks

### URL-first drafts and motion studies

Start from repository is available on the empty landing and populated project library. It accepts
a GitHub URL, optional brief and optional full SHA without requiring footage. This only creates a
local source draft: it does not fetch, ingest, execute or infer features from the repository. Existing
footage-first entry remains available. Motion mode offers a deterministic, frame-sampled study using
literal local labels, or authorized/privacy-reviewed local footage. The owned Taskroom image is labeled
as a demo still. No UI is redrawn and no remote assets are loaded. No LLM request or MP4 export is made.

The defaults follow references/style_analysis/style_profile.json at commit 48d334c: 30 fps, 900 frames,
beats [0,180), [180,660), [660,900), one character revealed per frame, 60-character caption edits,
hard cuts, push-in capped at 1.12, and cubic-bezier(0.22,1,0.36,1). Legacy 160-character captions remain
in storage; the study warns when its 60-character display cap is exceeded. Caret annotation is an
editable highlight choice only: placement and actual annotations await footage/control coordinates.
Existing box/spotlight choices are retained for compatibility, not rendered as dark masks. No automated
numeric claim verification is implemented. Linked evidence and human/backend review are still required.

Playback starts paused, supports restart/seek and reduced motion, and refuses unknown/out-of-range
footage bounds. Browser seeking waits for decoder readiness and is not a frame-accurate export gate.
Caption edits and source changes reset preview playback. These modules own no media URLs or persistence.
Valid browser duration/dimensions from Motion also update the matching authorized session clip in
Footage and Review, without resetting transport. Stale/replaced media callbacks are ignored. Metadata
stays out of draft storage and does not substitute for backend decode, privacy or frame-count gates.
The motion browser suite checks real decoded red/blue fixture pixels, random seeking, out-of-range
blocking, restart and privacy-consent revocation; the generated MP4 stays in ignored test-results/.

Focused checks: `npm --prefix frontend test -- src/motion src/source-entry src/model.test.ts` and
`npm --prefix frontend run test:browser -- motion.spec.ts`. Motion tests check random seeks, beat
boundaries, easing, scale/caption limits and media guards. Browser tests use the real public input URL
https://github.com/mohamedamineelabidi/realestate-rag pinned to
a9fa0fa285c0ecae0224ca15240ba95640f7d2a8; this verifies form/draft behavior, not repository ingestion.
Independent read-only inspection found its README links a Google Drive demo at
https://drive.google.com/file/d/15vbux_4qsIx73d2STNASoTCr5KoiHR3Q/view.
That recording has not been downloaded, authorized for reuse or privacy-reviewed in this frontend task.
TASK-072/073 remain Hermes's lane; LLM proposals, real rendering and the API adapter remain later gates.

2026-09-12 revision: the user's Magnific/SchoolAI screenshots inform the slim rail, visual library and
canvas-first editor. The finance reference informs restrained green accents, not its landing-page layout.
Mobbin's https://mobbin.com/browse/web/apps redirected to its public discovery page during inspection;
no authenticated screen library was scraped and no Mobbin assets are bundled.

Styles are layered: style.css supplies responsive structure, soft-spatial.css the earlier surface
refinement, and studio.css the current library/navigation/editor treatment. Customer preview colors
remain local to the scene. Geist is bundled, tracking remains zero and meaningful text uses accessible
contrasts. No copied marketing hero, device controls or invented metrics.

Tests cover draft validation, editing, undo/redo, browser persistence, conflicts, permission-gated
playback, JSON download, deletion, library filtering and artifact import contracts/lifecycle. Creation
is covered through the entry flow; editor tests seed validated local drafts. Playwright/axe checks Projects, Storyboard,
Evidence, Footage and Review at 1440x900, 1024x768, 390x844 and 320x568. The zoom check uses the
equivalent 640px layout viewport, not an assertion of OS/browser UI zoom automation. Real backend
states, end-to-end privacy and preview/export parity remain unverified until integration.
Imported content is also checked at 1440 and 320 px with axe, literal hostile-HTML rendering, stale
reports, invalid replacement, session/project isolation, delayed-read cancellation and blocked export.