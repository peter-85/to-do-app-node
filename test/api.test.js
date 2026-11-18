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

async function call(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = token; // raw JWT, no "Bearer" prefix
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

test("register with a taken username returns 409", async () => {
  const user = await registerUser();
  const res = await call("POST", "/auth/register", {
    body: { username: user.username, password: "another" },
  });
  assert.equal(res.status, 409);
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
    body: { task: "Alice's todo" },
  });

  const bobsList = await call("GET", "/todos", { token: bob.token });
  assert.ok(!bobsList.body.some((t) => t.id === todo.body.id));

  const update = await call("PUT", `/todos/${todo.body.id}`, {
    token: bob.token,
    body: { completed: 1 },
  });
  assert.equal(update.status, 404);

  const remove = await call("DELETE", `/todos/${todo.body.id}`, {
    token: bob.token,
  });
  assert.equal(remove.status, 404);

  // Alice's todo is still there and unchanged
  const alicesList = await call("GET", "/todos", { token: alice.token });
  const stillThere = alicesList.body.find((t) => t.id === todo.body.id);
  assert.ok(stillThere);
  assert.equal(stillThere.completed, false);
});
