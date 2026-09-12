# Project Task Tracker

Live backlog and state machine. Updated in the same commit as the code it describes. Phases and details: `.hermes/plans/2026-09-12_100000-demoforge-backlog.md`. Rules: `AGENTS.md`.

## Current sprint focus
**Objective:** Phase 0, repository foundation and governance files, then Phase 1 data ingestion to Agent Context Pack v1.

---

### Active (In Progress)
- [ ] **TASK-010**: Pydantic schemas for every pack (`demoforge/schemas/`) with round-trip tests
  - *Current step:* not started.
  - *Target verification:* `uv run pytest tests/schemas -q` green; every example in `docs/DATA_CONTRACTS.md` validates.

---

### Backlog (Pending)

#### Phase 1: ingestion to Context Pack v1
- [ ] **TASK-011**: Run workspace (`workspace/<run_id>/{raw,staging,curated,outputs}`, `run.json`)
- [ ] **TASK-012**: GitHub metadata via API (`ingest/github_api.py`), mocked tests, opt-in live smoke
- [ ] **TASK-013**: Shallow clone (`ingest/clone.py`)
- [ ] **TASK-014**: File classifier with ignore/priority rules (`ingest/file_classifier.py`)
- [ ] **TASK-015**: README/docs extraction with line-level evidence (`extract/readme.py`)
- [ ] **TASK-016**: Manifest extraction + tech stack inference + install cross-verify (`extract/manifests.py`)
- [ ] **TASK-017**: Secret scanner and redaction (`quality/secrets.py`)
- [ ] **TASK-018**: Image asset extraction and scoring (`extract/images.py`)
- [ ] **TASK-019**: Website capture with Playwright (`extract/website.py`, `video/capture/capture_site.mjs`, `scripts/install_rig.sh`)
- [ ] **TASK-020**: Brand signals (`extract/brand_signals.py`)
- [ ] **TASK-021**: Quality scoring and questions for user (`quality/scoring.py`)
- [ ] **TASK-022**: Context Pack v1 + `demoforge ingest` CLI; tag `v0.1-context-pack`

#### Phase 2: Brand Kit v1
- [ ] **TASK-023**: Parametric logo engine with collision math (`brand/logo/mark.py`)
- [ ] **TASK-024**: Logo export family + size strip + MD5 dedupe (`brand/logo/export.py`)
- [ ] **TASK-025**: Lockup measurement via getBBox (`brand/logo/measure.py`)
- [ ] **TASK-026**: Look-alike vision gate (`brand/logo/lookalike.py`)
- [ ] **TASK-027**: Design tokens + WCAG contrast (`brand/tokens.py`)
- [ ] **TASK-028**: Offline brand page + zip + integrity sweep (`brand/kit_page.py`)
- [ ] **TASK-029**: `demoforge brand` CLI, Brand role prompt, skill update

#### Phase 3: Narrative Pack v1
- [ ] **TASK-030**: Provider-agnostic LLM with schema validation and FakeLLM (`enrich/llm.py`)
- [ ] **TASK-031**: Evidence-grounded product profile (`enrich/product_profile.py`)
- [ ] **TASK-032**: Narrative pack and audience arcs (`enrich/narrative.py`)
- [ ] **TASK-033**: Copy lint gate with one regeneration
- [ ] **TASK-034**: Style archetype selector + style corpus data (`enrich/style.py`)
- [ ] **TASK-035**: `demoforge narrate` CLI, Narrative role prompt, skill grounded-narrative

#### Phase 4: Deck
- [ ] **TASK-036**: Slide spec generator, 10 slides (`deck/slides.py`)
- [ ] **TASK-037**: Curated Jinja2 layouts (`deck/layouts/`)
- [ ] **TASK-038**: Offline HTML deck (`deck/html_deck.py`)
- [ ] **TASK-039**: PDF export via headless Chrome, page count check
- [ ] **TASK-040**: PPTX export via python-pptx
- [ ] **TASK-041**: Deck visual QA with vision critique (`qa/deck_review.py`)
- [ ] **TASK-042**: `demoforge deck` CLI, Deck role prompt, skill deck-as-code
- [ ] **TASK-043**: Milestone demo 1: `demoforge run <url> --until deck`; tag `v0.2-deck`

#### Phase 5: Motion teaser
- [ ] **TASK-044**: EDL model + ported `test_edl.py` (`video/edl.py`)
- [ ] **TASK-045**: Storyboard generator to `edit.json` (`video/storyboard.py`)
- [ ] **TASK-046**: Product capture with Playwright recordVideo (`video/capture/record_site.mjs`)
- [ ] **TASK-047**: Assemble base picture with ffmpeg (`video/assemble.py`)
- [ ] **TASK-048**: HTML overlay renderer + Playwright frame loop + node tests (`video/overlay/`)
- [ ] **TASK-049**: Composite + synthesized SFX mix + loudness (`video/mix.py`)
- [ ] **TASK-050**: Verification gates (`video/verify.py`)
- [ ] **TASK-051**: 9:16 and 1:1 variants
- [ ] **TASK-052**: `demoforge video` CLI, Video role prompt, skill video-as-code
- [ ] **TASK-053**: Milestone demo 2: 30 s teaser + outputs README; tag `v0.3-teaser`

#### Phase 6: Documentation
- [ ] **TASK-054**: Code signals extraction (`extract/code_signals.py`)
- [ ] **TASK-055**: Markdown docs generator with source footnotes (`docs_gen/markdown_docs.py`)
- [ ] **TASK-056**: Offline HTML docs site (`docs_gen/html_docs.py`)
- [ ] **TASK-057**: Docs QA: every command verified, copy lint
- [ ] **TASK-058**: `demoforge docs` CLI, Docs role prompt; tag `v0.4-docs`

#### Phase 7: Swarm and product surface
- [ ] **TASK-059**: Blackboard + message bus (`swarm/blackboard.py`, `swarm/bus.py`)
- [ ] **TASK-060**: Orchestrator DAG with stop-and-ask and one retry (`swarm/orchestrator.py`)
- [ ] **TASK-061**: Hermes runner emitting delegate_task batches (`swarm/hermes_runner.py`)
- [ ] **TASK-062**: QA role aggregating gates into `qa_report.json` + `REVIEW.md`
- [ ] **TASK-063**: `demoforge run <url>` end to end + `outputs/index.html`
- [ ] **TASK-064**: Evaluation set of 5 repos + metrics CSV (`evals/`)
- [ ] **TASK-065**: Dogfood: run on this repo, choose final product name, own brand
- [ ] **TASK-066**: README with dogfood video, release v0.5

---

### Completed
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
