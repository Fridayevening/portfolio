<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Commit Convention

All commits in this repo follow Conventional Commits. AI must generate commit messages according to this convention before every `git commit` (a local hook enforces it).

## Format

`<type>(<scope>): <subject>`

- type (required): `feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`
- scope (optional): the module being changed, e.g. `desktop`, `market`, `hotaru`, `server`
- subject (required): imperative mood, one sentence describing what was done, max 50 characters, no trailing period
- breaking change: add `!` after the type (e.g. `feat!:`), or mark `BREAKING CHANGE:` in the footer

## Rules

1. Run `git log --oneline -10` before committing and follow the repo's existing commit style
2. One commit per kind of change; keep `feat` and `fix` in separate commits
3. No vague messages: `update`, `wip`, `fix bug`, `tmp`, etc.
4. Commit only the files related to the change; never include unrelated or temporary files
5. Never push automatically after committing unless the user explicitly asks

## Examples

- `feat(desktop): add market alerts to taskbar`
- `fix(hotaru): guard empty stream before close`
- `refactor(market): extract price ticker into service`

# Comment Convention

Comments must be sparse and high-value. Write clear names first; add a comment only when the code cannot explain itself. Comments explain the why, never restate the what.

## Never write

- Line-by-line translation comments that repeat each statement (e.g. `const total = sum(items); // compute the total`)
- Obvious comments that restate what the code already says
- Commented-out dead code — delete it; recover from git if ever needed
- Change history, authors, or dates in comments — git owns that
- Vague, emotional, or chatty comments like `// this is hacky`, `// leave it for now`, or bare `// TODO: optimize later` (TODO is only acceptable with a concrete reason and owner, or a linked issue)
- Redundant JSDoc that just repeats the signature when names and types are self-explanatory

## Always write

- Non-obvious business rules, constraints, and edge cases — and the reason they exist
- Magic numbers and literals — explain the source or basis, or better, extract them into named constants
- Complex algorithms — one paragraph on the idea, with a reference link when applicable
- Temporary workarounds or hacks — what they avoid and under what condition they can be removed
- Public APIs — concise JSDoc covering behavior, side effects, and limits not visible from the signature

## Format

- Write comments in English, matching the code; never mix English and Chinese comments in the same file (existing Chinese comments may stay, new ones must be English)
- Use `//` vs `/* */` per language convention; use `{/* */}` inside JSX
- Indent comments with the code they describe; start sentences with a capital letter and end with a period
- Attach a comment to the code it explains, directly above it — never above a distant, unrelated block
