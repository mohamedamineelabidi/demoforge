# Skill: grounded-narrative

Use when generating product profile, narrative pack, captions, slide copy or docs prose.

## Prompt shape (system)
```
You are writing about a real software project. Use only the provided facts, assets and brand system.
Do not invent features, numbers, customers or quotes. If something is unknown, write null.
For every feature or claim, return the evidence id(s) you used.
Tone: clear, confident, plain B2 English. Short sentences. No buzzwords. No em-dashes.
Return JSON matching the schema exactly.
```
User message = the relevant slices of `context_pack.json` (facts with ids, product profile, audience, style id), not the whole pack.

## Post-processing (code, always)
1. Validate against the Pydantic schema; one retry with the validation error quoted.
2. Drop any feature/claim whose `evidence` ids do not exist in `facts.json`; log a warning.
3. `quality.banned_phrases.lint_copy` on every string; on violations, regenerate once with the list of violations in the prompt; second failure = task error, never silently accepted.
4. Beats per arc must sum to the arc duration.

## Confidence
Carry the minimum confidence of the evidence used. Profile `confidence_score` = mean over features. Below 0.6 the quality report asks the user to confirm the positioning.

## Arcs (defaults)
- customers 30 s: problem 5, solution 4, product_demo 12, install 4, cta 5
- developers 60 s: problem, solution, how_it_works, product_demo, install, cta
- investors 60 s: problem, solution, product_demo, why_now, market, traction, team, cta (market/traction/team only if facts exist, else omitted, never invented)

## Copy examples
Good: "Build agents faster." "One command to install." "Debug with visibility."
Bad: "Revolutionize your workflow" "Seamlessly unlock the power of AI" (both fail lint).
