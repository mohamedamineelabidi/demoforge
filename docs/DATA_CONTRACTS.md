# Data Contracts

Every pack the data layer produces and every spec a generator consumes. Pydantic models in `demoforge/schemas/` are the executable version; this file is the human-readable one. Examples here are used as round-trip fixtures by `tests/schemas/`.

Conventions: snake_case keys; timestamps ISO-8601 UTC; paths relative to the run folder `workspace/<run_id>/`; every inferred field carries `confidence` in [0,1]; every factual claim carries `evidence`.

## Shared types

```json
"Evidence": {"source": "README.md", "line": 45, "url": null, "quote": "npm install agentflow"}
```
`source` is a repo-relative file or `website`, `github_api`, `manifest:package.json`. `line` optional. `quote` <= 200 chars.

## 1. RepositoryEntity (`curated/repository.json`) — required

```json
{
  "repo_url": "https://github.com/example/product",
  "name": "product",
  "full_name": "example/product",
  "description": "A framework for building AI agents",
  "default_branch": "main",
  "commit_sha": "abc123",
  "homepage": "https://product.dev",
  "stars": 12000, "forks": 900, "open_issues": 45,
  "license": "MIT",
  "languages": {"TypeScript": 78, "Python": 15, "Shell": 7},
  "topics": ["ai", "agents", "framework", "developer-tools"],
  "latest_release": {"tag": "v1.4.0", "published_at": "2026-05-01T00:00:00Z"},
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2026-06-01T00:00:00Z"
}
```

## 2. FileRecord (`staging/files.json`, list) — required

```json
{"path": "README.md", "classification": "readme", "priority": "high", "size_bytes": 8123, "content_hash": "sha1:...", "language": "markdown"}
```
`classification` in: readme, documentation, example, asset, image, video, config, manifest, source_code, test, ci_cd, license, changelog, deployment, security, ignored. `priority` in: high, medium, low.

## 3. Fact (`curated/facts.json`, list) — required

```json
{
  "fact_id": "fact_0001",
  "topic": "installation",
  "field": "install_command",
  "value": "npm install agentflow",
  "language": "bash",
  "evidence": {"source": "README.md", "line": 45, "quote": "npm install agentflow"},
  "verified_by": ["manifest:package.json"],
  "confidence": 0.98
}
```
`topic` in: identity, installation, usage, feature, architecture, configuration, api, cli, deployment, security, license, changelog, audience, problem, solution.

## 4. VisualAssetEntity (`curated/visual_assets.json`, list)

```json
{
  "asset_id": "va_001",
  "type": "screenshot",
  "source": "https://product.dev",
  "path": "staging/extracted_images/homepage_desktop.png",
  "page": "homepage", "viewport": "desktop",
  "width": 1920, "height": 1080,
  "dominant_colors": ["#0A84FF", "#FFFFFF", "#0B0C10"],
  "ui_elements_detected": ["navbar", "hero", "cta_button"],
  "blur_score": 812.4, "phash": "d1c4...",
  "quality_score": 0.92,
  "usable_in_video": true, "usable_in_deck": true
}
```
`type` in: screenshot, logo, favicon, social_preview, diagram, icon, gif, video, illustration, unknown. `viewport` in: desktop, tablet, mobile, null.

## 5. BrandKitEntity (`curated/brand_kit.json`)

