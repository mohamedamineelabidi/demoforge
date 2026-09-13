# Project Task Tracker

Authoritative backlog as of 2026-09-12. Requirements: PRD.md. Boundaries: .agents/architecture.md.
Decision: docs/decisions/ADR-0003-video-first-explicit-workflow.md. The Hermes plan is historical only.
Tasks describe planned behavior, not implemented commands or modules. Never mark done before checks pass.

## Current focus

Local teaser-first proof (ADR-0005): public repository -> documented source excerpts -> approved
storyboard -> 30-second animated teaser -> full human review and approved export. Supplied-footage
demonstrations remain a separate workflow. Presentation and documentation generation are deferred.
Do not install hosted infrastructure or start deck/logo work to complete this milestone.

## Planning update completed

- [x] **TASK-067**: Align product, architecture, contracts, instructions, backlog and CLI/package descriptions.
  - Completed on: 2026-09-12. ADR-0003 accepted; old pending IDs retired; historical plans marked archived.
  - Verification: `uv run pytest tests/test_cli.py -q` RED then GREEN (2 passed);
    `uv run pytest tests -q` 6 passed; `uv run ruff check .` clean; document checks passed for
    20 Markdown files, 30 unique task definitions, 2 local links and 2 contract JSON examples.
  - `git diff --check` clean. Contract checks validate example syntax, not unimplemented Pydantic models.
    No pipeline/media/hosted feature completion claimed. Changes left uncommitted; no commit requested.

- [x] **TASK-090**: Adopt the supplied frontend branding and document the full platform in README.
  - Scope: frontend design contract, linked PRD/architecture/recipes, editor acceptance and README
    frontend/backend/database/storage/auth/jobs/deployment overview. No frontend implementation.
  - Completed on: 2026-09-12. Design-guide work delegated to a subagent and reviewed locally.
  - Verification: `uv run pytest tests -q` 6 passed; `uv run ruff check .` clean; documentation checks
    passed for 7 files, 16 local links and 31 unique task IDs; editor diagnostics and diff whitespace clean.
  - README uses a plain-text architecture diagram, avoiding a sign-in-dependent Mermaid validator.
    No frontend build/screenshots claimed; TASK-083 retains implementation and visual QA. No commit requested.

- [x] **TASK-091**: Save verified-work publication preference and motion-reference production knowledge.
  - Scope: agent instructions, README, motion guide/reference archive and first fixture-video test brief.
  - Documentation verified on 2026-09-12: `uv run pytest tests -q` 6 passed;
    `uv run ruff check .` clean; 8 documents, 18 local links and 32 unique task IDs checked;
    README headings, editor diagnostics and `git diff --check` clean.
  - Publication includes the previously uncommitted TASK-067/090 work under the new standing request.
    Normal push and remote hash comparison are required before reporting publication success.
    Media/fixture/schema implementation and independent reference-film review remain pending.

## Ready next

- [ ] Complete the remaining **TASK-072..078** acceptance gates. Initial working CLI slice is recorded
  below; none of those full task definitions is marked complete by the initial integration.

## Initial Backend Integration

- [x] **TASK-103**: Install requested ui-demo skill and produce an owned-app recording/edit test.
  - User explicitly authorized recording DemoForge at http://127.0.0.1:8001/ on 2026-09-13.
    Installed affaan-m/ecc ui-demo for Copilot with source lock. Applied Discover -> Rehearse -> Record.
    Added test-only walkthrough harness and camera/scope regression; no production capture API added.
  - Eight sections: project entry, canvas caption edit, frame caption save, evidence, footage,
    approvals, review and source teaser entry. Fresh browser contexts, built-in demo data, no existing
    localStorage reused. External/mutating requests blocked; source-teaser run list suppressed for privacy.
    No production approvals or run submissions. Caption edits affect isolated demo drafts only.
  - Review draft: real WebM footage, visible event-linked cursor, cuts, offline section captions,
    measured focus targets and smooth bounded 1.35x zoom. Silent, no music or voiceover.
    No Tella/FocuSee parity, arbitrary-app support or connected editor/export completion claimed.
  - Verified 2026-09-13: focused tests RED -> GREEN; real recording gate 2 passed. Full pytest
    356 passed, 3 opt-in tests skipped; Ruff clean. Eight raw SHA-256 values verified. Actual output:
    1920x1080, 30 fps, 1800 frames, 60 seconds, no audio (peak N/A); full decode and 8 motion MD5 pairs
    passed. Chromium played all 1800 frames to the end without media error. Encoded wide/focus samples
    inspected. SHA-256 3d693ea467f817b366fe386f194ed91189457bbc2155bf1814c495061e5f2dc4.
  - Local deliverables: reviews/owned-ui-demo-20260913-04 under the non-synced runtime root,
    including walkthrough-review.mp4, review.html, edit.json, raw WebM clips and measurements.json.
    Captured checkout revision 2846912f44be421ba73c004c8a88cb4c3db51282. No runtime assets committed.
  - Full human privacy/motion/creative review remains pending; this completed test is not an approved
    final export. Generalized recording needs separately authorized scenarios, isolation/egress controls,
    backend integration and exact revision approvals. TASK-101 remains unrelated and open.

