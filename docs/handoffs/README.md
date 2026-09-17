# Task Handoffs

Use this directory for task-level implementation evidence. It is required for parallel task branches that must avoid editing the root `HANDOFF.md` concurrently, and it may also be used by a main-worktree task before review or integration.

Name each file after its task ID, for example `NB-003.md`, and include:

```md
# NB-003 Handoff

- Owner:
- Branch:
- Base commit:
- Status:
- File scope:

## Changed

## Verification

## Remaining risks

## Reviewer notes
```

After integration, the integration owner moves lasting architectural decisions into `docs/decisions/`, updates the root `HANDOFF.md`, and removes obsolete task-specific detail when it no longer helps future work.
