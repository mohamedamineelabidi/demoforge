# Skill: context-pack-ingest

Use when running or debugging the data layer (Phase 1) or adding an extractor.

## Run
```bash
uv run python -m demoforge ingest https://github.com/owner/repo [--site https://...] [--out workspace]
# result: workspace/<run_id>/curated/context_pack.json + quality_report.json
```

## Read the quality report first
`curated/quality_report.json`: `gate` pass | ask_user | fail. `questions_for_user` is what to ask before generating anything. Do not work around a low score by inventing data.

## Adding an extractor (pattern)
1. Test in `tests/extract/test_<name>.py` on a fixture file; assert the `Fact` has `evidence.source` and `evidence.line`.
2. `demoforge/extract/<name>.py`: `run(run_dir) -> Path` reading from `raw/` or `staging/`, writing to `staging/` or `curated/`.
3. Facts only with evidence; set `confidence` by source reliability: manifest 0.98, README code block 0.95, README prose 0.8, website copy 0.7, inferred 0.5.
4. Cross-verify when possible (`verified_by`), e.g. README install command vs manifest package name.
5. Register the stage in `pack/context_pack.py` ordering and in `docs/DATA_CONTRACTS.md`.

## Rules
- Ignore list is authoritative (`ingest/file_classifier.py`): node_modules, vendor, dist, build, coverage, .cache, .next, .nuxt, out, target, __pycache__, .venv, lock files, minified assets.
- Secrets: `quality/secrets.py` runs before anything is copied to curated; `.env.example` contributes key names only.
- GitHub API without a token is rate-limited (60/h); pass `GITHUB_TOKEN` in `.env` for evals.
- Website capture needs the rig: `bash scripts/install_rig.sh` installs Playwright + Chromium in `$LOCALAPPDATA/Temp/demoforge-rig`.
