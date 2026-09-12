# ADR-0005: Teaser mode, a motion-design video from a repository alone

Status: accepted, 2026-09-12. Supersedes the "footage required for every video" reading of PRD v2.

## Context

The 13 reference videos the user wants to match were analysed frame by frame
(`references/style_analysis/SUMMARY.md`). 11 of 13 never show a screen recording; they rebuild the
product as motion design: flat brand fields, kinetic typography, a device card, one accent colour,
typewriter captions, a three-beat structure and an end card. The user's request is explicit:
"based on a GitHub repo URL, create a video like the YouTube references". Requiring footage blocks
that request entirely.

## Decision

DemoForge has two modes that share the controller, schemas, approvals, quality bar and style profile.

- **Teaser mode (first milestone, this ADR).** Input: public GitHub URL, optional brief. Output:
  30 s 16:9 motion-design teaser. Every text line is a `documented` claim quoting the README,
  manifest or docs at a pinned commit. Product visuals are limited to raster images that exist in the
  repository (README screenshots, `docs/**/*.png`, logo). When no image exists, the scene shows the
  claim as typography on a device card, clearly styled as illustration. No invented UI screens.
- **Demo mode (later).** Authorized footage, `runtime_observed` claims, as PRD v2 describes.

## Consequences

- The footage stage becomes optional; a new `teaser` package renders HTML scene templates with the
  pinned Playwright rig and concatenates frames with FFmpeg, all foreground.
- The evidence report labels the export "Motion-design teaser built from repository text and images
  at commit X. Not a recording." That label is part of the artifact, not a footnote.
- Metrics, superlatives and features not present in the repository text are still banned.
- `docs/QUALITY_BAR.md` and the banned phrase list apply unchanged.
