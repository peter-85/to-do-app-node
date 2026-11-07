# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev              # node --watch with .env loaded; serves API + frontend on :8080
npm start                # no watch, no .env loading (env must come from the process — used in Docker)
npm run contract:emit    # regenerate src/prisma/contract.json + contract.d.ts after editing contract.prisma
npx prisma db update     # push the contract to the database (add --dry-run to preview, --db <url> to target another DB)
npx prisma db migrate    # apply planned migrations instead
docker compose up --build
```

There is no test suite, linter, or build step. `npm test` is a placeholder that exits 1.

Required env (in `.env` locally): `DATABASE_URL`, `JWT_SECRET`. Optional: `PORT` (default 8080).

## Runtime model

- Requires **Node.js 24+**. The project is plain ESM JavaScript, but `src/prisma/db.ts` is TypeScript imported directly from `.js` files (`import { db } from "../prisma/db.ts"`). Node strips the types at load time; `tsconfig.json` is for editor type hints only. Keep the `.ts` extension in import paths and use only erasable TS syntax (no enums, namespaces, parameter properties) in `.ts` files.
- Express 5 serves both the REST API and the static frontend in `public/` from one process (`src/server.js`).

## Prisma 8 (contract-first — differs from Prisma ≤7)

- No generated client in `node_modules`. The source of truth is `src/prisma/contract.prisma`; `contract.json` and `contract.d.ts` next to it are **generated** by `npm run contract:emit` and must be committed together with any schema change. `migrations/` holds contract snapshots/refs managed by the Prisma CLI.
- `src/prisma/db.ts` builds the single shared client (`postgres<Contract>(...)` from `@prisma/orm-postgres/runtime`). All data access goes through it.
- Query API: `db.orm.public.<Model>` with a fluent builder — `.where({...}).first()`, `.all()`, `.orderBy(t => t.id.asc())`, `.select("id")`, `.update({...})`, `.delete()`. `create`/`update` take fields directly (no `data:` wrapper) and return the row; `update`/`delete` on a `where` return a falsy value when nothing matched (routes use this for 404s).
- Transactions: `db.transaction(async (tx) => { ... })` commits on return, rolls back on throw; use `tx.orm...` inside.
- Constraint violations throw `SqlQueryError` with a Postgres `sqlState` (e.g. `23505` unique violation), not `P2002`.
- `prisma.config.ts` points the CLI at the contract and reads `DATABASE_URL` via dotenv.
- `prisma-8.md` is a Prisma 8 reference guide; consult it for API details.

## Auth flow

- `POST /auth/register` hashes the password with bcryptjs and, in one transaction, creates the user plus a default first todo; returns a JWT (`{ id }` payload, 1h expiry).
- `POST /auth/login` returns `{ token }`; invalid credentials return **404** (not 401), DB errors return 503.
- `src/middleware/authMiddleware.js` is mounted on `/todos` only. It reads the **raw JWT from the `Authorization` header (no `Bearer` prefix)**, verifies it, confirms the user still exists, and sets `req.userId`.
- Every todo query in `src/routes/todoRoutes.js` is scoped by `userId: req.userId` — keep that invariant for any new todo route so users can't touch each other's rows.
- The frontend sends `completed` as 0/1; `PUT /todos/:id` normalises it with `Boolean()`.
