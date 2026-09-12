# Architecture

Accepted direction: 2026-09-12. Planned modules below are not yet implemented.
PRD.md owns requirements; TASKS.md owns execution order; docs/DATA_CONTRACTS.md owns contracts.

## 1. One application, explicit workflow

```text
Repository + brief + authorized footage/demo + existing brand assets
   -> bounded quarantine -> scan/redact -> evidence and asset catalog
   -> claims + demo scenario -> human approval of exact revisions
   -> supplied-footage validation OR controlled capture + observation checks
   -> storyboard + brand tokens -> review/edit -> storyboard approval
   -> render -> technical QA -> full human review -> export
```

No autonomous swarm or message-bus-driven content decisions. A Python controller owns transitions;
typed stage functions own computation. CLI and future API/worker entry points reuse those functions.
The context pack is a versioned evidence snapshot, not a mutable global blackboard. Downstream stages
read explicitly declared approved snapshots and artifact references, never raw repositories.
Brand tokens are resolved before storyboard composition, not concurrently with dependent outputs.

## 2. Local state and artifacts

```text
workspace/index.sqlite                  authoritative run/stage/approval state
workspace/<run_id>/raw/                 quarantined repository and uploads
workspace/<run_id>/staging/             scanned extracts and intermediate media
workspace/<run_id>/curated/<revision>/  validated immutable packs/specifications
workspace/<run_id>/outputs/<revision>/  render, evidence report, review page, QA
workspace/<run_id>/events.jsonl         diagnostic log only
workspace/<run_id>/run.json             exported state snapshot, never second authority
```

Use stdlib sqlite3 locally; store the database on a local filesystem, not a cloud-synced/network
directory. The workspace root must be configurable (this checkout is in OneDrive). Export manifests
make artifacts portable; import/resume must validate hashes and reconstruct state, not trust run.json.
Raw inputs are immutable while retained but deletable quarantine. Default pilot retention: delete raw
inputs after successful finalization or seven days after failure/cancellation; explicit retention and
early deletion controls are required. Temporary credentials are never part of packs or diagnostics.

## 3. Ownership and interfaces

| Module | Responsibility | Forbidden dependency/behavior |
|---|---|---|
| schemas/ | Pydantic contracts and pure structural checks; stdlib allowed | I/O, SDK clients, orchestration |
| ingest/, extract/ | Bounded collection, source locations and deterministic parsing | Model calls, repository execution |
| quality/ | Evidence, copy, privacy and artifact gates | Content generation |
| pack/ | Safe paths, atomic writes, manifests, catalog assembly | Workflow decisions |
| enrich/ | Typed provider interface, FakeLLM, claim/narrative proposals | Raw filesystem or unrestricted tools |
| brand/ | Reuse supplied assets; neutral fallback tokens and contrast | Logo generation in pilot |
| video/ | Scenario validation, capture adapters, storyboard, rendering and gates | Ingestion or unapproved source access |
| workflow/ | State repository, transitions, approvals, cancellation and resume | Generating content itself |
| api/ and workers/ (hosted) | Authorization and dispatch adapters | Duplicated business rules |
| deck/, docs_gen/ (deferred) | Later outputs from approved evidence | Pilot prerequisites |

Stage interface target: `run(request: StageRequest, context: StageContext) -> StageResult`.
Request identifies run, stage and immutable input manifests; context supplies storage, clock and
configured service adapters; result identifies artifacts, gate and sanitized issues. The controller
commits state after validating published outputs. Do not introduce a generic plugin framework.
Python invokes trusted Node scripts with argument arrays and JSON manifest paths, never shell strings.
Node validates JSON against schema and reports structured results. Hosted messages carry IDs only.

## 4. State, retries and invalidation

Run states: pending, ingesting, planning, awaiting_approval, acquiring_footage, storyboarding,
rendering, reviewing, complete, failed, cancelled. Stage states: pending, running, awaiting_approval,
complete, failed, cancelled. `awaiting_approval` records a checkpoint and continuation, then exits.
`ask_user` pauses; `fail` blocks; `pass` permits the next transition but does not imply human approval.

