# DemoForge Frontend Design

## Scope and status

Design contract for the planned DemoForge application, not a shipped frontend or a customer video
template. [PRD](../PRD.md) defines behavior; [TASKS](../TASKS.md) controls delivery and dependencies.
The planned editor uses React, TypeScript, Vite and TanStack Query. This document does not authorize
framework installation, hosted services or a renderer choice. Remotion requires the TASK-082 decision.
See the [quality bar](QUALITY_BAR.md) for evidence, privacy and export gates.

## Visual direction

Adapt "Kinetic Bento & Clean AI Native" to a quiet, precise production tool. Use the supplied
LocalCan, Calendly and Glide references for compact hierarchy, clear navigation and tactile controls,
not as templates to copy. Light canvas, white work surfaces, subtle inset regions and one dark
execution-log tool provide contrast. Indigo is a limited action/selection accent, not a dominant
purple theme. Emerald and amber communicate verified success and waiting with accompanying labels.

"Bento" means organized regions with useful density, not a dashboard of floating section cards.
Keep page sections unframed; frame only repeated items and intentional tools such as the log viewer.
No nested floating cards, decorative gradient orbs, glow blobs, marketing hero or oversized headings.
Use solid fills, borders and small control shadows for depth. All letter spacing is zero. Card and
tool radii stay at or below 8px; pill geometry is reserved for statuses and filters.

"Kinetic" means feedback tied to real interactions and state changes, not perpetual animation.
Do not copy incompatible pasted HTML or Tailwind v3 snippets. The tokens below are framework-neutral
CSS; Tailwind is not required. If adopted in its owning task, select a compatible version explicitly
and verify its configuration and build rather than assuming a snippet's version.

## Tokens

Example app-chrome tokens, not a complete stylesheet or installed theme:

```css
:root {
  --df-canvas: #F9FAFC;
  --df-surface: #FFFFFF;
  --df-inset: #F1F3F7;
  --df-obsidian: #0C0D0E;
  --df-dark-surface: #16181A;
  --df-dark-border: #26292E;
  --df-ink: #0F172A;
  --df-muted: #64748B;
  --df-secondary: #475569;
  --df-border: #E2E8F0;
  --df-control-border: #64748B;
  --df-accent: #6366F1;
  --df-action: #4338CA;
  --df-success: #10B981;
  --df-waiting: #F59E0B;
  --df-info-bg: #EEF2FF;
  --df-info-text: #3730A3;
  --df-success-bg: #ECFDF5;
  --df-success-text: #065F46;
  --df-waiting-bg: #FFFBEB;
  --df-waiting-text: #92400E;
  --df-error-bg: #FEF2F2;
  --df-error-text: #991B1B;
  --df-neutral-bg: #F1F3F7;
  --df-neutral-text: #475569;
  --df-log-text: #E2E8F0;
  --df-log-muted: #CBD5E1;
  --df-focus: #4338CA;
  --df-focus-dark: #A5B4FC;
  --df-font-sans: "Geist Sans", "Segoe UI", sans-serif;
  --df-font-mono: "Geist Mono", Consolas, monospace;
  --df-text-small: 0.75rem;
  --df-text-label: 0.875rem;
  --df-text-body: 1rem;
  --df-text-section: 1.125rem;
  --df-text-title: 1.5rem;
  --df-tracking: 0;
  --df-space-1: 4px;
  --df-space-2: 8px;
  --df-space-3: 12px;
  --df-space-4: 16px;
  --df-space-6: 24px;
  --df-space-8: 32px;
  --df-radius-control: 6px;
  --df-radius-tool: 8px;
  --df-control-size: 36px;
  --df-touch-target: 44px;
}

.demoforge-chrome {
  font-family: var(--df-font-sans);
  font-size: var(--df-text-body);
  line-height: 1.5;
  letter-spacing: var(--df-tracking);
  color: var(--df-ink);
  background: var(--df-canvas);
}

.demoforge-chrome :where(button, input, select, textarea) {
  font: inherit;
  letter-spacing: var(--df-tracking);
}

.demoforge-chrome :focus-visible {
  outline: 2px solid var(--df-focus);
  outline-offset: 2px;
}

.demoforge-log :focus-visible {
  outline-color: var(--df-focus-dark);
}

.scene-preview {
  aspect-ratio: 16 / 9;
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
```

Use locally bundled, licensed Geist Sans and Geist Mono; retain license notices and verify embedding
rights before shipping fonts. Plus Jakarta Sans and JetBrains Mono are alternatives only after the
same review. No Inter, default-font-led theme, runtime font CDN or remote font dependency. System
fallbacks above are for font failure and platform coverage, not the intended visual identity.

