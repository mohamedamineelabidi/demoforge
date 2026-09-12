# DemoForge

Turn a shipped feature into a source-linked, editable release-demo video of the real product.

Planned flow: repository + feature brief + authorized footage/demo -> evidence -> approved claims and
scenario -> footage checks -> editable storyboard -> render -> technical QA and human review -> export.
The first local milestone uses supplied footage, a 30-second 16:9 video and reusable brand assets.
Controlled capture, a browser editor and hosting follow. Decks, docs and logo generation are deferred.

Status: bounded GitHub text ingestion and an initial supplied-footage CLI pipeline are implemented.
The CLI supports grounded proposals, exact-revision approvals, normalization, silent HTML/FFmpeg
rendering and offline evidence/review export. Synthetic real-tool tests pass; broader release gates
remain open. The browser draft editor remains separate from the backend controller and export.
See [local pipeline](docs/LOCAL_PIPELINE.md) for commands and limitations.
See [TASKS.md](TASKS.md) for the next task and [PRD.md](PRD.md) for requirements.

## Local frontend

```bash
npm --prefix frontend ci
npm --prefix frontend run dev -- --port 5174
```

Open the URL printed by Vite. Create a local project or select **Open sample project** for labeled
demo data. The revised dashboard uses a visual project library and slim navigation inspired by the
user's supplied creative-tool screenshots. See [frontend/README.md](frontend/README.md) for tests,
asset provenance, browser-storage behavior and the backend integration boundary.

## Quick start