- [x] **TASK-102**: Replace the rejected serif/document teaser with a provisional kinetic template.
  - Directly inspected public LinkedIn post media and sampled frames from ML Intern, OUI-1 and
    Qwen3-TTS/Nari Labs. Sandrine's public post exposed no playable video. Findings and limitations
    are recorded in references/style_analysis/linkedin_posts.md; no audio/full-playback review claimed.
  - User unavailable to select between UI-led and kinetic references. Template v3 provisionally uses
    bold sans-serif text, contrasting fields and feature-only linear trails; no copied assets, fake UI,
    fabricated metrics or changed approved source text. Creative acceptance is explicitly still open.
  - RED/GREEN browser regression rejects the old illustration/serif type and checks random seeking,
    motion, capture-key consistency, reduced motion, final holds and 320/390/1280/1920px bounds.
  - Verified: full pytest 356 passed, 1 skipped with real-media enabled; Ruff clean. Synthetic render:
    900 frames, 30 seconds, 1920x1080, 30 fps, silent (peak N/A), full decode and motion-pair MD5 checks.
    SHA-256 eae06f414b2bd7bdf08d7f4f594717cb2940caa460f36f10bdad41903a60d61a;
    273 captured frames, 61.391 seconds rendering on this host. Encoded samples and mobile screenshot
    inspected. Full human motion/privacy/creative review and actual repository MP4 remain TASK-101.
  - No frontend source changes; frontend suites were not rerun. Fixed three-scene pacing and no sound
    design remain limits, not reference parity. Sample retained outside Git under reviews/kinetic-v3-20260912.

- [x] **TASK-100**: Improve reference-inspired teaser composition, source selection and usability.
  - Three scoped agents improved scene composition, deterministic README selection and connected UI.
    Root README purpose/features outrank sample document lists. Whole bold/table excerpts retain
    exact source text; qualifications, unsafe instructions and unsupported fragments remain rejected.
  - Template v2: product-name opening, editorial feature typography, animated labelled document
    illustration, green accent and dark end card. Frame-indexed easing/reduced-motion preview and
    static final hold checked; no copied reference assets, invented UI or runtime claims.
  - UI: four-step status, collapsed source/revision details, truthful delayed-request state and fresh
    retry IDs after terminal runs; uncertain network retries preserve idempotency. Approvals stay explicit.
  - Verified 2026-09-12: 356 Python tests passed, 1 skipped with real-media opt-in; Ruff clean;
    186 frontend unit tests, production build and all 9 connected browser tests passed. Browser gate
    includes actual synthetic MP4 rendering/download, 320px accessibility, retry and approval sequencing.
  - Synthetic sample: 900 frames, 30 seconds, 1920x1080, 30 fps, silent, full decode and motion-pair MD5
    checks; SHA-256 9adaa37ade322da1b964fb0c4c732ece68ac29dadc0d7962a08e60b49bd2a6e5.
    Render took 46.0 seconds on this host. Audio peak not applicable. Synthetic decisions are test-only.
  - Actual realestate-rag storyboard prepared from saved commit a9fa0fa285c0ecae0224ca15240ba95640f7d2a8,
    not claimed current HEAD. Opening: RAG Real Estate Document Assistant. Feature: Every answer includes
    references to original documents. Exact storyboard SHA-256:
    48233975d932bce44821b2b423eaf28f4927d01b3f59dfec2b88e012fab6408b.
    Offline HTML feature composition inspected. User unavailable for exact approval; no approval fabricated.
- [ ] **TASK-101**: Obtain exact realestate-rag storyboard approval, render the repository-specific MP4,
  then obtain full human output review before final export. Presentation/docs generation are not part
  of this gate. The synthetic test video is not a substitute for the requested repository video.

