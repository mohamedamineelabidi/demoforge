# DemoForge — Implementation Plan & Backlog

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task (one fresh subagent per task, spec review then quality review). Work in `C:\Users\hp\OneDrive - Université Abdelmalek Essaadi\Desktop\Demo_Builder`.

**Goal:** From a GitHub URL (+ optional website / brand kit), produce in one run: Product Profile, Brand Kit, 10-slide deck, 30-second motion teaser, one-page docs — all grounded in repo evidence, brand-consistent, and not "AI-looking".

**Architecture:** Understanding-first. A deterministic **data layer** (Python) builds an evidence-backed `context_pack.json`. A **swarm of specialist agents** (Hermes subagents, blackboard pattern: they read/write shared JSON packs and a `messages.jsonl` bus) generates narrative, brand, deck, video, docs. Every generator is *video-as-code / logo-as-code*: JSON spec → deterministic render → automated verification gates. No generation from nothing; only `Evidence + Brand System + Design Constraints + Narrative`.

**Tech stack:** Python 3.11 (`uv`), Pydantic v2, Typer CLI, httpx, GitPython, markdown-it-py, tree-sitter (later), Pillow/OpenCV, Playwright (Node) for capture + overlay rendering, ffmpeg/ffprobe, headless Chrome for SVG→PNG, python-pptx, SQLite (MVP) → PostgreSQL+pgvector (later), pytest, node:test.

**Working name:** DemoForge (rename = one constant in `demoforge/__init__.py`; final choice deferred to Phase 5 brand task).

---

## 0. What we already know (reuse, don't reinvent)

Hermes has proven these methods in earlier sessions — they are the product's secret sauce and must be ported as code + skills:

| Asset | Where it exists today | Ported to |
|---|---|---|
| Video-as-code EDL pipeline (`edit.json` → `assemble` → HTML overlay via Playwright → composite → SFX mix → verification gates) | `C:\Users\hp\smart-network-assistant\scripts\assemble-anim-v9.py`, `render-anim-v9.mjs`, `mix-anim-v9-merge.py`, `video_v8\tests\animation.spec.mjs`, `test_edl.py`; skill `demo-video-production` (+6 references) | `demoforge/video/` + skill `video-as-code` |
| Logo-as-code (parametric SVG via Python, collision math, 14/18/28/46 px survival strip, look-alike test, `getBBox()` lockup, MD5 export check) | `C:\Users\hp\netix_video\superpose-*\build.py`, `verify.py`; skill `svg-logo-design` | `demoforge/brand/logo/` + skill `logo-as-code` |
| Offline brand kit / deck HTML rules (no CDN, inlined SVG, integrity sweep) | `svg-logo-design/references/brand-kit-offline-and-cobranding.md`, `html-pitch-deck-builder`, `pitch-deck-from-template`, `popular-web-designs`, `apple-design` | `demoforge/deck/` + skill `deck-as-code` |
| User quality bar | memory: white decks, real screenshots not icons, data storytelling, no em-dashes in copy, no fake metrics, no accuracy %, offline HTML | `docs/QUALITY_BAR.md` + `demoforge/qa/banned_phrases.txt` |

Windows pitfalls already known (bake into `AGENTS.md`): native tools need `C:/` paths; `drawtext` Fontconfig crash → HTML overlays; background node dies on git-bash → foreground renders; Chrome `--screenshot` needs absolute paths and `file://` + `--disable-application-cache`; Playwright installed outside the repo in `$LOCALAPPDATA/Temp/demoforge-rig`.

---

## 1. Repository layout (target)