Approvals bind actor, subject revision/hash, decision and timestamp. Editing a claim or scenario
invalidates dependent storyboard/output approvals; caption edits preserve acquisition and ingestion.
Cache keys include stage/schema/template/tool versions, options and input hashes. Do not automatically
reuse live capture across releases: reset, freshness and explicit reuse authorization are required.
Publish artifacts to temporary paths then atomically rename; commit pointers only after hash/gate checks.
Every stage must tolerate duplicate execution without duplicate publication or approval effects.
Transient network failures: up to three total attempts with backoff/jitter and explicit I/O timeouts.
Content repair: at most one revision attempt, then ask the user. Policy/permission failures never retry.
Cancellation is cooperative between stages and terminates owned subprocesses with cleanup; timeouts
and worker loss leave recoverable attempts, not falsely completed runs. Test crash-after-write recovery.

## 5. Rendering and AI decisions

Local proof keeps HTML/Playwright overlays and FFmpeg/ffprobe. Pin browser, fonts and encoder versions;
repeatability applies to frozen inputs, not live browser behavior or stochastic model output.
Remotion is the preferred candidate for the editing stage because React Player and export can share
composition logic. TASK-082 benchmarks it against the pilot renderer and checks applicable licensing
before an ADR selects one production backend. Do not implement two permanent rendering stacks.
Start with one OpenAI SDK adapter plus FakeLLM. Select a model on grounded-output evaluations and cost,
not brand claims. Pydantic validation is not factual verification; evidence support and approval are
separate gates. No arbitrary model-generated JavaScript, shell, React or browser execution.

## 6. Hosted target (not required for local proof)

React + TypeScript + Vite + TanStack Query talks to FastAPI/Uvicorn through REST and progress polling.
Application chrome follows [docs/FRONTEND_DESIGN.md](../docs/FRONTEND_DESIGN.md): light workspaces,
obsidian logs, restrained accents and accessible controls. This theme must not leak into customer
BrandTokens or video exports. [README.md](../README.md) contains the platform overview and data ownership.
Use accessible controls; a scene editor, not a general nonlinear video editor. Managed identity
(Clerk candidate) provides authentication; FastAPI checks issuer/audience and tenant authorization.
PostgreSQL + SQLAlchemy + Alembic owns users/projects/runs/attempts/approvals/artifact metadata.
Private S3 stores media and versioned JSON; authorized short-lived URLs grant per-object access.
Celery + RabbitMQ transports work; transactional outbox publication connects DB commits to dispatch.
Reconcile stale attempts and unpublished outbox records. Do not use Celery result state as product state.
Durable messages, acknowledgment policy, bounded worker-loss retries and idempotency need fault tests;
there is no exactly-once guarantee. Separate lightweight processing and resource-heavy rendering queues.
Trusted supervisors launch restricted capture jobs; the sandbox has no broker/DB/production credentials.
Trusted render jobs receive only sanitized approved media/templates, with external network disabled.
Linux containers/WSL2 support workers; native Windows Celery is unsupported. Start with modest Linux
deployment, managed persistence and separate capture isolation, not Kubernetes or GPU infrastructure.
CI: GitHub Actions. Observability: structured run/stage/attempt logs and OpenTelemetry without raw secrets.
Track queue wait, retry counts, cost per accepted video, correction time and render/capture failures.

## 7. Security and acceptance

Bound clone depth, bytes, file count, decompression, downloads and media decode resources. Never execute
submitted repos or trust their scanner configuration. Scan/redact before model or curated access.
Arbitrary URL support is blocked until DNS/redirect/private-IP/metadata egress defenses and browser
isolation pass tests. Supplied-footage mode remains usable without external browser access.
Keep a capture action allowlist, preconditions, reset, readiness assertions and result assertions.
Separate intentional viewing holds from readiness waits. Mask before creating sharable derivatives;
review the full video, not just a contact sheet. Respect permission and asset licensing.

Required gates: typed packs and resolvable evidence, exact approvals, frame-contiguous EDL, media
bounds, full decode, exact output frame count, text/asset integrity, privacy review and audio true
peak <= -1 dBTP when audio exists. Expected static/duplicate frames are not automatically errors.
See docs/QUALITY_BAR.md and ADR-0003 for the accepted replacement of the original swarm roadmap.
