# Vercel + Supabase deployment

Vercel project: `tool-kit-api-server`. Root: `artifacts/api-server`. Node: 24.
The checked-in vercel.json builds the Toolstack frontend, bundles Express, copies
static assets into public, and routes API requests to a serverless function.

## Persistent storage

Supabase project: `jnuxrrmphbklatukaxgc` (existing “tool kit” project).
All application tables live in the private `toolstack` PostgreSQL schema, not
Supabase's exposed public schema. RLS is enabled. The server connects over verified
TLS using the official Supabase CA certificate and a restricted `toolstack_app` login with CRUD and sequence grants only
for this schema. Anonymous/browser clients have no application-table access.
The application enforces member/admin authorization in Express.

Required server-only encrypted Vercel variables:
- DATABASE_URL: Supabase PostgreSQL pooler URI, with the app role and password.
- DATABASE_SSL_CA: optional PEM CA override; by default the build downloads the
  public official Supabase CA certificate into the bundled dist/certs directory.
- SESSION_SECRET: stable random secret used for signed cookies and provider-key
  encryption. Do not rotate casually; rotation invalidates sessions and requires
  re-entering saved AI keys.
- ADMIN_BOOTSTRAP: initial private provisioning config (see below).

DATABASE_URL must be configured separately for preview deployments using an
isolated database. Never point untrusted previews at production data. On Vercel,
missing DATABASE_URL fails closed rather than silently using /tmp SQLite.
Local development without DATABASE_URL still uses the existing SQLite file.

Apply the SQL files in supabase/migrations before deploying. Provision the login
password privately; never put it in Git. Vercel's build runs a real database
preflight before promotion: initialize under an advisory transaction lock, verify
schema access, and check public/auth API responses. A failed connection/schema
check blocks promotion and leaves the prior deployment active.

The SQL helper converts positional parameters and preserves numeric counts and
camelCase response aliases. All database callers are awaited. Transactions pin a
single PostgreSQL connection using AsyncLocalStorage, with commit/rollback.

Existing data held only in Vercel /tmp is not automatically recoverable. This
creates a durable store and seeds the directory if empty; an old SQLite export
must be imported separately if a surviving copy is available.

## Initial administrator

ADMIN_BOOTSTRAP contains base64-encoded JSON with `email`, `salt` (16 random bytes,
hex), and `hash` (scrypt(password, salt, 64), hex). It is never a VITE variable or a
public signup endpoint. Startup provisions only when no admin exists and never
overwrites an existing password. The previously generated account can be retained.
Once the durable admin is confirmed, remove the bootstrap configuration.

## Admin AI troubleshooting

Provider records and AES-GCM-encrypted API keys now share persistent storage.
In Admin → Settings, connect a provider using a valid API key, base URL, and model.
Then open Assistant → Test connection. Saving settings alone does not prove the
key or API quota works. A consumer chatbot subscription may not include API access.

The assistant reports missing configuration, rejected credentials/permissions,
model/endpoint errors, quota/rate limits, and timeouts. It selects configured
providers only; undecipherable keys are marked disconnected. Gemini keys travel
in request headers, not URLs. Generic OpenAI-compatible services aren't forced to
support OpenAI's response_format parameter. Anthropic /v1 endpoints are normalized.

Test connection sends a small real provider request and may consume API quota.
This environment cannot call provider APIs due to its outbound host allowlist;
provider adapters are tested using mocked upstream responses, not real AI output.

## Tests

- `pnpm run typecheck`
- `pnpm --filter @workspace/toolstack run build`
- `pnpm --filter @workspace/api-server run build`
- `node artifacts/api-server/tests/admin-provision.mjs`

The auth/AI tests use an isolated temporary SQLite database and mocked upstream
providers. The production build preflight is the real Supabase integration check.
Vercel READY status alone is not a browser test; deployment protection may still
require Vercel sign-in, and sandbox outbound access to vercel.app is restricted.
