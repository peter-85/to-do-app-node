# Spec: #8 Accept the standard `Bearer` Authorization scheme

Status: approved
Issue: https://github.com/peter-85/to-do-app-node/issues/8

## Goal

`/todos` routes accept `Authorization: Bearer <token>` as well as the current raw token, so standard HTTP clients work. The frontend and the README switch to the `Bearer` form.

## Requirements

- `authMiddleware` accepts an `Authorization` header of the form `Bearer <token>` and verifies only the `<token>` part.
- The scheme name `Bearer` is matched case-insensitively (RFC 9110 §11.1), so `bearer <token>` and `BEARER <token>` are accepted.
- Leading and trailing whitespace around the header value and extra spaces between the scheme and the token are ignored.
- A header that does not start with the `Bearer` scheme is still treated as a raw token (backward compatibility), including headers with another scheme such as `Basic abc`, which are not rejected separately.
- A missing or empty `Authorization` header still returns `401` with `{ "message": "No token provided" }`.
- A `Bearer` header with no token after the scheme (e.g. `Bearer` or `Bearer   `) returns `401` with `{ "message": "No token provided" }`.
- An invalid or expired token, in either form, still returns `401` with `{ "message": "Invalid token" }`.
- A valid token for a user that no longer exists still returns `401` with `{ "message": "Invalid token" }`, in either form.
- `public/index.html` sends `Authorization: Bearer <token>` on every `/todos` request (fetch, create, update, delete).
- The README API section documents `Authorization: Bearer <token>` as the expected form and notes that the raw token is still accepted for now.
- The CLAUDE.md auth-flow note about the raw JWT (no `Bearer` prefix) is updated to match.

## Acceptance criteria

- `GET /todos` with `Authorization: Bearer <valid token>` returns `200` and the caller's todos.
- `GET /todos` with `Authorization: bearer <valid token>` returns `200`.
- `GET /todos` with `Authorization: <valid token>` (raw) returns `200`.
- `GET /todos` with `Authorization: Bearer` (no token) returns `401` with `{ "message": "No token provided" }`.
- `GET /todos` with `Authorization: Bearer not-a-jwt` returns `401` with `{ "message": "Invalid token" }`.
- `GET /todos` with `Authorization: Basic abc` returns `401` with `{ "message": "Invalid token" }`.
- `GET /todos` with no `Authorization` header returns `401` (existing test keeps passing).
- `POST`, `PUT` and `DELETE` on `/todos` work with a `Bearer` header (covered by switching the test helper's default to `Bearer`).
- The existing user-isolation test still passes with `Bearer` headers.
- `grep` finds no `Authorization: token` without the `Bearer ` prefix in `public/index.html`.

## Files likely affected

- `src/middleware/authMiddleware.js`: parse the optional `Bearer` scheme before `jwt.verify`.
- `public/index.html`: send `Bearer ${token}` in the four `/todos` fetch calls.
- `test/api.test.js`: `call()` helper sends `Bearer <token>` by default; add tests for raw token, lowercase scheme, empty `Bearer`, invalid `Bearer` token, and a non-`Bearer` scheme.
- `README.md`: API section (around line 120) describes the `Bearer` form.
- `CLAUDE.md`: auth-flow bullet about the raw JWT.

## Out of scope

- Removing or deprecating raw-token support (issue says "for now"; a later issue can drop it).
- Adding a `WWW-Authenticate` response header on `401`.
- Changing `/auth/register` or `/auth/login` responses (they keep returning the bare `{ token }`).
- Changing token payload, expiry, or storage on the frontend.
- Changing the `404` on invalid login credentials.

## Open questions

_None._

## Decisions

- **How to handle a non-`Bearer` scheme (e.g. `Basic abc`)?**
  Fall through to the raw-token path; `jwt.verify` fails and the response is `401 { "message": "Invalid token" }`, the same as today. Decided by the user, 2026-11-23.
- **Which form should the test helper send by default?**
  `Bearer <token>` (the documented form), with one explicit raw-token test for backward compatibility. Decided by the user, 2026-11-23.
