# Spec: #7 Allow editing a todo's text and marking it incomplete again

Status: approved
Issue: https://github.com/peter-85/to-do-app-node/issues/7

## Goal

`PUT /todos/:id` updates only the fields it is given (`task`, `dueDate` and/or `completed`), so a todo's text and due date can be edited and a completed todo can be reopened. The frontend gets a Done ⇄ Undo toggle and inline editing of the task text and due date.

## Requirements

- `PUT /todos/:id` accepts an optional `task`, an optional `dueDate` and an optional `completed` in the body.
- Only the fields present in the body are written; a field that is absent keeps its stored value.
- A body with none of `task`, `dueDate` or `completed` returns `400 { "message": "Nothing to update" }` and changes nothing.
- `completed: false` (or `0`) on a completed todo sets `completed` to `false`.
- `completed: true` (or `1`) sets `completed` to `true`.
- Any other `completed` value (e.g. `"false"`, `"true"`, `2`, `null`) returns `400 { "message": "Invalid completed" }` and changes nothing.
- A `task` that is not a string (including `null`), or is empty after trimming whitespace, returns `400 { "message": "Invalid task" }` and changes nothing.
- A valid `task` is trimmed and the trimmed text replaces the stored text.
- A valid `dueDate` replaces the stored due date, using the same formats and normalisation to `YYYY-MM-DD` as `POST /todos` (`parseDueDate`).
- `dueDate: null` clears the stored due date (stored as `null`); a missing `dueDate` keeps it.
- An invalid `dueDate` returns `400 { "message": "Invalid dueDate" }` (same as `POST`) and changes nothing.
- When any field in the body is invalid, nothing is written, including the valid fields.
- The body is validated before the todo is looked up, so an invalid body returns `400` even for a todo that doesn't exist or belongs to another user.
- Other body fields (e.g. `userId`, `id`) are ignored, as today.
- The update stays scoped by `userId: req.userId`; with a valid body, a todo that doesn't exist or belongs to another user returns `404 { "message": "Todo not found" }`.
- A successful update returns `200` with the updated todo, as today.
- In `public/index.html`, a completed todo shows an enabled "Undo" button that sends `completed: false`; an open todo shows "Done", which sends `completed: true`.
- In `public/index.html`, each todo has an "Edit" button that replaces its text with a text input and a date input, both pre-filled with the current values.
- In the edit form, Enter or a "Save" button saves and Escape cancels, restoring the todo's normal view without a request.
- Saving sends only the fields that changed; an emptied date input sends `dueDate: null`.
- Saving with no changes closes the edit form without sending a request.
- If the server returns `400` on save, the edit form stays open.
- The frontend's `PUT` requests no longer send fields that aren't changing (the Done/Undo toggle sends only `completed`).
- The README API table row for `PUT /todos/:id` documents the body `{ task?, dueDate?, completed? }` (at least one), that `dueDate: null` clears the due date, and the `400` cases.

## Acceptance criteria

- `PUT` with `{ completed: false }` on a completed todo returns `200` with `completed: false`, and `GET /todos` shows it open.
- `PUT` with `{ completed: true }` on an open todo returns `200` with `completed: true`.
- `PUT` with `{ completed: "false" }`, `{ completed: 2 }` or `{ completed: null }` returns `400 { "message": "Invalid completed" }` and `completed` is unchanged.
- `PUT` with `{ task: "New text" }` returns `200`, the todo's `task` is `"New text"`, and its `completed` and `dueDate` are unchanged.
- `PUT` with `{ task: "  Padded  " }` stores `"Padded"`.
- `PUT` with `{ dueDate: "2030-12-31" }` returns `200` with `dueDate: "2030-12-31"`, and `task` and `completed` are unchanged.
- `PUT` with `{ dueDate: "2030-12-31T10:00:00Z" }` stores `"2030-12-31"`.
- `PUT` with `{ dueDate: null }` on a todo with a due date returns `200` with `dueDate: null`.
- `PUT` with `{ completed: 1 }` (no `dueDate`) on a todo with a due date leaves `task` and `dueDate` unchanged (replaces the existing test "PUT /todos/:id keeps the dueDate").
- `PUT` with `{ task: "" }`, `{ task: "   " }`, `{ task: null }` or `{ task: 5 }` returns `400 { "message": "Invalid task" }` and the stored `task` is unchanged.
- `PUT` with `{ dueDate: "2026-02-30" }` returns `400 { "message": "Invalid dueDate" }` and the stored `dueDate` is unchanged.
- `PUT` with `{ task: "ok", dueDate: "not-a-date" }` returns `400` and neither `task` nor `dueDate` changes.
- `PUT` with `{}` returns `400 { "message": "Nothing to update" }` and the todo is unchanged.
- `PUT` with `{ task: "x" }`, `{ dueDate: "2030-01-01" }` or `{ completed: false }` on another user's todo returns `404`, and that todo is unchanged (extend the existing isolation test).
- `PUT` with `{ task: "" }` on another user's todo returns `400`.
- Existing tests that send `{ completed: 1 }` keep passing.
- Manual: in the browser, mark a todo Done, click Undo, and it moves back to the Open tab.
- Manual: click Edit, change the text and the due date, press Enter, reload the page, and the new text and date are shown.
- Manual: click Edit, clear the date, Save, and the todo no longer shows a due date.
- Manual: click Edit, press Escape, and the todo is unchanged; click Edit and Save without changes, and no `PUT` request is sent (check the Network tab).

