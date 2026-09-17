# NewBoy Deployment Runbook

This runbook prepares deployment but does not authorize account creation, billing, secret entry, commits, pushes or releases. Yanfei remains the integration and release owner.

## Selected topology

| Layer | Provider | Reason |
|---|---|---|
| Next.js frontend | Vercel | Native Next.js support, CDN delivery and cookie-aware SSR |
| NestJS + Python API | Render Docker web service | Persistent process for SSE, schedules and Python child processes |
| MongoDB | MongoDB Atlas | Managed MongoDB compatible with the existing native driver |

The Render free web-service plan is appropriate for staging only. It spins down after 15 idle minutes and can take about one minute to wake. Production should use always-on compute if API tools, market SSE and owner features are part of the public experience.

Atlas Free is sufficient for an initial low-traffic release, with a 0.5 GB storage cap and no full production backup posture. It may pause after 30 days with no connections. Use Flex or a backed-up paid tier before the database becomes the sole copy of valuable content.

Official references:

- [Vercel platform limits](https://vercel.com/docs/limits)
- [Render Docker services](https://render.com/docs/docker)
- [Render free-service limits](https://render.com/docs/free)
- [Render Blueprint reference](https://render.com/docs/blueprint-spec)
- [MongoDB Atlas Free limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)

## Release gates

1. Copilot reviews the complete NB-004 and NB-005 diff.
2. Yanfei accepts or resolves every review finding.
3. Yanfei explicitly authorizes a Conventional Commit and push.
4. Yanfei selects or creates the Vercel, Render and Atlas accounts/projects and approves any paid plan.
5. Staging passes the checks below.
6. Yanfei explicitly accepts staging and authorizes the production release.

## Environment matrix

| Variable | Where | Secret | Required | Value shape |
|---|---|---:|---:|---|
| `NEXT_PUBLIC_API_URL` | Vercel | no | yes | Render origin, no trailing `/v1` |
| `MONGODB_URI` | Render | yes | yes | Atlas SRV URI; database name may be included |
| `OWNER_TOKEN` | Render | yes | yes | Unique long random value, never committed |
| `CORS_ORIGINS` | Render | no | yes | Comma-separated exact Vercel/custom origins |
| `NEWS_PROXY_URL` | Render | no | yes | Empty for direct production egress |
| `MARKET_PROXY_URL` | Render | no | yes | Empty for direct production egress |
| `SILICON_API_KEY` / `DEEPSEEK_API_KEY` | Render | yes | no | Leave unset for raw news without AI curation |

Do not expose `OWNER_TOKEN`, database credentials or AI keys through `NEXT_PUBLIC_*` variables.

## Staging sequence

1. Create an Atlas project, cluster and least-privilege database user. Store the SRV URI outside the repository. Allow only the Render outbound range when the selected Render plan supplies stable ranges; otherwise document the temporary Atlas access-list scope.
2. Create a Render Blueprint from `render.yaml`. The committed Blueprint explicitly uses `plan: free` for staging. Enter the three `sync: false` values in the Render dashboard.
3. Set `CORS_ORIGINS` to the exact staging Vercel origin. Keep Render automatic deploys off.
4. Verify `GET https://<api>/v1/health` before connecting the frontend.
5. Create a Vercel project with Root Directory `frontend`. Set `NEXT_PUBLIC_API_URL=https://<api>` for Preview first.
6. Deploy a preview, then run every staging check. Do not promote it yet.

## Staging checks

- `/` renders in English in a clean browser profile.
- Work shows four approved cases; Research shows two approved studies.
- Switching to Chinese updates desktop labels, open content, title bars and taskbar entries; refresh preserves the selection.
- Both approved Figma links open the intended public prototypes.
- `/v1/health` succeeds over HTTPS.
- Frontend mode becomes live when the API is available and falls back honestly when it is unavailable.
- Market and news failures retain the previous valid value and never invent replacements.
- Market SSE stays connected for at least ten minutes.
- Owner unlock rejects an incorrect token and accepts the real token only when Yanfei tests it privately.
- Hotaru ping reports its Python dependencies; one small image completes successfully.
- Laser Lab reports Blender unavailable without crashing the API or the rest of the site.
- Browser console contains no NewBoy application errors. Extension-injected errors are recorded separately.
- Check at desktop, 800×600 and a narrow mobile viewport.

## Production release

1. Freeze the accepted commit SHA.
2. Promote the same frontend build or rebuild from that exact SHA with the production environment.
3. Set production `CORS_ORIGINS` to the final Vercel and custom domains only.
4. Change the Render plan from `free` to an approved always-on plan before production if cold starts are not acceptable. Keep the Blueprint and dashboard setting aligned so a later sync cannot revert the plan unexpectedly.
5. Add the custom domain and TLS only after the provider URLs pass verification.
6. Re-run health, language, Work, Research, SSE and Hotaru checks on the public domain.
7. Record provider URLs, release SHA, date, checks and known limitations in the NB-007 handoff.

## Media and persistence

- The frontend currently ships about 42 MB under `public/`, including a roughly 23 MB audio file. This fits Vercel's current Hobby upload limit but can dominate bandwidth and first-use transfer. Keep it for staging, measure actual transfer, then compress or move it to object storage if needed.
- Work and Research are static typed content and do not depend on MongoDB.
- Hotaru and Laser Lab uploads are job artifacts and may remain ephemeral for the first release.
- Virtual-file-system image bytes live under `server/.data/files`. Do not promise durable owner-uploaded images until a Render persistent disk or object storage is configured and restore-tested.

## Rollback

- Frontend: redeploy the last accepted Vercel deployment or previous commit SHA.
- API: use Render rollback to the last healthy image; automatic deploys are disabled.
- Database: avoid destructive schema changes in the first release. Export valuable Atlas data before any future migration.
- If the API is unavailable, remove or correct `NEXT_PUBLIC_API_URL` only in a deliberate rebuild; NewBoy then uses its honest local/offline behavior.
