# Architecture

## 1. Principle

Understanding first, generation second. Generators never create from nothing; they create from
`Evidence + Brand System + Design Constraints + Narrative`. Each generator is "X-as-code": a JSON spec, a deterministic renderer, a verification gate.

```
 GitHub URL / website / brand inputs
            |
   [Ingestion]  github_api . clone . file_classifier                 (deterministic)
            |
   [Extraction] readme . manifests . images . website . brand_signals . code_signals
            |
   [Quality]    secrets (redact) . scoring . banned_phrases
            |
   [Enrichment] llm . product_profile . narrative . style           (LLM, evidence-bound)
            |
   curated/context_pack.json  <-- the only input generators are allowed to read
            |
   +--------+---------+---------+
   brand    narrative  docs     (parallel, independent)
   +--------+---------+
   deck     video               (parallel, need brand + narrative)
   +--------+
   qa  -> qa_report.json, REVIEW.md
```

## 2. Data lake per run (`workspace/<run_id>/`)

```
raw/        repo/ (shallow clone)  api_responses/  websites/ (html, css, screenshots)
staging/    files.json  parsed_markdown/  parsed_code/  extracted_images/  website_dom/  website_css/  redactions.json
curated/    repository.json  facts.json  visual_assets.json  brand_signals.json  brand_kit.json
            product_profile.json  narrative_pack.json  motion_style.json  quality_report.json  context_pack.json
outputs/    brand/  deck/  video/  docs/  index.html  REVIEW.md
messages.jsonl   run.json
```
Raw is immutable. Staging may be regenerated. Curated is validated by Pydantic. Outputs are reproducible from curated + specs.

## 3. Module boundaries (`demoforge/`)

| Module | May import | Must not |
|---|---|---|
| `schemas/` | pydantic only | anything else |
| `ingest/`, `extract/` | schemas, stdlib, httpx, git, Pillow, markdown-it | `enrich/` (no LLM in extraction) |
| `quality/` | schemas | generators |
| `enrich/` | schemas, quality, `enrich/llm.py` | file system of raw/ directly (works from staging/curated) |
| `pack/` | schemas, quality | generators |
| `brand/`, `deck/`, `video/`, `docs_gen/` | schemas, quality, Jinja2, subprocess (ffmpeg, chrome, node) | `ingest/`, `extract/` (read packs only) |
| `swarm/` | everything above through their public `run(run_dir)` functions | internal helpers |

Each stage exposes `run(run_dir: Path, **options) -> Path` returning the artifact it wrote, and logs one `done` message on the bus.

## 4. Swarm protocol (blackboard)

No direct agent-to-agent calls. An agent reads the packs it depends on, writes its own pack or output, then appends one line to `messages.jsonl` (schema in `docs/DATA_CONTRACTS.md` section 13).

Roles and contracts:

| Role | Reads | Writes | Hard rules |
|---|---|---|---|
| orchestrator | messages.jsonl, quality_report | run plan, dispatch order, TASKS-like `run.json` status | never generates content; stops on `gate != pass` and asks the user |
| ingest | URL, inputs | repository, files, facts, visual_assets, quality_report | deterministic only |
| brand | brand_signals, visual_assets, user kit | brand_kit, `outputs/brand/` | logo-as-code procedure; reuse existing logo; MD5 export check |
| narrative | facts, product_profile | narrative_pack, motion_style | every claim has evidence; copy lint |
| deck | narrative, brand_kit, visual_assets | `outputs/deck/` | curated layouts; real assets; white default |
| video | narrative, brand_kit, visual_assets, captures | `outputs/video/` | EDL tests before render; gates |
| docs | facts, technical, code signals | `outputs/docs/` | only verified commands |
| qa | all outputs | qa_report, REVIEW.md | may `review_reject` once per role |

Stages: `ingest -> (brand || narrative || docs) -> (deck || video) -> qa`. Failure policy: a rejected output re-queues its role once with the critique attached; second failure escalates to the user. Human checkpoints: missing inputs (`ask_user`), brand approval when a logo was generated, final review.

Execution modes: in-process sequential (`demoforge run`), or Hermes subagents in parallel per stage (`swarm/hermes_runner.py` emits one task per role with the role prompt from `swarm/roles/<role>.md` plus pack paths).

## 5. Verification gates (code, not opinions)

- Packs: Pydantic validation; evidence required on facts and features.
- Copy: `quality.banned_phrases.assert_clean`.
- Logo: collision margins >= 0; size strip rendered; MD5 dedupe; look-alike vision prompt.
- Deck: slide count; no clipped text (screenshot + vision); offline integrity sweep.
- Video: `test_edl` before render; `ffprobe -count_frames == total_frames`; full decode 0 errors; true peak <= -1 dBTP; contact sheet read.
- Docs: every command traceable to a `Fact` with `verified_by`.

## 6. Decisions

- ADR-0001 `docs/decisions/ADR-0001-python-data-layer-html-renderers.md`
- ADR-0002 `docs/decisions/ADR-0002-sqlite-json-mvp.md`

## 7. Deferred (post-MVP)

FastAPI + Arq/Redis job queue; PostgreSQL + pgvector embeddings and knowledge graph; Next.js UI; GitHub App for private repos; Figma export; Remotion renderer; Prefect orchestration.
