# Skill: swarm-roles

RETIRED 2026-09-12 by ADR-0003. Do not implement or dispatch this protocol. Use
`.agents/skills/workflow-execution.md` and TASKS.md instead. The text below is historical reference only;
its roles, message schemas, paths and retry rules are not current requirements.

## Blackboard rules
- An agent reads packs, writes its own artifact, appends ONE line to `workspace/<run>/messages.jsonl` (schema: `docs/DATA_CONTRACTS.md` section 13). No agent calls another.
- Roles: orchestrator, ingest, brand, narrative, deck, video, docs, qa.
- Stages: `ingest -> (brand || narrative || docs) -> (deck || video) -> qa`.
- One retry per `review_reject`; the second failure escalates to the user (`ask_user`).
- Orchestrator never generates content. It stops when `quality_report.gate != pass`.

## Role prompt template (`roles/<role>.md`)
```
You are the <ROLE> agent for a real software project.
Inputs (read only these): <list of pack paths>
Output (write only this): <artifact path>
Use only the provided facts, visual assets and brand system. Do not invent features, metrics or UI.
Follow .agents/skills/<skill>.md step by step. Run its gates. Do not report done before the gate passes.
When done, append to messages.jsonl: {"from":"<role>","to":"orchestrator","type":"done","refs":[...]}.
If an input is missing, append {"type":"need"} naming the pack and stop.
Never touch files outside your output folder. Never run background renders.
```

## Dispatching with Hermes
`swarm/hermes_runner.py` emits one `delegate_task` task per role in a stage: goal = role prompt, context = pack paths + AGENTS.md rules + relevant skill text. Children self-report; the orchestrator verifies by reading the artifact and running the gate itself, never by trusting the summary.

## Human checkpoints
1. After ingest when `questions_for_user` is non-empty.
2. After brand when a logo was generated (approve or upload the real one).
3. After qa: `outputs/REVIEW.md` with contact sheets.
