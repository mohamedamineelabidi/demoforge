# Style analysis summary (13 reference videos)

Computed from the 13 per-video JSON files in this folder. Counts are string matches on the
recorded style attributes, so treat them as approximate; open the per-video file for the
frame-cited evidence. LinkedIn findings live in `linkedin_posts.md` (lower confidence).

## Corpus

| video | channel | duration s | shots | avg shot frames | real UI vs motion | 3-beat |
|---|---|---|---|---|---|---|
| ylEyGoNF3VU | Motion Swell | 11 | 4 | 82 | motion-designed recreation of ChatGPT UI, no real screen rec | yes: input typed (start) -> files analys |
| ZK-rNEhJIDs | What a Story - The Video Partner for SaaS & AI | 19 | 6 | 95 | recreated UI mockups (motion design), plus one stock footage | partial: problem headline (start) -> tou |
| -uHLJY66PDM | Zelios - Animated Video Production | 32 | 10 | 96 | recreated UI in motion design, composited on stock footage | yes: open library (start) -> configure t |
| SgmuplXU2iY | Zelios - Animated Video Production | 33 | 10 | 99 | fully motion-designed; UI recreated, no screen recording | yes: drop file (start) -> progress 79->9 |
| AxX0BHrEFJw | Juan Blanco | 42 | 22 | 57 | fully motion-designed, UI recreated on 3D cards | partial: Candidate Analysis table (start |
| VwxpmC4zhqo | Burnwe | 44 | 8 | 165 | real app screens composited into motion-designed phone mocku | yes: problem (frames 0-287) -> product/c |
| Hbj6WMhVByQ | Buff | 72 | 26 | 83 | live-action footage + motion graphics; UI only as static scr | no product start/action/result beat; nar |
| z9Zt8-PdZ4g | Zelios - Animated Video Production | 73 | 10 | 219 | motion-designed CGI, UI recreated in mockups | yes: type prompt + drop image (start, 61 |
| 66XwG1CLHuU | Apple | 76 | 15 | 152 | kinetic typography + 2 live-action inserts; no product UI | narrative (promise -> what we do -> not  |
| 3Kcihys0gUY | Beliv8 Motion - Top Quality Explainer Videos | 77 | 9 | 773 | almost entirely motion design and icon illustration; only th | yes: problem (frames 0-585) -> solution  |
| 4SCjXcBeW1E | Google Workspace | 87 | 16 | 124 | real Google Vids UI fragments re-composed as motion design;  | yes: intent typed as prompt (frames 0-40 |
| awUYikrGsKk | ObiN Studio | 95 | 11 | 260 | real product screenshots composited in motion design; no scr | yes: problem (frames 0-298) -> product r |
| k3d_xeVxEOE | OpenAI | 110 | 12 | 275 | 100 % motion design | no; it is a typography/identity reveal |

## Recurring patterns

- 3/13 real screen recording (any)
- 11/13 UI recreated as motion design
- 10/13 3-beat structure visible (yes/partial)
- 5/13 visible cursor or hand
- 12/13 zoom or push-in used
- 13/13 hard cuts dominant
- 8/13 device or browser mockup
- 7/13 gradient background
- 7/13 dark background dominant
- 6/13 typewriter or streaming text
- 13/13 audio track present

- Shot duration across 159 shots: min 14, median 101, mean 146, p90 324 frames at 30 fps.

## The uncomfortable finding

Almost every polished reference recreates the product UI in motion design instead of showing a
screen recording. That is exactly what DemoForge must not do (claims come from real footage).
So the target is: the *framing, pacing and typography* of these films applied to *real* footage.
The three LinkedIn founder posts are the closest to the DemoForge output (real capture, cursor,
one continuous take, slow drift).

## Top 10 techniques to reproduce (ranked by frequency, then fit with real footage)

1. One idea per shot, 90 to 240 frames, hard cut between beats (all 13).
2. Product framed inside a device or browser card with rounded corners and shadow on a flat or soft-gradient field (VwxpmC4zhqo, AxX0BHrEFJw, ZK-rNEhJIDs, li1, li3).
3. Three beats: start state, action, observable result (10/13 yes or partial; SgmuplXU2iY 'drop file -> progress -> done', ylEyGoNF3VU 'typed -> analysing -> result').
4. Typewriter or streaming caption reveal, never instant text (k3d_xeVxEOE 0-240, 66XwG1CLHuU throughout, li2, li3).
5. Slow push-in or drift on a static screen instead of a cut when nothing changes (li1, li2, li3, 66XwG1CLHuU live inserts).
6. Emphasis by a small annotation next to the control (green caret + word in 66XwG1CLHuU; pill labels in Hbj6WMhVByQ) rather than black masks.
7. Short kinetic headline card between UI beats, centred sans-serif, black on white or white on brand colour (3Kcihys0gUY, awUYikrGsKk, li2).
8. One accent colour per shot, background swaps on the beat as the transition (66XwG1CLHuU, Hbj6WMhVByQ, k3d_xeVxEOE).
9. Tiny margin captions (9-11 px equivalent) for facts, big type only for the claim (k3d_xeVxEOE, ZK-rNEhJIDs).
10. End card: logo or product name alone, then one sentence, held 90-120 frames (66XwG1CLHuU, 3Kcihys0gUY, li2).

## Palette families seen

- Paper white / light grey fields: #FFFFFF, #F1F1F6, #E8E8EA
- Near-black fields: #000000, #0F0F0F
- One saturated brand accent: #2A3DFF, #2FFF6B, #F5D90A, #F5C842, #F26A2E
- All hex values recorded: #000000, #04366B, #0A0A0A, #0A0F1E, #0B1022, #0B1E6B, #0F0F0F, #0F5F5F, #111111, #1A1A1A, #1A73E8, #1B1B1F, #1B2340, #1C1C1E, #1E1E22, #1E6BFF, #1F4BFF, #1F6BFF, #1F6FEB, #2A3DFF, #2F5BFF, #2F6BFF, #2F7BFF, #2FFF6B, #34A853, #3A5BFF, #3B4BFF, #3B82F6, #3C4043, #4285F4, #46D4F5, #4A4AFF, #4CAF50, #4FA0FF, #7A8BFF, #7B3FF2, #7FA7E8, #7FB6FF, #8E7CC3, #A142F4, #A26BFF, #B9B6F5, #B9F542, #C9CCFF, #CFE3FF, #DDE3F5, #E23D3D, #E5484D, #E64BB0, #E86A6A, #E8E8EA, #E8F1FF, #E9E6FA, #E9EEF6, #EA4335, #EAF1FB, #EAF1FF, #F1A07A, #F1F1F6, #F26A2E, #F2F2F5, #F3F4F6, #F4F5FA, #F4F6FB, #F5C518, #F5C842, #F5D90A, #F7D34B, #FBBC04, #FFFFFF

## Do NOT do

- Do not redraw or 'clean up' the UI; only real footage is allowed (contrast with 9/13 references).
- No flash cuts under 30 frames (Hbj6WMhVByQ 14-frame flashes) in a 30 s demo.
- No stock footage or CGI (z9Zt8-PdZ4g, -uHLJY66PDM).
- No black masks or heavy vignettes over the UI; use blur or a surface-coloured card.
- No metrics, percentages or superlatives in captions unless they are a typed claim with evidence.
- No em-dashes and no banned marketing phrases in captions (see docs/QUALITY_BAR.md).

## Machine-readable defaults

See `style_profile.json`. It is the generator's starting point, not a rule the user cannot change.