## Files likely affected

- `src/routes/todoRoutes.js`: `PUT /:id` validates the body and updates only the provided fields; reuses `parseDueDate`.
- `src/utils/dueDate.js`: likely unchanged; `parseDueDate` already maps `null` to "no due date", but `PUT` must tell a missing `dueDate` from `null` before calling it.
- `public/index.html`: Done ⇄ Undo toggle and Edit form (text + date input) in `renderTodos`; `updateTodo` sends only the changed fields.
- `test/api.test.js`: new tests for reopen, edit text, edit and clear due date, partial update and the 400 cases; extend the user-isolation test; replace "PUT /todos/:id keeps the dueDate".
- `README.md`: API table row for `PUT /todos/:id`.

## Out of scope

- Validating `task` on `POST /todos` (it currently accepts an empty task); a separate issue will cover it.
- A maximum length for `task`.
- Escaping task text in the frontend (`renderTodos` inserts `todo.task` into `innerHTML` unescaped; this already exists and is a separate fix).
- Validating a non-numeric `:id`.
- Schema or migration changes (none needed: `task`, `dueDate` and `completed` already exist on `Todo`).

## Open questions

_None._

## Decisions

- **Replace the #12 test "PUT /todos/:id keeps the dueDate"?**
  Yes. This issue reverses #12's "PUT ignores dueDate". The test is replaced by one that `{ completed: 1 }` without `dueDate` keeps the due date, and new tests check that a `dueDate` in the body is written. Decided by the user, 2026-11-23.
- **Valid `completed` values?**
  Only `true`, `false`, `1` and `0`; anything else returns `400 { "message": "Invalid completed" }`. Decided by the user, 2026-11-23.
- **How is `task` validated and stored?**
  Must be a string that is non-empty after trimming, otherwise `400 { "message": "Invalid task" }`; the trimmed text is stored. Decided by the user, 2026-11-23.
- **Can `PUT` clear a due date?**
  Yes: `dueDate: null` clears it, a missing `dueDate` keeps it. `task: null` and `completed: null` are invalid (`400`). Decided by the user, 2026-11-23.
- **Body with none of the three fields?**
  `400 { "message": "Nothing to update" }`. Decided by the user, 2026-11-23.
- **Can the frontend change the due date?**
  Yes. The inline edit form includes a date input pre-filled with the current due date; emptying it clears the due date. Decided by the user, 2026-11-23.
- **Should `POST /todos` also reject an empty `task`?**
  No. Keep this issue to `PUT`; a separate issue will cover `POST`. Decided by the user, 2026-11-23.
- **Invalid body on another user's todo: 400 or 404?**
  `400`. The body is validated before the lookup, which reveals nothing about other users' todos. Decided by the user, 2026-11-23.
- **How does inline edit work?**
  An "Edit" button swaps the text for a text input and a date input; Enter or "Save" saves, Escape cancels; on a `400` the form stays open. Decided by the user, 2026-11-23.
- **Save with no changes?**
  The frontend closes the edit form without sending a request (an empty body would get `400 "Nothing to update"`). Decided by the user, 2026-11-23.
