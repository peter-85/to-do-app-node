// API tests: start the real app on a random port and call it over HTTP.
// They run against DATABASE_URL_TEST (never the dev or production database).
// Every run registers users with random names, so no cleanup is needed.
import "dotenv/config";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

if (!process.env.DATABASE_URL_TEST) {
  throw new Error("Set DATABASE_URL_TEST (in .env locally) to run the tests");
}
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
process.env.JWT_SECRET ??= "test-secret";

// Imported after DATABASE_URL is switched, because db.ts connects on import.
const { app } = await import("../src/app.js");
const { db } = await import("../src/prisma/db.ts");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.close();
});

// --- helpers ---------------------------------------------------------------

// `token` is sent as "Bearer <token>"; `authorization` sends a header value verbatim.
async function call(method, path, { body, token, authorization } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (authorization !== undefined) headers["Authorization"] = authorization;
  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : undefined };
}

function newCredentials() {
  return { username: `user-${randomUUID()}`, password: "secret123" };
}

async function registerUser() {
  const credentials = newCredentials();
  const res = await call("POST", "/auth/register", { body: credentials });
  assert.equal(res.status, 201);
  return { ...credentials, token: res.body.token };
}

// --- auth ------------------------------------------------------------------

test("register returns 201 with a token", async () => {
  const res = await call("POST", "/auth/register", { body: newCredentials() });
  assert.equal(res.status, 201);
  assert.equal(typeof res.body.token, "string");
});

