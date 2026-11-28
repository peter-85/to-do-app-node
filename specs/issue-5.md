# Spec: #5 Todo routes return HTML 500 errors for bad input

Status: draft
Issue: https://github.com/peter-85/to-do-app-node/issues/5

## Goal

Bad input to the todo routes returns a JSON `400 { message }` instead of an HTML 500 page, and any unexpected error from `/todos` returns a JSON `{ message }`.

## Requirements

- `POST /todos` with a `task` that is missing, not a string, or empty after trimming returns `400` with `{ "message": "Invalid task" }` and writes nothing.
- `POST /todos` with no body (no `Content-Type`) returns `400` with `{ "message": "Invalid task" }` instead of crashing on `req.body`.
- `POST /todos` trims `task` before storing it, matching `PUT /todos/:id`.
- `PUT /todos/:id` and `DELETE /todos/:id` return `400` with `{ "message": "Invalid id" }` when `:id` is not a decimal integer in the range 1 to 2147483647 (see Q2).
- The `:id` check runs before any database call, so a bad id never reaches the database.
- `PUT /todos/:id` with `completed` set to anything other than `true`, `false`, `1`, or `0` (including the string `"false"`) returns `400`. The current code already does this; keep it covered by the tests.
- A JSON error-handling middleware is registered in `src/app.js` after the routes. Unexpected errors (no `status` on the error) return `500` with `{ "message": "Internal server error" }` and log the error with `console.error`. The response never contains a stack trace or HTML.
- Errors that carry a 4xx status from Express (such as a malformed JSON body) return that status with `{ "message": "Invalid JSON" }` when the cause is a JSON parse error, and otherwise `{ "message": <error message> }`.
- Successful responses and the existing `404 { message: "Todo not found" }` responses are unchanged.
- Every todo query stays scoped by `userId: req.userId`.
- No database schema or contract change.

## Acceptance criteria

- `POST /todos` with `{}` returns `400` and `{ "message": "Invalid task" }`, and no todo is created.
- `POST /todos` with `{ "task": "   " }` returns `400` and `{ "message": "Invalid task" }`.
- `POST /todos` with `{ "task": 5 }` returns `400` and `{ "message": "Invalid task" }`.
- `POST /todos` with no body returns `400` and `{ "message": "Invalid task" }`, not `500`.
- `POST /todos` with `{ "task": "  buy milk  " }` returns `200` and stores `"buy milk"`.
- `PUT /todos/abc` and `DELETE /todos/abc` return `400` and `{ "message": "Invalid id" }`.
- `PUT /todos/1.5`, `PUT /todos/0`, `PUT /todos/-1`, and `DELETE /todos/0` return `400` and `{ "message": "Invalid id" }`.
- `PUT /todos/2147483648` returns `400` and `{ "message": "Invalid id" }`, not `500`.
- A `PUT /todos/:id` request with an invalid id and an invalid body returns `400` with the id message.
- `PUT /todos/:id` with `{ "completed": "false" }` returns `400` and the todo stays unchanged.
- An unexpected error thrown in a todo route (for example, by a test that stubs the database) returns `500` with `Content-Type: application/json` and `{ "message": "Internal server error" }`.
- A malformed JSON body (e.g. `{bad json`) to `POST /todos` returns `400` JSON with `{ "message": "Invalid JSON" }`.
- Every response to the cases above has a JSON `Content-Type`, not `text/html`.

## Files likely affected

- `src/routes/todoRoutes.js`: validate `task` in `POST /`, default `req.body` to `{}`, parse and validate `:id` in `PUT /:id` and `DELETE /:id` before the lookup.
- `src/app.js`: add the JSON error-handling middleware after the `/todos` route mount.
- `test/api.test.js`: add tests for each acceptance criterion above.
- `src/server.js`: no change needed (it only calls `listen`; see Q1).

## Out of scope

- Validation of other fields or routes (`/auth` already validates its body in #4).
- Changing the frontend, or the 503 DB-error convention used by `/auth`.
- Rate limiting, logging frameworks, or error tracking.
- Changing the `completed` values accepted by `PUT` (`true`/`false`/`1`/`0` stay as they are).
- Adding a `GET /todos/:id` route.

## Open questions

- **Q1:** The issue says to put the error middleware in `src/server.js`, but that file only calls `listen`, and the tests import `src/app.js`. Should the middleware go in `src/app.js` so it can be tested?
  - Proposed: Yes, add it in `src/app.js` after the routes. The response contract is the same either way.
  - Blocking: no

- **Q2:** Which `:id` values count as invalid? The issue only says "non-integer". Values such as `0`, negatives, and integers above the Postgres `int4` range would reach the database and return 500 today.
  - Proposed: Accept only decimal digits with no sign, no decimal point, and a value from 1 to 2147483647. Anything else returns `400 { "message": "Invalid id" }`.
  - Blocking: yes (this sets the API contract for ids and the validation rule the tests check).

- **Q3:** Should `task` be trimmed before storing, and should a whitespace-only task count as empty? `PUT` already does both.
  - Proposed: Yes to both, so `POST` and `PUT` behave the same. Store the trimmed value.
  - Blocking: yes (this changes what is stored and what is accepted).

- **Q4:** What status and body should an unexpected error return?
  - Proposed: `500` with `{ "message": "Internal server error" }`, the same text `/auth` uses for its generic failures.
  - Blocking: no

- **Q5:** Should a malformed JSON body return `400` JSON, or is the 400 status from Express enough?
  - Proposed: Return `400 { "message": "Invalid JSON" }` for JSON parse errors. This applies to every route, since the middleware is app-wide.
  - Blocking: no

## Decisions

_None yet._
