# Product Requirements Document (PRD)

## 1. Executive summary

- **Product name:** DemoForge (working name; final name decided in TASK-065).
- **Core value proposition:** Turn a GitHub repository into a startup-quality demo video, an investor-grade presentation, polished documentation and a consistent brand kit, generated from the real product and looking human-made.
- **Differentiator:** Not "we generate videos with AI" but "we understand the product deeply from the repository, extract its real brand and UI, and generate launch-quality assets that look human-made". Understanding comes first; generation is constrained by evidence, brand system, design rules and narrative strategy.
- **Target users:** founders (investor decks, launch videos), developers and open-source maintainers (showcase without design skills), product teams (release demos), agencies and freelancers (client deliverables faster).

## 2. Problem

Founders and developers have a working product, a repository, a README, screenshots and code, but not a demo video, a professional deck, a clear narrative, a consistent identity or launch-ready docs. Existing AI tools produce generic, robotic content disconnected from the real product.

## 3. Inputs

| Input | Required | Notes |
|---|---|---|
| GitHub repository URL | yes | public in MVP; private via token later |
| Product website URL | no | inferred from repo homepage when present |
| Brand kit (logo, colors, fonts, guidelines, screenshots, Figma tokens) | no | Mode B: user kit overrides extracted signals |
| Target audience | no | investors, developers, customers, enterprise |
| Style preference, tone, language | no | style archetype selector otherwise |
| Video duration, aspect ratio | no | defaults 30 s, 16:9; also 9:16 and 1:1 |

## 4. Outputs

- **A. Motion demo video:** 30 s teaser (MVP), 60 s demo and 2 min walkthrough later; 16:9, 9:16, 1:1; product choreography (real screenshots, zoom, callouts, terminal typing), not a slideshow.
- **B. Presentation deck:** 10 slides (MVP); HTML (offline), PDF, PPTX.
- **C. Documentation:** overview, installation, quickstart, configuration, CLI/API reference, FAQ; Markdown + offline HTML site.
- **D. Brand kit:** logo family (or reuse of the existing logo), palette, typography, spacing, radii, motion style, tone of voice, do/don't rules, offline brand page.
- **E. Marketing assets (later):** tagline options, landing copy, social posts, README improvements.

## 5. Functional requirements

### Data layer (Phase 1)
- **FR-1** Ingest a GitHub URL: metadata via API, shallow clone, file classification with ignore rules.
- **FR-2** Extract README/docs structure (headings, code blocks, images, install and usage sections) with line-level evidence.
- **FR-3** Extract manifests and infer tech stack; cross-verify install commands.
- **FR-4** Extract and score visual assets (size, palette, blur, duplicates, screenshot vs logo).
- **FR-5** Capture the product website (desktop + mobile screenshots, DOM headings, CSS colors and fonts, favicon, OG image).
- **FR-6** Scan and redact secrets before anything reaches curated data.
- **FR-7** Produce a quality report (completeness, evidence coverage, missing fields, questions for the user) and an Agent Context Pack.

### Brand (Phase 2)
- **FR-8** Mode A auto brand kit from extracted signals; Mode B merge user kit. Reuse an existing logo when present; generate a proposed logo-as-code only when none exists.
- **FR-9** Logo generation follows the parametric procedure: at most 5 primitives, single stroke weight, collision math before render, 46/28/18/14 px survival strip, look-alike test, measured lockup, hash-verified exports.
- **FR-10** WCAG contrast check for text/background pairs.

### Narrative (Phase 3)
- **FR-11** Product profile and narrative pack where every feature or claim carries `evidence` and `confidence`; unevidenced claims are dropped.
- **FR-12** Copy lint: banned phrases and em-dashes rejected, one regeneration with violations listed.
- **FR-13** Style archetype selection (minimal SaaS, developer infra, AI-native, enterprise, open-source friendly).

### Deck (Phase 4)
- **FR-14** 10-slide spec, one message per slide, at most 3 supporting points, real assets only, curated layouts, white background default.
- **FR-15** Exports: offline HTML, PDF (page count = slides), PPTX.
- **FR-16** Visual QA via contact sheet and vision critique; failed review re-queues the deck once.

### Video (Phase 5)
- **FR-17** Video-as-code: `edit.json` EDL in frames, tested before render (contiguity, total, zoom <= 1.5x, sources exist).
- **FR-18** Pipeline: assemble (masks, zoom, window) -> HTML overlay via Playwright -> composite -> sparse synthesized SFX -> gates (full decode, frame count, true peak <= -1 dBTP, contact sheet read, privacy list).

### Docs (Phase 6)
- **FR-19** Docs generated only from verified facts and code signals; every command in docs traceable to a source.

### Swarm (Phase 7)
- **FR-20** Blackboard orchestration: roles read/write packs and `messages.jsonl`; parallel stages (brand, narrative, docs) then (deck, video) then QA; stop-and-ask when required inputs are missing; one retry per rejected output.
- **FR-21** `demoforge run <url>` end to end with an `outputs/index.html` launcher.

## 6. Non-functional requirements

- **Truthfulness:** zero fabricated facts, metrics or UI. Missing data produces a question, never an invention.
- **Quality bar:** see `docs/QUALITY_BAR.md` (anti-AI-look rules).
- **Cost and latency targets (evals):** < 5 min and < $0.50 per public repo for the MVP path.
- **Reproducibility:** every output regenerable from packs + specs with one command; renders deterministic.
- **Security:** no secrets stored; licenses respected; only public data or user-authorised sources.
- **Offline deliverables:** HTML outputs work from `file://` with no network.
- **Testing:** pytest for Python, node:test for overlay; fixtures local; network tests opt-in.

## 7. MVP scope (first demo, section "Ideal first product demo")

Input: one GitHub URL. Output in under 5 minutes: product profile, brand kit, 10-slide deck, 30-second teaser, one-page docs. Milestones: v0.1 context pack, v0.2 deck, v0.3 teaser, v0.4 docs, v0.5 end-to-end dogfood on this repository.

Out of MVP: FastAPI service and job queue, Postgres + pgvector embeddings and knowledge graph, web UI, private repos via GitHub App, Figma export, Remotion, Prefect.

## 8. Definition of done

A task is complete only when: code lints, tests pass locally, documentation and `TASKS.md` are updated, a skill is added or updated if a new procedure appeared, and the change is committed cleanly with an explanatory Conventional Commit referencing the task id.