- [x] **TASK-099**: Connect a public-repository teaser workflow to the local browser application.
  - Three delegated lanes: source preparation/schema, offline motion renderer, and loopback API/browser
    integration over the existing SQLite controller. No hosted dependencies or live model calls.
  - URL -> source-linked scene review -> combined source/storyboard hash approval -> render/preview ->
    final-output hash approval -> MP4/evidence/offline ZIP. Browser draft approvals remain separate.
  - Verified 2026-09-12: full pytest 334 passed, 1 skipped with DEMOFORGE_TEASER_MEDIA=1; Ruff clean;
    frontend 178 unit tests, production build, 24 existing browser checks and 3 connected teaser checks.
    Connected test injects source fixture but uses real SQLite/preparation/render/download. Desktop
    and mobile screenshots inspected; accessibility and decoded video pixel checks pass.
  - Real renderer: 900 frames, 30.0 seconds, 1920x1080, 30 fps, silent; full decode and 11 distinct
    sampled motion-frame MD5 values. SHA-256 d79fe9e71700a0098a363bd5bf342261351475412d26810b6f55e73d3bc60e75.
    Measured 43.078 seconds on this host, not a performance guarantee. No audio peak applies.
  - Realestate-rag source preparation checked at a9fa0fa285c0ecae0224ca15240ba95640f7d2a8;
    generic media headings excluded after RED/GREEN regression. Synthetic decisions only cover tests;
    no actual user approval fabricated. Full human creative-quality review remains open.
    Later live API acquisition was blocked by GitHub's exhausted public quota (0/60 remaining);
    corrected captions were verified against the earlier saved pinned catalog. No live user export claimed.
  - Initial style: kinetic typography, masked/typewriter reveals, contrasting fields and end hold.
    Not reference-film parity; no copied media or invented UI. Image import, connected caption edits,
    richer narrative selection, mid-render cancellation and hosted multi-user execution remain open.
    Run one local server/operator per workspace. Scoped publication and remote verification required.

- [x] **TASK-098**: Initial CLI source-to-supplied-footage pipeline across TASK-072..078.
  - Implemented: bounded fixed-host GitHub API acquisition, local redaction, sanitized context/catalog;
    media permission/decode/hash checks and silent normalization; neutral brand tokens; exact-excerpt
    FakeLLM/OpenAI proposals; source-bound storyboard and four exact approval pauses; foreground
    HTML/FFmpeg render, offline source review, manifest-backed portable export and SQLite CLI commands.
  - Public read-only ingestion: realestate-rag at a9fa0fa285c0ecae0224ca15240ba95640f7d2a8,
    17 evidence entries, ask_user for footage/approvals. No repo execution or live model call.
  - Verified on 2026-09-12: focused RED/GREEN tests; `uv run pytest tests -q` 226 passed, 1 skipped;
    `uv run ruff check .` clean. Frontend regression: 175 unit tests and production build passed.
    Real synthetic render/controller: 900 frames, 30.0 seconds, 1920x1080, 30 fps, silent; full decode.
    Export SHA-256: 882d790026c105900ceeb370e70ac97a60f16ce35540a6eec76c88355df4b930.
    Peak: not applicable (no audio). Synthetic test decisions are not human approvals. Contact-sheet
    framing was inspected; no customer-video human review is claimed. Scoped commit/push and remote
    hash verification are required for publication.
  - Remaining original-task requirements are explicit in docs/LOCAL_PIPELINE.md: clone/policy decision,
    quarantine/ACLs, richer extraction, asset import, live evaluation, deterministic motion/masking,
    tool pinning/resources, crash-safe retry, caption-only edits, real product review and frontend API.

## Completed local proof tasks