Prerequisites: Python 3.11+, [uv](https://docs.astral.sh/uv/) and Git. Media tests require Node LTS,
Playwright 1.63.0 in the external rig, installed Chrome and FFmpeg/ffprobe. Binary version enforcement
remains a release gate. No cloud account is required for tests or supplied proposal JSON.

```bash
git clone https://github.com/mohamedamineelabidi/demoforge.git
cd demoforge
unset PYTHONPATH PYTHONHOME     # git-bash: clear stray host Python variables
cp .env.example .env            # optional keys; public repos work without a token
uv venv --python 3.11
uv pip install -e ".[dev]"
uv run python -m demoforge --help
```

## Commands

```bash
uv run pytest tests -q          # test suite (hard gate before any task is marked done)
uv run ruff check .             # lint
uv run python -m demoforge version
uv run python -m demoforge ingest https://github.com/owner/repo
uv run python -m demoforge run --help
uv run python -m demoforge propose --help
uv run python -m demoforge status RUN_ID
uv run python -m demoforge resume RUN_ID
```

## Production knowledge and next step

We are building a tool that turns repository evidence and authorized footage into a truthful, editable
release-demo video, not a generator that invents product screens. The current repository implements
an initial CLI vertical slice, copy lint, typed contracts and a separate local browser draft editor.
Full frontend integration remains **TASK-083**. Original backend tasks retain open acceptance items;
see TASKS.md and docs/LOCAL_PIPELINE.md.

The [motion production knowledge base](docs/MOTION_PRODUCTION.md) stores the supplied film references,
adapted camera/typography/state-flow techniques and a concrete first visual-test brief: record an actual
controlled fixture's starting state, filter action and visible result, then produce three scenes totaling
900 frames at 30 fps. Synthetic encoder-pattern videos now pass the real render/controller tests;
a real product workflow demonstration and full human review remain open.
The films are unreviewed inspiration, not copied assets or a guarantee of professional output quality.
Keep the local HTML/FFmpeg path first; the supplied Remotion/3D examples do not override TASK-082.

## Frontend design

The application adopts **Kinetic Bento & Clean AI Native**, adapted to DemoForge's real production
workflow. The complete [frontend design contract](docs/FRONTEND_DESIGN.md) includes CSS tokens,
responsive layouts, interaction states and accessibility/visual QA acceptance criteria.

| Element | Application treatment |
|---|---|
| Canvas and surfaces | Light canvas `#F9FAFC`, white `#FFFFFF`, inset `#F1F3F7`, borders `#E2E8F0` |
| Dark tools | Obsidian `#0C0D0E` for the execution-log viewer, with high-contrast text |
| Text | Ink `#0F172A`, muted `#64748B`; stronger secondary text on inset backgrounds |
| Accent and status | Restrained indigo `#6366F1`, emerald `#10B981`, amber `#F59E0B`; darker accessible text variants and explicit labels |
| Typography | Licensed, locally bundled Geist Sans and Geist Mono; 12/14/16/18/24px scale, zero letter spacing |
| Controls | Lucide icons with accessible names/tooltips, tabs, switches, swatches and numeric controls; pills for filters/statuses |
| Structure | Dense unframed workspaces, subtle borders, compact 6-8px control/tool radii and stable preview dimensions |

The reference's oversized rounded cards, negative tracking and decorative aura blobs are adapted out
of the work interface. Light/dark contrast and restrained accents provide hierarchy without floating
card-heavy pages. This is a production app, not a marketing landing page or generic agent dashboard.
Tailwind is optional, not installed or mandated by the pasted configuration; tokens are framework-neutral CSS.

Planned workspaces:

1. **Projects and runs:** source revision, actual stage, filters and next action; no invented KPI tiles.
2. **Evidence and approvals:** claims, source locations, verification status, missing inputs and exact-revision approval.
3. **Footage:** permitted recordings/thumbnails, measured metadata, provenance and privacy checks.
4. **Scene editor:** scene list, stable 16:9 preview, caption/trim/brand inspector and revision history.
5. **Render and review:** backend-confirmed progress, sanitized dark logs, full-video playback, gates and export approval.

Desktop uses a navigation rail and editor tracks for scenes, preview and inspector. Tablet collapses
one side pane; mobile stacks controls and switches scene/properties/evidence/log views through tabs.
Controls remain keyboard accessible with 44px touch targets, visible focus and reduced-motion support.
Loading, empty, queued, approval-waiting, stale-revision, privacy-restricted, disconnected and error
states are explicit. Unknown measurements stay unknown; a paused approval never looks like a running worker.

**Brand boundary:** this palette styles DemoForge navigation and tools, not customer videos. Exported
content uses the customer's approved assets and BrandTokens; neutral output tokens cover missing branding.
Preview styling must be isolated so app colors, fonts and badges cannot leak into rendered exports.

## Platform architecture

This is the **target platform**, not the current installation. The repository remains a foundation CLI
and copy-lint package. Build the local proof first, then capture, editing and hosting, according to
[TASKS.md](TASKS.md). Detailed ownership is in [.agents/architecture.md](.agents/architecture.md);
[ADR-0003](docs/decisions/ADR-0003-video-first-explicit-workflow.md) records the staged decisions.

### Frontend, backend and services

```text
User -> React / TypeScript / Vite editor -> Managed identity (Clerk candidate)
					 |
		  Authenticated REST + progress polling
					 v
			  FastAPI / Uvicorn
					 |
Local Typer CLI ------+--> Python workflow and domain services
							  |
							  +--> State: SQLite local / PostgreSQL hosted
							  +--> Artifacts: local files / private S3
							  +--> Bounded ingestion and sanitization
							  +--> Typed AI adapter (sanitized evidence only)
							  +--> Technical gates and human approval

Hosted dispatch:
PostgreSQL outbox -> Publisher -> RabbitMQ (job IDs) -> Celery trusted supervisors
														|
						 +------------------------------+-------------------+
						 v                              v                   v
				 Shared Python stages          Isolated Playwright    Trusted Node /
													capture           FFmpeg render
						 |                              |                   |
						 +------------------------------+-------------------+
														v
								Validated manifests -> workflow state + storage

Review/export: API checks permissions and gates -> scoped artifact access -> editor
```

The queue/outbox and managed services belong to hosting; the local CLI executes stages sequentially.
This is one modular application with isolated execution environments, not independent microservices.

| Layer | Technology | Ownership and boundary |
|---|---|---|
| Frontend | React, TypeScript, Vite, TanStack Query, Lucide | Navigation, editing and previews; server state is not an alternate workflow controller |
| API | FastAPI, Uvicorn, Pydantic v2 | Validates requests, permissions and expected revisions; returns job IDs rather than rendering in requests |
| Core backend | Python 3.11+, uv; ingest/extract/enrich/pack/quality/video/workflow modules | Evidence, transitions, approvals, invalidation, resume/cancel and export rules; shared by CLI and workers |
| Authentication | Managed identity, initially Clerk candidate | API verifies issuer/audience/expiry; project membership and tenant authorization stay server-side |
| Local database | stdlib sqlite3 | Authoritative runs, attempts and approvals on a configurable local non-synced filesystem, outside OneDrive |
| Hosted database | PostgreSQL, SQLAlchemy, Alembic | Tenant/project membership, workflow state, immutable revision metadata, approvals and artifact ownership; migrations and backups |
| Artifact storage | Local files initially; private Amazon S3 hosted | Footage, sanitized assets, versioned JSON, videos and reports; DB holds IDs/hashes, not video blobs |
| Job transport | Celery with RabbitMQ | Separate processing/render queues; IDs only, bounded retries, outbox publication and stale-attempt reconciliation |
| Capture | Playwright with pinned Chromium | Approved scenarios, reset/readiness/result assertions; sandbox receives no production, database or broker credentials |
| Rendering | HTML/Playwright overlays + FFmpeg/ffprobe locally | Approved immutable scenes and sanitized assets; restricted external network; exact media gates |
| Editor renderer | Remotion candidate | TASK-082 measures quality, memory, latency and preview/export parity, checks licensing, then selects one production backend |
| AI | One OpenAI SDK adapter plus FakeLLM | Typed proposals over evidence; no unrestricted shell/browser/React execution; provider/model selection follows evaluations |
| Verification | pytest, Ruff, node:test, Playwright and media gates | Contract, workflow, UI, fault-recovery and artifact tests; human review remains required |
| Operations | Linux jobs, GitHub Actions, structured logs, OpenTelemetry | Deployment, queue/resource limits, secrets management, retention, backups/restore and cost/failure measurements |

### Database and artifact model

These are logical entities for future migrations, not existing tables. API/worker repositories own
writes; browsers never connect directly to PostgreSQL or the broker. Local single-user state omits
hosted identity/membership machinery. Pydantic defines payload contracts; relational constraints
enforce ownership, uniqueness and relationships in persistence.

| Entity | Relationships and stored state |
|---|---|
| tenants, users, memberships | A user may belong to multiple tenants; role checks scope all project actions |
| projects, source_revisions | Tenant-owned projects reference repository URLs and immutable full commit hashes |
| runs, stage_attempts | Project run, current state/checkpoint, retry attempts, cancellation and measured resource/cost data |
| catalog_revisions, evidence, claims | Pinned sources and evidence IDs; claim-to-evidence references and verification status |
| scenario_revisions, observations | Approved action/reset/assertion specification and recorded results tied to footage |
| brand_revisions, storyboard_revisions | Immutable brand/scene versions with dependency IDs; parent revisions support history |
| approvals | Actor, subject type/ID/revision/hash, decision and time; approval is separate from claim verification |
| artifacts, manifests, quality_reports | Ownership, object key, hash, type, size, lineage and gate results; large payloads live in storage |
| outbox | Transactionally recorded dispatch intent; publication status supports recovery after broker/DB failures |

Tenant scope must be checked on every referenced object, not just the top-level request. Immutable
revisions and optimistic concurrency reject stale edits; edits invalidate only affected descendants.
JSON specifications remain portable artifacts, referenced by metadata rather than a giant mutable state blob.
The UI distinguishes documented, statically_supported, runtime_observed and user_attested claims.
Schema validity, human approval and runtime observation are separate concepts.

### Request and job lifecycle

1. The user selects a repository revision, supplies a feature brief and authorized footage/demo, and starts a run.
2. FastAPI checks identity, tenant/project access, quotas and inputs. It stores run state plus outbox intent in one transaction.
3. The publisher sends an ID-only job; trusted workers load authorized immutable inputs and execute the shared stage functions.
4. Ingestion sanitizes inputs before model access. Claim/scenario approval persists a checkpoint and releases the worker.
5. Footage validation or approved capture produces observations. The user edits and approves a storyboard revision.
6. Rendering publishes checked artifacts; technical QA plus full human review binds final approval to the exact output hash.
7. The API provides scoped artifact access only after permission/gate checks. The browser polls authoritative state and displays real measurements.

Planned API families cover projects/runs, claims/evidence, uploads/artifacts, scenario/storyboard
revisions, approvals, cancellation/resume and export. Exact route schemas belong to TASK-083/084.
The local editor API binds to loopback; hosted authentication and tenant controls precede public exposure.
Large uploads/downloads use scoped storage access rather than passing videos through queue payloads.
Uploads remain quarantined until validation; signed URLs are short-lived bearer credentials, not public buckets.

Workers tolerate duplicate delivery: stage idempotency keys and atomic artifact publication prevent
duplicate effects. Queue acknowledgment alone is not exactly-once processing. Outbox reconciliation,
attempt timeouts and cooperative subprocess cancellation cover crash and failure paths. Caption edits
do not reclone or recapture; live capture reuse requires explicit freshness approval across releases.
Diagnostic logs and exported run.json snapshots are not authoritative workflow state.

### Deployment and security

- **Local proof:** Python CLI, SQLite and filesystem artifacts; foreground media jobs on this Windows host.
- **Editor:** Vite app and loopback FastAPI adapter; no hosted services required for single-user editing.
- **Hosted beta:** static frontend hosting plus TLS API, managed PostgreSQL/private S3, RabbitMQ and
	Linux worker processes. Deploy trusted rendering separately from hostile browser capture boundaries.
- **Isolation:** never install/run submitted repositories. Block private-network/metadata egress,
	unsafe redirects/DNS resolution and unauthorized browser actions; ordinary containers alone are insufficient.
- **Operations:** least-privilege secrets, sanitized logs, permission checks, quotas, retention/deletion,
	monitored queue backlog and tested backup/restore. Linux/WSL2 for Celery; native Windows is unsupported.

No Kubernetes, Kafka, GPU, vector database or autonomous swarm is required. Hosted resource sizing and
cost promises depend on measured pilot workloads. No deployment or UI screenshot validation is claimed yet.

## Repository map

| Path | Purpose |
|---|---|
| `AGENTS.md` | Operating manual for any AI agent working here (read first) |
| `PRD.md` | Product requirements, the source of truth for features |
| `TASKS.md` | Live backlog and state machine, updated in every commit |
| `.agents/architecture.md` | Module boundaries, explicit workflow, state and artifact ownership |
| `.agents/skills/` | Reusable operational recipes (video-as-code, logo-as-code, ...) |
| `docs/` | Data contracts, quality bar, decisions |
| `docs/FRONTEND_DESIGN.md` | Application palette, typography, workspaces, states and visual QA contract |
| `demoforge/` | Python core; future data layer, workflow and video modules |
| `tests/` | pytest suite; fixtures are local, network tests need `DEMOFORGE_LIVE=1` |
| `workspace/` | Runtime data lake per run (gitignored) |

## AI agent integration

Read `AGENTS.md` and `TASKS.md`, state goal/files/checks, write tests first for logic, verify, then update
tasks and relevant recipes. The user's standing request is to commit task-related changes and push to
the configured GitHub upstream after verification, then confirm the remote commit. Never force-push or
publish secrets, runtime/customer media or unrelated edits. Report authentication/protection failures
without bypassing them. Historical Hermes plans are archived, not executable backlogs. ADR-0003
records the video-first direction and staged technology choices.

Local proof: Python + SQLite + JSON + HTML/FFmpeg. Editor target: React/TypeScript/Vite, with a
Remotion benchmark before renderer selection. Hosted target: FastAPI, PostgreSQL, private S3,
managed identity and Celery/RabbitMQ on Linux. None of these future services are installed by the plan.
