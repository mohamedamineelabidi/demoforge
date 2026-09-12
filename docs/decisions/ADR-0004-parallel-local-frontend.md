# ADR-0004: Parallel local frontend workstream

Status: accepted by explicit user request, 2026-09-12.

The user assigned VS Code the frontend while Hermes implements TASK-068..070. Authorize an isolated
frontend/ React, TypeScript and Vite application now, ahead of TASK-083's full integration dependencies.
Use local bundled Geist fonts, Lucide, Zod for browser draft validation and Vitest/Playwright for tests.
This is a local draft editor, not an alternative workflow controller. No fake network, approvals,
render jobs or export success. No customer data leaves the browser. Media is session-local and is not
persisted in localStorage. Explicit demo data is separate from real project evidence.

Keep API integration, TanStack Query server state and renderer/preview parity in TASK-083. Do not select
Remotion, install hosted infrastructure or change Python schemas. Frontend DTOs are local-only and must
be mapped to validated backend contracts by the later adapter. Browser drafts are not approved artifacts.
The extra build/test toolchain is isolated under frontend/ with its own npm lockfile. This decision
authorizes UI implementation, not completion of TASK-083 or any pipeline/media gate.