- [x] **TASK-094**: Session-local evidence catalog and quality report imports.
  - Completed on: 2026-09-12. Frontend-only lane under ADR-0004, separate from Hermes's
    TASK-072/073. Strict version-1 JSON parsing, bounded collections/uploads, required nullable
    fields, unique IDs, claim support, safe source rendering and catalog revision checks.
  - Evidence displays imported claim status, IDs/revisions, limitations, source lines and hashes.
    Review displays reported checks, reasons, missing inputs/questions/warnings and exact catalog
    subject/revision association, including stale/unassociated states. Import never grants approval,
    links scenes automatically or enables export. Sanitized-input confirmation is not a secret scan.
  - Imports stay in project-scoped memory, outside localStorage/draft downloads. Invalid replacements
    retain the last valid artifact; navigation/removal invalidates pending reads. README and frontend
    recipe document stricter browser policies and backend boundaries. No Python files changed.
  - Verification: parser RED then GREEN; `npm --prefix frontend test` 29 passed;
    `npm --prefix frontend run build` passed; `npm --prefix frontend run test:browser` 17 passed,
    including desktop/mobile import screenshots, axe, hostile HTML as text, stale reports, project
    isolation and replacement/removal races. Older editor tests aligned with TASK-093 entry flow.
    `uv run pytest tests -q` exited 0 (one skipped); `uv run ruff check .` clean. Both synthetic JSON
    fixtures validated against committed Pydantic models; claim support and report association pass.
    TASK-083 API/controller/render integration remains open. No new rendered-video gate claimed.

- [x] **TASK-071**: Fixture app and evaluation fixtures (FR-08).
  - Completed on: 2026-09-12. `fixtures/taskroom/` (static, dependency-free task list: 8 seeded
    tasks, 3 completed, All/Active/Completed filter, data-testids, visible count), `demoforge/
    fixtures/server.py` (loopback-only ThreadingHTTPServer, no path escape), `demoforge/evals/
    schema.py` (EvalCase kinds, EvalMetrics with None for unknowns, never 0), `evals/cases/` (5
    cases: authorized recording, invalid media, missing evidence, prompt injection, privacy).
  - Verification: `uv run pytest tests -q` 148 passed, 1 skipped; ruff clean.
- [x] **TASK-093**: Frontend entry flow (landing, 3-step project creation, footage attestation).
  - Completed on: 2026-09-12. `frontend/src/entry/` (Zod schemas for repo URL/brief/footage, inline
    copy lint for em-dashes and marketing words, browser-read video metadata, mandatory
    authorization attestation, honest 'nothing sent yet' review, draft added to library).
  - Verification: `npx tsc --noEmit` ok, vitest 16 passed, `npm run build` ok, Playwright
    `e2e/entry.spec.ts` 2 passed incl. 375 px + axe.

- [x] **TASK-070**: Explicit controller, approvals, resume/cancel (FR-05, FR-11).
  - Completed on: 2026-09-12. `demoforge/workflow/stages.py` (Stage protocol, StageRequest/Context/
    Outcome, TransientError vs ContentError) and `workflow/controller.py` (ordered stages over the
    SQLite store; skips stages with a live manifest; approval subjects persist a checkpoint and
    raise `ApprovalRequired` then exit; approvals bind to type+id+revision+sha256, rejection fails
    the run; cancellation checked before every stage; three-attempt transient budget, one content
    repair with a hint; output hashes verified before a manifest is published; manifests record
    upstream manifest ids and hashes; `invalidate_from(stage)` supersedes downstream attempts so a
    caption edit re-runs storyboard/render/review only). State store gained options, superseded
    attempts, `reopen_run`, `active_attempt_count`.
  - Verification: `uv run pytest tests -q` 127 passed, 1 skipped; `uv run ruff check .` clean.
    Fake stages cover: pause at each approval, no re-run on resume without approval, stale hash,
    rejection, fresh-process resume, terminal resume refused, cancel between stages purges raw,
    2 transient then success, 3 transient fail, one repair, second content error fails,
    invalidation reruns only downstream, unknown stage rejected.

- [x] **TASK-069**: Safe workspace and local state (FR-03, FR-11).
  - Completed on: 2026-09-12. `demoforge/pack/workspace.py` (root outside OneDrive via
    `DEMOFORGE_WORKSPACE`/LOCALAPPDATA, `runs/<id>/{raw,staging,curated,outputs}`, path and symlink
    escape protection, atomic hashed publish, verify, quarantine purge, temp sweep) and
    `demoforge/workflow/state.py` (SQLite WAL; runs/attempts/manifests/approvals/events, legal
    transitions, one running attempt per stage, immutable approvals) plus `workflow/recovery.py`
    (stale-attempt recovery after crash, snapshot export/import that never overwrites, terminal
    `finalize_run` that purges quarantine and sets retention).
  - Verification: `uv run pytest tests -q` 114 passed (1 skipped: symlink needs privilege on Windows);
    `uv run ruff check .` clean. Negative tests: OneDrive root, unsafe run_id, `..`/absolute/symlink
    escape, hash and size mismatch, duplicate run, illegal and terminal transitions, second running
    attempt, failed attempt with outputs, foreign manifest, approval rewrite, unsupported snapshot
    version, snapshot overwrite, finalize on non-terminal state.

