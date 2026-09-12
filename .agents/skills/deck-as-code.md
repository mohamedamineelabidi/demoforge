# Skill: deck-as-code

Use when generating or reviewing the presentation deck.

## Pipeline
`narrative_pack + brand_kit + visual_assets -> deck.json (DeckSpec) -> Jinja2 layouts -> deck.html (offline) -> deck.pdf (Chrome) + deck.pptx (python-pptx) -> visual QA`

## Slide plan (MVP, 10 slides)
title, problem, solution, how_it_works, demo (real screenshot), feature_grid (max 4), architecture/tech, use_cases, install_cta, closing.

## Rules
- One message per slide: headline <= 8 words, <= 3 points, one asset or none. Enforced in `deck/slides.py` tests.
- Curated layouts only (`deck/layouts/*.html`): hero_statement, split_text_image, feature_grid_4, screenshot_full, code_block, closing. Adding a layout = template + sample render test.
- White background default; brand primary for accents; type scale and spacing from `brand_kit`. Dark canvas only for `developer_infra` style with a dark brand.
- Real product visuals only. No icon grids as decoration, no stock illustrations. If no screenshot is usable, the demo slide becomes a code_block with the real install/usage snippet.
- Data storytelling: one number + one sentence, never a table on a slide.
- Offline HTML: no CDN, fonts system stack or local woff2, SVG inlined. Integrity sweep must report 0 missing.

## Exports and checks
```bash
chrome --headless --disable-gpu --print-to-pdf="C:/abs/deck.pdf" --no-pdf-header-footer "file:///C:/abs/deck.html?print=1"
```
- PDF page count == slide count (pypdf).
- PPTX opens and slide count == 10.
- Visual QA: screenshot each slide, contact sheet, vision prompt from `docs/QUALITY_BAR.md` section 8; score < 3/5 on "generic AI look" or any clipped text re-queues the deck once with the critique.

## References
Hermes skills `html-pitch-deck-builder`, `pitch-deck-from-template`, `apple-design`, `popular-web-designs` (style archetypes, not assets to copy).
