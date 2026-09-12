# Skill: logo-as-code

Use when a product has no logo and one must be proposed, or when building the brand page. Never use a generative image model: a logo must be vector, one-ink capable, editable, and legible at 16 px.

## Procedure (9 steps, all mandatory)

1. **Translate the product into primitives.** Ask "what does the product do?", never "what shape is pretty?". Pick at most 5 SVG primitives (`rect`, `circle`, `path`, `line`). Two elements, two weights (passive object ~0.3 opacity, active layer solid). More than 5 primitives is an illustration, not a logo.
2. **One grid, one weight variable.** Grid 100x100, optical centre (50,50). `SW = 7.0` is the only free stroke value; every other thickness derives from it (`SW*0.80`, `SW*0.86`). Radii are ratios of a side (`R = S*0.273`), never free numbers.
3. **Write a parametrised function, not a file.**
   ```python
   def MARK(col, cx=50, cy=50, sc=1.0, w=SW) -> str: ...  # returns SVG fragment
   ```
   `col` and `sc` yield the whole family (light, dark, accent, transparent, icon, favicon) in one pass.
4. **Compute collisions before rendering.** `margin_frame = S/2 - w/2 - (R_ring + w/2)`, `margin_dot = (gap - r_dot) - (R_ring + w/2)`. Any margin < 0: sweep the parameter in a table, pick the value balancing both margins. No render while geometry is wrong.
5. **Render and look.** SVG inlined in an HTML wrapper sized to target pixels, headless Chrome `--screenshot` with absolute path, `file://` URL, `--disable-application-cache`, unique wrapper filename. Load the PNG with vision and judge it like a print proof. The eye overrides the math for balance.
6. **Small-size survival strip.** Render 46 / 28 / 18 / 14 px on one sheet. A mark that dissolves at 16 px is dead.
7. **Look-alike test.** Vision prompt, fixed wording: "Does this resemble any existing well-known icon (RSS, wifi, power, menu/hamburger, camera lens, location pin, bluetooth, share)? Does it look intentional or accidental?" Concentric arcs are banned before vision (always RSS/wifi). A near-centred circle in a square is a lens: push dots to a quadrant.
8. **Measure the lockup.** `getBBox()` after `document.fonts.ready` on mark and text; require `markCy == textCy`, gap ~0.25 x mark width, mark height ~1.2 x text height; set `viewBox` width = `textRight + left_margin` so margins are equal.
9. **Export and verify the export.** Hash every PNG (`hashlib.md5`); identical hashes mean Chrome served cache. Fix: `file://`, `--disable-application-cache`, unique wrapper names, re-hash.

## Expected ratio
About 15 candidates for 2 kept. Listing the rejected ones and why (RSS, hamburger, record button, drop shadow, broken frame) is part of the deliverable.

## Rules for DemoForge
- If the repository or website already has a logo, reuse it; do not redesign. Generated marks are labelled "proposed" in `brand_kit.logo.label`.
- Reference implementation to port: `C:\Users\hp\netix_video\superpose-directions\build.py`, `verify.py`; Hermes skill `svg-logo-design`.
