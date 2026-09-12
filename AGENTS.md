# Agent Instructions & Operational Boundaries

Read this file and `TASKS.md` at the start of every session. Requirements live in `PRD.md`; module boundaries in `.agents/architecture.md`; procedures in `.agents/skills/`.

## 1. Project context

- **Product:** DemoForge (working name). GitHub URL in, grounded demo video + deck + docs + brand kit out.
- **Primary stack:** Python 3.11 managed by `uv` (Pydantic v2, Typer, httpx, GitPython, markdown-it-py, Pillow, Jinja2). Node 20+ only for Playwright (capture, overlay rendering). ffmpeg/ffprobe and headless Chrome for media.
- **Architecture:** understanding-first data layer -> `context_pack.json` -> blackboard swarm of generator roles -> verification gates. Generators create from `Evidence + Brand System + Design Constraints + Narrative`, never from nothing.
- **Host:** Windows 11, git-bash. Repo path contains spaces and accents.

## 2. Operating workflow (every task)

1. **Read context:** `AGENTS.md`, `TASKS.md`, the relevant `.agents/skills/*.md`.
2. **Pre-flight in plain English (3 bullets):** Goal / Files targeted / Verification command.
3. **Change code.** Tests first when the task produces logic (RED -> GREEN -> refactor).
4. **Verify:** `uv run pytest tests -q` and `uv run ruff check .` must exit 0. Media tasks also run their gate (`ffprobe` frame count, MD5 dedupe, integrity sweep).
5. **Update state:** tick or move the task in `TASKS.md`; add or patch a skill in `.agents/skills/` whenever a new tool, command or workflow appears.
6. **Atomic commit:** code + `TASKS.md` in the same Conventional Commit, one concept per commit.

```bash
git add demoforge/ingest/clone.py tests/ingest/test_clone.py TASKS.md
git commit -m "feat(ingest): shallow clone into raw/repo [TASK-013]"
```

Never mark `[x]` in `TASKS.md` before the verification command has returned exit code 0 in this session.

## 3. Commands

```bash
unset PYTHONPATH PYTHONHOME              # once per shell (host has a stray global PYTHONPATH)
uv venv --python 3.11 && uv pip install -e ".[dev]"
uv run pytest tests -q                   # hard gate
uv run ruff check .                      # lint (ruff format --check optional)
uv run python -m demoforge --help        # CLI (use python -m; the .exe shim breaks on this path)
DEMOFORGE_LIVE=1 uv run pytest tests -q -m live   # network tests, opt-in only
```

## 4. Strict boundaries

- **NEVER** commit `.env`, tokens, or anything under `workspace/`. Secrets found in analysed repos are redacted in staging and never reach curated packs.
- **NEVER** fabricate product facts, features, metrics, testimonials or screenshots. A claim without `evidence` (file + line) is dropped, not guessed. Missing inputs are reported in `quality_report.json` and asked of the user.
- **NEVER** run destructive commands (`rm -rf` outside `workspace/<run>/`, `git reset --hard`, `git push --force`).
- **NEVER** add a heavy dependency (Remotion, Postgres, Airflow, an ML model) without an ADR in `docs/decisions/`.
- Generated copy: no em-dashes, no phrases from `demoforge/quality/banned_phrases.txt`, plain B2 English or French.
- Generated HTML deliverables are **offline**: no CDN, fonts local or system stack, SVG inlined.
- Background renders are forbidden on this host (git-bash kills them); run ffmpeg/Playwright in the foreground.

## 5. Windows rules for native tools

```bash
# native tools (ffmpeg, node, chrome, git) do not understand /c/... paths
ffmpeg -i "C:/Users/hp/.../in.mp4" ...                    # forward-slash C:/ paths
chrome --headless --screenshot="C:\abs\path\out.png"       # absolute, or nothing is written
python: subprocess.run([..., "--disable-application-cache", f"file:///{abs_html}"])
```

- Playwright rig is installed OUTSIDE the repo (`$LOCALAPPDATA/Temp/demoforge-rig`), scripts read `DEMOFORGE_RIG`.
- ffmpeg `drawtext` crashes (Fontconfig) on this build: render all text as HTML overlays.
- Verify every exported PNG set by MD5 (Chrome serves cached renders) and every video by `ffprobe -count_frames`.

## 6. Directory map

- `demoforge/schemas/` Pydantic contracts for every pack (see `docs/DATA_CONTRACTS.md`).
- `demoforge/ingest/` GitHub API, clone, file classification. Deterministic, no LLM.
- `demoforge/extract/` README, manifests, images, website, brand signals, code signals.
- `demoforge/enrich/` LLM abstraction and grounded product profile / narrative.
- `demoforge/quality/` secret scan, banned phrases, quality scoring.
- `demoforge/pack/` run workspace and context pack assembly.
- `demoforge/brand/`, `deck/`, `video/`, `docs_gen/` generators (spec -> deterministic render -> gate).
- `demoforge/swarm/` blackboard, message bus, orchestrator, role prompts (`roles/*.md`).
- `tests/` mirrors the package; `tests/fixtures/` holds a tiny sample repo and static site.
- `workspace/<run_id>/{raw,staging,curated,outputs}` runtime data lake, gitignored.

## 7. Definition of done

Code lints, tests pass, docs and `TASKS.md` updated, skill added if a new procedure appeared, one clean commit. For media: the artifact exists on disk and its gate numbers (frames, duration, peak, hashes) are printed in the commit or task note.