- [x] **TASK-068**: First typed contract slice and fixtures (FR-02, FR-04, FR-05).
  - Completed on: 2026-09-12. `demoforge/schemas/` = `_base` (StrictModel, Sha1/Sha256, UtcDatetime,
    RelativePath, CostValue), `evidence`, `claim` (+ Repository, FileRecord, EvidenceCatalog,
    `validate_claim_support`), `artifact` (ArtifactRef, Cost, ArtifactManifest), `approval`
    (+ `approval_matches`), `quality` (Check, QualityReport). No deck/logo/swarm schemas.
  - Verification: RED (5 collection errors, module missing) then GREEN; `uv run pytest tests -q` 75 passed;
    `uv run ruff check .` clean. Negative tests cover unknown fields, schema_version 2, bad hashes,
    inverted line ranges, dangling evidence, runtime_observed without observation, user_attested without
    attestation, path escape (abs/drive/`..`/URL), failed manifest with outputs, stale approval (revision
    or hash), pass gate with failed/not_run required check, ask_user without questions, secret values in
    measurements. Schema validity is not verified truth; I/O checks arrive with TASK-069/072.

## Local proof backlog

Every task requires the full pytest/Ruff gates plus the scoped acceptance below. Dependencies are explicit;
new IDs replace unstarted legacy tasks rather than silently reusing their meanings.

- [x] **TASK-069**: Safe workspace and local state (depends 068; FR-03, FR-11). Done, see above.
  - pack/ + workflow/state.py; configurable non-synced workspace root, SQLite runs/attempts/approvals,
    versioned manifests, atomic publication, path/symlink escape protection and quarantine retention.
  - Gate: tests/pack and tests/workflow validate crash-after-write recovery, DB authority, hash mismatch,
    snapshot export/import and cleanup on success/failure/cancellation. Do not place SQLite in OneDrive.
- [x] **TASK-070**: Explicit controller, approvals, resume/cancel (depends 069; FR-05, FR-11). Done, see above.
  - workflow/ stage request/context/result interface; persist checkpoint and exit while awaiting approval.
  - Gate: tests/workflow covers transition legality, duplicate execution, stale approvals, cancellation,
    stage invalidation, transient three-attempt budget and one content-repair budget using Fake stages.
- [ ] **TASK-071**: Early evaluation fixtures and measurement format (depends 068; PRD section 7).
  - First visual fixture and rejection matrix: docs/MOTION_PRODUCTION.md section 6. Implement the actual
    seeded filter app and record permitted footage; reference-video assets are not test assets to copy.
  - tests/fixtures/ and evals/; five authorized repo/recording cases with permission records and expected
    claims, plus small local invalid-media/missing-evidence/injection/privacy/failure fixtures.
  - Gate: fixture tests run offline; metrics distinguish unknown from zero and include model/compute/
    storage/retry cost, correction time, capture success, render failure and user acceptance.
- [ ] **TASK-072**: Bounded ingestion, sanitization and evidence catalog (depends 069, 071; FR-01..04).
  - ingest/, extract/, quality/secrets.py, pack/context_pack.py; GitHub API, pinned shallow clone,
    classifier, README/manifests, curated context snapshot and missing-input questions.
  - Gate: mocked tests cover rate limits, timeouts, byte/file limits, malicious paths, redaction before
    model/curated access and prompt injection treated as data. Never execute repo code or scanner config.
- [ ] **TASK-073**: Supplied footage and existing brand assets (depends 069, 071; FR-06, FR-08).
  - video/import_media.py + brand/tokens.py; permission/provenance, decode/format limits, normalization,
    privacy review, neutral fallback tokens and contrast. No website capture or generated logo required.
  - Gate: media-fixture tests, ffprobe metadata/frame count and decode; reject invalid/unapproved assets.
- [ ] **TASK-074**: Typed AI adapter, grounded claims/narrative and scenario approval (depends 070, 072; FR-04..08).
  - enrich/ + scenario schema; FakeLLM first, one OpenAI SDK adapter; approved source-linked copy,
    supplied-footage scenario, bounded repair and explicit missing-evidence handling.
  - Gate: tests/enrich rejects fabricated/dangling claims and injected instructions; literal commands
    unchanged; scenario/claim changes invalidate approvals. Live provider evaluation is separately opt-in.
