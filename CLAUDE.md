# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev              # node --watch with .env loaded; serves API + frontend on :8080
npm run build            # bundle to dist/server.mjs (+ dist/public/) for Prisma Compute
npm start                # runs the build output (dist/server.mjs); no .env loading. Run `npm run build` first
node src/server.js       # what the Dockerfile runs: source directly, no build
npm run contract:emit    # regenerate src/prisma/contract.json + contract.d.ts after editing contract.prisma
npx prisma db update     # push the contract to the database (add --dry-run to preview, --db <url> to target another DB)
npx prisma db migrate    # apply planned migrations instead
docker compose up --build
```

`npm test` runs the API tests in `test/` (`node:test` + `fetch`, no extra dependencies). They start the app from `src/app.js` on a random port and run against `DATABASE_URL_TEST` (required; set it in `.env` locally, never to the dev or production DB). Tests register users with random names, so no cleanup is needed. After a new migration, apply it to the test DB with `npx prisma db migrate --db <DATABASE_URL_TEST>`. In CI, the `test` job in `.github/workflows/prisma-deploy.yml` runs them against a throwaway Postgres service container (after applying the migrations), and `deploy` has `needs: test`, so failing tests block every deploy. There is no linter.

The build (`scripts/build.mjs`, esbuild) exists for Prisma Compute, which deploys only the build output, without `node_modules`, and ignores the Dockerfile. Every npm dependency is bundled into `dist/server.mjs`, so a new dependency must be bundleable (mark optional native modules such as `pg-native` as external). `src/server.js` serves `public/` from next to itself when present (`dist/public`), otherwise from `../public`. Local dev (`npm run dev`) and the Dockerfile still run `src/` directly. The Prisma Console requires `npm start` to run a file inside tsconfig `outDir` (`dist`), so keep `start` pointed at the build output.

Required env (in `.env` locally): `DATABASE_URL`, `JWT_SECRET`. Optional: `PORT` (default 8080).

## Runtime model

- Requires **Node.js 24+**. The project is plain ESM JavaScript, but `src/prisma/db.ts` is TypeScript imported directly from `.js` files (`import { db } from "../prisma/db.ts"`). Node strips the types at load time; `tsconfig.json` is for editor type hints only. Keep the `.ts` extension in import paths and use only erasable TS syntax (no enums, namespaces, parameter properties) in `.ts` files.
- Express 5 serves both the REST API and the static frontend in `public/` from one process. `src/app.js` builds and exports the app; `src/server.js` only calls `listen`, so tests can import the app without starting a server.

## Prisma 8 (contract-first — differs from Prisma ≤7)

- No generated client in `node_modules`. The source of truth is `src/prisma/contract.prisma`; `contract.json` and `contract.d.ts` next to it are **generated** by `npm run contract:emit` and must be committed together with any schema change. `migrations/` holds contract snapshots/refs managed by the Prisma CLI.
- `src/prisma/db.ts` builds the single shared client: `contract = contractFromJson<Contract>(contractJson)` (from `@prisma/orm-postgres/static`), then `postgres({ contract, url })` (from `@prisma/orm-postgres/runtime`). The client takes the contract as a value; there is no `contractJson` option or type argument. All data access goes through it.
- **Versions are pinned exactly and move together.** `@prisma/orm-postgres`, the `prisma` CLI and `@prisma/cli-engine` have no `^`; the CLI release must bundle the same `@prisma/orm-toolchain` version as the app (one ORM copy only), and its `@prisma/cli-engine` must match ours. The Prisma Console deploys via Composer (bundled in the CLI) and refuses the repo unless `@prisma/orm-postgres` on `main` is exactly the version that Composer release requires. Upgrade one RC at a time following `node_modules/@prisma/orm-postgres/skills/prisma-8/references/upgrade-app.md`, re-emitting the contract each step.
- Query API: `db.orm.public.<Model>` with a fluent builder — `.where({...}).first()`, `.all()`, `.orderBy(t => t.id.asc())`, `.select("id")`, `.update({...})`, `.delete()`. `create`/`update` take fields directly (no `data:` wrapper) and return the row; `update`/`delete` on a `where` return a falsy value when nothing matched (routes use this for 404s).
- Transactions: `db.transaction(async (tx) => { ... })` commits on return, rolls back on throw; use `tx.orm...` inside.
- Constraint violations throw `SqlQueryError` with a Postgres `sqlState` (e.g. `23505` unique violation), not `P2002`.
- `prisma.config.ts` points the CLI at the contract and reads `DATABASE_URL` via dotenv. Import `definePrismaConfig` from `prisma/config` (not `@prisma/cli-engine`, though it is the same function): the Prisma Console setup only edits a config whose default export is `definePrismaConfig({...})` from `prisma/config`.
- `prisma-8.md` is a Prisma 8 reference guide; consult it for API details.

## Prisma Compute deploys (Composer)

- `module.mjs` (app root, module name `to-do-app`) and `src/service.mts` (the `compute()` service with a `db` dependency) are the deploy declaration; `prisma.config.ts` has the `composer` section pointing at `module.mjs`. `.github/workflows/prisma-deploy.yml` builds and deploys on every branch push (default branch = production, other branches = previews).
- The Console project must be named exactly like the module (`to-do-app`): the deploy finds its project by that name.
- **Deploys only replay committed migrations** and never create schema. Every schema change: edit `contract.prisma` → `npm run contract:emit` → `npx prisma migration plan --name <slug>` → commit `migrations/` with it. A deploy without an authored path fails with `MIGRATION_PATH_NOT_FOUND`.
- **Two separate databases.** Compute uses the Composer-managed `database` (production, plus a fresh one per preview branch); Render and local `.env` use the older "To do database". They share no data; apply each migration to the Render DB with `npx prisma db migrate`.
- `src/prisma/db.ts` uses the Composer binding (`service.load().db.url`) whenever it exists, i.e. on Compute, even if a `DATABASE_URL` is set there (Composer pins it to `"-"` or leaves an older value). Without a binding (local, Docker, Render) it uses `DATABASE_URL`. Do not add `DATABASE_URL` in the Console; the name is reserved. `PORT` is exported by the platform. `JWT_SECRET` must be set as a platform environment variable (production and preview).

## Auth flow

- `POST /auth/register` hashes the password with bcryptjs and, in one transaction, creates the user plus a default first todo; returns a JWT (`{ id }` payload, 1h expiry). Any error, including a taken username, returns 503 (see issue #3).
- `POST /auth/login` returns `{ token }`; invalid credentials return **404** (not 401), DB errors return 503.
- `src/middleware/authMiddleware.js` is mounted on `/todos` only. It reads the **raw JWT from the `Authorization` header (no `Bearer` prefix)**, verifies it, confirms the user still exists, and sets `req.userId`.
- Every todo query in `src/routes/todoRoutes.js` is scoped by `userId: req.userId` — keep that invariant for any new todo route so users can't touch each other's rows.
- The frontend sends `completed` as 0/1; `PUT /todos/:id` normalises it with `Boolean()`.
