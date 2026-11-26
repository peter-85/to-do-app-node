# Spec: #4 Auth endpoints accept missing or empty credentials

Status: approved
Issue: https://github.com/peter-85/to-do-app-node/issues/4

## Goal

`POST /auth/register` and `POST /auth/login` return `400` with a clear `{ message }` when `username` or `password` is missing, not a string, empty, or (on register) outside the length limits, before calling bcrypt or the database.

## Requirements

- Both handlers validate the body before any `bcrypt` or `db` call, so an invalid body never reaches the database.
- A request with no body or a non-object JSON body (e.g. no `Content-Type`, or `[]`, `"x"`, `null`) returns `400` instead of the Express default error from destructuring `req.body`.
- Both endpoints trim leading and trailing whitespace from `username` before validating it, and use the trimmed value for the lookup (login) and for storage (register).
- A `username` that is missing, not a string, or empty after trimming returns `400` with `{ "message": "Username is required" }` on both endpoints.
- A `password` that is missing, not a string, or empty returns `400` with `{ "message": "Password is required" }` on both endpoints.
- `password` is never trimmed; it is hashed and compared exactly as sent.
- When both fields are invalid, the response reports only the username error (one `{ message }` per response, the existing API error shape).
- On register, a trimmed `username` shorter than 3 or longer than 254 characters returns `400` with `{ "message": "Username must be between 3 and 254 characters" }`.
- On register, a `password` shorter than 8 characters returns `400` with `{ "message": "Password must be at least 8 characters" }`.
- On register, a `password` longer than 72 bytes in UTF-8 returns `400` with `{ "message": "Password is too long (max 72 bytes)" }`.
- On login, length limits are not checked; a present, non-empty string that matches no account still returns `404 { "message": "Invalid credentials" }`.
- Valid requests behave exactly as today: register returns `201`/`409`/`503`, login returns `200`/`404`/`503`.
- The frontend's client-side password minimum is 8 characters instead of 6.

## Acceptance criteria

- `POST /auth/register` with `{}` returns `400` and `{ "message": "Username is required" }`.
- `POST /auth/register` with no body returns `400`.
- `POST /auth/register` with only a valid `username` returns `400` and `{ "message": "Password is required" }`.
- `POST /auth/register` with `username: ""`, `username: "   "` or `password: ""` returns `400`.
- `POST /auth/register` with `username: 123` or `password: ["x"]` returns `400`.
- `POST /auth/register` with a 2-character or 255-character username returns `400` with the username length message, and with a 3-character or 254-character username returns `201`.
- `POST /auth/register` with a username of 2 characters plus surrounding spaces returns `400` (length is checked after trimming).
- `POST /auth/register` with `"  <name>  "` returns `201`, and `POST /auth/login` with `<name>` (untrimmed or trimmed) and the same password returns `200`.
- `POST /auth/register` with a 7-character password returns `400` and `{ "message": "Password must be at least 8 characters" }`, and with an 8-character password returns `201`.
- `POST /auth/register` with a 72-byte ASCII password returns `201`, and with a 73-byte ASCII password returns `400` and `{ "message": "Password is too long (max 72 bytes)" }`.
- `POST /auth/register` with a password of 37 two-byte characters (e.g. `"é"`, 74 bytes) returns `400` with the too-long message.
- After a `400` from register, logging in with the same username returns `404`, showing no user was created.
- `POST /auth/login` with `{}`, no body, a missing field, an empty or whitespace-only username, an empty password, or a non-string field returns `400` with the matching message.
- `POST /auth/login` with an existing username and a short, non-empty wrong password (e.g. `"wrong"`) still returns `404`.
- All existing tests in `test/api.test.js` pass, with only the test-data change listed below.

## Files likely affected

- `src/routes/authRoutes.js`: one shared credential check at the top of both handlers (trim username, then validate), returning `400` before `bcrypt`/`db`; it must run before `req.body` is destructured. Register additionally checks the length limits.
- `test/api.test.js`: new validation tests. `newCredentials()` usernames (`user-<uuid>`, 41 characters) and its `"secret123"` password already fit the limits; the 409 test's `"another"` password (7 characters) must become 8+ characters.
- `public/index.html`: in `authenticate()`, change the password minimum from `6` to `8`.
- `README.md`: the endpoint table and the error note (around line 140) should mention the `400` and the limits.

## Out of scope

- Requiring the username to be an email address (the frontend asks for one; the API does not).
- Password strength rules (character classes, breached-password checks).
- Rate limiting or lockout on login.
- Changing the `404` for invalid login credentials to `401`.
- Case-folding usernames, or migrating existing users that break the new rules (including any stored username with surrounding whitespace, which can no longer be matched on login).
- A database-level length constraint in `contract.prisma`.
- Showing a message in the frontend when its own client-side check fails (it currently returns silently).

## Open questions

_None._

## Decisions

- **Username length limits (Q1)**
  3–254 characters on register (the maximum email length), measured after trimming. Decided by the user, 2026-11-26. Reason: the frontend uses the email address as the username.
- **Password length limits (Q2)**
  At least 8 characters and at most 72 bytes on register. Decided by the user, 2026-11-26. Reason: bcrypt ignores everything after 72 bytes.
- **Length limits on login (Q3)**
  Not enforced; login checks only present, string and non-empty. Decided by the user, 2026-11-26. Reason: existing accounts with 6–7 character passwords must still be able to log in.
- **Whitespace handling (Q4)**
  Trim the username before validating and storing it; never trim the password. Decided by the user, 2026-11-26.
- **Trimming on login**
  Login trims the username the same way register does. Decided by the user, 2026-11-26. Reason: the same input should work on both endpoints.
- **How the 72 limit is measured**
  In UTF-8 bytes, so no password is silently truncated. Decided by the user, 2026-11-26.
- **Password error messages**
  Two messages: "Password must be at least 8 characters" (minimum, in characters) and "Password is too long (max 72 bytes)" (maximum, in bytes). Decided by the user, 2026-11-26.
- **Frontend checks (Q5)**
  Change only the client-side password minimum from 6 to 8. Decided by the user, 2026-11-26. Reason: users meet the same rule the server enforces.
- **One error or all errors (Q6)**
  One `{ message }` per response, username error first. Decided by the user, 2026-11-26. Reason: matches the existing API error shape.
