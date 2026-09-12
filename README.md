# DemoForge

Turn a GitHub repository into a startup-quality demo video, an investor-grade deck, documentation and a brand kit, all grounded in what the repository actually contains.

The product starts with **understanding**, not generation: a deterministic data layer builds an evidence-backed `context_pack.json`; a swarm of specialist agents (brand, narrative, deck, video, docs, QA) generates from `Evidence + Brand System + Design Constraints + Narrative`, never from nothing. Every output passes automated verification gates before it is delivered.

Status: Phase 0 (foundation). See `TASKS.md` for the live backlog and `PRD.md` for requirements.

## Quick start

Prerequisites: Python 3.11+, [uv](https://docs.astral.sh/uv/), Git, Node 20+ (Playwright rig, Phase 1), ffmpeg 6+ (Phase 5).

```bash
git clone <repo-url> && cd Demo_Builder
cp .env.example .env            # optional keys; public repos work without a token
uv venv --python 3.11
uv pip install -e ".[dev]"
uv run demoforge --help
```

## Commands

```bash
uv run pytest tests -q          # test suite (hard gate before any task is marked done)
uv run ruff check .             # lint
uv run demoforge version
# Phase 1+: uv run demoforge ingest <github-url> [--site URL]
```

## Repository map

| Path | Purpose |
|---|---|
| `AGENTS.md` | Operating manual for any AI agent working here (read first) |
| `PRD.md` | Product requirements, the source of truth for features |
| `TASKS.md` | Live backlog and state machine, updated in every commit |
| `.agents/architecture.md` | Module boundaries, data lake layout, swarm protocol |
| `.agents/skills/` | Reusable operational recipes (video-as-code, logo-as-code, ...) |
| `docs/` | Data contracts, quality bar, decisions |
| `demoforge/` | Python package (data layer, generators, swarm) |
| `tests/` | pytest suite; fixtures are local, network tests need `DEMOFORGE_LIVE=1` |
| `workspace/` | Runtime data lake per run (gitignored) |

## AI agent integration

This repository follows the Memory Bank & Task State Machine convention: read `AGENTS.md` and `TASKS.md`, explain the plan in plain English, change code, run verification, update `TASKS.md` and skills, then make one atomic commit containing code and state together.
