# ADR-0003: Video-first product with explicit workflow and staged hosting

Date: 2026-09-12. Status: accepted product/architecture direction; implementation pending.
Supersedes the four-output MVP, blackboard swarm and legacy task order. Amends ADR-0001 and ADR-0002.

## Context

The repository currently implements a CLI/version command and copy lint, not a generator pipeline.
Building logos, decks, docs and videos before validating any output delays learning. Repository facts
cannot establish runtime behavior. Known pipeline stages do not require autonomous agent coordination.

## Decision

- Deliver an editable release-demo video for developer tools/web apps first. Require a feature brief
  and authorized footage/demo environment in addition to the public repository. Start with supplied footage.
- Preserve evidence through claims, scenarios, narrative and scenes. Bind approvals to immutable revisions.
- Use one modular Python application and an explicit persisted controller; no swarm/Hermes runtime.
- Retain Python/uv/Pydantic/Typer/httpx/GitPython/Markdown/Pillow/Jinja2. SQLite owns local state;
  versioned JSON and media remain artifacts. Use a configurable workspace outside OneDrive for SQLite.
- Retain HTML overlays/Playwright/FFmpeg for local proof. Prefer Remotion as an editing-stage candidate,
  conditional on TASK-082 benchmark and license review. Record a follow-up selection ADR before adoption.
- AI uses one SDK adapter initially (OpenAI), typed outputs, FakeLLM and evaluations. No unrestricted
  model-generated execution; Pydantic AI remains optional rather than a new orchestration dependency.
- Editing target: React/TypeScript/Vite, TanStack Query, accessible components, shared preview/export
  compositions if Remotion wins. No second application backend in Next.js.
- Hosted target: FastAPI/Uvicorn, PostgreSQL/SQLAlchemy/Alembic, private S3, managed identity (Clerk
  candidate), Celery/RabbitMQ, Linux jobs, GitHub Actions and OpenTelemetry. Use outbox publication,
  idempotency, cancellation and recovery. Separate trusted rendering from untrusted capture.
- No native Windows Celery, no long rendering in FastAPI BackgroundTasks, and no GPU or Kubernetes
  requirement. Foreground local rendering remains the Windows rule; hosted workers are a later stage.

## Alternatives and consequences

The original swarm creates additional coordination and audit work without evidence of better outputs.
A fully hosted stack now creates operations work before a useful local video exists. Remotion now would
skip validation of the existing team's rendering procedure; rejecting it permanently would make shared
React preview/editing harder. The staged decision keeps the proof small and makes the later choice measurable.
RabbitMQ/Celery add operations complexity only when multi-user asynchronous work is introduced.
Authentication does not replace tenant authorization; containers do not by themselves secure hostile sites.
Retained raw inputs are quarantined with deletion controls, not falsely described as secret-free storage.

## Adoption gates

TASKS.md is authoritative for IDs and order. Build fixtures/contracts and reliable local state first,
then one full supplied-footage export, capture, editor and hosted beta. No package installation is part
of this planning change. Hosting packages are authorized only when their scheduled tasks start; Remotion
still requires benchmark approval. Validate release demand and cost per accepted video before expansion.

## References

- FastAPI heavy-work caveat: https://fastapi.tiangolo.com/tutorial/background-tasks/#caveat
- Celery Windows support: https://docs.celeryq.dev/en/stable/faq.html#windows
- Remotion preview and license: https://www.remotion.dev/docs/player and https://www.remotion.dev/license
- S3 access: https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html
- Capture safety: https://playwright.dev/docs/docker
- Workflow rationale: https://www.anthropic.com/engineering/building-effective-agents