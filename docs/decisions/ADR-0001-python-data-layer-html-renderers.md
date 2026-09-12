# ADR-0001: Python data layer, HTML/Playwright renderers, no Remotion for the MVP

Date: 2026-09-12. Status: accepted.

## Context
The product needs heavy extraction (git, markdown, images, scraping) and media rendering (video, deck, logo). Remotion (React video) was considered for the video layer.

## Decision
- Python 3.11 for the whole data layer and orchestration.
- Rendering through what is already proven in this team's earlier work: ffmpeg for picture assembly, an HTML overlay rendered frame by frame with Playwright, headless Chrome for SVG to PNG and HTML to PDF, python-pptx for PPTX.
- No Remotion in the MVP.

## Consequences
- One language for logic; Node used only as a rendering runtime (Playwright scripts).
- Deterministic renders: same spec, same pixels; testable with node:test and pytest.
- Text is never rendered by ffmpeg `drawtext` (Fontconfig crash on Windows builds).
- Remotion can be added later as an alternative `video` backend behind the same EDL spec.
