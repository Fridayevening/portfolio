# NewBoy — Current Handoff

> This is the current integration snapshot for the next collaborator. Read `AGENTS.md`, this file, `TASKS.md`, and the nearest directory-level `AGENTS.md` before changing files.

## Snapshot

- Updated: 2026-09-17
- Updated by: Codex
- Base commit: `52193df`
- Working tree at start: clean
- Repository: `Fridayevening/newboy` (public) — renamed from `Fridayevening/portfolio` on 2026-09-19
- Default branch: `main`
- Deployment: production preparation active; no external environment created

The working tree may contain the uncommitted collaboration-document changes described under **Awaiting review**. Run `git status --short` and inspect the diff instead of assuming this snapshot is current.

## Project state

NewBoy is an interactive Windows 95-style portfolio:

- Next.js 16 frontend on port 3030.
- NestJS 12 API on port 3031 with the `/v1` prefix.
- MongoDB database `newboy` on local port 27017.
- Python image and video processing through Hotaru scripts.

The application runs locally. Frontend UI, backend errors, offline market messages, SSE market alerts, and supported dynamic news content have Chinese and English behavior. The English UI has passed the previous SSR Chinese-residue audit, and the completed language work passed TypeScript and runtime smoke checks.

Stable architecture, setup, module responsibilities, i18n design, operational constraints, and deployment guidance live in `docs/ARCHITECTURE.md`.

## Last completed

- Completed frontend and backend Chinese/English support.
- Localized deep windows, games, creative tools, file dialogs, API errors, market states, and news editions.
- Removed the copyrighted default lyric excerpt from `notes.txt` and replaced it with original placeholder copy.
- Created the public Git repository and added the MIT license.
- Audited, approved and implemented four bilingual Work cases and two bilingual Research studies.
- Added Work and Research desktop folders, immediate bilingual switching and public Figma links.
- Prepared the Vercel + Render Docker + MongoDB Atlas deployment configuration and runbook; NB-005 awaits independent review.

## Collaboration workflow

- `NB-001` was accepted by Yanfei on 2026-09-17.
- Codex is the default implementer and verifier; Copilot provides independent diff review; Yanfei remains the integration owner and controls commits, pushes and deployments unless a task explicitly says otherwise.
- Work proceeds sequentially by default. Parallel work requires non-overlapping file scopes and dedicated branches or worktrees.

## Next work

1. Have Copilot independently review the NB-004 and NB-005 diff using `docs/handoffs/NB-005.md`.
2. Resolve review findings, then obtain Yanfei's explicit authorization for commit and push.
3. Select or confirm provider accounts and billing, then deploy and verify staging under `NB-006`.
4. Release production under `NB-007` only after Yanfei accepts staging and approves the release action.

## Blockers and decisions required

- Uniubi scale and team facts were corrected and confirmed on 2026-09-17. Withdrawn figures must not be copied from the old site; the six first-release entries are approved under `docs/content-review/approved/`.
- Content marked `draft` or `needs-review` must not be published.
- The first Work and Research release uses reviewed static typed frontend data and dedicated portfolio windows. A backend content editor remains optional future work.

## Known follow-up items

- Deploy the frontend, persistent backend, and managed MongoDB database.
- Measure the approximately 42 MB frontend media transfer in staging; optimize the 23 MB audio file if bandwidth or startup cost warrants it.
- Install Blender only if full laser-card rendering is required.
- Consider upgrading the news retry strategy to match the market request strategy.
- Add About Me, contact, and résumé content after the public facts are approved.

## Non-negotiable boundaries

- Do not fabricate market data, news, portfolio evidence, metrics, or user feedback.
- Preserve the last valid market or news value when providers fail.
- Do not independently edit the frozen `server/python/hotaru.py` integration copy.
- Explain the impact before changing `db.ts`, `env.ts`, `watchlist.ts`, or `market-providers.ts`.
- Do not commit `.env`, credentials, tokens, or private information.
- Do not push, deploy, send messages, apply for anything, or contact third parties without Yanfei's explicit approval.
- Use Conventional Commits and keep unrelated changes separate.

## Verification record

The i18n completion snapshot previously passed:

- Frontend TypeScript checking.
- English SSR Chinese-character audit.
- Runtime language-switching smoke checks.

NB-004 and NB-005 additionally passed frontend type/build checks, browser Work/Research smoke checks, server no-emit TypeScript checking and temporary JavaScript emission. Docker construction is delegated to the Node 24 CI job because Docker is not installed locally. Re-run checks appropriate to later application changes.

## Quick links

- Shared agent rules: `AGENTS.md`
- Multi-AI operating manual: `docs/MULTI-AI-WORKFLOW.md`
- Active ownership: `TASKS.md`
- Stable architecture: `docs/ARCHITECTURE.md`
- Architecture decisions: `docs/decisions/`
- Frontend-specific rules: `frontend/AGENTS.md`
- Portfolio migration proposal: `MIGRATION-PLAN.md`
