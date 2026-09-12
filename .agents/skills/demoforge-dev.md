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
# edit TASKS.md (move task, add verification line)
git add <files> TASKS.md && git commit -m "feat(<area>): <what> [TASK-0NN]"
```

## Conventions
- CLI: `uv run python -m demoforge <cmd>` (the .exe shim fails on this path).
- New stage = `demoforge/<layer>/<name>.py` with `run(run_dir: Path, **opts) -> Path`, a Pydantic model in `schemas/`, a test in `tests/<layer>/`, an entry in `docs/DATA_CONTRACTS.md` if it writes a new pack.
- Tests never touch the network unless marked `@pytest.mark.live` and `DEMOFORGE_LIVE=1`.
- Fixtures: `tests/fixtures/sample_repo/` (tiny git repo built by a fixture) and `tests/fixtures/site/` (static HTML).
- Native tools (ffmpeg, node, chrome, git) get `C:/...` forward-slash paths; scratch files go to `$LOCALAPPDATA/Temp`.
- Renders run in the foreground only.

## Adding a dependency
Light (pure Python, < 5 MB): add to `pyproject.toml`, `uv pip install -e ".[dev]"`, mention in the commit. Heavy (native, ML, DB, JS framework): write `docs/decisions/ADR-000N-*.md` first.
