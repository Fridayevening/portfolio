# NewBoy Copilot Instructions

Read and follow the repository root `AGENTS.md`, `HANDOFF.md`, `TASKS.md`, and the nearest directory-level `AGENTS.md` before editing files.

For technical implementation or architecture work, also read `docs/ARCHITECTURE.md` and the relevant records under `docs/decisions/`.

When implementing a task:

- Confirm the task owner, status, file scope, and base commit in `TASKS.md`.
- Do not edit the file scope of any non-`done` task assigned to another owner.
- Search related modules and preserve existing architecture and failure behavior.
- Report the exact files changed and validation commands run.
- Review the full Git diff before claiming completion.
- Do not update the root `HANDOFF.md` concurrently from a parallel task branch; leave a task-specific note under `docs/handoffs/` when a handoff is needed.
- Create a local commit only when Yanfei explicitly requests it.
- Do not push, deploy, send messages, apply for anything, or contact third parties.
- Never include secrets, tokens, private data, or unverified portfolio claims in code or documentation.
- Never fabricate market data, news, portfolio evidence, metrics, experience, or user feedback. Preserve the last valid market or news value when a provider fails.
- Do not edit the frozen `server/python/hotaru.py` copy independently from its upstream source.
- Do not delete the generated Next.js instruction block at the top of `frontend/AGENTS.md`.