- [ ] **TASK-075**: Versioned three-scene storyboard and EDL (depends 073, 074; FR-09..11).
  - Apply docs/MOTION_PRODUCTION.md: evidence-linked starting state/action/result, 30 fps pilot pacing,
    frame-sampled motion, no invented metrics/progress, no mandatory 60 fps or unapproved 3D dependency.
  - video/storyboard.py + schemas; local JSON scene editing, trims, captions, ordering and revision history.
  - Gate: tests/video covers contiguity, source bounds, 900 frames at 30 fps, approved references and
    caption-only changes preserving catalog/footage. No arbitrary generated renderer code.
- [ ] **TASK-076**: Local HTML/FFmpeg render pipeline (depends 075; FR-12).
  - Include the motion guide's random-access frame repeatability and transformed-mask tests; no
    wall-clock CSS loops in exports. Visual review is required in addition to frame/decode checks.
  - video/assemble.py, overlay/, mix.py; pinned rig, fonts/tools, deterministic frame API, owned subprocesses.
  - Gate: node:test + Python render tests; real three-scene output, full decode and exactly 900 frames.
    Print time/peak memory; audio optional, true peak <= -1 dBTP when present; foreground rendering only.
- [ ] **TASK-077**: QA report, offline review and final export approval (depends 076; FR-12).
  - video/verify.py + quality/; text/asset integrity, full-video privacy/motion review, artifact-bound approval.
  - Gate: failed/not_run required checks block export; source report links resolve, no missing offline
    assets; print duration/frame count/audio peak/hashes. Contact sheets alone cannot approve privacy.
- [ ] **TASK-078**: CLI vertical slice and recovery (depends 077; FR-01..12).
  - cli.py exposes planned ingest/run/approve/resume/cancel behavior through workflow/; no duplicated logic.
  - Gate: CLI integration tests plus authorized supplied-footage run from input to approved MP4;
    pause/resume and caption-only rerender work. Help accurately documents implemented commands.
- [ ] **TASK-079**: Local pilot evaluation and release decision (depends 078, 071).
  - Run the five-case set, collect correction time/cost and whether users accept/publish videos.
  - Gate: publish measured gate results and failure analysis; no five-minute/$0.50 promise without data.
    Proceed to capture/editor based on observed friction; retain supplied-footage fallback.

## Controlled capture

- [ ] **TASK-080**: Approved Playwright scenarios on trusted demos (depends 079; FR-07).
  - video/capture/; typed allowlisted actions, preconditions, reset, readiness/result assertions, intentional
    holds, explicit viewport/recording size and observation evidence; close browser context before finalizing.
  - Gate: local fixture app replay/reset tests, authorization and sensitive-region checks; failed assertions
    cannot become runtime_observed claims. No automated install/run of submitted repositories.
- [ ] **TASK-081**: Capture security and reliability gate (depends 080; FR-03, FR-07).
  - Isolated Linux job design; network/redirect/DNS/IPv4/IPv6/metadata restrictions, no production/broker/DB
    secrets inside browser jobs, resource limits, credential cleanup and failure/cancellation handling.
  - Gate: hostile-URL and worker-loss tests, full-video masking review, repeat-run success measurements.
    Arbitrary hosted URL capture remains disabled until isolation review and these checks pass.

## Editing experience

- [x] **TASK-097**: Share motion-preview browser measurements with session footage.
  - Valid duration/dimensions update only the matching authorized clip, without metadata-triggered
    playback resets. No persistence, backend validation or export authority added.
  - Verification: real local two-color MP4 browser regression RED (Footage showed Not measured),
    then GREEN; decoded pixels, seeking, source-bound blocking, restart and consent revocation pass.
    TypeScript, 175 Vitest tests, production build, 24 foreground Playwright tests and
    `uv run pytest tests -q` (one skipped) exited 0; `uv run ruff check .` clean.
    Frontend README updated; generated test media remains ignored. Backend tasks remain open.