```json
{
  "mode": "auto",
  "logo": {"primary": "outputs/brand/svg/lockup-dark.svg", "icon": "outputs/brand/svg/icon.svg", "favicon": "outputs/brand/png/favicon-32.png", "social_preview": null, "origin": "generated", "label": "proposed"},
  "colors": {"primary": "#0A84FF", "secondary": "#5856D6", "accent": "#FF9F0A", "background_light": "#FFFFFF", "background_dark": "#0B0C10", "text_primary": "#111111", "text_secondary": "#555555"},
  "typography": {"headline_font": "Inter", "body_font": "Inter", "code_font": "JetBrains Mono", "source": "local"},
  "ui_style": {"border_radius": 12, "shadow_style": "soft", "spacing_scale": [4, 8, 12, 16, 24, 32, 48, 64, 96], "icon_style": "linear", "dark_mode": true},
  "type_scale": {"display": 64, "heading_1": 40, "heading_2": 28, "body": 18, "caption": 14, "code": 14},
  "motion": {"easing": "easeInOutCubic", "duration_fast_ms": 150, "duration_normal_ms": 300, "duration_slow_ms": 600, "scene_transition": "fade_slide"},
  "tone_of_voice": {"personality": ["technical", "confident", "clear"], "avoid": ["salesy", "buzzwords", "fake urgency"]},
  "contrast_checks": [{"fg": "#111111", "bg": "#FFFFFF", "ratio": 18.9, "pass": true}],
  "do_not_use": ["random 3D shapes", "generic gradients", "fake dashboard screenshots", "stock illustrations"],
  "confidence": 0.8
}
```
`mode` in: auto, user, merged. `logo.origin` in: repo, website, user, generated.

## 6. ProductProfileEntity (`curated/product_profile.json`) — required

```json
{
  "product_name": "AgentFlow",
  "tagline_options": ["Build production-ready AI agents faster"],
  "category": "Developer Tool",
  "problem": {"text": "...", "evidence": [{"source": "README.md", "line": 12}], "confidence": 0.8},
  "solution": {"text": "...", "evidence": [{"source": "README.md", "line": 20}], "confidence": 0.85},
  "primary_audience": "AI engineers", "secondary_audience": "Backend developers",
  "key_features": [{"name": "Agent orchestration", "description": "...", "evidence": [{"source": "README.md", "line": 45}], "confidence": 0.95}],
  "value_props": ["Reduce boilerplate"],
  "use_cases": ["Customer support agents"],
  "tech_stack": {"frontend": ["react"], "backend": ["fastapi"], "database": ["postgresql"], "ai": ["openai"], "deployment": ["docker"]},
  "install_command": {"value": "npm install agentflow", "evidence": [{"source": "README.md", "line": 45}], "verified_by": ["manifest:package.json"]},
  "confidence_score": 0.86
}
```

## 7. NarrativePack (`curated/narrative_pack.json`)

```json
{
  "hero_headline": "Build agents faster.",
  "tagline": "Production-ready AI agents in minutes",
  "problem_framing": "...", "value_proposition": "...",
  "arcs": [
    {"arc_id": "customer_30s", "audience": "customers", "duration_seconds": 30,
     "beats": [{"beat": "problem", "message": "Building AI agents is hard", "seconds": 5, "visual_hint": "typography"},
               {"beat": "solution", "message": "Meet AgentFlow", "seconds": 4, "visual_hint": "logo_reveal"}]}
  ],
  "demo_script": ["..."],
  "copy_lint": {"passed": true, "violations": []}
}
```
`beat` in: problem, solution, product_demo, how_it_works, why_now, market, traction, team, install, cta.

## 8. MotionStyleEntity (`curated/motion_style.json`)

```json
{"style_id": "developer_infra", "fps": 30, "resolution": [1920, 1080], "duration_range": [25, 35], "easing": "easeOutQuint", "max_zoom": 1.5, "camera_language": ["smooth zoom", "soft pan"], "transition_style": ["cut", "fade"], "typography_animation": ["fade up", "line mask reveal"], "sfx_policy": {"max_per_minute": 14, "music": false}, "avoid": ["bouncy animations", "spinning", "particles"]}
```

## 9. Storyboard / EDL (`outputs/video/edit.json`)

