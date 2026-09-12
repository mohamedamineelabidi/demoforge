# ADR-0002: JSON artifacts and SQLite local state, PostgreSQL when hosted

Date: 2026-09-12. Status: amended by ADR-0003; original search-only SQLite decision superseded.

## Context
The original brief proposes PostgreSQL, pgvector, a knowledge graph and an orchestrator (Prefect). The MVP runs locally, one repository at a time, and its outputs must be reproducible from files.

## Decision
- Every pack is a versioned JSON artifact validated by Pydantic in `workspace/<run_id>/curated/<revision>/`.
- SQLite (`workspace/index.sqlite`, stdlib sqlite3) owns local runs, attempts and approvals from the first
	resumable workflow. Use a configurable local, non-synced workspace root. JSON state exports are snapshots.
- No embeddings, vector store or graph database in the MVP. Retrieval over a single repository is done by reading the packs.

## Consequences
- No database service for the local pilot; manifests support validated export/import of run artifacts.
- Hosted beta uses PostgreSQL relational state and private S3 artifacts. SQLAlchemy/Alembic manage
	hosted persistence; do not merely move the whole product state into opaque JSONB columns.
- No planned automatic adoption of pgvector or a knowledge graph; add only for a measured retrieval need.
- A new heavy dependency requires a new ADR.
