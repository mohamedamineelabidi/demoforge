# Skill: context-pack-ingest

Use when implementing TASK-072 ingestion or adding an extractor. The initial bounded GitHub API
implementation is in ingest/github.py and pack/context_pack.py; full TASK-072 acceptance remains open.
Read docs/LOCAL_PIPELINE.md for implemented limits and the API-only versus shallow-clone distinction.

## Run
```bash
uv run python -m demoforge ingest https://github.com/owner/repo --commit FULL_SHA
# Result: non-synced workspace/runs/ingest-ID/curated/SHA/{catalog,quality,context}.json
```

## Read the quality report first
QualityReport: `gate` pass | ask_user | fail; `questions` and `missing_inputs` name blockers.
Required failed/not_run checks block progression; no aggregate score overrides them. Resolve missing
inputs with the user, never inferred facts. A pass is not claim/scenario approval.

## Adding an extractor (pattern)
1. Test extraction on a fixture; assert Evidence source, full revision, line_start/line_end and quote.
2. Use StageRequest/StageContext/StageResult from architecture.md; only ingestion/sanitization accesses
	quarantine. Downstream parsers/models receive scanned extracts and declared manifests.
3. Emit evidence plus documented/statically_supported claims. Source type does not imply a calibrated
	probability; do not assign arbitrary confidence constants or label README text runtime_observed.
4. Cross-check commands against manifests without executing them. Preserve literal source text.
5. Register dependencies in workflow/ and contracts in docs/DATA_CONTRACTS.md. ContextPack is a frozen
	catalog reference, not a mutable pack containing downstream narrative.

## Rules
- Ignore list is authoritative (`ingest/file_classifier.py`): node_modules, vendor, dist, build, coverage, .cache, .next, .nuxt, out, target, __pycache__, .venv, lock files, minified assets.
- Bound clone/download bytes, file count, depth, timeouts and decoding; reject path/symlink escapes.
- Secrets: scan/redact before curated/model/log access; `.env.example` contributes key names only.
	Use trusted scanner rules, not settings/allowlists from analyzed repos. Quarantine is access-limited
	and deleted by retention policy; scanners cannot guarantee all secrets or private data are detected.
- Initial API acquisition is unauthenticated (GitHub rate limits apply); token support is not wired.
	Never put credentials into repository URLs. Tests use httpx.MockTransport, not live requests.
- Website capture is TASK-080/081, not required for the supplied-footage proof. Pin Playwright/Chromium;
	use DEMOFORGE_RIG on this host. Do not assume an installer exists. Arbitrary URLs require isolation
	and egress tests; homepage screenshots are assets, not proof of an executed product scenario.
