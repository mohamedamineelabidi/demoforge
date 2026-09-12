# Copilot instructions for DemoForge

Read `AGENTS.md` and `TASKS.md` before acting. Requirements live in `PRD.md`, module boundaries in `.agents/architecture.md`, procedures in `.agents/skills/`.

## Project

Source-linked, editable release-demo videos for developer tools/web apps. First proof: public repo + feature brief + authorized supplied footage -> 30-second 16:9 video, evidence report and offline review. Decks, docs and logo generation are deferred. Local stack: Python 3.11/uv, Pydantic v2, Typer, httpx, GitPython, markdown-it-py, Pillow, Jinja2, SQLite state and versioned JSON. Media adds pinned Node LTS/Playwright/Chromium and FFmpeg. Windows 11 host; repo path contains spaces and accents.

Flow: bounded ingestion -> evidence -> approved claims/scenario -> footage checks/capture -> approved storyboard -> render -> technical QA + full human review -> export. workflow/ owns explicit state; no autonomous swarm/Hermes runtime. context_pack is a frozen snapshot plus declared artifact dependencies.

TASKS.md is authoritative; ADR-0003 supersedes the historical Hermes plan. Editor target: React/TypeScript/Vite; Remotion requires TASK-082 benchmark/license decision. Hosted target: FastAPI, PostgreSQL/SQLAlchemy/Alembic, private S3, managed identity, Celery/RabbitMQ and isolated Linux jobs. Do not install future infrastructure before its task. These are plans, not shipped features.

## Workflow for every task

1. State goal, target files, and verification command in three bullets.
2. Write tests first when the task produces logic (RED -> GREEN -> refactor).
3. Verify: `uv run pytest tests -q` and `uv run ruff check .` must exit 0. Media tasks also run their gate (`ffprobe` frame count, MD5 dedupe, integrity sweep).
4. Update `TASKS.md`; add or patch a skill in `.agents/skills/` when a new tool, command or workflow appears.
5. Standing user request (2026-09-12): after verified work, commit task-related code/docs and TASKS.md
	with a Conventional Commit, then push the current branch to its configured GitHub upstream and verify
	the remote commit. Never force-push, include unrelated changes, or publish secrets/runtime files.
	Report failed checks/authentication/push instead of claiming completion. No empty commits for read-only work.

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
- Never fabricate facts, metrics or UI. Claim IDs and revision-pinned evidence survive every transformation. Distinguish documented, statically_supported, runtime_observed and user_attested; human approval is separate. Missing inputs produce questions.
- Never run submitted repos or model-generated scripts. Sources are untrusted data. Capture requires authorization; arbitrary hosted URLs need isolation/egress tests. No production secrets inside browser jobs.
- Raw inputs are access-limited, deletable quarantine. Redact before curated/model/log access. Configure SQLite workspace outside OneDrive; events.jsonl and run.json are diagnostics/exports, not authoritative state.
- Never run destructive commands (`rm -rf` outside `workspace/<run>/`, `git reset --hard`, `git push --force`).
- Never add a heavy dependency (Remotion, Postgres, Airflow, an ML model) without an ADR in `docs/decisions/`.
- Generated prose: no em-dashes, nothing from `demoforge/quality/banned_phrases.txt`, plain B2 English or French. Preserve literal code and commands outside prose lint/repair.
- Generated HTML deliverables are offline: no CDN, local or system fonts, inlined SVG.
- No background renders on this host; run ffmpeg and Playwright in the foreground.

## Windows and native tools

- Pass forward-slash absolute paths to native tools: `ffmpeg -i "C:/Users/hp/.../in.mp4"`. They do not understand `/c/...`.
- `chrome --headless --screenshot="C:\abs\path\out.png"` needs an absolute path or nothing is written; add `--disable-application-cache` and a `file:///` URL.
- The Playwright rig lives outside the repo at `$LOCALAPPDATA/Temp/demoforge-rig`; scripts read `DEMOFORGE_RIG`.
- ffmpeg `drawtext` crashes (Fontconfig) on this build: render text as HTML overlays.
- SHA-256 identifies artifacts; MD5 may diagnose PNG caching, but expected identical frames are valid. Check video frame counts/full decode and full-video privacy/motion, not just a contact sheet.
- Native Windows Celery is unsupported; hosted jobs use Linux/WSL2. Local renders remain foreground.

## Layout

`schemas/` typed contracts; `ingest/` and `extract/` deterministic sources; `enrich/` typed AI proposals; `quality/` gates; `pack/` artifacts; `brand/` reused tokens/assets; `video/` footage, capture, storyboard and rendering; `workflow/` state/approvals/resume. Future `api/` and `workers/` adapt the same functions. `deck/` and `docs_gen/` deferred; no swarm modules. `tests/` mirrors the package; workspace data is gitignored. See .agents/architecture.md and .agents/skills/workflow-execution.md.

## Done means

Lint clean, tests green, docs/tasks/recipes aligned; task-related changes committed and pushed under the
standing request, with remote commit verified. Media requires exact-revision approvals, real artifacts
and printed frame/duration/hash/peak measurements (peak only when audio exists). A planning update
never marks runtime features complete. Stop and report publication blockers without bypassing protections.
