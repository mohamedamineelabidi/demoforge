# Data Contracts

Status: v1 design for the video-first flow, accepted 2026-09-12; executable models are not yet built.
TASK-068 implements the first slice. This replaces the original unimplemented 13-pack draft; no stored
production-data migration is required. Examples below are illustrative until schema tests implement them.
The remaining contracts are implemented with their owning tasks, not all in one large schema task.

## Shared rules

- Pydantic v2, snake_case, explicit schema_version, UTC timestamps, stable IDs, immutable revisions.
- Reject unexpected input fields. Validate positive dimensions, counts and durations, finite numbers,
  supported enums and schema versions. Reject absolute/traversing artifact paths, including symlink escapes
  at storage access; runtime safe-path checks supplement schema checks.
- Artifact references use SHA-256 and run-relative paths; hosted references use object IDs, not expiring URLs.
- Repository revisions are full commit hashes. Every source has acquisition time and provenance.
- Evidence IDs must resolve in the referenced snapshot. Schema validation alone cannot establish support.
- A heuristic confidence score is optional, named heuristic_score, and is never a probability or approval.
- User brief text is input, not verified fact. Factual copy references Claim IDs; code/commands remain literal.

## 1. Evidence (TASK-068)

Fields: schema_version, evidence_id, kind (repository, website, api, observation, attestation), source,
revision (nullable outside repositories), line_start, line_end, quote, acquired_at, content_sha256,
observation_id and attestation_id (nullable). Repository evidence requires a revision and valid line
range; observations/attestations require the matching referenced record. Quotes contain sanitized text.

```json
{
  "schema_version": 1,
  "evidence_id": "ev_readme_1",
  "kind": "repository",
  "source": "README.md",
  "revision": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "line_start": 12,
  "line_end": 12,
  "quote": "Export results as CSV.",
  "acquired_at": "2026-09-12T10:00:00Z",
  "content_sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "observation_id": null,
  "attestation_id": null
}
```

Hashes and product text above are synthetic fixtures, not claims about DemoForge.

## 2. Claim and EvidenceCatalog (TASK-068, TASK-072)

Claim fields: schema_version, claim_id, revision, text, evidence_ids (nonempty), verification_status
(documented, statically_supported, runtime_observed, user_attested), limitations (list).
`runtime_observed` requires a passing CaptureObservation linked through evidence, never just a README.
`user_attested` requires an attestation actor/time/text. Human approval is separate from verification_status.

EvidenceCatalog fields: schema_version, catalog_id, revision, repository, evidence[], claims[], assets[].
Repository fields: repo_url, full_name, commit_sha, acquired_at, license (nullable), metadata_evidence_ids.
FileRecord fields: path, classification, size_bytes, content_sha256, scan_status, exclusion_reason (nullable).
Tech-stack/install claims use the same claim model; no unreferenced marketing strings in a product profile.

```json
{
  "schema_version": 1,
  "claim_id": "claim_csv",
  "revision": 1,
  "text": "Export results as CSV.",
  "evidence_ids": ["ev_readme_1"],
  "verification_status": "documented",
  "limitations": ["Runtime behavior has not been observed."]
}
```

## 3. ArtifactRef and ArtifactManifest (TASK-068, TASK-069)

ArtifactRef fields: artifact_id, path, sha256, media_type, size_bytes. Never store credentials or signed URLs.
ArtifactManifest fields: schema_version, manifest_id, run_id, stage_id, attempt_id, revision, created_at,
input_manifest_ids, input_hashes, options_hash, tool_versions, schema_versions, template_version,
model_id (nullable), prompt_hash (nullable), outputs (ArtifactRef list), gate, cost.
Cost fields: currency, model, compute, storage, total; unknown measurements are null, not zero.
Publishing a manifest requires all referenced outputs to exist, match hashes and pass required gates.
Failed attempts retain sanitized diagnostics but never a successful-output pointer.

## 4. Approval (TASK-068, TASK-070)

Fields: schema_version, approval_id, run_id, subject_type (claims, scenario, storyboard, output),
subject_id, subject_revision, subject_sha256, actor_id, decision (approved, rejected), decided_at, note.
Approvals are immutable records; changed inputs require new approvals. Local actor identity is an
explicit operator label; hosted identity comes from authenticated server context, never a client field.
Export binds approval to the final artifact hash, not merely the storyboard that preceded rendering.

## 5. RunRecord, StageRequest and StageResult (TASK-069, TASK-070)

RunRecord: schema_version, run_id, created_at, updated_at, state, current_stage, checkpoint,
input_manifest_id, cancellation_requested, retention_deadline. Tenant/project IDs are added for hosting.
Checkpoint identifies the approval subject and continuation stage. Allowed run states:
pending, ingesting, planning, awaiting_approval, acquiring_footage, storyboarding, rendering, reviewing,
complete, failed, cancelled. Terminal runs do not resume implicitly; resumption creates an explicit attempt.

StageRequest: schema_version, run_id, stage_id, attempt_id, input_manifest_ids, options, idempotency_key.
StageContext is a Python dependency container, not serialized JSON: artifact store, state store, clock,
configured service clients and cancellation check. StageResult: schema_version, run_id, stage_id,
attempt_id, state, output_manifest_ids, gate, issues. Stage state enum: pending, running,
awaiting_approval, complete, failed, cancelled. The controller validates transitions and owns DB commits.

