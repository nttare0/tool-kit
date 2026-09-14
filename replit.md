# Toolstack

Toolstack is a curated, visual directory of useful software with a protected admin workspace.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- SQLite data is stored in `artifacts/api-server/data/toolstack.sqlite`
- `SESSION_SECRET` is used to sign admin session cookies when available

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: SQLite via Node.js 24 `node:sqlite`
- Validation: Zod (`zod/v4`)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/api-server/src/lib/sqlite.ts` — SQLite schema and access wrapper
- `artifacts/api-server/src/lib/auth.ts` — admin setup, login, logout, and signed sessions
- `artifacts/api-server/src/routes/` — public directory and protected admin APIs
- `artifacts/toolstack/src/pages/` — public directory, detail, 404, and admin screens
- `lib/api-spec/openapi.yaml` — API contract source of truth

## Architecture decisions

- Public browsing stays open; category and tool mutations require an authenticated admin session.
- Tool poster previews can be stored as image data URLs in SQLite, so the admin workflow does not need a separate upload service.
- Seeded tools use Microlink screenshot image responses, while newly added tools can use an uploaded image or preview URL.
- The older `lib/db` package is retained for workspace compatibility but is not used by the Toolstack API server.

## Product

- Public visual directory with search, category shelves, featured tools, detail pages, pricing, best-for guidance, and external links.
- First-run admin setup with scrypt password hashing and HTTP-only signed session cookies.
- Admin CRUD for tools and categories, publishing state, featured state, logos, and preview images.

## User preferences

No project-specific preferences recorded.

## Gotchas

- Run API code generation after changing `lib/api-spec/openapi.yaml`.
- Use the managed workflow for preview/build checks because the Vite artifact expects workflow-provided `PORT` and `BASE_PATH`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
