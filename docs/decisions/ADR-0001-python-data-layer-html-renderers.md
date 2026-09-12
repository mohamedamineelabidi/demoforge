# ADR-0001: Python data layer, HTML/Playwright renderers, no Remotion for the MVP

Date: 2026-09-12. Status: accepted for the local pilot; amended by ADR-0003.

## Context
The product needs heavy extraction (git, markdown, images, scraping) and media rendering (video, deck, logo). Remotion (React video) was considered for the video layer.

## Decision
- Python 3.11 for the whole data layer and orchestration.
- Local video proof: ffmpeg for picture assembly and HTML overlays rendered with Playwright.
- Deck/PDF/PPTX and logo generation are deferred, not pilot renderer requirements.
- No Remotion in the local proof. Benchmark it at the editing milestone before adoption.

## Consequences
- One language for logic; Node used only as a rendering runtime (Playwright scripts).
- Repeatability requires frozen media plus pinned tools, fonts and templates; live capture is variable.
- Text is never rendered by ffmpeg `drawtext` (Fontconfig crash on Windows builds).
- TASK-082 selects one production renderer under the versioned storyboard contract after measuring
	quality, memory, latency, preview/export consistency and checking licensing. No permanent dual backend.
