# Spec: #3 Registering with an existing username returns 503 "Internal server error"

Status: approved
Issue: https://github.com/peter-85/to-do-app-node/issues/3

## Goal

`POST /auth/register` with a username that is already taken returns `409 Conflict` and a clear message, so clients can tell "username taken" apart from a real outage. The sign-in/sign-up form shows the API's error message to the user.

## Requirements

- When registration fails with a Postgres unique violation (`SqlQueryError` with `sqlState === "23505"`), the response is status `409` with body `{ "message": "Username already taken" }`.
- The `409` check uses `sqlState` only; it does not inspect which constraint was violated.
- Any other registration error still returns status `503` with body `{ "message": "Internal server error" }` and is still logged with `console.error`.
- A failed duplicate registration creates no user and no todo; the existing transaction rolls back.
- A successful registration still returns `201` with `{ token }`.
- In `public/index.html`, when a register or login response has no token but has a `message`, the form's error element shows that message.
- When a failed register or login response has no `message`, the form keeps showing the current generic text ("❌ Failed to authenticate...").

## Acceptance criteria

- Test: registering a new user and then registering again with the same username and a different password returns `409` with `message` equal to `"Username already taken"`.
- Test: after that `409`, logging in with the original username and original password returns `200` with a token, so the first account is unchanged.
- The existing test "register returns 201 with a token" still passes.
- `npm test` passes.
- Manual check in the browser (`npm run dev`): signing up with a username that already exists shows "Username already taken" in the form's error area.
- Manual check in the browser: signing in with a wrong password shows "Invalid credentials" in the form's error area.
- Manual check in the browser: signing up and signing in with valid details still open the dashboard.

## Files likely affected

- `src/routes/authRoutes.js`: in the `catch` block of `POST /register`, return `409` for `sqlState === "23505"` before the generic `503`.
- `test/api.test.js`: add the duplicate-username test(s) in the `auth` section, using the existing `registerUser()` and `call()` helpers.
- `public/index.html`: in the auth submit handler, show the response's `message` when there's no token, falling back to the generic text.
- `CLAUDE.md`: the "Auth flow" bullet for `/auth/register` currently says every error returns 503; update it to describe the `409`.

## Out of scope

- Automated frontend tests (e.g. Playwright); the frontend change is checked manually.
- Handling responses that aren't JSON in the frontend; current behaviour stays.
- Validating input (missing or empty `username`/`password`, length, case-insensitive duplicates). These currently fall through to `503`.
- Testing the `503` path, which would need a way to simulate a database failure.
- Changing login's `404` for invalid credentials.

## Open questions

_None._

## Decisions

- **Should the 409 check also confirm the violated constraint is `User.username`?**
  No; check `sqlState === "23505"` only. `User.username` is the only unique constraint registration touches. Decided by peter-85, 2026-11-23.
- **Should the frontend show the API's message instead of its generic error?**
  Yes, include it in this spec. Decided by peter-85, 2026-11-23.
- **Which failures should show the API's message?**
  Any failed register or login response that has a `message` (409, login 404, 503); otherwise keep the generic text. Decided by peter-85, 2026-11-23.
- **How should the frontend change be verified?**
  A manual browser check; no new frontend test tooling. Decided by peter-85, 2026-11-23.