- [x] **TASK-096**: URL-first local source drafts and style-profile motion studies.
  - GitHub URL, optional brief/full SHA and no-footage creation from empty/populated libraries.
    Deterministic 30 fps preview, 900-frame default, beat seeks, hard cuts, 60-character caption edits,
    capped 1.12 push-in, reduced motion and guarded local media. Legacy captions remain stored.
    Caret highlight is metadata only; no invented UI or automatic control placement.
  - Verification: tests-first RED/GREEN; TypeScript, 175 Vitest tests, production build and 23
    foreground Playwright tests pass. Desktop/320px screenshots inspected; axe, aspect ratio,
    overflow, transport, caption limits, storage and no external requests checked. Source form tested
    with realestate-rag URL/full SHA, not ingestion. `uv run pytest tests -q` exited 0 (one skipped);
    `uv run ruff check .` clean. Procedure/limits documented in frontend/README.md.
  - Local source draft/motion study only: no repository execution, ingestion, LLM call, rendered MP4,
    API approval or export. Backend TASK-072/073/074/075/076/077/083 remain separate. README-linked
    realestate-rag demo recording identified, not downloaded, authorized or privacy-reviewed.

- [x] **TASK-095**: Parallel frontend F1/F2/F3 review, frame editor and mock run status.
  - Completed on: 2026-09-12 with three isolated frontend subagents and parent integration.
    Claims -> Storyboard -> Final output review; strict local Approval schema, immutable history,
    actual snapshot/file SHA-256, required rejection note and explicit local operator identity.
    Frame-based editing, shared caption lint, highlight/clip references and re-approval baseline;
    read-only typed mock state rail with 3 transient attempts / 1 repair bounds. Entry flow preserved.
  - User brief labels F1/F2 as frontend halves of TASK-078/080; those backend tasks remain open
    with their original CLI/capture meanings. API/controller binding remains TASK-083. No dependencies,
    backend files or style-reference files changed. No real server approval/render/export claimed.
  - Verification: tests-first RED/GREEN; frontend `npx tsc --noEmit`, `npx vitest run` (116 passed),
    `npm run build`, `npx playwright test` (20 passed). Desktop/mobile screenshots inspected; axe,
    single caption editor, frame continuity, stale approvals, required notes, clipboard, local storage,
    real supplied MP4 hash/preview and blocked export verified. `uv run pytest tests -q` exited 0
    (one skipped); `uv run ruff check .` clean. Local-only limits/procedure in frontend/README.md.

- [x] **TASK-092**: Parallel local frontend and visual project-library redesign, explicitly requested
  on 2026-09-12 while Hermes owns Python work. ADR-0004 authorizes React/TypeScript/Vite now.
  - Scope: frontend/ browser drafts, scene editing, session footage, evidence/review views, responsive
    library UI and tests. No backend adapter, authoritative approvals, render or MP4 export.
  - Verified 2026-09-12: 6 Vitest tests, TypeScript/Vite production build, 11 foreground Playwright
    tests including axe A/AA checks and screenshots at 1440/1024/390/320px. Real browser playback,
    permission blocking, edits/undo, persistence/conflicts, library filters, draft download/deletion pass.
    `uv run pytest tests -q` exits 0 (one skipped); `uv run ruff check .` clean. Documentation links pass.
  - Mobbin public discovery page inspected; authenticated screen library not accessed or scraped.
    User-supplied screenshots inform the redesign. No third-party product imagery copied.
    Scoped commit/push required; TASK-083 API/render integration and media export remain open.

- [ ] **TASK-082**: Renderer benchmark and selection ADR (depends 079; FR-10).
  - Compare identical three-scene HTML/FFmpeg and Remotion prototypes under frozen assets/fonts/spec.
  - Gate: report export latency, peak memory, text quality, preview/export consistency and development
    effort; review license eligibility and record explicit approval before adoption. Select one backend.
- [ ] **TASK-083**: React scene editor and local API adapter (depends 082, 078; FR-10).
  - React/TypeScript/Vite, TanStack Query, accessible components; preview, captions, trims, ordering,
    brand controls and revision history. FastAPI adapter binds to loopback for single-user local use.
  - Design: docs/FRONTEND_DESIGN.md; light canvas/white workspaces, obsidian logs, restrained semantic
    accents and locally bundled Geist fonts. Customer video branding stays isolated from app chrome.
  - Gate: frontend typecheck/tests, API tests, Playwright desktop/mobile editing and preview/export checks;
    stale edits rejected by revision control. Remotion Player only if selected; no generic timeline suite.
    Include the design contract's responsive/state matrix, contrast, keyboard/focus, reduced-motion,
    stable-preview and brand-isolation checks. The branding document alone does not complete this task.

## Hosted beta

