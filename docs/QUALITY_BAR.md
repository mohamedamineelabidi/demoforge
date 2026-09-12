# Quality Bar: how outputs avoid the generic AI look

This specifies target gates for the video-first product. Most are not implemented yet; TASKS.md tracks
their owners. The explicit workflow enforces code gates and revision-bound approvals. Vision critique
assists human review and cannot prove truth, full-frame privacy or motion quality. Deck/logo rules are deferred.

Application chrome follows [FRONTEND_DESIGN.md](FRONTEND_DESIGN.md), including responsive layouts,
accessible status colors, real workflow states and future visual QA acceptance. Its compact light
workspaces and dark log tool are separate from customer branding inside the scene/video canvas.
The layout, typography and brand rules below concern generated deliverables, not app navigation,
tables or editor panels. A design guide is not evidence that the frontend has been implemented or tested.

[MOTION_PRODUCTION.md](MOTION_PRODUCTION.md) adapts the user's launch-film references into motion
rules and a fixture-test acceptance matrix. The links/analysis are unreviewed inspiration, not proof
of runtime behavior or permission to reuse media. Technical gates and full human review both apply.

## 1. Truth first
- Every factual claim references revision-pinned evidence through Claim IDs, including final captions.
	Distinguish documented, statically_supported, runtime_observed and user_attested. Confidence heuristics
	are not calibrated probabilities. No evidence, no claim; schema validity and human approval are not proof.
- No fake metrics, no invented testimonials, no "accuracy %" or KPIs that are not in the source. Seeded or sample data is labelled "Demo data".
- Only real screenshots, real commands, real UI crops. Never a mock dashboard.

## 2. Copy
- One primary message per slide or scene. Headline <= 8 words, caption <= 7 words, <= 3 supporting points.
- Plain B2 English or French. Short sentences. Verbs over adjectives ("Build agents faster." not "A revolutionary platform").
- No em-dashes ("—") in generated copy. Use a comma, a colon or a full stop.
- Banned phrases: see `demoforge/quality/banned_phrases.txt` (revolutionize, unleash, game-changing, next-generation, supercharge, unlock the power, seamless, cutting-edge, empower, leverage, ...). Lint fails on any hit; one regeneration with the violations listed.
- Apply prose lint only to prose; preserve literal commands/code and source references. Validation/copy
	repair shares one content-repair budget. A second failure asks the user rather than silently passing.

## 3. Layout and typography
- Curated layout templates only; never free-form slide composition.
- White background by default for decks; dark canvas for developer-infra style only when the brand is dark.
- Strong hierarchy: display / heading / body / code sizes from the design tokens, never ad hoc sizes.
- Spacing from the token scale (4, 8, 12, 16, 24, 32, 48, 64, 96). 12-column grid, max width 1200.
- Representative images that explain the slide's goal, not decorative icons or stock illustrations.
- Data storytelling (one number, one chart, one sentence) over tables.

## 4. Color and brand
- Customer brand colors used intentionally: one primary, one accent, neutrals. No random gradients,
	decorative gradient orbs or glow blobs, including for AI-native dark brands.
- Text contrast >= 4.5:1 (WCAG AA). Planned enforcement belongs to `brand/tokens.py`;
	do not claim that this gate exists until implemented and verified.
- Keep fonts, colors, radii and motion consistent across a customer's generated deliverables
	(deck, video, docs, brand page). DemoForge chrome has its own tokens; never apply its indigo,
	fonts or status badges to customer exports by default. Scope preview styles to prevent theme leakage.

## 5. Motion (video)
- Demonstrate starting state -> action -> observable result with authorized footage. A homepage scroll
	or animated screenshot is not runtime proof. Pilot: three scenes, 900 frames at 30 fps, 16:9.
- Zoom <= 1.5x, readable holds, restrained easing and transitions. Timing follows the demonstrated action,
	not a mandatory cut rhythm. Caption/trim edits create new approved revisions without recapturing.
- App framing follows reusable brand tokens and safe areas; no decorative window is required.
- SFX sparse and tied to visible events, <= 14 cues per minute, no music unless requested, true peak <= -1 dBTP.
- Avoid: bouncy or spinning animations, random zooms, particle effects, linear motion, more than one transition type per cut.

## 6. Logo (deferred)
- Pilot reuses existing permitted logos or neutral tokens. No logo-generation dependency.
- Vector, one-ink capable, at most 5 primitives, single stroke-weight variable with derived ratios.
- Collision math before render; survives at 46/28/18/14 px; passes the look-alike test (RSS, wifi, power, menu, lens, pin, bluetooth, share).
- Reuse the product's existing logo when one exists; a generated one is labelled "proposed".

## 7. Deliverable hygiene
- HTML deliverables offline: no CDN, fonts local or system stack, SVG inlined, integrity sweep shows 0 missing files.
- SHA-256 identifies artifacts; MD5 may diagnose PNG caching. Equal hashes are failures only when
	variants must differ. Static video frames and identical intended assets are legitimate.
- Video: full decode exits 0, exact frame count/duration, audio peak <= -1 dBTP when present, text/asset
	integrity and full-video motion/privacy review. Silent exports are valid. PDFs are deferred.
- Privacy: remove sensitive demo data where possible; otherwise redact throughout affected intervals
	before sharable derivatives. Weak blur/contact-sheet review alone is insufficient.
- Approved claim/scenario/storyboard revisions and final artifact-hash approval are required. Failed or
	not_run required checks block export. Raw inputs have access restrictions and retention/deletion controls.

## 8. Vision critique prompts (fixed wording)
Deck: "Rate 1-5: does this look like a generic AI slide? Is text clipped? Is there one clear message? Is the hierarchy strong? Are images real product visuals?"
Logo: "Does this resemble any existing well-known icon (RSS, wifi, power, menu/hamburger, camera lens, location pin, bluetooth, share)? Does it look intentional or accidental?"
Video contact sheet: "Any blank frames? Any clipped window? Is the style consistent across scenes? Are masked areas unreadable?"

## 9. Final questions before delivery
Is the starting state/action/result understandable? Are displayed claims supported? Does the full video
protect private data and remain readable? Does it use permitted assets? Would the intended developer
or product team publish it? Record correction time and cost per accepted video, not only render success.