```json
{
  "fps": 30, "width": 1920, "height": 1080, "canvas_color": "#0B0C10",
  "frames": {"desktop": {"x": 160, "y": 90, "w": 1600, "h": 900, "radius": 18}, "phone": {"x": 765, "y": 60, "w": 390, "h": 844, "radius": 40}},
  "total_frames": 900,
  "scenes": [
    {"id": "s01_problem", "layout": "graphic", "duration_frames": 150, "chapter": "01", "caption": "Building AI agents is hard.", "sfx": []},
    {"id": "s03_home", "layout": "desktop", "source": "staging/extracted_images/homepage_desktop.png", "source_in_seconds": 0,
     "duration_frames": 180, "chapter": "02", "caption": "One framework. Real agents.",
     "zoom": [{"frame": 0, "scale": 1.0, "cx": 960, "cy": 540}, {"frame": 90, "scale": 1.4, "cx": 1200, "cy": 300}],
     "spotlight": {"frame": 100, "hold": 40, "x": 1306, "y": 220},
     "masks": [{"id": "email", "kind": "blur", "rect": [1250, 24, 1530, 78]}]}
  ]
}
```
Rules (tested): scenes contiguous, sum of `duration_frames` = `total_frames`, `zoom.scale` <= `max_zoom`, spotlight within scene, sources exist. `layout` in: graphic, desktop, phone, passthrough.

## 10. DeckSpec (`outputs/deck/deck.json`)

```json
{
  "style_id": "minimal_saas", "aspect": "16:9",
  "slides": [
    {"n": 1, "slide_type": "title", "layout": "hero_statement", "headline": "AgentFlow", "subheadline": "Build agents faster.", "asset": "outputs/brand/svg/lockup-dark.svg"},
    {"n": 2, "slide_type": "problem", "layout": "split_text_image", "headline": "AI agents are powerful but fragile", "points": ["...", "...", "..."], "asset": "staging/extracted_images/homepage_desktop.png", "evidence": [{"source": "README.md", "line": 12}]}
  ]
}
```
`slide_type` in: title, problem, solution, how_it_works, demo, feature_grid, architecture, use_cases, install_cta, closing (MVP). `layout` in: hero_statement, split_text_image, feature_grid_4, screenshot_full, code_block, closing. Headline <= 8 words, <= 3 points.

## 11. QualityReport (`curated/quality_report.json`) — required

```json
{
  "overall_score": 0.83,
  "dimensions": {"completeness": 0.9, "evidence_coverage": 0.85, "asset_usability": 0.6, "brand_confidence": 0.8},
  "missing_fields": ["logo", "target_audience"],
  "warnings": ["No product website found", "Only one screenshot available"],
  "questions_for_user": ["Upload 2 to 4 UI screenshots (min 1280 px wide)", "Confirm the target audience"],
  "secrets_found": 0,
  "gate": "pass"
}
```
`gate` in: pass, ask_user, fail. Orchestrator stops on `ask_user` or `fail`.

## 12. AgentContextPack (`curated/context_pack.json`) — required

```json
{
  "run_id": "example-product-20260912-1000",
  "generated_at": "2026-09-12T10:00:00Z",
  "repository": "<RepositoryEntity>",
  "product_profile": "<ProductProfileEntity>",
  "facts": ["<Fact>"],
  "visual_assets": ["<VisualAssetEntity>"],
  "brand_kit": "<BrandKitEntity | null>",
  "narrative": "<NarrativePack | null>",
  "motion_style": "<MotionStyleEntity | null>",
  "technical": {"languages": {}, "frameworks": [], "entrypoints": [], "cli_commands": [], "env_vars": [], "api_routes": []},
  "style_constraints": {"quality_bar": "docs/QUALITY_BAR.md", "banned_phrases": "demoforge/quality/banned_phrases.txt", "avoid": []},
  "quality": "<QualityReport>"
}
```

## 13. Swarm message (`workspace/<run>/messages.jsonl`, one per line)

```json
{"ts": "2026-09-12T10:05:00Z", "from": "narrative", "to": "orchestrator", "type": "done", "subject": "narrative_pack ready", "refs": ["curated/narrative_pack.json"], "body": null}
```
`type` in: done, need, blocker, review_ok, review_reject, ask_user. `from`/`to` are role ids: orchestrator, ingest, brand, narrative, deck, video, docs, qa, user.
