# Recorded Demo Implementation

The user requested implementation on 2026-09-15. TASK-106 starts with strict data contracts;
it does not complete controlled capture, the connected editor or a reference-matched film.
The existing pilot, TASK-079 release decision, TASK-080/081 capture gates and TASK-082/083 renderer
and editor gates remain in force. No new infrastructure or Remotion dependency is installed.

## Frontend journey

Keep one project workspace with six server-backed steps, separate from legacy local drafts:

| Step | Operator decision | Required result |
| --- | --- | --- |
| Setup | Full app or new feature, target, audience, references, test data and permission | Explicit bounded target/action authorization |
| App map | Review states, roles, feature scope and unexplored areas | Selected feature inventory; unresolved frontier stays visible |
| Scenario | Edit goals, preconditions, actions and expected results | Exact scenario and claim approval |
| Test and record | Discover, reset, rehearse, then capture with result assertions | Real attempt evidence, including failed and blocked checks |
| Edit | Chapters, trims, focus, cursor, text and optional subtitles | Versioned storyboard with evidence links |
| Review and export | Inspect video, coverage and technical/privacy checks | Exact output approval before download |

Target deliverables are a highlight demo, chaptered walkthrough and separate assertion coverage report.
Short highlights may omit failed features, but never erase their results from the coverage report.
A page visit is not a passing feature test. Full-app means the agreed scope, not every possible state.

## Implemented contract slice

[recorded_demo.py](../demoforge/schemas/recorded_demo.py) provides frozen, bounded, versioned snapshots:

- `RecordedDemoPlan`: selected features, role-specific states, scenarios, expected assertions and
  unresolved frontier. Every selected feature needs a scenario; IDs and state links must resolve.
- `CoverageReport`: embeds the exact plan and one attempt's complete result set. Every assertion is
  passed, failed, blocked or not_run. Missing/duplicate results are rejected; failures need reasons.
  Executed results require evidence hashes. `summary` and `selected_scope_passed` are computed Python
  properties, not serialized approval/status fields. A passed selected scope does not clear frontier.
- `RecordedDemoSpec`: embeds coverage, native-rate source clips and contiguous 30 fps shots, bounded
  to 60 minutes. A shot's passing assertion must identify that exact clip hash. Source bounds use
  rational arithmetic across integer native/output frame rates. Zoom ramps must fit within shots.

The data is planning/review input only. `click` and `observe` describe intent, not executable locators
or authorized operations. Routes are labels, not validated network destinations. No runtime is allowed
to execute these steps directly. Caption text is a draft, not an approved factual claim. Unknown fields
such as `human_approved` or arbitrary scripts are rejected. Collections are immutable tuples.

The validator checks hash structure and internal consistency, not files or actual product behavior.
Future stages must verify artifacts, acquisition/provenance, privacy and permission before publishing
through `RunWorkspace`. Fractional native FPS, cursor event synchronization, capture authorization,
assertion runners and connected API DTOs remain later contracts with their owning implementations.
Legacy `StyleProfile`, three-scene storyboards and teaser output remain unchanged.

Focused check: `uv run pytest tests/schemas/test_recorded_demo.py tests/schemas/test_style_profile.py -q`.

## Reference direction

Primary user-supplied references:
- https://www.youtube.com/watch?v=4lXwF95jY2I
- https://www.youtube.com/watch?v=pCa8Zvf0XaE

Both remain unreviewed. Earlier fetches returned HTTP 401/player error 153; titles, shot timings,
visual style and soundtrack were not verified. Do not describe them as analyzed Google footage.
Next creative gate: complete timestamped analysis from accessible authorized playback, followed by
a 10-15 second real DemoForge style sample and user review before full reference-matched production.
Use our own product assets and permitted audio, not copied logos, music or footage.

The provisional baseline is TASK-105's full-screen genuine UI, 400 ms cursor movement, 12-frame zoom
ramps and readable result holds. These timings come from our proof, not the supplied references.
Use task -> action -> result, with short evidence-grounded text. Motion should explain the action,
not replace it. Never restyle UI through generative video models or fabricate intermediate states.

## Next implementation slices

1. TASK-107: bounded authorized app discovery and scenario compiler, with safe action/locator types,
   role/state separation, reset/readiness rules, frontier reporting and assertions. Fake fixture first;
   AI emits typed proposals, not scripts. This must respect TASK-080 prerequisites.
2. TASK-108: promote the owned-app proof into a trusted capture adapter. Rehearse and record the same
   assertions; bind observed results to raw hashes. Add cursor-free capture and synchronized events
   before enabling post-record cursor edits. TASK-081 blocks arbitrary hosted targets.
3. TASK-109: connect the six-step frontend to controller-backed runs and revision checks. Reuse existing
   frame/evidence/review views. The current serial HTTP server cannot serve self-capture while blocked
   in an advance request; resolve that with a reviewed local execution model and concurrency tests,
   not a fake progress display. Do not promise mid-render cancellation before cleanup/recovery tests.
4. TASK-110: shared preview/export composition after TASK-082's benchmark/license ADR. Compare frozen
   assets and identical specs, text clarity, memory, time and frame parity. Remotion is a candidate,
   not selected. Verify crop/cursor/mask coordinates and approve the short style proof.
5. TASK-111: end-to-end highlight/walkthrough/report acceptance. Include deliberately failing features,
   partial coverage, stale approvals, restart/resume and privacy checks. Then full human film review.

Each implementation slice runs tests first, full pytest and Ruff. Frontend slices additionally run
Vitest, build and foreground Playwright with desktop/mobile and accessibility checks. Media slices
measure exact frame count/duration, full decode, source hashes, deliberate motion samples, native FPS
and full playback; audio true peak only when audio exists. Automated gates never replace human review.
Publish only task-related code/docs after verified gates, never runtime recordings or secrets.