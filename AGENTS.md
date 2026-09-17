# NewBoy — Agent Instructions

This file defines the standing rules shared by every coding agent working in this repository.

## Required reading

Before changing files:

1. Read `HANDOFF.md`.
2. Read `TASKS.md`.
3. Read the nearest applicable `AGENTS.md` for the target directory.
4. Inspect `git status --short` and confirm the handoff base commit is still relevant.
5. Search the related modules before proposing or implementing a change.

For technical implementation or architecture work, also read `docs/ARCHITECTURE.md` and only the decision records under `docs/decisions/` that are relevant to the task.

For frontend work, also read `frontend/AGENTS.md` and the relevant Next.js 16 documentation under `frontend/node_modules/next/dist/docs/` before relying on framework conventions.

## Project boundaries

- `frontend/` contains the Next.js desktop application.
- `server/` contains the NestJS API and the frozen Python integration copy.
- `server/python/hotaru.py` is not the source of truth. Its upstream source lives in `skill-lab/HypeBoyImgTool/hotaru/`; do not edit the frozen copy independently.
- Never fabricate market data, news, portfolio claims, metrics, experience, or user feedback.
- When a market or news source fails, preserve the last valid value instead of inventing a replacement.
- Never commit `.env`, credentials, tokens, private information, dependency directories, virtual environments, or generated build output.
- Do not push, deploy, apply for jobs, send messages, or contact third parties without Yanfei's explicit approval.

## Collaboration

- Every task with status `active` or `review` must have one implementation owner in `TASKS.md`.
- Do not edit the file scope of any non-`done` task that is assigned to another owner.
- Use a dedicated branch or Git worktree when agents work in parallel.
- Split parallel tasks by file scope so that two agents do not modify the same shared files.
- The second agent should review the first agent's diff rather than independently reimplementing the same task.
- Yanfei is the default integration owner unless a task explicitly delegates that role. The integration owner updates `HANDOFF.md` after validated work is merged. Parallel task branches should write task-specific notes under `docs/handoffs/` when necessary instead of editing the root handoff concurrently.
- Treat Git diffs, commits, and verification output as evidence; do not rely on status claims in prose alone.

## Shared files

Explain the impact before changing any of these shared files:

- `server/src/modules/db.ts`
- `server/src/env.ts`
- `server/src/modules/market/watchlist.ts`
- `server/src/modules/market/market-providers.ts`

Changes to shared files must account for all known consumers and preserve existing failure behavior.

## Code and commits

- Follow the repository's existing architecture and module boundaries.
- Write new code comments in English. Comments should explain why, not repeat what the code does.
- Do not mix Chinese and English comments in the same source file.
- Use Conventional Commits: `<type>(<scope>): <subject>`.
- Run `git log --oneline -10` before committing and match the established style.
- Keep unrelated changes out of a commit.
- Create a local commit only when Yanfei explicitly requests it.
- Never push automatically.
- Do not delete the generated Next.js instruction block at the top of `frontend/AGENTS.md`; `next dev` will recreate it and dirty the working tree.

## Completion standard

Before declaring a task complete:

1. Review the full diff and confirm the file scope matches the assigned task.
2. Run checks proportional to the change, including relevant type checks, tests, builds, or runtime smoke tests.
3. Report the exact commands run and their results.
4. Record unresolved risks and failures honestly.
5. Update the task status only after verification.
6. Let the integration owner refresh `HANDOFF.md` after integration.
