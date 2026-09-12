# DemoForge Product Requirements

Status: accepted direction, 2026-09-12. This document specifies planned behavior, not shipped features.
Implementation order and acceptance checks live in TASKS.md. Architecture lives in .agents/architecture.md.

## 1. Product and audience

DemoForge turns a shipped feature into a source-linked, editable release-demo video of the real product.
The first audience is developers and small product teams building developer tools and web applications.
The value hypothesis is less time spent producing and updating credible demos; demand remains to be validated.
Do not promise investor-grade decks or superiority over competitors without evidence.

## 2. Inputs and outputs

Required inputs: a public GitHub URL pinned to a revision, a feature/audience brief, and an authorized
recording or demo environment. A repository alone is not proof that a feature runs.
Existing logos, licensed fonts, colors and screenshots are optional. Reuse supplied brand assets;
when absent, use neutral design tokens, not an invented identity.

The first local milestone accepts supplied footage and exports a 30-second, 16:9 MP4, a versioned
scene specification, an evidence report and an offline review page. The product target expands to
30-60 seconds and a browser scene editor. Controlled capture follows the supplied-footage milestone.
No automatic publication: export requires technical QA and human approval of the exact revision.

## 3. Product flow

1. Ingest bounded sources into quarantine, scan/redact, and create a versioned evidence catalog.
2. Draft source-linked claims and a scenario describing starting state, actions and observable result.
3. Ask the user to resolve missing evidence and approve claims and scenario.
4. Import authorized footage or execute an approved capture scenario; verify observations and privacy.
5. Build a storyboard using approved claims, reusable brand tokens and verified assets.
6. Review and revise captions, trims, ordering and brand controls; approve the storyboard revision.
7. Render, run technical gates, review the full result, and export the approved artifact.

Approval waits persist state and release workers. Missing inputs produce questions, not invented facts.
Changing captions must not reclone the repository or recapture footage.

## 4. Functional requirements

| ID | Requirement and acceptance condition |
|---|---|
| FR-01 | Pin repository revision; bound clone/file/download sizes and API timeouts; record source provenance. |
| FR-02 | Extract README/docs and manifests deterministically with source paths, line ranges and quotes. |
| FR-03 | Quarantine raw inputs; scan/redact before curated packs, model requests or logs; report skipped files. |
| FR-04 | Claims retain evidence IDs through narrative and displayed copy; distinguish documented, statically_supported, runtime_observed and user_attested. |
| FR-05 | Approvals bind to immutable claim/scenario/storyboard revisions; changes invalidate affected approvals. |
| FR-06 | Footage carries ownership/permission attestation, capture time, hash and source; supplied footage is always a fallback. |
| FR-07 | Scenarios specify preconditions, allowlisted actions, assertions, reset and sensitive regions; capture never executes arbitrary model-generated code. |
| FR-08 | Reuse brand assets and check text contrast; plain English/French copy lint excludes literal source code and commands. |
| FR-09 | Frame-based storyboards validate source bounds, scene contiguity, total duration, captions, safe areas and evidence references. |
| FR-10 | Local scene-spec editing precedes the React editor; browser editor supports preview, trims, captions, ordering, brand controls and revision history. |
| FR-11 | Checkpoint stages with atomic writes, bounded retries, cancellation, resume and input-based invalidation. |
| FR-12 | Export only after full decode, exact frame count, asset integrity, text/privacy checks and human review; audio peak <= -1 dBTP when present. |
| FR-13 | Hosted API enforces tenant authorization, quotas and scoped artifact access; queued jobs cannot rely on web-request lifetime. |

## 5. Security and reproducibility

Never automatically install dependencies or run submitted repositories. Initial capture supports trusted,
authorized demo environments only. Before accepting arbitrary hosted URLs, isolate capture jobs from
production secrets and private networks; enforce HTTP(S), DNS/redirect/IPv4/IPv6 egress restrictions,
resource limits and sandboxing. A normal container is not a complete hostile-browser boundary.
Treat repository text and websites as untrusted data, never agent instructions. Validate media and SVG;
do not run supplied scripts in trusted render templates. Public visibility is not a reuse license.

Raw data is quarantined with explicit access and retention limits, not promised secret-free storage.
Delete quarantine and sensitive recordings according to policy, including failure/cancellation paths.
Record hashes, schema/template/model versions, prompts and tool versions without exposing secrets.
Pinned rendering inputs support repeatability; live capture and model generation are not pixel-deterministic.
Generated HTML deliverables remain offline with local/system fonts and no CDN.

## 6. Delivery stages and exclusions

1. Local proof: Python/uv/Pydantic/Typer, SQLite run state, JSON artifacts, supplied footage,
	HTML overlays and FFmpeg, one aspect ratio, early evaluation fixtures.
2. Controlled capture: Playwright/Chromium scenarios and readiness assertions, reset and privacy gates.
3. Editing: React/TypeScript/Vite, TanStack Query and accessible controls. Benchmark Remotion against
	HTML overlays before selecting one production renderer; licensing and ADR approval are required.
	App branding and responsive workspace rules follow [docs/FRONTEND_DESIGN.md](docs/FRONTEND_DESIGN.md),
	independently of customer video branding. The frontend must reflect actual workflow and approval state.
4. Hosted beta: FastAPI/Uvicorn, PostgreSQL/SQLAlchemy/Alembic, private S3, managed identity (Clerk
	initial candidate), Celery/RabbitMQ, isolated Linux jobs, GitHub Actions and OpenTelemetry.
5. Validated expansion: saved release scenarios, stale-claim detection, GitHub App/private repositories,
	additional aspects and optional narration, then evidence-derived decks and documentation.

Defer logo generation, PPTX, investor decks, Figma integration, autonomous swarms, Hermes coupling,
vector databases, self-hosted models, generative video, Kubernetes and Kafka. No new infrastructure
is required merely to implement local contracts. AI starts with one provider SDK (OpenAI) behind a
small typed interface and FakeLLM; model choice is evaluation-driven. Pydantic AI is optional later.

## 7. Evaluation and release gates

Start with five representative authorized repositories/recordings and local negative fixtures for
missing evidence, invalid media, sensitive content, prompt injection and stage failure/recovery.
Track cost per accepted video (model + compute + storage + retries), correction time, capture success,
render failures, evidence coverage and whether users publish outputs. Record environment and inputs.
The former five-minute/$0.50 goals are benchmark hypotheses, not release promises.
No milestone is complete without its tests and documented acceptance checks passing in that session.
All changes require `uv run pytest tests -q`, `uv run ruff check .`, updated documentation and TASKS.md.
Media milestones additionally require real artifacts and printed gate measurements; vision/contact
sheets assist review but do not prove factual correctness, motion quality or full-frame privacy.
