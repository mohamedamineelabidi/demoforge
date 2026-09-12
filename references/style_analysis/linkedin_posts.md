# LinkedIn reference posts (lane B partial findings)

## Direct inspection: 2026-09-12

The following observations supersede conflicting historical notes below. Public post DOM and evenly
spaced frames from publicly served videos were inspected locally. This was sampled visual inspection,
not full playback or audio review. Temporary reference media is outside the checkout and is not reused.

| Activity | Observed media | Sampled visual direction |
|---|---|---|
| 7503485868112891904 | ML Intern, 36.053 seconds | White field, compact sans-serif text, input box, staged research/budget/training/result UI, closing tagline. Samples every 4 seconds. |
| 7503899570859585536 | Sandrine guide | Public DOM exposed written post content but no playable video. Carousel content was not verified. |
| 7503735902351806464 | OUI-1, 730x720, 10.233 seconds | Persistent title above device frame, prompt, code output, dashboard reveal. Samples every second. |
| 7503851876086644736 | Qwen3-TTS / Nari Labs, 1138x640, 41.216 seconds | Dark full-screen typography, bright linear trails, price chart, colored fields with feature list, brand ending. Samples every 4 seconds. |

These are two different directions, not one shared style. The user rejected template v2's serif text
and document-stack illustration. With the user unavailable to choose, template v3 provisionally follows
the fourth reference's full-screen sans-serif/linear-motion direction because it needs no fabricated
product UI. It does not copy its assets, metrics, exact composition or soundtrack. The current fixed
three-scene contract and silent output do not reproduce its richer shot sequence or sound design.
Creative approval remains pending. UI-led treatment needs actual permitted product assets.

## Historical Partial Findings

Source: a Hermes analyst subagent that inspected the media with vision but hit its iteration cap
before writing per-video files. Only its top-level findings survived; they are recorded here so
they are not lost. Treat as **lower confidence** than the per-video files in this folder (no
per-shot tables, frame numbers are the analyst's own 0.5 s sample indices, not 30 fps frames).

## Items

| id | source | media | status |
|---|---|---|---|
| li1 | lnkd.in/p/eqViknkH (Jerry Liu, LlamaParse) | video 992x640, 31.7 s | analysed |
| li2 | activity:7503485868112891904 (Hugging Face, "ML Intern") | video 640x640, 36 s | analysed |
| li3 | activity:7503735902351806464 (OUI-1 generative UI) | video 650x640, 10.2 s | analysed |
| li4 | activity:7503899570859585536 (Sandrine Zambou, Claude lead-gen guide) | document/carousel post, no video | text only, skipped |

Fetch notes: web_extract returned 403 and the browser daemon failed; a plain curl with a Chrome
user agent returned the public page. No login was attempted.

## Findings (analyst's ranked list, verbatim intent, cleaned wording)

1. Real screen recording of the live product with a visible native cursor doing the actual clicks (li1 samples 1-63, li2 samples 1-60).
2. Browser or device window floated on a soft pastel gradient with a drop shadow (li1 pink-to-blue gradient throughout; li3 phone mockup on light grey, samples 1-20).
3. Persistent small title caption above the mockup: product name plus one-line claim (li3 "Introducing OUI-1 / World's first Generative UI model", samples 1-20).
4. 3-beat structure: empty state or prompt, processing or streaming, finished result (li3: prompt 1-4, stream 5-11, final dashboard 12-20; li2: prompt, model runs, loss curve, Hub page).
5. Typewriter or streaming text reveal for prompts and model output, never instant text (li2 samples 1-12 word by word; li3 code stream 5-9).
6. Short kinetic headline cards between UI beats, centred sans-serif, black on white (li2 "Find, ground it in the research", "Make the dataset. Fire up the compute", "Watch it learn").
7. Polished launch teasers redraw the UI as motion design; founder posts use raw capture (YouTube 3Kcihys0gUY, k3d_xeVxEOE, awUYikrGsKk vs li1, li2).
8. Slow continuous zoom-in or drift on static screens instead of hard cuts; the three LinkedIn clips produced zero scene cuts at threshold 0.3.
9. End card: logo alone, then tagline, held about 3-4 s (li2 samples 65-72 "You have the ideas. The Hub has the details."; also 66XwG1CLHuU and 3Kcihys0gUY end cards).
10. Square or near-square aspect for feed videos (li2 640x640, li3 650x640) with generous whitespace around the UI.

## Relevance for DemoForge

Items 1, 2, 4, 5, 8 and 9 match the MVP (real footage, one continuous take with slow drift, 3
beats, honest end card). Item 10 suggests a 1:1 export variant later (TASK-089 territory), not
now. Item 7 is a warning: the polished look in several YouTube references comes from redrawn UI,
which DemoForge must not do (claims must come from real footage).
