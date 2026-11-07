# Vercel deployment

Use the existing `tool-kit-api-server` project, Node 24, with root directory
`artifacts/api-server`. The checked-in vercel.json overrides framework detection,
builds the frontend and server, copies static assets into public, and routes API
requests to an Express function (no listening socket). Other routes use the SPA.
Set a random encrypted SESSION_SECRET for both production and preview.

## Storage limitation

On Vercel, SQLite defaults to `/tmp/toolstack.sqlite`. This is **temporary demo
storage**, not a production database. Each function instance has independent data;
accounts, sessions, saved tools, and admin changes can disappear on cold starts
or deployments. DATABASE_URL does not migrate this SQLite implementation.
Before using real accounts or production writes, migrate the SQLite queries to a
persistent remote database or host the API on a platform with a persistent disk.

Vercel's READY status proves a successful build, not successful live HTTP tests.
Deployment Protection can require users to sign in. The sandbox's outbound host
allowlist also prevents HTTP verification against vercel.app domains.
