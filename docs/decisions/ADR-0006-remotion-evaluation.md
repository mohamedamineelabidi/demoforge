# ADR-0006: Remotion Evaluation Benchmark

Date: 2026-09-15. Status: accepted for evaluation; not a production adoption.

## Context

TASK-082 requires comparing the existing HTML/Playwright/FFmpeg render pipeline with a
Remotion prototype under identical assets and specifications. Remotion 4.0.524 has been
installed in `tests/video/remotion/` as an evaluation placeholder since the project began.
The user requested a Google Workspace-style demo video using Remotion to showcase DemoForge.

## Decision

Build a standalone Remotion evaluation project in `demo-video/` that produces a 30-second
(900 frames, 30 fps, 1920x1080) product demo video. This serves as the Remotion benchmark
prototype for TASK-082 comparison. The existing HTML+FFmpeg pipeline remains the production
renderer until this evaluation is complete and a selection decision is recorded.

## Scope

- Remotion 4.0.524 with React 19 and TypeScript
- Six-scene composition using TransitionSeries
- Google Material Design 3 easing curves
- Silent output (no TTS integration)
- Mock UI components recreating DemoForge's interface, not screenshots
- Evaluation metrics: render time, peak memory, text quality, frame parity

## License

Remotion is free for companies under $10M annual revenue. DemoForge is pre-revenue.
The free tier applies. Production adoption requires recording this in a follow-up ADR
after TASK-082 comparison results are available.

## Consequences

The demo-video/ directory is an evaluation artifact. It does not replace video/assemble.py
or any production rendering code. The existing approval chain, storyboard contracts, and
render gates continue to govern production output. If Remotion is selected after TASK-082,
a separate migration ADR will document the transition plan.