At a default 16px root size the type scale is 12/14/16/18/24px. Use 14px for dense rows and controls,
16px for reading/editing and mobile inputs, 18px for panel headings and 24px for page titles.
Reserve 12px for secondary metadata, not critical approval text. Use 400/500/600 weights, body line
height 1.5 and heading line height 1.25. Mono is for revisions, paths, timecodes and sanitized logs.
Honor user font scaling; no viewport-width font sizing or negative tracking, including headings.

The supplied accent/status colors are markers, not small text colors on white. Use the semantic
text/background pairs above for status labels; each must meet WCAG AA normal-text contrast >= 4.5:1.
Use `--df-action` for light-surface links and white-text primary actions. Do not assume white text
on `--df-accent`, `--df-success` or `--df-waiting` passes. Use `--df-muted` only on white/light canvas;
use `--df-secondary` on inset surfaces. Dark logs use the log text tokens, not light-surface status
text tokens. Verify all actual combinations, including hover, selected and error states.
Subtle borders organize surfaces; use the stronger control border or another >= 3:1 cue when an
outline is needed to identify an interactive control. Focus cues also need >= 3:1 adjacent contrast.

## Workspaces and controls

- Projects and runs: an unframed list/table with project name, source revision, actual workflow
  stage, latest available update and a clear next action. Use filters, not invented KPI tiles.
- Evidence and claims: a scan-friendly list plus selected detail pane showing evidence kind,
  source location, revision and Claim IDs. Show human approval separately from evidence strength;
  approval is not proof. Keep claim/scenario approval and missing-input questions close to context.
- Supplied footage: show authorized thumbnails, filename, measured media metadata, provenance,
  permission and privacy review state. Unreviewed/raw media must not leak into shared previews.
- Scene editor: scene list, stable preview and property inspector for captions, trims, ordering,
  brand controls and revision history. Provide numeric timecode entry and move-up/down actions as
  keyboard alternatives to dragging. Do not invent a general-purpose timeline suite.
- Render jobs: show authoritative stage/attempt state and available measurements. Frame the
  collapsible dark execution-log viewer as a tool with sanitized lines, timestamps, copy and pause
  auto-scroll controls. It is not a decorative terminal or autonomous-agent activity feed.
- Review and export: full-video playback, evidence links, required check results, privacy review
  and approval of the exact artifact hash/revision. Failed or not-run required checks block export.

Navigation and first screen support work, not a sales landing page. No GTM agents, CRM, webhook
demo content or autonomous swarm. Unimplemented functions must not appear operational.

Use Lucide icons for compact tool actions such as undo, redo, playback, zoom and download; provide
accessible names and tooltips on hover and keyboard focus. Use icon-plus-text for consequential
commands such as approval or export. Tooltips supplement, never replace, accessible names.
Use swatches with text names for colors, tabs for views, segmented controls for modes, switches or
checkboxes for binary settings, and sliders/steppers/inputs for numeric values. Filters and statuses
may be pills; ordinary command buttons and settings must not become pill-shaped text chips.
Fix control/icon dimensions so hover, loading or long labels do not shift adjacent controls.
Allow labels to wrap where appropriate; disclose truncated paths/revisions through accessible detail.

## Responsive behavior

Desktop: compact navigation rail, project/run header and task toolbar above an unframed workspace.
The scene editor uses three tracks: a 200-240px scene list, flexible preview (`minmax(0, 1fr)`) and
280-320px inspector. Collapse side panes when their minimum widths no longer fit; do not squeeze
the preview or overlap labels to preserve three columns. Logs sit in a resizable or collapsible
execution region, not behind the scene canvas. Content determines breakpoints.

Tablet: reduce to preview plus one selectable pane. Mobile: navigation becomes a drawer; stack the
header and toolbar, retain the preview, and switch scene/properties/evidence/log views with accessible
tabs. Rows become labeled stacked fields when a table cannot fit. Keep approval and export reachable
without covering playback or content; account for device safe areas. Dialogs fit the viewport and
scroll internally where needed. No horizontal page scroll at 320px; code/log areas may scroll locally.

The pilot scene preview reserves a 16:9 box before loading, while playing and on error. Fit media
without distortion using contain/letterboxing; source cropping is an explicit scene edit. Future
aspect ratios must come from the approved scene spec, not the viewport. Keep playback controls
outside the image bounds, preserve caption safe areas and use real footage or an honest placeholder.
Changing zoom, selection, loading text or transport labels must not resize the preview.

## States and accessibility

