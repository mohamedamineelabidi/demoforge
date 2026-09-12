# Local Supplied-Footage Pipeline

Initial CLI implementation, not a completed release gate for TASK-072 through TASK-078. The browser
editor remains local-only. Runtime files belong outside OneDrive and must not be committed.

## Environment

Python 3.11/uv, FFmpeg/ffprobe on PATH, Node LTS and installed Chrome for HTML captions. Install the
renderer dependency outside the checkout in PowerShell:

```powershell
npm install --prefix "$env:LOCALAPPDATA/Temp/demoforge-rig" --save-exact playwright@1.63.0
```

`DEMOFORGE_RIG` overrides that directory. `DEMOFORGE_WORKSPACE` overrides the non-synced state/output
root, otherwise `%LOCALAPPDATA%/demoforge` is used. Chrome/FFmpeg versions are not enforced yet;
binary pinning and reproducibility remain acceptance work. Rendering runs in the foreground.

## Ingest

```powershell
uv run python -m demoforge ingest https://github.com/mohamedamineelabidi/realestate-rag --commit a9fa0fa285c0ecae0224ca15240ba95640f7d2a8
```

Uses fixed-host GitHub commit/tree/blob APIs, not a shallow clone. No repository code, hooks, scanner
configuration, URLs inside sources or install commands execute. Redirects are refused. Default limits:
500 selected text files, 256 KB/file, 4 MB selected content, 2 MB/JSON response, 10,000 tree entries,
50 requests, depth 12, 10 seconds/request and 120 seconds total. Git blob hashes and the requested
commit are checked. Oversize/truncated trees fail rather than imply completeness. README/docs,
manifests/license text and environment-template names are collected. Others are counted as skipped.
Raw bytes stay in bounded acquisition memory, not retained quarantine files.

Trusted local redaction rules run before curated evidence. They cannot detect every secret or private
fact. Evidence carries full commit, source lines and sanitized SHA-256; no product claims are inferred.
The command prints paths/hashes for catalog.json, quality.json and context.json. `ask_user` is expected:
authorized footage and exact approvals are still needed. Catalog/quality JSON can be imported into the
frontend manually; that import grants no backend authority.

The live repository check on 2026-09-12 produced 17 evidence entries at the revision above. No repository
was executed, no recording was downloaded, and no live provider request was made.

## Propose

Supply JSON matching `Proposal.model_json_schema()` from `demoforge.video.storyboard`, or opt in to a
provider call over a sanitized catalog:

```powershell
uv run python -m demoforge propose C:/local/catalog.json C:/local/proposal.json --model YOUR_MODEL --live
```

Set `OPENAI_API_KEY` locally, never in chat, command arguments or committed files. The command does not
automatically load .env. It refuses an existing output. The SDK uses no tools, a 45-second timeout,
zero SDK retries and at most 2,000 completion tokens. There is one application-level content repair.
FakeLLM and mocked OpenAI transport cover tests; live model/schema compatibility remains unverified.

The first proposal has three <=60-character captions, each an exact source excerpt with an evidence
ID and matching status. This checks excerpt support, not whether source prose is true or misleading
out of context. Human review remains required. Paraphrased narratives, feature briefs in model
requests and richer semantic support checks remain future work.

## Run And Review

```powershell
uv run python -m demoforge run C:/local/catalog.json C:/local/proposal.json C:/local/footage.mp4 --actor operator --provenance "Recording supplied by product owner" --authorized --privacy-reviewed --sanitized-catalog
uv run python -m demoforge status RUN_ID
uv run python -m demoforge approve RUN_ID --sha256 PENDING_HASH --actor operator --note "Reviewed the exact subject"
uv run python -m demoforge resume RUN_ID
uv run python -m demoforge cancel RUN_ID
```

Do not set attestation flags unless you have permission and reviewed the entire source recording.
The controller pauses for claims, scenario, storyboard and final-output approvals. Read the matching
manifest artifacts before supplying the pending hash. `approve --reject` records rejection; approval
never resumes automatically. For output, watch the full rendered video and review privacy, evidence,
motion and caption legibility. A contact sheet is insufficient.

CLI defaults: chronological trims 0,180,660 and 180/480/240-frame scenes, requiring at least 30 seconds
of valid normalized footage. The scenario contract supports other trims but a public edit/reapproval
command is not implemented. Do not alter manifest-backed files in place: hashes will reject them.
Caption-only editing/recovery workflows remain TASK-075/078 work.

Media requires explicit permission/provenance, local MP4/MOV/WebM/MKV, at most 256 MB, 300 seconds,
3840x2160 pixels and 120 fps. Network media protocols are disabled. ffprobe counts frames; FFmpeg fully
decodes with errors fatal. Normalization produces a new silent 30 fps copy. The renderer verifies
media hashes, approvals, bounds and approved brand colors. Output: silent 1920x1080, 30 fps, 900 frames,
hard cuts, bounded linear push-in and static offline HTML captions. Typewriter captions, reference
easing, rounded footage corners, masks and preview/export parity are not implemented. No soundtrack
is retained.

After final approval, `outputs/export/` contains video.mp4, catalog.json, proposal.json, scenario.json,
storyboard.json, quality.json, approval.json and review.html. SQLite is authoritative; stage manifests
hash artifacts. Review pages are offline, script-free and escape source prose. Final approval is an
operator attestation bound to output bytes, not automated proof of privacy or truth.

## Verification And Remaining Gates

```powershell
uv run pytest tests/ingest tests/video tests/workflow/test_pipeline.py tests/test_cli.py -q
uv run pytest tests -q
uv run ruff check .
```

Media tests require the tools above and create synthetic test patterns outside the repository. Their
decisions are synthetic, not user approvals. Full decode/frame/duration/hash checks pass, and contact
sheet framing was inspected. Human customer-video review has not occurred.

Still open: bounded shallow clone or approved API-only decision; retained-quarantine/ACL policy;
complete skipped-file reporting and structured manifest parsing; imported logo/assets; factual
paraphrase/brief evaluation; tool version enforcement; audio/masks/frame-repeatability gates; full
subprocess cancellation/resource accounting; crash-safe export retry; caption-only edits; real-product
end-to-end evaluation and frontend/API binding. No hosted infrastructure or Remotion was added.