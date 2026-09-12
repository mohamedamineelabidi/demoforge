# Skill: local frontend development

Use for frontend/ work. Read frontend/README.md, docs/FRONTEND_DESIGN.md and ADR-0004 first.
The user authorized parallel UI development; do not edit Hermes-owned Python files or stage them.

Commands from repository root:

```bash
npm --prefix frontend ci
npm --prefix frontend test
npm --prefix frontend run build
npm --prefix frontend run dev -- --port 5174
npm --prefix frontend run test:browser
```

Start Vite as a dev server, but run Playwright in the foreground. Use the printed URL; when different,
set FRONTEND_URL for browser tests. Chrome must be installed. Outputs under frontend/test-results/ and
frontend/dist/ are ignored. Do not commit recordings, traces or private data. The permitted fixture
screenshot under public/ is generated from our own Fixture component and labeled Demo data.

Write logic tests first. Run the focused test immediately after a change, then browser checks for
meaningful workflow/layout risks. Inspect screenshots at desktop/mobile sizes. Run repository pytest
and Ruff too; concurrent backend failures are blockers to report, not permission to modify that lane.
Record local-only limitations. No backend approvals, renders or exports can be simulated as real.

Evidence/quality import work lives in frontend/src/evidence/. Run focused checks with
`npm --prefix frontend test -- src/evidence/imports.test.ts` and
`npm --prefix frontend run test:browser -- imports.spec.ts`. Test fixtures under test-fixtures/ are
synthetic version-1 contract JSON, not customer evidence. Playwright's Node ESM loader requires
`with { type: "json" }` for JSON imports. Keep browser limits explicit in frontend/README.md; do not
change Python contracts to accommodate the UI. Require sanitized-input confirmation, preserve valid
imports on invalid replacement, invalidate pending reads on removal/navigation, and never persist
imported artifacts or enable export from imported pass statuses. Source strings are not fetch targets.
Keep entry-flow creation tests separate from seeded-draft editor tests; New project is no longer the
legacy dialog. Opening demo data reuses its existing project identity, so isolation tests need a
distinct second project.

Before commit, reread git status and shared TASKS.md. Stage only frontend/, this recipe and associated
task/design documentation. Inspect the index for unrelated files before committing and normally pushing.
Never reset another agent's work, bypass branch protection or claim a failed publication succeeded.