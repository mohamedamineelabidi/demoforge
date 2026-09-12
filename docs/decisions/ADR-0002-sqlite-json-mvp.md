# ADR-0002: JSON files + SQLite for the MVP, PostgreSQL + pgvector later

Date: 2026-09-12. Status: accepted.

## Context
The original brief proposes PostgreSQL, pgvector, a knowledge graph and an orchestrator (Prefect). The MVP runs locally, one repository at a time, and its outputs must be reproducible from files.

## Decision
- Every pack is a JSON file validated by Pydantic in `workspace/<run_id>/curated/`.
- A single SQLite database (`workspace/index.sqlite`) indexes runs, facts and assets for search, added when the first query need appears (not before).
- No embeddings, vector store or graph database in the MVP. Retrieval over a single repository is done by reading the packs.

## Consequences
- Zero infrastructure to run the MVP; runs are portable folders.
- Migration path: the same Pydantic models map to JSONB columns; pgvector is added when cross-repository style matching or similar-product discovery is built (Phase 8+).
- A new heavy dependency requires a new ADR.