## 6. QualityReport (TASK-068 and each gate owner)

Fields: schema_version, report_id, subject_id, subject_revision, gate (pass, ask_user, fail), checks[],
missing_inputs[], questions[], warnings[]. Each check: check_id, status (pass, fail, not_run),
required, measurement (nullable), reason (nullable). No aggregate score can override a failed required check.
Required checks that are not_run block completion. Reports contain secret counts/locations only, never values.
`ask_user` pauses the workflow; `fail` blocks it; `pass` does not substitute for an approval.

## 7. Asset and BrandTokens (TASK-073)

Asset: schema_version, asset_id, artifact_ref, kind (video, screenshot, logo, font, audio), source,
captured_at (nullable), acquired_at, permission (actor_id, attested_at, scope, license nullable),
width/height (nullable for nonvisual assets), duration_frames/fps (nullable for nonvideo),
privacy_status (pending, cleared, rejected), sanitized_derivative_id (nullable).
Permission is an attestation, not a legal guarantee. Verified assets require integrity and privacy gates.
Video is normalized to the storyboard frame rate; preserve source timestamps/timebase in the manifest.

BrandTokens: schema_version, revision, origin (user, extracted, neutral), logo_asset_id (nullable),
colors, typography, spacing, motion, contrast_checks. Font references must resolve locally with permissions.
No generated-logo origin in the pilot. Evidence IDs document extracted product-brand assertions.

## 8. DemoScenario and CaptureObservation (TASK-074, TASK-080, TASK-081)

DemoScenario: schema_version, scenario_id, revision, claim_ids, mode (supplied_footage, controlled_capture),
starting_state, allowed_origins, preconditions[], actions[], assertions[], reset, sensitive_regions[].
Supplied-footage mode describes the demonstrated flow but executes no actions. Automated mode requires
explicit allowed origins, preconditions, reset and assertions. Credential references are ephemeral handles.
Action kinds: navigate, click, fill, select, scroll, wait_for, hold; use typed per-kind payloads,
bounded timeouts and constrained selectors. Never JavaScript, shell, purchase or destructive actions.
`hold` is a deliberate viewing duration; `wait_for` uses readiness assertions, not guessed sleep delays.
Sensitive regions include time range, source-space rectangle and masking method; reject out-of-bounds data.

CaptureObservation: schema_version, observation_id, scenario_id, scenario_revision, claim_ids,
recorded_at, assertion_results[], asset_id, frame_start, frame_end, tool_versions, reset_succeeded.
Each assertion records expected/observed values, result and evidence artifact refs. Failed assertions
cannot upgrade a claim to runtime_observed. Uploads do not automatically establish runtime verification.

## 9. Narrative and StoryboardRevision (TASK-074, TASK-075)

Narrative: schema_version, revision, audience, beats[]; each beat references approved claim IDs and
contains purpose, copy and duration_frames. Factual copy must be supported by the referenced claims.
Nonfactual labels/CTA may have no claim IDs but must not smuggle in product assertions. Literal code or
commands use a separate content kind and preserve the source rather than passing through copy repair.

StoryboardRevision: schema_version, storyboard_id, revision, parent_revision (nullable), scenario_id,
scenario_revision, catalog_revision, brand_revision, fps, width, height, total_frames, scenes[].
Pilot defaults: 30 fps, 1920x1080, 900 frames. Scene: scene_id, start_frame, duration_frames, asset_id,
source_in_frame, caption, claim_ids, layout, zoom_keyframes[], masks[], sound_cues[].
Caption distinguishes prose/label/literal. Zoom keyframes specify local frame, scale and center;
masks specify source-space rectangle and active frame interval. Layout is a curated template ID.

Enforce start_frame[0] = 0, contiguous scenes, positive durations, sum = total_frames, unique IDs,
valid source bounds, zoom <= 1.5, masks/zoom/sound inside bounds, resolvable assets/claims and exact
approved dependencies. Trims and time ranges are half-open [start, end). The EDL is generated from this
approved specification, not a separate hand-maintained authority. A caption edit creates a new revision
and invalidates dependent renders/approvals, but preserves unaffected evidence and footage.

## 10. ContextPack and hosted transport (TASK-072, TASK-085)

ContextPack: schema_version, context_id, revision, run_id, catalog_manifest_id, brief,
brand_manifest_id (nullable), quality_report_id. No circular narrative dependency. Generators consume
this frozen snapshot plus explicitly declared approved scenario/storyboard/asset manifests.

Hosted job envelope: schema_version, job_id, run_id, stage_id, attempt_id, input_manifest_ids.
Server-side lookup enforces ownership; no credentials, mutable model objects or media bytes on the broker.
Database outbox and attempt records are authoritative. Optional events.jsonl records timestamp, run_id,
stage_id, attempt_id, event and sanitized details for diagnostics only. There is no swarm message contract.

## Implementation checks

TASK-068 tests Evidence, Claim, ArtifactRef/Manifest, Approval and QualityReport JSON round trips plus
invalid enums/hashes/ranges, unsupported schema versions and dangling evidence. Pure cross-reference
validation is separate from I/O-backed checks. Later owning tasks add scenario, storyboard and state tests.
Negative tests must cover stale approvals, unsupported runtime status, media bounds, copy losing claim
references, path escape and required checks left not_run. Pydantic schema validity never equals verified truth.