```
Demo_Builder/
  AGENTS.md                      # rules for any agent working in this repo (Hermes, Claude Code, Codex)
  README.md
  docs/
    VISION.md                    # the user's brief, cleaned (sections 1-6, 33, 35 of the draft)
    ARCHITECTURE.md              # data layer + swarm diagram
    DATA_CONTRACTS.md            # every pack schema, with examples
    QUALITY_BAR.md               # anti-AI-look rules, banned phrases, verification gates
    SWARM_PROTOCOL.md            # how agents talk (blackboard + messages.jsonl)
    BACKLOG.md                   # this task list, kept updated (status column)
    decisions/ADR-000x-*.md      # architecture decisions
  .hermes/
    plans/                       # this file
    skills/                      # repo-local skills (see §4)
  demoforge/                     # Python package
    __init__.py  cli.py  config.py
    schemas/     # Pydantic: repository, product_profile, brand_kit, visual_asset, fact, narrative, storyboard, deck, context_pack
    ingest/      # github_api.py clone.py file_classifier.py
    extract/     # readme.py manifests.py images.py website.py brand_signals.py code_signals.py
    enrich/      # llm.py (provider-agnostic), product_profile.py, narrative.py, facts.py
    quality/     # scoring.py secrets.py banned_phrases.py
    pack/        # context_pack.py (assemble curated/ → context_pack.json)
    brand/       # logo/ (parametric SVG), tokens.py, kit_page.py
    deck/        # slides.py layouts/ html_deck.py pptx_export.py pdf_export.py
    video/       # edl.py assemble.py overlay/ (overlay.html + render_overlay.mjs) mix.py verify.py capture/
    docs_gen/    # markdown_docs.py html_docs.py
    swarm/       # blackboard.py bus.py roles/ (orchestrator, ingest, brand, narrative, deck, video, docs, qa)
  tests/         # pytest mirrors package; fixtures/ has a tiny sample repo
  workspace/     # runtime data (gitignored): raw/ staging/ curated/ outputs/ per run_id
  scripts/       # dev helpers: install_rig.sh, run_sample.sh
  pyproject.toml  .gitignore  .env.example
```

Data lake per run: `workspace/<run_id>/{raw,staging,curated,embeddings,outputs}` exactly as in draft §13.

---

## 2. Swarm design (summary; full text goes to docs/SWARM_PROTOCOL.md in Task 7)

**Pattern:** Blackboard. No agent calls another directly. Each agent:
1. reads `workspace/<run>/curated/*.json` it depends on,
2. writes its own pack,
3. appends to `workspace/<run>/messages.jsonl`: `{"ts","from","to","type":"done|need|blocker|review","subject","refs":[paths]}`.

**Roles** (each becomes a Hermes subagent prompt in `demoforge/swarm/roles/*.md` and a repo skill):

