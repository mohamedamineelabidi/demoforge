# ylEyGoNF3VU – ChatGPT SaaS Product Demo Ad

- **Channel:** Motion Swell
- **URL:** https://www.youtube.com/watch?v=ylEyGoNF3VU
- **Duration:** 11 s (330 frames @30fps)
- **Source fps:** 30000/1001 (all frame numbers below normalised to 30 fps)
- **Resolution analysed:** 1280x720
- **Audio stream:** yes
- **Scene cuts (scene>0.3):** 3 -> 4 shots, avg 82 frames

## Shot list

| shot | start_frame | end_frame | duration_frames | layout | motion | transition_in | text | highlight | notes |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0 | 49 | 49 | full-bleed pastel gradient (purple/blue/peach), floating white card | card fades/scales in, text types into card | none | GPT-5 / Flagship model, checkmark ticks | single white card centred on gradient, checkmark appears | frames 0-49: model-picker card mock, no real UI chrome |
| 2 | 49 | 172 | 123 | full-bleed white, centred pill search input, tagline bottom-centre | typewriter into input, tagline colour word swaps (deeper -> faster) | cut (gradient -> white) | Our smartest, fastest model yet / Think deeper / Think faster | typing caret in input, coloured keyword in tagline | frames 49-172: keyword color changes purple -> red -> orange on each swap |
| 3 | 172 | 215 | 43 | full-bleed light blue gradient, stacked file chips (pdf/xlsx/doc) | chips slide in vertically, 'Analyzing...' subtitle typing | cut | sales_deck.pdf, annual_report.xlsx, consult_notes.doc, Analyzing... | coloured icon per file type (pink/green/blue) | frames 172-215 |
| 4 | 215 | 330 | 115 | full-bleed white, large left-aligned body text, then warm gradient end card with pill button | text typewriter/streams in, zoom-in on paragraph (text grows to exceed frame), then cut to end card, button text types | cut | Go-to-market (sales_deck.pdf): The current sales deck positions... / Available now -> | zoom on streaming response text; CTA pill | frames 215-330; typed CTA 'Available n' -> 'Available now' with arrow |

## Style attributes

- **layout:** no device mockup; flat full-bleed compositions, single UI element (card, input pill, file chips, text block) centred on plain or gradient background
- **background:** alternates soft multi-stop pastel gradients (purple #8E7CC3, blue #7FA7E8, peach #F1A07A, cream #F6E7C8) and pure white #FFFFFF
- **typography:** sans-serif (Inter/SF-like), regular weight, sentence case; tagline bottom-centre with one coloured keyword; body text large left-aligned
- **palette_hex:** #FFFFFF, #8E7CC3, #7FA7E8, #F1A07A, #E86A6A, #1A1A1A
- **camera_motion:** mostly static; slow push-in on streaming text in shot 4 (frames ~250-290)
- **transitions:** hard cuts between scenes; elements fade/scale within scene
- **ui_highlight:** isolation (one element on empty canvas), colour keyword, checkmark reveal, zoom on generated text
- **text_animation:** typewriter/streaming characters, word swap with colour change
- **pacing_frames:** shots 49 / 123 / 43 / 115, avg 83; micro-beats every ~14 frames inside shots
- **cursor_or_hand:** none visible; typing caret only
- **real_ui_vs_motion:** motion-designed recreation of ChatGPT UI, no real screen recording
- **audio:** audio stream present (music/SFX, not analysed)
- **three_beat:** yes: input typed (start) -> files analysing (action) -> answer streams + CTA (result)

## Style verdict

1. Ultra-minimal motion-design ad: one UI element per scene on white or pastel gradient, never a full app screenshot (sheet_1 frames 0-172).
2. Story told via typewriter text and streaming responses, no cursor (sheet_1, sheet_2).
3. Hard cuts only, 4 shots in 330 frames, average 83 frames; feels calm because each shot holds 1.5-4 s.
4. Highlight = isolation + colour keyword + push-in on result text (frames 250-290), not boxes or spotlights.
5. Ends on a gradient CTA card with typed pill button (frames ~300-330).

_Evidence: contact sheets sheet_01.jpg, sheet_02.jpg, sheet_1.jpg, sheet_2.jpg, sheet_3.jpg (one tile every 0.46 s) plus ffmpeg scene detection. Frames/videos stay in scratch, not in the repo._
