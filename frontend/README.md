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
- Demo data is explicitly labeled. The sample app really filters tasks; its still is not a recording
  or proof about customer software. Offline bundled fonts retain license notices under public/.

## Integration boundary

No HTTP API adapter, authentication, repo ingestion, server-side persistence, authoritative approval,
rendering or MP4 export is implemented by this frontend. Export video remains disabled. TanStack Query
and renderer selection stay in TASK-083/082. Do not post these local DTOs directly to Python APIs;
map them to the versioned backend contracts and use server-authoritative revisions and error states.
Unknown frame counts/hashes remain unknown. Browser media metadata is not an ffprobe/decode gate.
Saved drafts contain user text in localStorage; use trusted local data, not secrets. Closing/reloading
loses attached media, while draft text remains until the user deletes it. This is not hosted security.

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