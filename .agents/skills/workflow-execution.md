# Skill: workflow-execution

Use when implementing the explicit controller, stage interfaces, approvals, retries, resumability or
hosted dispatch. Replaces the retired swarm-roles recipe. This is a target procedure, not existing code.

## Local procedure

1. Read TASKS.md, .agents/architecture.md and docs/DATA_CONTRACTS.md for the active stage and inputs.
2. Write a focused test for the transition and failure path before logic. Use a fake clock/LLM/stage.
3. Validate StageRequest and immutable input manifests; check evidence, permissions and approvals.
4. Derive idempotency/cache keys from stage/input/schema/tool/template versions and options. Reject stale
   approvals. Do not reuse capture across releases without freshness and user authorization.
5. Persist attempt state in SQLite before execution. Pass configured dependencies in StageContext.
6. Publish output artifacts atomically, validate hashes/gates, then persist successful manifest pointers.
   A crash after file write but before DB commit must be recoverable without duplicate side effects.
7. For approval, persist subject revision/hash and continuation, then return; never keep a worker waiting.
8. Retry transient failures up to three total attempts with backoff/jitter. Repair content at most once.
   Never retry authorization/policy failures or fabricate missing inputs. Cancellation cleans owned processes.
9. Resume only eligible attempts; invalidate descendants of edited inputs. A caption edit must preserve
   ingestion/footage. Export requires final-output hash approval after QA, not only storyboard approval.

## Hosted adapter

Reuse stage functions from Celery jobs, with PostgreSQL state and S3 artifacts. Publish IDs through a
transactional outbox to RabbitMQ; reconcile stale attempts/outbox entries. Broker acknowledgments do not
make effects exactly-once. Test duplicate deliveries, worker loss, database/publish crash windows and cancellation.
Capture supervisors launch restricted jobs with no broker/DB/production credentials; do not put secrets in messages.
Local run.json and events.jsonl remain snapshots/diagnostics, never workflow authorities.

## Checks

Run focused tests/workflow and tests/pack as they are introduced, then full pytest and Ruff. Media stages
also need real frame/decode/privacy/audio gates. Never mark a task complete based on a worker's summary.
Do not install queues, databases or an agent framework until the corresponding scheduled task.