| State | Required presentation and behavior |
| --- | --- |
| Loading | Reserve layout; mark the region busy, with restrained skeletons or a labeled indicator. Never imply a running render before the controller confirms it. |
| Empty | State what is missing and offer the relevant input action. No fabricated project rows, screenshots or performance figures. Explicitly label any isolated fixture view as Demo data. |
| Queued/running | Display only backend-confirmed state. Show measured progress only when available; unknown is not zero. Do not invent percentages, ETAs, throughput or running counts. |
| Awaiting approval | Amber marker plus explicit text, target revision and review action. The workflow is paused; do not show a worker as still running. |
| Stale revision | Warning text with edited versus approved revision and affected downstream artifacts. Reject conflicting saves; require refresh/reconciliation and renewed approval where invalidated. |
| Error | Error icon and plain text with safe diagnostic detail, preserved user input and an allowed recovery action. Do not expose secrets or offer retry where the workflow forbids it. |
| Privacy restricted | Clearly distinguish permission missing, review pending, redaction required and access denied. Hide restricted imagery/log content and block sharing/export until required gates pass. |
| Ready/approved | Emerald marker and explicit scope: stage completed, revision approved or artifact approved. Never merge these into a misleading global success state. |
| Cancelled/disconnected | Neutral label and last-known update. Indicate stale connectivity; do not infer success, failure or resumed execution from a client timeout. |

TanStack Query represents server state, not an alternate workflow controller. Save pending/saved/error
must be distinct. Do not optimistically claim approval, render completion or export eligibility.
Use semantic landmarks, headings, tables and native controls; expose selection and validation errors
programmatically. Keyboard users can reach all controls, operate tabs, reorder scenes and dismiss
dialogs; trap focus only inside modal dialogs and restore it on close. Never hide focus rings.
Announce meaningful state transitions without streaming every log line into a live region.

Compact 36px visual controls can use separated 44px hit areas; touch layouts require at least
44x44px targets with no overlap. Check layout at 200% zoom and with enlarged text. Labels must remain
readable without colliding or disappearing. Never communicate status only by color or animation.
Use short 120-180ms transitions only for meaningful feedback. Honor `prefers-reduced-motion` by
removing nonessential movement, shimmer and auto-scroll; keep explicit user-controlled video playback.
Do not autoplay preview media. Explain blocked actions with a nearby reason, not only a disabled tooltip.

## Brand boundary

DemoForge chrome owns navigation, controls, status labels, logs and review metadata. The scene/video
canvas owns the customer's permitted logos, licensed fonts, brand colors and approved footage.
Do not inject DemoForge indigo, typography or badges into exports unless explicitly requested.
Keep chrome styles scoped and isolate preview styling so selectors and CSS variables do not leak
across the boundary. Brand editing updates the versioned scene/brand data, not the application theme.
Use neutral output tokens when customer assets are missing; do not invent a logo or copy UI from
another product. Evidence/approval identifiers remain attached through edits and rendering.
Offline customer review HTML uses bundled or system fonts, no CDN and inlined SVG, independently
of the application build. See the [quality bar](QUALITY_BAR.md) for deliverable-specific rules.

## Visual QA acceptance

These are future implementation gates, not existing tests, screenshots or completed checks. Record
the frontend revision, fixture data, browser version, viewport, expected result and observed result.

- Capture and inspect Playwright screenshots at 1440x900, 1024x768, 390x844 and 320x568 for each
  core workspace and the state matrix above. No overlaps, clipped action text or page overflow.
- Exercise project/run navigation, evidence review, supplied-footage selection, caption/trim/order
  editing, approval, render recovery and review/export with controlled fixtures. Confirm UI state
  matches the controller; include stale saves, disconnected polling and invalidated approvals.
- Verify preview bounds and aspect ratio before/after loading, playback, zoom and error; inspect
  actual pixels for nonblank footage and permitted asset rendering. Compare preview/export at the
  same approved scene revision and check caption readability and safe areas.
- Test full keyboard paths, dialog focus return, named icon tooltips, touch hit boxes, 200% zoom,
  enlarged text and reduced motion. Combine automated accessibility checks with manual inspection.
- Measure text contrast >= 4.5:1 and required control/focus contrast >= 3:1 on actual rendered
  backgrounds. Inspect all statuses, dark logs, hover/selected states and local-font failure fallback.
- Inspect computed typography for zero tracking and fixed rem/px sizes. Confirm card/tool radius
  <= 8px, pills only for filters/statuses, no nested section cards and no decorative glow/orbs.
- Switch customer brand assets and confirm chrome is unchanged; switch app views and confirm the
  video canvas is unchanged. Verify no private raw data in shared views, copied logs or screenshots.
- Confirm missing inputs show honest empty states, unknown metrics remain unknown and restricted
  or stale approvals cannot enable export. Check offline review assets with network disabled.
- Run the frontend's implemented typecheck/tests and required API/media gates from the owning task.
  Record failures and untested cases explicitly; documentation checks alone cannot satisfy UI QA.