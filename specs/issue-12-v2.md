# Spec: #12 Due dates for todos

Status: draft
Issue: https://github.com/peter-85/to-do-app-node/issues/12

## Goal

Let users set an optional due date when they create a todo, and make overdue todos (due date passed and not completed) stand out in the list.

## Requirements

- The `Todo` model has a new nullable `dueDate` column, and existing rows keep `dueDate` as null.
- `POST /todos` accepts an optional `dueDate` field in the request body.
- `POST /todos` stores `dueDate` as null when the field is missing, null, or an empty string.
- `POST /todos` returns 400 when `dueDate` is present but is not a valid date.
- `POST /todos` and `GET /todos` include `dueDate` in each returned todo (null when not set).
- `PUT /todos/:id` ignores any `dueDate` in the body and never changes the stored due date.
- The add-todo form has an optional date input next to the task input, and the form still submits when the date is left empty.
- The frontend shows the due date on each todo that has one.
- A todo whose due date is before today and that is not completed has a visible overdue style.
- Completed todos and todos without a due date never get the overdue style.

## Acceptance criteria

- `POST /todos` with `{ task: "x" }` returns 200 with `dueDate: null`.
- `POST /todos` with `{ task: "x", dueDate: "2026-12-01" }` returns 200, and the stored todo has that date.
- `POST /todos` with `{ task: "x", dueDate: "not-a-date" }` returns 400 and creates no row.
- `GET /todos` returns todos created before the migration with `dueDate: null` and no error.
- `PUT /todos/:id` with `{ completed: 1, dueDate: "2030-01-01" }` leaves the todo's `dueDate` unchanged.
- In the UI, a not-completed todo whose due date was yesterday has the overdue class, and the same todo after completion does not.
- In the UI, a todo due today is not shown as overdue.

## Files likely affected

- `src/prisma/contract.prisma`: add the nullable `dueDate` field to `Todo`.
- `src/prisma/contract.json`, `src/prisma/contract.d.ts`: regenerate with `npm run contract:emit`.
- `migrations/`: the new contract snapshot from the Prisma CLI.
- `src/routes/todoRoutes.js`: accept and validate `dueDate` in `POST /`.
- `public/index.html`: add the date input in `renderTodos()` and send it from `addTodo()`, then render the due date and overdue state.
- `public/styles.css`: add the overdue style.

## Out of scope

- Changing or removing a due date after creation (excluded by the issue).
- Sorting or filtering by due date.
- Reminders or notifications.
- Due times (time of day) and per-user time zone settings.
- Validating `task` in `POST /todos`, which has no validation today.

## Open questions

- **Q1:** Is the due date a date only (`YYYY-MM-DD`), or a full timestamp?
  - Proposed: Date only. Store it as `DateTime` (or a `@db.Date` column if Prisma 8 supports it) and accept `YYYY-MM-DD` from the API.
  - Blocking: yes (it decides the column type, the API format and the tests)
- **Q2:** When does a todo count as overdue: from the day after the due date, or once the due date's midnight has passed?
  - Proposed: It's overdue when the due date is before today in the browser's local time, so a todo due today is not overdue.
  - Blocking: yes (it decides the overdue tests)
- **Q3:** Does the server compute overdue, or does the frontend?
  - Proposed: The frontend computes it from `dueDate` and `completed`, so the API contract only gains `dueDate`.
  - Blocking: yes (it changes the API response shape)
- **Q4:** Should a due date in the past be rejected when a todo is created?
  - Proposed: No. Accept it, and the todo shows as overdue straight away.
  - Blocking: yes (it changes validation)
- **Q5:** What does "stand out" look like?
  - Proposed: A red border or accent on the card plus an "Overdue" label, using the existing `fanta.css`/`styles.css` conventions.
  - Blocking: no
- **Q6:** Should the default first todo created at registration get a due date?
  - Proposed: No, leave it null.
  - Blocking: no

## Decisions

_None yet._
