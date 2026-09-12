# Quality Bar: how outputs avoid the generic AI look

This file is a rule set, not advice. Generators and the QA role enforce it with code (`demoforge/quality/`) and with fixed vision-critique prompts.

## 1. Truth first
- Every feature, number, command and quote carries `evidence` (file + line, or URL) and `confidence`. No evidence, no claim.
- No fake metrics, no invented testimonials, no "accuracy %" or KPIs that are not in the source. Seeded or sample data is labelled "Demo data".
- Only real screenshots, real commands, real UI crops. Never a mock dashboard.

## 2. Copy
- One primary message per slide or scene. Headline <= 8 words, caption <= 7 words, <= 3 supporting points.
- Plain B2 English or French. Short sentences. Verbs over adjectives ("Build agents faster." not "A revolutionary platform").
- No em-dashes ("—") in generated copy. Use a comma, a colon or a full stop.
- Banned phrases: see `demoforge/quality/banned_phrases.txt` (revolutionize, unleash, game-changing, next-generation, supercharge, unlock the power, seamless, cutting-edge, empower, leverage, ...). Lint fails on any hit; one regeneration with the violations listed.

## 3. Layout and typography
- Curated layout templates only; never free-form slide composition.
- White background by default for decks; dark canvas for developer-infra style only when the brand is dark.
- Strong hierarchy: display / heading / body / code sizes from the design tokens, never ad hoc sizes.
- Spacing from the token scale (4, 8, 12, 16, 24, 32, 48, 64, 96). 12-column grid, max width 1200.
- Representative images that explain the slide's goal, not decorative icons or stock illustrations.
- Data storytelling (one number, one chart, one sentence) over tables.

## 4. Color and brand
- Brand colors used intentionally: one primary, one accent, neutrals. No random gradients, no glow unless the brand is AI-native dark.
- Text contrast >= 4.5:1 (WCAG AA). Checked in `brand/tokens.py`.
- Same fonts, colors, radii and motion everywhere (deck, video, docs, brand page).

## 5. Motion (video)
- Product choreography, not a slideshow: problem statement, logo, real homepage, zoom to a feature, install command, code, CTA.
- Zoom <= 1.5x, easing easeInOutCubic or easeOutQuint, cut rhythm 2 to 3 seconds, 14-frame fade-in, 8-frame fade-out before a cut.
- App shown in a rounded, shadowed window on a flat brand-colored canvas.
- SFX sparse and tied to visible events, <= 14 cues per minute, no music unless requested, true peak <= -1 dBTP.
- Avoid: bouncy or spinning animations, random zooms, particle effects, linear motion, more than one transition type per cut.

## 6. Logo (when generated)
- Vector, one-ink capable, at most 5 primitives, single stroke-weight variable with derived ratios.
- Collision math before render; survives at 46/28/18/14 px; passes the look-alike test (RSS, wifi, power, menu, lens, pin, bluetooth, share).
- Reuse the product's existing logo when one exists; a generated one is labelled "proposed".

## 7. Deliverable hygiene
- HTML deliverables offline: no CDN, fonts local or system stack, SVG inlined, integrity sweep shows 0 missing files.
- Exports verified by machine: PNG sets by MD5 (no duplicates), videos by `ffprobe -count_frames` and full decode, PDFs by page count.
- Privacy list: real names, emails, paths, tokens masked in captures.

## 8. Vision critique prompts (fixed wording)
Deck: "Rate 1-5: does this look like a generic AI slide? Is text clipped? Is there one clear message? Is the hierarchy strong? Are images real product visuals?"
Logo: "Does this resemble any existing well-known icon (RSS, wifi, power, menu/hamburger, camera lens, location pin, bluetooth, share)? Does it look intentional or accidental?"
Video contact sheet: "Any blank frames? Any clipped window? Is the style consistent across scenes? Are masked areas unreadable?"

## 9. Final questions before delivery
Does it look like a real startup made it? Is the product understandable in 10 seconds? Are the features accurate? Does the design match the brand? Would a founder show this to investors? Would a developer share it publicly?