- [ ] **TASK-084**: API, identity and tenant persistence (depends 083; FR-13).
  - FastAPI/Uvicorn, managed identity (Clerk candidate), PostgreSQL/SQLAlchemy/Alembic; REST/progress
    polling, server-side tenant authorization, quotas and migrations. Reuse workflow/ business rules.
  - Gate: issuer/audience/expiry tests, cross-tenant denial, concurrent revisions, migration/restore tests.
- [ ] **TASK-085**: Durable dispatch and private artifact storage (depends 084; FR-11, FR-13).
  - Celery/RabbitMQ, transactional outbox, private S3, signed object access, attempt reconciliation,
    processing/render queues and trusted supervisors for isolated capture. Linux/WSL2, not native Windows.
  - Gate: duplicate delivery, broker outage, worker loss, publish/DB crash windows, cancellation, tenant
    isolation, signed-URL scope/expiry and retention tests. No media bytes/secrets in queue payloads.
- [ ] **TASK-086**: Deployment and operational acceptance (depends 085, 081).
  - Linux containers with separate capture isolation, GitHub Actions, OpenTelemetry, sanitized logs,
    backups/restore, retention deletion, concurrency limits and usage budgets; no Kubernetes required.
  - Gate: hosted end-to-end fault/load/security checks, observed resource/cost limits and recovery drill.

## Deferred expansion (requires validated demand)

- [ ] **TASK-087**: Saved release scenarios, revision diffs and stale-claim detection (depends 086).
  - Gate: changed evidence invalidates affected claims; unchanged footage reused only with freshness approval.
- [ ] **TASK-088**: GitHub App/private repos, extra aspect ratios and optional narration (depends 086).
  - Split into scoped tasks before implementation; require least-privilege/revocation tests and media gates.
- [ ] **TASK-089**: Evidence-derived technical decks/docs and brand deliverables (depends 079 plus demand).
  - Split before implementation. Investor/business claims need supplied evidence; logo/PPTX/Figma remain opt-in.

## Retired task IDs

TASK-010..066 were unstarted and are superseded, not completed. Historical recipes remain in the archived
Hermes plan only. Mapping: 010 -> 068 plus owning schemas; 011 -> 069/070; 012..022 -> 072/073/080;
023..029 -> neutral/reused tokens in 073, logo family deferred to 089; 030..035 -> 074;
036..043 -> 089; 044..053 -> 073/075..083/088; 054..058 -> 089;
059..061 -> 070/085 (swarm/Hermes removed); 062..063 -> 077/078; 064..066 -> 071/079.

## Completed foundation history

Historical completion records below describe the original foundation, not completion of revised features.

- [x] **TASK-007**: Public GitHub repo `https://github.com/mohamedamineelabidi/demoforge`, history pushed, `.github/copilot-instructions.md` mirrors AGENTS.md
  - *Completed on:* 2026-09-12
- [x] **TASK-006**: `.agents/skills/` scaffold (7 recipes: demoforge-dev, context-pack-ingest, logo-as-code, grounded-narrative, deck-as-code, video-as-code, swarm-roles)
  - *Completed on:* 2026-09-12
- [x] **TASK-005**: `.agents/architecture.md` + ADR-0001 (Python data layer, HTML renderers) + ADR-0002 (JSON/SQLite MVP)
  - *Completed on:* 2026-09-12
- [x] **TASK-004**: `docs/DATA_CONTRACTS.md` (13 contracts incl. Agent Context Pack, EDL, DeckSpec, swarm message)
  - *Completed on:* 2026-09-12
- [x] **TASK-003**: `docs/QUALITY_BAR.md`, `demoforge/quality/banned_phrases.txt`, `lint_copy()` / `assert_clean()`
  - *Completed on:* 2026-09-12
  - *Verification:* `uv run pytest tests -q` 5 passed; `uv run ruff check .` clean.
- [x] **TASK-002**: `AGENTS.md`, `PRD.md`, `README.md`, `TASKS.md` governance files
  - *Completed on:* 2026-09-12
  - *Commit:* `docs: add AGENTS.md operating manual and PRD [TASK-002]`
- [x] **TASK-001**: Initialize repository: `pyproject.toml` (uv, hatchling), package skeleton, Typer CLI, first test, `.gitignore`, `.env.example`
  - *Completed on:* 2026-09-12
  - *Verification:* `uv run pytest tests -q` 1 passed; `uv run ruff check .` clean; `uv run python -m demoforge version` prints `DemoForge 0.0.1`.
  - *Note:* the `demoforge.exe` console shim fails on this OneDrive path (accents/spaces); use `python -m demoforge`.