# NewBoy — Task Board

This file coordinates work ownership. It is not a substitute for Git history or issue tracking.

Yanfei is the default integration owner. A task may name another integration owner explicitly, but an implementation owner does not become the integration owner automatically.

## Active tasks

| ID | Task | Owner | Status | File scope | Base commit |
|---|---|---|---|---|---|
| NB-001 | Establish the multi-agent collaboration workflow | Codex | done | Repository collaboration documentation | `52193df` |
| NB-002 | Confirm evidence for public portfolio metrics | Yanfei | done | Content review only | — |
| NB-003 | Audit and freeze the first public Work and Research release | Codex | done | `MIGRATION-PLAN.md`, `docs/content-review/**`, source portfolio content (read-only) | `52193df` |
| NB-004 | Implement approved Work and Research content | Codex | done | `frontend/src/**`, approved content data, relevant frontend tests | `52193df` |
| NB-005 | Prepare production runtime and security | Codex | review | Deployment configuration, environment templates, CORS, media and runtime documentation | `52193df` |
| NB-006 | Deploy and verify staging | Yanfei (integration) | blocked | Hosting-provider configuration and staging environment | — |
| NB-007 | Release and verify production | Yanfei (integration) | blocked | Production hosting, domain, environment and release record | — |
| NB-008 | Restore full Work and Research narratives with corrected facts | Codex | review | `docs/content-review/**`, `frontend/src/components/desktop/portfolioContent.ts`, Work/Research presentation files and relevant tests | `521be15` |

## Dependency order

`NB-003 → NB-004 → NB-005 → NB-006 → NB-007`

`NB-008` is a post-release content-remediation task. It may begin only after the implementer performs the recovery and evidence audit in `docs/handoffs/NB-008.md`. It must preserve the old portfolio's useful narrative depth while treating the approved evidence ledger and Yanfei's explicit confirmations as authoritative over old website copy.

- `NB-004` unblocks only when the release content is explicitly marked `approved`.
- `NB-005` starts after the local Work and Research experience passes its quality gates.
- `NB-006` requires provider selection and Yanfei's approval for any account, billing, secret or external-state change.
- `NB-007` requires Yanfei's acceptance of the staging build and explicit production-release approval.

## Status values

- `ready`: scoped and available to claim.
- `active`: owned and currently being implemented.
- `review`: implementation is complete and awaiting review.
- `blocked`: cannot continue until the named dependency is resolved.
- `done`: integrated and verified.

## Working agreement

1. Assign one implementation owner before changing code.
2. Record an explicit file scope and base commit for every active engineering task.
3. Do not claim a task whose file scope overlaps any non-`done` task assigned to another owner.
4. Use a dedicated branch or worktree for simultaneous work.
5. Move a task to `review` only after recording verification in its commit, pull request, or task handoff.
6. Move a task to `done` only after integration and final verification.
