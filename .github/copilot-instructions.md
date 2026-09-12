# Copilot instructions for DemoForge

Read `AGENTS.md` and `TASKS.md` before acting. Requirements live in `PRD.md`, module boundaries in `.agents/architecture.md`, procedures in `.agents/skills/`.

## Project

GitHub URL in, grounded demo video + deck + docs + brand kit out. Python 3.11 managed by `uv` (Pydantic v2, Typer, httpx, GitPython, markdown-it-py, Pillow, Jinja2). Node 20+ only for Playwright. ffmpeg/ffprobe and headless Chrome for media. Host is Windows 11 with git-bash; the repo path contains spaces and accents.

Flow: deterministic data layer -> `context_pack.json` -> blackboard swarm of generator roles -> verification gates. Generators build from `Evidence + Brand System + Design Constraints + Narrative`, never from nothing.

## Workflow for every task

1. State goal, target files, and verification command in three bullets.
2. Write tests first when the task produces logic (RED -> GREEN -> refactor).
3. Verify: `uv run pytest tests -q` and `uv run ruff check .` must exit 0. Media tasks also run their gate (`ffprobe` frame count, MD5 dedupe, integrity sweep).
4. Update `TASKS.md`; add or patch a skill in `.agents/skills/` when a new tool, command or workflow appears.
5. One atomic Conventional Commit containing code and `TASKS.md` together, one concept per commit.

Never tick `[x]` in `TASKS.md` before the verification command returned exit code 0 in this session.

## Commands

```bash
unset PYTHONPATH PYTHONHOME              # once per shell, the host has a stray global PYTHONPATH
uv venv --python 3.11 && uv pip install -e ".[dev]"
uv run pytest tests -q                   # hard gate
uv run ruff check .                      # lint, line-length 100, rules E,F,I,B,UP
uv run python -m demoforge --help        # the .exe shim breaks on this path, use python -m
DEMOFORGE_LIVE=1 uv run pytest tests -q -m live   # network tests, opt-in only
```

## Hard rules

- Never commit `.env`, tokens, or anything under `workspace/`. Secrets found in analysed repos are redacted in staging and never reach curated packs.
- Never fabricate product facts, features, metrics, testimonials or screenshots. A claim without `evidence` (file + line) is dropped, not guessed. Missing inputs go into `quality_report.json` and are asked of the user.
- Never run destructive commands (`rm -rf` outside `workspace/<run>/`, `git reset --hard`, `git push --force`).
- Never add a heavy dependency (Remotion, Postgres, Airflow, an ML model) without an ADR in `docs/decisions/`.
- Generated copy: no em-dashes, nothing from `demoforge/quality/banned_phrases.txt`, plain B2 English or French.
- Generated HTML deliverables are offline: no CDN, local or system fonts, inlined SVG.
- No background renders on this host; run ffmpeg and Playwright in the foreground.

## Windows and native tools

- Pass forward-slash absolute paths to native tools: `ffmpeg -i "C:/Users/hp/.../in.mp4"`. They do not understand `/c/...`.
- `chrome --headless --screenshot="C:\abs\path\out.png"` needs an absolute path or nothing is written; add `--disable-application-cache` and a `file:///` URL.
- The Playwright rig lives outside the repo at `$LOCALAPPDATA/Temp/demoforge-rig`; scripts read `DEMOFORGE_RIG`.
- ffmpeg `drawtext` crashes (Fontconfig) on this build: render text as HTML overlays.
- Verify exported PNG sets by MD5 and videos by `ffprobe -count_frames`.

## Layout

`demoforge/schemas/` Pydantic contracts. `ingest/` GitHub API, clone, classification (deterministic, no LLM). `extract/` README, manifests, images, website, brand and code signals. `enrich/` LLM abstraction and grounded profile/narrative. `quality/` secret scan, banned phrases, scoring. `pack/` run workspace and context pack. `brand/`, `deck/`, `video/`, `docs_gen/` generators (spec -> deterministic render -> gate). `swarm/` blackboard, bus, orchestrator, role prompts. `tests/` mirrors the package. `workspace/<run_id>/{raw,staging,curated,outputs}` is gitignored.

## Done means

Lint clean, tests green, docs and `TASKS.md` updated, skill added if a new procedure appeared, one clean commit. For media, the artifact exists on disk and its gate numbers (frames, duration, peak, hashes) are printed in the commit or task note.