| Role | Reads | Writes | Hard rules |
|---|---|---|---|
| Orchestrator | messages.jsonl, quality report | run plan, dispatch order | Never generates content; stops the run if `quality.overall < 0.6` and asks user for missing inputs |
| Ingest | GitHub URL | repository.json, files.json, facts.json, visual_assets.json | Deterministic only, no LLM |
| Brand | visual_assets, website css, user kit | brand_kit.json, logo family, brand.html | Logo-as-code procedure; MD5 check on exports |
| Narrative | facts, product_profile | narrative_pack.json (problem/solution/features with `evidence`+`confidence`) | Every claim has a source line; banned-phrase lint |
| Deck | narrative, brand, visual_assets | deck.html, deck.pdf, deck.pptx | Curated layouts only; real screenshots; white background default |
| Video | narrative, brand, visual_assets, captures | edit.json → final.mp4 + README | EDL tests pass before render; gates §Step 8 |
| Docs | facts, code_signals | docs/*.md, docs site html | Only documented commands verified against manifests |
| QA | all outputs | qa_report.json | Runs gates; can `review:reject` an output, which re-queues that role once |

MVP orchestration = `demoforge run <url>` running roles sequentially in-process; Hermes `delegate_task` batch mode used for Brand/Narrative/Docs in parallel once packs exist (they are independent), then Deck+Video in parallel, then QA.

---

## 3. Phased backlog

Status legend: ☐ todo · ◐ in progress · ☑ done. Each task ≈ 2–20 min for a subagent. Commit after every task (`git commit -m "<type>: <task>"`, private repo per user convention → `github-project-routine` skill).

### Phase 0 — Repo foundation & instruction files (Tasks 1–9)

**Task 1 — Init repo + tooling**
Files: `pyproject.toml`, `.gitignore` (add `workspace/`, `.venv/`, `node_modules/`, `*.mp4`, `*.mov`), `.env.example` (`GITHUB_TOKEN=`, `LLM_PROVIDER=`, `LLM_API_KEY=`, `DEMOFORGE_RIG=`), `README.md` (one paragraph + quickstart).
Steps: `uv init --package demoforge`; add deps `pydantic>=2 typer httpx gitpython markdown-it-py pillow pyyaml python-dotenv`; dev `pytest pytest-cov ruff`. `git init`, private GitHub repo via `gh repo create --private` (per github-project-routine skill).
Verify: `uv run pytest -q` → "no tests ran" exit 5 accepted; `uv run demoforge --help` prints.

**Task 2 — `AGENTS.md`**
Content: language (Python 3.11 via uv; Node only for Playwright), commands (`uv run pytest tests -q`, `uv run ruff check .`), Windows rules (from §0), non-negotiables: no fabricated facts, no fake metrics, no em-dashes in generated copy, offline HTML, verify exports by hash/ffprobe, never commit `workspace/`. Points to `docs/QUALITY_BAR.md` and `docs/SWARM_PROTOCOL.md`.
Verify: file exists, < 200 lines, linked from README.

**Task 3 — `docs/VISION.md`** — Clean rewrite of the draft (product promise, users, inputs/outputs, differentiator §33/§35, MVP demo §32). No tooling detail.

**Task 4 — `docs/QUALITY_BAR.md` + `demoforge/quality/banned_phrases.txt`**
Banned: revolutionize, unleash, game-changing, next-generation, supercharge, unlock the power, seamless, cutting-edge, empower, leverage (verb), "—" (em-dash). Design rules from draft §29 + user memory (white deck, real screenshots, one message per slide/scene, easing easeInOutCubic/easeOutQuint, zoom ≤1.5×, cut rhythm 2–3 s, sparse SFX ≤14/min).
Test: `tests/quality/test_banned_phrases.py` → `lint_copy("Supercharge your agents — now")` returns 2 violations.

**Task 5 — `docs/DATA_CONTRACTS.md`** — Paste and normalize the 8 entities from draft §10 + Agent Context Pack §15 + quality report §16. Mark required vs optional. This is the spec for Task 10.

**Task 6 — `docs/ARCHITECTURE.md`** — Draft §34 diagram + layered lake §13 + pipeline §11 + MVP path §25. Include ADR-0001 "Python data layer, HTML/Playwright renderers, no Remotion for MVP" and ADR-0002 "SQLite+JSON files for MVP, Postgres+pgvector later".

**Task 7 — `docs/SWARM_PROTOCOL.md`** — §2 above, message schema, role table, failure/retry policy (one re-queue per reject), and the human-in-the-loop points (missing inputs, brand approval, final review).

**Task 8 — `docs/BACKLOG.md`** — This task list as a table with Status/Owner/PR columns. Orchestrator updates it.

**Task 9 — Repo-local skills scaffold** (`.hermes/skills/<name>/SKILL.md`, see §4) — create the 7 skill files with frontmatter + workflow bullets; content is filled/patched as phases complete. Verify: `skills_list` shows them when Hermes runs from this folder.

### Phase 1 — Data ingestion → Agent Context Pack v1 (Tasks 10–22)

**Task 10 — Pydantic schemas** `demoforge/schemas/*.py` for RepositoryEntity, VisualAssetEntity, DocumentationFact (`claim, evidence{file,line}, confidence, verified_by[]`), ProductProfile, BrandKit, NarrativePack, Storyboard/Scene, DeckSpec/Slide, QualityReport, ContextPack.
Test: `tests/schemas/test_roundtrip.py` — load each example JSON from `docs/DATA_CONTRACTS.md` → model → dump equals input.

**Task 11 — Run workspace** `demoforge/config.py` + `demoforge/pack/run.py`: `Run.create(url)` → `workspace/<slug>-<yyyymmdd-hhmm>/{raw,staging,curated,outputs}`, `run.json` manifest.
Test: dirs exist; second call gives different id.

**Task 12 — GitHub metadata** `demoforge/ingest/github_api.py` (`httpx`, token optional, handles 403 rate-limit with clear error): repo, topics, languages, license, releases(latest), homepage, stars/forks → `raw/api_responses/*.json` + `curated/repository.json`.
Test: mocked responses via `respx`; live smoke on `https://github.com/tiangolo/typer` gated by env `DEMOFORGE_LIVE=1`.

**Task 13 — Shallow clone** `demoforge/ingest/clone.py`: `git clone --depth 1` into `raw/repo/`, records commit sha; skip if exists.
Test: clone `tests/fixtures/sample_repo` (a local git repo created by a fixture).

**Task 14 — File classifier** `demoforge/ingest/file_classifier.py`: walk tree honoring ignore list (§17), classify into 15 categories with priority high/med/low → `staging/files.json`.
Test: fixture tree classifies README→readme/high, `package.json`→manifest/high, `dist/x.js`→ignored.

**Task 15 — README/docs extraction** `demoforge/extract/readme.py` (markdown-it-py AST): headings tree, paragraphs, code blocks (lang, text), images (src, alt), badges, links, install/usage sections by heading heuristics → `staging/parsed_markdown/*.json` + facts with `evidence.line`.
Test: fixture README yields `install_command="pip install sample"` fact with line number.

**Task 16 — Manifest extraction** `demoforge/extract/manifests.py`: `package.json`, `pyproject.toml`, `requirements.txt`, `Cargo.toml`, `go.mod`, `Dockerfile`, `docker-compose.yml`, `.env.example` (keys only, never values) → tech stack inference table (§Stage 5) + `verified_by` cross-check of install commands.
Test: pyproject with `fastapi` → `backend:["fastapi"]`; README install verified_by pyproject name.

**Task 17 — Secret scanner** `demoforge/quality/secrets.py`: regex set (AWS, GitHub tokens, JWT, private keys, `://user:pass@`) run over every text file → redact in staging, list in `quality/secrets.json`.
Test: fixture containing `ghp_XXXX…` → redacted, flagged; nothing leaks into any curated file (assert by grep).

**Task 18 — Image asset extraction** `demoforge/extract/images.py`: collect png/jpg/webp/svg/gif from repo + README image URLs; Pillow: size, aspect, dominant colors (k-means 5), blur score (Laplacian var, OpenCV), perceptual hash dedupe; heuristics screenshot vs logo (aspect + size + filename) → `curated/visual_assets.json`, copies in `staging/extracted_images/`.
Test: fixture images → 1 logo, 1 screenshot, duplicate removed, `usable_in_deck` true when min side ≥ 800.

**Task 19 — Website capture (Playwright)** `demoforge/extract/website.py` + `demoforge/video/capture/capture_site.mjs`: if homepage exists → desktop 1920×1080 + mobile 390×844 screenshots (viewport + full page), DOM text (h1/h2, CTAs), meta/OG image, favicon, computed CSS vars + fonts → `raw/websites/`, `staging/website_dom/`, `staging/website_css/`. Rig install script `scripts/install_rig.sh` (Playwright in `$LOCALAPPDATA/Temp/demoforge-rig`).
Test: run against a local static fixture served by `python -m http.server`; assert PNG exists and `dominant h1` extracted.

**Task 20 — Brand signals** `demoforge/extract/brand_signals.py`: colors from CSS vars + screenshot palette, fonts from CSS, logo candidate (svg in repo / site header img / favicon), style tags (dark-mode, gradient-heavy, minimal…) → `curated/brand_signals.json`.
Test: fixture css `--primary:#0A84FF` → primary detected; missing site → falls back to README logo/palette.

**Task 21 — Quality scoring** `demoforge/quality/scoring.py`: completeness over required ContextPack fields, evidence coverage, asset usability → `curated/quality_report.json` with `missing_fields`, `warnings`, `questions_for_user`.
Test: pack with no screenshots → warning "Only N screenshots" and `overall < 0.7`.

**Task 22 — Context Pack v1 + CLI** `demoforge/pack/context_pack.py`, `demoforge ingest <url> [--site URL] [--out DIR]` → `curated/context_pack.json`. Product profile at this stage is heuristic (name/description/topics/install) — LLM enrichment comes in Phase 3.
Verify: `uv run demoforge ingest https://github.com/tiangolo/typer` finishes < 2 min, pack validates, `quality_report.json` produced. Commit tag `v0.1-context-pack`.

### Phase 2 — Brand Kit v1 (Tasks 23–29)

**Task 23 — Port logo-as-code engine** `demoforge/brand/logo/mark.py`: parametric `MARK(col, cx, cy, sc, w)` pattern from `netix_video/superpose-directions/build.py`, generalized: a `LogoSpec` (primitives ≤5, grid 100, single stroke weight `SW`, ratios) → SVG string; `collisions(spec)` returns margins; refuses render if any margin < 0.
Test: sample spec margin math; negative margin raises.

**Task 24 — Export + verification** `demoforge/brand/logo/export.py`: SVG → PNG via headless Chrome wrapper page (`file://`, `--disable-application-cache`, unique wrapper filenames, absolute `--screenshot`), family (lockup light/dark/accent/transparent, icon ×4, app icon, favicon 16/32), size strip 46/28/18/14, MD5 dedupe assert.
Test: exported set has no duplicate hashes; strip PNG exists.

**Task 25 — Lockup measurement** `demoforge/brand/logo/measure.py`: inline SVG in wrapper, `getBBox()` after `document.fonts.ready` via Playwright `page.evaluate`, returns markCy/textCy/gap; auto-sets viewBox width so margins equal.
Test: mocked bbox → viewBox computed; live test skipped without rig.

**Task 26 — Look-alike gate (vision)** `demoforge/brand/logo/lookalike.py`: builds contact sheet, calls vision model with the explicit "does it resemble RSS/wifi/power/menu/lens/pin/bluetooth/share?" prompt, parses verdict → `brand/logo/review.json`. Concentric arcs banned by rule before vision.
Test: spec with arcs → rejected pre-vision.

**Task 27 — Design tokens** `demoforge/brand/tokens.py`: brand_signals + user kit (`--brand-kit kit.json`) → `curated/brand_kit.json` (schema §10.3 + design system §20: spacing scale, radii, type scale, motion durations, `do_not_use`). Contrast check WCAG ≥4.5 for text pairs; auto-adjust or warn.
Test: low-contrast pair → warning + adjusted secondary.

**Task 28 — Brand page** `demoforge/brand/kit_page.py`: offline `brand.html` (inlined SVG, no CDN): lockups on both backgrounds, rationale, size strip, palette hex, type, ✓/✗ rules, downloads (zip with `svg/`,`png/`,`README.txt`). Integrity sweep: every referenced file exists.
Test: sweep returns 0 missing; HTML has no `http(s)://` in `src/href` except repo links.

**Task 29 — `demoforge brand <run>` CLI + Brand role prompt** (`demoforge/swarm/roles/brand.md`): Mode A (auto from signals) vs Mode B (user kit; if a logo is provided, skip generation and only build tokens/page). Update skill `logo-as-code`.
Verify: brand kit for typer run produced in < 3 min; the logo procedure log lists rejected candidates.

### Phase 3 — Narrative Pack v1 (Tasks 30–35)

**Task 30 — LLM abstraction** `demoforge/enrich/llm.py`: provider-agnostic `complete(system, user, schema)` with JSON-schema-validated output, retries, cost log; providers: openai-compatible, anthropic; offline `FakeLLM` for tests reading canned fixtures.
Test: FakeLLM returns fixture; schema violation → one retry then error.

**Task 31 — Fact-grounded product profile** `demoforge/enrich/product_profile.py`: prompt receives only README chunks + manifests + topics; output ProductProfile where each feature has `evidence` (file+line quoted) and `confidence`; features without evidence dropped.
Test: FakeLLM output with one unevidenced feature → filtered out, warning logged.

**Task 32 — Narrative pack** `demoforge/enrich/narrative.py`: problem/solution/value prop/tagline (3 options)/hero headline; three arcs (investor 60 s, developer 60 s, customer 30 s) using `NarrativeArc` structures; audience from `--audience` flag or inferred.
Test: output passes banned-phrase lint; each arc sums to duration.

**Task 33 — Copy lint gate** wire `quality/banned_phrases.py` into enrich outputs; hard fail → regenerate once with violations listed in prompt.
Test: FakeLLM first returns "Supercharge", second clean → accepted on retry.

**Task 34 — Style archetype selector** `demoforge/enrich/style.py`: rules table (topics/category/brand dark-mode → `minimal_saas | developer_infra | ai_native | enterprise | open_source_friendly`) + `--style` override → `curated/motion_style.json` + deck style id. Style corpus as data: `demoforge/deck/layouts/styles/*.json` (draft §21, no brand assets copied).
Test: topics `["cli","developer-tools"]` → developer_infra.

**Task 35 — `demoforge narrate <run>` + Narrative role prompt + skill `grounded-narrative`.** Verify on typer run: profile + narrative validate, every feature cites README lines.

### Phase 4 — Deck generation (Tasks 36–43)

**Task 36 — Slide spec** `demoforge/deck/slides.py`: NarrativePack + brand + assets → `DeckSpec` of 10 slides (title, problem, solution, how it works, demo screenshot, feature grid (max 4), architecture/tech, use cases, install/CTA, closing). Each slide: one headline (≤ 8 words), ≤ 3 points, one real asset or none.
Test: 10 slides, no slide > 3 points, every asset path exists.

**Task 37 — Curated layouts** `demoforge/deck/layouts/*.html` (Jinja2): hero_statement, split_text_image, feature_grid_4, screenshot_full, code_block, closing. 12-col grid, spacing from tokens, white default, fonts from kit (local woff or system stack; no CDN).
Test: render each layout with sample data → HTML contains no `undefined`/empty headline.

**Task 38 — HTML deck** `demoforge/deck/html_deck.py`: one offline `deck.html` (keyboard nav, 16:9 scaling), inlined CSS/SVG.
Test: file self-contained (no external URLs); 10 `<section>`.

**Task 39 — PDF export** via headless Chrome `--print-to-pdf` with `@page{size:1920px 1080px}`; verify page count = slides (pypdf).
**Task 40 — PPTX export** `python-pptx`: layouts mapped to shapes/text/images; verify opens and slide count = 10.
**Task 41 — Deck visual QA** `demoforge/qa/deck_review.py`: screenshot each slide, contact sheet, vision critique prompt ("generic AI look? clipped text? weak hierarchy?"), score → `qa_report.deck`. Fail → Deck role re-runs with critique.
**Task 42 — `demoforge deck <run>` + Deck role prompt + skill `deck-as-code`.**
**Task 43 — Milestone demo #1:** `demoforge run <url> --until deck` → profile + brand + deck for typer. Tag `v0.2-deck`.

### Phase 5 — Motion teaser (Tasks 44–53)

**Task 44 — Port EDL model** `demoforge/video/edl.py` from `assemble-anim-v9.py` structures: fps, canvas, frames per layout (`graphic|desktop|phone|passthrough`), scenes with `source_in_seconds`, `duration_frames`, chapter, caption, zoom keyframes, spotlight, masks; `tests/video/test_edl.py` ported (contiguity, sum, spotlight in scene, zoom ≤ 1.5, sources exist).
**Task 45 — Storyboard generator** `demoforge/video/storyboard.py`: NarrativeArc (30 s customer) + assets → `edit.json` (10 scenes pattern §6.5: problem typography → logo reveal → homepage → zoom feature → install command → code → CTA). Captions ≤ 7 words, lint-passed. Scenes using screenshots as stills (Ken Burns via zoom keyframes) when no recording exists.
Test: generated EDL passes test_edl.
**Task 46 — Product capture** `demoforge/video/capture/record_site.mjs`: Playwright `recordVideo` of homepage + scroll + docs page, timecoded events log → `raw/captures/`. Optional; storyboard uses it when present.
**Task 47 — Assemble** `demoforge/video/assemble.py` ported: trim → masks (blur bounded `r≤min(24,h//6,w//6)`) → zoom crop expr with ease-out → rounded window + shadow on canvas → per-scene `libx264 -crf 16` → concat → `base.mp4`; verify `nb_read_frames == total_frames`.
**Task 48 — Overlay** `demoforge/video/overlay/overlay.html` (+ `render_overlay.mjs`) ported: `configureTimeline(edit)`, `renderFrame(n)`, brand tokens injected as CSS vars, 14-frame fade in / 8-frame out, spotlight ring during hold; Playwright loops frames → `overlay.mov` (qtrle argb). `tests/video/animation.spec.mjs` ported (no overlay pixels in window region, ring only during hold, fonts/logo load).
**Task 49 — Composite + sound** `mix.py` ported: `visual-events.json` (tick/swish/brand), synth 48 kHz, ≤14 cues/min, true peak ≤ −1 dBTP (ebur128 check); mux AAC 192k.
**Task 50 — Verification gates** `demoforge/video/verify.py`: full decode 0 errors, frame count, duration, loudness, contact sheet of final + vision read (blank frames, clipped window), privacy list masked → `qa_report.video`.
**Task 51 — Aspect variants** 9:16 and 1:1 by EDL `frames` presets (same scenes, different window rects). Test: three renders share total_frames.
**Task 52 — `demoforge video <run>` + Video role prompt + skill `video-as-code` (port `demo-video-production` references, strip Superpose specifics).**
**Task 53 — Milestone demo #2:** 30 s teaser for typer, delivered with `outputs/video/README.md` (scene table, verification numbers, reproduce commands). Tag `v0.3-teaser`.

### Phase 6 — Documentation (Tasks 54–58)

**Task 54 — Code signals** `demoforge/extract/code_signals.py`: Python `ast` (entry points, CLI commands via typer/click/argparse, public functions + docstrings), TS via regex/tree-sitter later; env vars from `.env.example`; API routes (FastAPI/Express decorators) → `curated/technical_graph.json`.
**Task 55 — Docs generator** `demoforge/docs_gen/markdown_docs.py`: Overview, Installation (verified command only), Quickstart (from README examples), Configuration (env keys), CLI/API reference (from code signals), FAQ (from issues titles if API allows), each section footnoted with source file.
**Task 56 — HTML docs site** offline single page with sidebar (MkDocs-like), brand tokens. **Task 57 — Docs QA**: every command in docs exists in facts with `verified_by`; banned-phrase lint. **Task 58 — `demoforge docs <run>` + Docs role prompt.** Tag `v0.4-docs`.

### Phase 7 — Swarm orchestration & product surface (Tasks 59–66)

**Task 59 — Blackboard + bus** `demoforge/swarm/blackboard.py`, `bus.py` (append/read `messages.jsonl`, typed messages).
**Task 60 — Orchestrator** `demoforge/swarm/orchestrator.py`: DAG ingest → (brand ∥ narrative ∥ docs) → (deck ∥ video) → qa; stop-and-ask when `quality_report.questions_for_user` non-empty; one retry on `review:reject`.
**Task 61 — Hermes runner** `demoforge/swarm/hermes_runner.py`: emits `delegate_task` batch specs (goal+context = role prompt + pack paths) so Hermes can run the parallel stages as real subagents; in-process fallback.
**Task 62 — QA role** aggregates gate outputs into `qa_report.json` + human-readable `REVIEW.md` with contact sheets.
**Task 63 — `demoforge run <url> [--site] [--brand-kit] [--audience] [--style] [--duration 30]`** end-to-end; `outputs/index.html` launcher linking deck/video/docs/brand.
**Task 64 — Evaluation set** `evals/repos.txt` (5 public repos: CLI, web app, library, AI framework, mobile) + `evals/run_all.py` recording draft §30 metrics (completeness, asset usability, latency, cost, failure rate) to `evals/results.csv`.
**Task 65 — Product's own brand + demo** (dogfood): run DemoForge on itself; choose final name from shortlist (DemoForge / RepoToDemo / LaunchGraph / StoryRepo) using logo-as-code look-alike + domain check. **Task 66 — README + release v0.5** with the dogfooded video embedded.

### Later (not MVP, tracked only)
FastAPI service + job queue (Arq/Redis), Postgres+pgvector embeddings & knowledge graph (§Stage 10–11), Next.js UI, private repos via GitHub App, Figma export, Remotion renderer, Prefect orchestration.

---

## 4. Repo-local skills to create (`.hermes/skills/`)

| Skill | Trigger / content |
|---|---|
| `demoforge-dev` | How to work in this repo: commands, run layout, where packs live, how to add a stage; links AGENTS.md |
| `context-pack-ingest` | Running/debugging ingestion, reading `quality_report.json`, adding an extractor with evidence+confidence |
| `logo-as-code` | The 9-step procedure (primitives ≤5, SW ratios, collision math, render & look, 14 px strip, look-alike, getBBox lockup, MD5) — ported from `svg-logo-design` |
| `grounded-narrative` | Prompt shape, evidence rules, banned phrases, arcs per audience, retry-on-lint |
| `deck-as-code` | Layout catalogue, one-message-per-slide, white default, real assets, offline HTML, export + vision QA |
| `video-as-code` | EDL recipe Steps 1–9 (from the session), Windows pitfalls, gates — ported from `demo-video-production` |
| `swarm-roles` | Role prompts, message protocol, when to reject, when to ask the user |

Each role prompt in `demoforge/swarm/roles/*.md` starts with the draft §28 framing: "Use only the provided facts, assets and brand system. Do not invent features. No clichés. Prefer real screenshots and concrete details."

---

## 5. Tests / validation strategy

- `uv run pytest tests -q` green at every task; fixtures = tiny local git repo + static site, no network by default (`DEMOFORGE_LIVE=1` enables live smoke).
- Node tests: `node --test demoforge/video/overlay/tests/`.
- Gates are code, not opinions: EDL tests, frame counts, ebur128, MD5 dedupe, banned-phrase lint, evidence coverage, integrity sweeps.
- Vision checks (deck/logo/video contact sheets) are the only subjective gate; their prompts are fixed in code so they are repeatable.
- Milestones: v0.1 context pack → v0.2 deck → v0.3 teaser → v0.4 docs → v0.5 end-to-end dogfood.

## 6. Risks, tradeoffs, open questions

- **Repos without screenshots or website** → outputs degrade to typography + terminal scenes; quality gate must ask the user for assets instead of faking UI (rule, not option).
- **LLM cost/latency**: keep deterministic extraction first; LLM only in Phase 3 + QA critiques. Budget target < $0.50 and < 5 min per repo in evals.
- **Windows/MSYS**: renders foreground only; Playwright rig outside repo; native path rules. All in AGENTS.md.
- **Logo generation for someone else's product** is risky when the repo already has a logo → default Mode B (reuse), generate only when none exists, and label it "proposed".
- **Licensing**: respect repo license in outputs footer; never scrape sites blocking robots for capture.
- Open: final product name; LLM provider default (Copilot models available via Hermes vs API key); whether PPTX export is MVP or v0.6 (recommend keep, python-pptx is cheap).

## 7. Next action after approval

Execute Phase 0 (Tasks 1–9) in one subagent batch (they are independent after Task 1), then Phase 1 sequentially per task with spec + quality review.
