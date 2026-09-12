# Skill: demoforge-dev

Use when working on any code in this repository.

## Setup (once per shell)
```bash
cd "/c/Users/hp/OneDrive - Université Abdelmalek Essaadi/Desktop/Demo_Builder"
unset PYTHONPATH PYTHONHOME
uv venv --python 3.11 && uv pip install -e ".[dev]"
```

## Loop for one task
```bash
uv run pytest tests/<area> -q          # RED: write the test first, see it fail
# implement
uv run pytest tests -q && uv run ruff check .   # GREEN + lint, both exit 0
# edit TASKS.md (move task only after checks pass, add verification line)
# Standing user request: commit and push task-related changes after verification.
git add <files> TASKS.md && git commit -m "feat(<area>): <what> [TASK-NNN]"
git push
git status --short --branch
git ls-remote origin refs/heads/<current-branch>
```

## Conventions
- Publication: inspect staged paths and diffs; exclude secrets, workspace artifacts and unrelated edits.
	Use the configured upstream, never force-push. Confirm remote hash equals local HEAD; if rejected,
	report the blocker rather than resetting/rebasing user work or bypassing branch protection.
- CLI: `uv run python -m demoforge <cmd>` (the .exe shim fails on this path).
- Follow TASKS.md, not the archived Hermes plan. Start TASK-068 with the small contract slice; implement later schemas with their owning stages.
- New stage = `run(request: StageRequest, context: StageContext) -> StageResult` with explicit immutable inputs, validated output manifests, a test in `tests/<layer>/` and a contract entry. workflow/ alone commits transitions; see workflow-execution.md.
- SQLite state requires a configurable non-synced local workspace outside this OneDrive checkout. Never use a diagnostic JSONL log or exported run.json as a second state authority.
- Tests never touch the network unless marked `@pytest.mark.live` and `DEMOFORGE_LIVE=1`.
- Fixtures: `tests/fixtures/sample_repo/` (tiny git repo built by a fixture) and `tests/fixtures/site/` (static HTML).
- Native tools (ffmpeg, node, chrome, git) get `C:/...` forward-slash paths; scratch files go to `$LOCALAPPDATA/Temp`.
- Local renders run in the foreground only. Hosted Celery workers use Linux/WSL2, not native Windows.
- Future CLI commands, fixtures, modules and services described by recipes do not necessarily exist yet. Check the current task and implementation before running them.
- Planning changes: check Markdown links, contract JSON syntax, task IDs/dependencies and stale references; run full pytest/Ruff but do not claim those tests validate unimplemented contracts or media.

## Planned frontend design
- Before frontend UI or design-instruction work, read [FRONTEND_DESIGN.md](../../docs/FRONTEND_DESIGN.md)
	and [QUALITY_BAR.md](../../docs/QUALITY_BAR.md). The design guide defines DemoForge chrome;
	customer branding belongs to the scene/video canvas and must not inherit the app theme.
- Adapt the Kinetic Bento direction to dense, unframed evidence/approval/editing workspaces:
	light surfaces, a dark execution-log tool, limited indigo, zero tracking and radii <= 8px.
	No decorative glow/orbs, nested section cards, marketing hero or simulated agent activity.
- Use the planned React/TypeScript/Vite and TanStack Query stack only in its owning task.
	CSS tokens are framework-neutral; do not install Tailwind or select Remotion from a design reference.
- Preserve authoritative workflow states and revision-bound approvals. No invented metrics or
	running statuses. Use the guide's responsive, accessible controls and state coverage as acceptance
	criteria; record visual QA evidence only after an implemented frontend has actually been checked.

## Adding a dependency
Add dependencies only for the active task, update pyproject.toml and the uv lock consistently, then verify.
Heavy (native, ML, DB, JS framework): record an ADR first. ADR-0003 stages the hosted stack; it does not
authorize installing it during the local proof. Remotion still needs the TASK-082 benchmark/selection ADR.