test("register with a taken username returns 409 and keeps the first account", async () => {
  const user = await registerUser();
  const res = await call("POST", "/auth/register", {
    body: { username: user.username, password: "another" },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.message, "Username already taken");

  const login = await call("POST", "/auth/login", {
    body: { username: user.username, password: user.password },
  });
  assert.equal(login.status, 200);
  assert.equal(typeof login.body.token, "string");
});

test("login with the right password returns a token", async () => {
  const user = await registerUser();
  const res = await call("POST", "/auth/login", {
    body: { username: user.username, password: user.password },
  });
  assert.equal(res.status, 200);
  assert.equal(typeof res.body.token, "string");
});

test("login with a wrong password returns 404", async () => {
  const user = await registerUser();
  const res = await call("POST", "/auth/login", {
    body: { username: user.username, password: "wrong" },
  });
  assert.equal(res.status, 404);
});

test("/todos without a token or with an invalid token returns 401", async () => {
  assert.equal((await call("GET", "/todos")).status, 401);
  assert.equal((await call("GET", "/todos", { token: "not-a-jwt" })).status, 401);
});

test("/todos accepts Bearer in any case, and the raw token", async () => {
  const user = await registerUser();
  for (const authorization of [
    `Bearer ${user.token}`,
    `bearer ${user.token}`,
    `BEARER   ${user.token}`,
    user.token, // raw token, kept for backward compatibility
  ]) {
    const res = await call("GET", "/todos", { authorization });
    assert.equal(res.status, 200, `header: ${authorization}`);
    assert.equal(res.body.length, 1);
  }
});

test("malformed Authorization headers return 401", async () => {
  const empty = await call("GET", "/todos", { authorization: "Bearer" });
  assert.equal(empty.status, 401);
  assert.deepEqual(empty.body, { message: "No token provided" });
  for (const authorization of ["Bearer not-a-jwt", "Basic abc"]) {
    const res = await call("GET", "/todos", { authorization });
    assert.equal(res.status, 401, `header: ${authorization}`);
    assert.deepEqual(res.body, { message: "Invalid token" });
  }
});

// --- todos -----------------------------------------------------------------

test("a new user starts with the default todo", async () => {
  const user = await registerUser();
  const res = await call("GET", "/todos", { token: user.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 1);
});

test("create, complete and delete a todo", async () => {
  const user = await registerUser();

  const created = await call("POST", "/todos", {
    token: user.token,
    body: { task: "Buy milk" },
  });
  assert.equal(created.status, 200);
  assert.equal(created.body.task, "Buy milk");

  const updated = await call("PUT", `/todos/${created.body.id}`, {
    token: user.token,
    body: { completed: 1 }, // the frontend sends 0/1
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.completed, true);

  const deleted = await call("DELETE", `/todos/${created.body.id}`, {
    token: user.token,
  });
  assert.equal(deleted.status, 200);

  const list = await call("GET", "/todos", { token: user.token });
  assert.ok(!list.body.some((todo) => todo.id === created.body.id));
});

test("users cannot see, update or delete each other's todos", async () => {
  const alice = await registerUser();
  const bob = await registerUser();

  const todo = await call("POST", "/todos", {
    token: alice.token,
    body: { task: "Alice's todo", dueDate: "2029-06-01" },
  });

  const bobsList = await call("GET", "/todos", { token: bob.token });
  assert.ok(!bobsList.body.some((t) => t.id === todo.body.id));

  for (const body of [
    { completed: 1 },
    { completed: false },
    { task: "x" },
    { dueDate: "2030-01-01" },
  ]) {
    const update = await call("PUT", `/todos/${todo.body.id}`, { token: bob.token, body });
    assert.equal(update.status, 404, `body: ${JSON.stringify(body)}`);
  }

  // An invalid body is rejected before the lookup, so it is 400, not 404
  const invalid = await call("PUT", `/todos/${todo.body.id}`, {
    token: bob.token,
    body: { task: "" },
  });
  assert.equal(invalid.status, 400);

  const remove = await call("DELETE", `/todos/${todo.body.id}`, {
    token: bob.token,
  });
  assert.equal(remove.status, 404);

  // Alice's todo is still there and unchanged
  const alicesList = await call("GET", "/todos", { token: alice.token });
  const stillThere = alicesList.body.find((t) => t.id === todo.body.id);
  assert.ok(stillThere);
  assert.equal(stillThere.completed, false);
  assert.equal(stillThere.task, "Alice's todo");
  assert.equal(stillThere.dueDate, "2029-06-01");
});

// --- due dates (#12) -------------------------------------------------------

async function createTodo(token, body) {
  return call("POST", "/todos", { token, body });
}

test("a todo created without a dueDate has dueDate null", async () => {
  const user = await registerUser();
  for (const body of [{ task: "a" }, { task: "a2", dueDate: null }]) {
    const res = await createTodo(user.token, body);
    assert.equal(res.status, 200);
    assert.equal(res.body.dueDate, null);
  }
});

test("a valid dueDate is stored as YYYY-MM-DD, including past dates and date-times", async () => {
  const user = await registerUser();
  const cases = [
    ["a", "2026-12-01", "2026-12-01"],
    ["b", "2020-01-01", "2020-01-01"], // already in the past
    ["c", "2026-12-01T10:00:00Z", "2026-12-01"],
    ["d", "2026-12-01T23:30:00-05:00", "2026-12-01"], // offset ignored, not converted to UTC
  ];
  for (const [task, dueDate, expected] of cases) {
    const res = await createTodo(user.token, { task, dueDate });
    assert.equal(res.status, 200, `${dueDate} should be accepted`);
    assert.equal(res.body.dueDate, expected);
  }

  // GET returns the same dates
  const list = await call("GET", "/todos", { token: user.token });
  for (const [task, , expected] of cases) {
    assert.equal(list.body.find((t) => t.task === task).dueDate, expected);
  }
});

test("an invalid dueDate returns 400 and creates no row", async () => {
  const user = await registerUser();
  const invalid = ["2026-02-30", "12/01/2026", 1764547200000, "not-a-date"];
  for (const dueDate of invalid) {
    const res = await createTodo(user.token, { task: `bad ${dueDate}`, dueDate });
    assert.equal(res.status, 400, `${dueDate} should be rejected`);
    assert.deepEqual(res.body, { message: "Invalid dueDate" });
  }

  const list = await call("GET", "/todos", { token: user.token });
  assert.ok(!list.body.some((t) => t.task.startsWith("bad ")));
});

test("GET /todos returns dueDate on every todo, no overdue field, in id order", async () => {
  const user = await registerUser();
  // Due dates deliberately out of id order
  await createTodo(user.token, { task: "late", dueDate: "2030-01-01" });
  await createTodo(user.token, { task: "early", dueDate: "2020-01-01" });
  await createTodo(user.token, { task: "none" });

  const list = await call("GET", "/todos", { token: user.token });
  assert.equal(list.status, 200);

  // The default todo from registration has no due date
  assert.equal(list.body[0].dueDate, null);
  for (const todo of list.body) {
    assert.ok("dueDate" in todo);
    assert.ok(!("overdue" in todo));
  }

  const ids = list.body.map((t) => t.id);
  assert.deepEqual(ids, [...ids].sort((x, y) => x - y));
});

// Replaces the #12 test "PUT /todos/:id keeps the dueDate": since #7, PUT writes a
// dueDate it is sent, but one that is not sent is still kept.
test("PUT /todos/:id without a dueDate keeps the dueDate", async () => {
  const user = await registerUser();
  const created = await createTodo(user.token, { task: "due", dueDate: "2020-01-01" });

  const updated = await call("PUT", `/todos/${created.body.id}`, {
    token: user.token,
    body: { completed: 1 },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.completed, true);
  assert.equal(updated.body.task, "due");
  assert.equal(updated.body.dueDate, "2020-01-01");
});

// --- editing todos (#7) ----------------------------------------------------

function updateTodo(token, id, body) {
  return call("PUT", `/todos/${id}`, { token, body });
}

async function getTodo(token, id) {
  const list = await call("GET", "/todos", { token });
  return list.body.find((t) => t.id === id);
}

test("PUT toggles completed both ways", async () => {
  const user = await registerUser();
  const { body: todo } = await createTodo(user.token, { task: "toggle" });

  const done = await updateTodo(user.token, todo.id, { completed: true });
  assert.equal(done.status, 200);
  assert.equal(done.body.completed, true);

  const reopened = await updateTodo(user.token, todo.id, { completed: false });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.completed, false);
  assert.equal((await getTodo(user.token, todo.id)).completed, false);

  // 0 also reopens (the frontend used to send 0/1)
  await updateTodo(user.token, todo.id, { completed: 1 });
  const zero = await updateTodo(user.token, todo.id, { completed: 0 });
  assert.equal(zero.body.completed, false);
});

test("PUT updates only the fields sent", async () => {
  const user = await registerUser();
  const { body: todo } = await createTodo(user.token, { task: "orig", dueDate: "2029-01-01" });
  await updateTodo(user.token, todo.id, { completed: true });

  const text = await updateTodo(user.token, todo.id, { task: "New text" });
  assert.equal(text.status, 200);
  assert.equal(text.body.task, "New text");
  assert.equal(text.body.completed, true);
  assert.equal(text.body.dueDate, "2029-01-01");

  const padded = await updateTodo(user.token, todo.id, { task: "  Padded  " });
  assert.equal(padded.body.task, "Padded");

  const date = await updateTodo(user.token, todo.id, { dueDate: "2030-12-31" });
  assert.equal(date.status, 200);
  assert.equal(date.body.dueDate, "2030-12-31");
  assert.equal(date.body.task, "Padded");
  assert.equal(date.body.completed, true);

  const dateTime = await updateTodo(user.token, todo.id, { dueDate: "2030-12-31T10:00:00Z" });
  assert.equal(dateTime.body.dueDate, "2030-12-31");

  const cleared = await updateTodo(user.token, todo.id, { dueDate: null });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.dueDate, null);
  assert.equal((await getTodo(user.token, todo.id)).dueDate, null);
});

test("PUT rejects invalid values with 400 and changes nothing", async () => {
  const user = await registerUser();
  const { body: todo } = await createTodo(user.token, { task: "keep", dueDate: "2029-01-01" });

  const cases = [
    [{}, "Nothing to update"],
    [{ completed: "false" }, "Invalid completed"],
    [{ completed: 2 }, "Invalid completed"],
    [{ completed: null }, "Invalid completed"],
    [{ task: "" }, "Invalid task"],
    [{ task: "   " }, "Invalid task"],
    [{ task: null }, "Invalid task"],
    [{ task: 5 }, "Invalid task"],
    [{ dueDate: "2026-02-30" }, "Invalid dueDate"],
    [{ task: "ok", dueDate: "not-a-date" }, "Invalid dueDate"], // valid task is not written either
  ];
  for (const [body, message] of cases) {
    const res = await updateTodo(user.token, todo.id, body);
    assert.equal(res.status, 400, `body: ${JSON.stringify(body)}`);
    assert.deepEqual(res.body, { message });
  }

  const after = await getTodo(user.token, todo.id);
  assert.equal(after.task, "keep");
  assert.equal(after.dueDate, "2029-01-01");
  assert.equal(after.completed, false);
});
