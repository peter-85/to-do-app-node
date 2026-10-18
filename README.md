# To Do app

A small REST API for a to-do list, built with **Express 5** and **Prisma 8** on **PostgreSQL**.

Users can register, log in with JWT authentication, and manage their own private list of
todos. A minimal static frontend is served straight from the API, so the whole app runs
from a single process.

## Tech stack

| Concern           | Choice                                                            |
| ----------------- | ----------------------------------------------------------------- |
| Runtime           | Node.js 24 (strips TypeScript types natively — no build step)      |
| Web framework     | Express 5                                                          |
| ORM               | Prisma 8 (`@prisma/orm-postgres`)                                 |
| Database          | PostgreSQL (managed Prisma Postgres)                              |
| Authentication    | JWT (`jsonwebtoken`), sent in the `Authorization` header           |
| Password storage  | bcrypt hashes (`bcryptjs`)                                        |
| Configuration     | `dotenv`                                                           |

## Requirements

- **Node.js 24 or newer.** The Prisma client lives in `src/prisma/db.ts` and is imported
  directly from JavaScript. Node 24 removes the TypeScript types at load time, so there
  is no compile step and no `tsc` in the pipeline.
- A PostgreSQL database you can reach over the network.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file (see the next section)
#    .env is git-ignored and must never be committed.

# 3. Make sure the database schema matches the contract
npx prisma db update

# 4. Start the app with auto-reload
npm run dev
```

The server listens on <http://localhost:8080> and serves the frontend from there.

### Environment variables

Both variables are required. The app reads them from `.env` locally, or from the real
process environment when deployed.

| Variable       | Description                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgres://user:password@host:5432/dbname` |
| `JWT_SECRET`   | Long random string used to sign and verify JWTs                             |
| `PORT`         | Optional. Defaults to `8080`.                                               |

Create the file by hand:

```ini
DATABASE_URL="postgres://user:password@host:5432/dbname"
JWT_SECRET="replace-me-with-a-long-random-string"
```

> `.env` is listed in `.gitignore`. Keep it that way — if a real credential ever lands in
> a commit, rotate it, because deleting the file in a later commit does **not** remove it
> from the repository history.

## npm scripts

| Script                 | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Starts the server with `--watch` and loads `.env`          |
| `npm start`            | Starts the server without watching (used in Docker)        |
| `npm run contract:emit`| Regenerates the Prisma 8 artifacts from the contract       |

## Prisma 8 notes

Prisma 8 is contract-first and no longer generates a client into `node_modules`.

- The data model lives in [`src/prisma/contract.prisma`](src/prisma/contract.prisma).
- [`src/prisma/db.ts`](src/prisma/db.ts) builds the client with `postgres<Contract>(...)`
  from `@prisma/orm-postgres/runtime` and exports it as `db`. Every route imports `db`
  from there.
- Queries are reached through `db.orm.<namespace>.<Model>`, for example
  `db.orm.public.User` and `db.orm.public.Todo`.
- Writes take the fields directly (no `data` wrapper) and return the full row:

  ```js
  const todo = await db.orm.public.Todo.create({ task, userId });
  ```

- Multi-step writes go through a transaction that commits on return and rolls back on
  throw:

  ```js
  const user = await db.transaction(async (tx) => {
    const created = await tx.orm.public.User.create({ username, password });
    await tx.orm.public.Todo.create({ task: DEFAULT_TODO, userId: created.id });
    return created;
  });
  ```

- Constraint violations surface as `SqlQueryError` with a `sqlState` (for example
  `23505` for a duplicate key) rather than Prisma 7's `P2002`.

After editing the contract, regenerate the artifacts and commit both `contract.json` and
`contract.d.ts` alongside the schema change:

```bash
npm run contract:emit
```

Schema changes are then applied to the database with `npx prisma db update` (or
`npx prisma db migrate` when applying planned migrations). Both read `DATABASE_URL` from
`.env` through [`prisma.config.ts`](prisma.config.ts); pass `--db <url>` to target a
different database, and `--dry-run` to preview the operations first.

## API

All todo routes require an `Authorization` header containing the raw JWT returned by
register or login (no `Bearer` prefix).

| Method   | Endpoint         | Auth | Body                          | Success | Notes                                |
| -------- | ---------------- | ---- | ----------------------------- | ------- | ------------------------------------ |
| `POST`   | `/auth/register` | No   | `{ username, password }`      | `201`   | Also creates the user's first todo   |
| `POST`   | `/auth/login`    | No   | `{ username, password }`      | `200`   | Returns `{ token }`                  |
| `GET`    | `/todos`         | Yes  | —                             | `200`   | Returns only the caller's todos      |
| `POST`   | `/todos`         | Yes  | `{ task }`                    | `200`   | Creates a todo for the caller        |
| `PUT`    | `/todos/:id`     | Yes  | `{ completed }`               | `200`   | `404` if the todo is not the caller's |
| `DELETE` | `/todos/:id`     | Yes  | —                             | `200`   | `404` if the todo is not the caller's |

Both auth endpoints return `404` for invalid credentials and `503` if the database call
fails. Requests to `/todos` without a valid token get `401`.

## Docker

The image is built from [`Dockerfile`](Dockerfile) and runs with the production
dependencies only, as the unprivileged `node` user. Secrets are injected at run time and
are never baked into a layer.

```bash
docker compose up --build     # build and run on http://localhost:8080
```

[`docker-compose.yml`](docker-compose.yml) reads `.env` for `DATABASE_URL` and
`JWT_SECRET`, so the same credentials as local development are used. Set `PORT=8080` in
the container environment to match the published port.

> Docker is not required for local development — `npm run dev` is enough. The image is
> primarily there so the app can be deployed to any platform that builds from a
> Dockerfile (Render, Railway, Fly.io, Cloud Run, App Runner, and so on). Those platforms
> build the image for you, so no local Docker installation is needed.

## Project structure

```
├── Dockerfile              # production image
├── docker-compose.yml      # local container run, reads .env
├── prisma.config.ts        # points the Prisma CLI at the contract and the database
├── tsconfig.json           # type hints for editors; Node strips the types at runtime
├── migrations/             # Prisma 8 contract snapshots and refs
├── public/
│   ├── index.html          # static frontend served by the API
│   ├── styles.css
│   └── fanta.css
└── src/
    ├── server.js           # Express app, static assets, route mounting
    ├── middleware/
    │   └── authMiddleware.js   # verifies the JWT and loads the user
    ├── routes/
    │   ├── authRoutes.js       # register and login
    │   └── todoRoutes.js       # todo CRUD, scoped to the current user
    └── prisma/
        ├── contract.prisma     # data model (source of truth)
        ├── contract.json       # generated from the contract
        ├── contract.d.ts       # generated from the contract
        └── db.ts               # exports the shared `db` client
```

## License

ISC
