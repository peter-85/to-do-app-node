import express from "express";
import { db } from "../prisma/db.ts";
import { parseDueDate } from "../utils/dueDate.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const todos = await db.orm.public.Todo.where({ userId: req.userId })
    .orderBy((todo) => todo.id.asc())
    .all();

  res.json(todos);
});

router.post("/", async (req, res) => {
  const { task } = req.body;

  const dueDate = parseDueDate(req.body.dueDate);
  if (dueDate === undefined) {
    return res.status(400).json({ message: "Invalid dueDate" });
  }

  const todo = await db.orm.public.Todo.create({
    task,
    dueDate,
    userId: req.userId,
  });

  res.json(todo);
});

// Validates a PUT body. Returns { changes } with only the fields that were sent,
// or { error } with the 400 message. Nothing is written unless every field is valid.
function parseTodoUpdate(body) {
  const has = (field) => Object.hasOwn(body, field);
  if (!has("task") && !has("dueDate") && !has("completed")) {
    return { error: "Nothing to update" };
  }

  const changes = {};

  if (has("completed")) {
    // The frontend has historically sent 0/1, so accept those as well as booleans
    const { completed } = body;
    if (![true, false, 1, 0].includes(completed)) return { error: "Invalid completed" };
    changes.completed = Boolean(completed);
  }

  if (has("task")) {
    const task = typeof body.task === "string" ? body.task.trim() : "";
    if (!task) return { error: "Invalid task" };
    changes.task = task;
  }

  if (has("dueDate")) {
    // null clears the due date; parseDueDate maps null to null
    const dueDate = parseDueDate(body.dueDate);
    if (dueDate === undefined) return { error: "Invalid dueDate" };
    changes.dueDate = dueDate;
  }

  return { changes };
}

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);

  // Validate before the lookup, so the response reveals nothing about other users' todos
  const { changes, error } = parseTodoUpdate(req.body ?? {});
  if (error) {
    return res.status(400).json({ message: error });
  }

  const todo = await db.orm.public.Todo.where({ id, userId: req.userId }).update(changes);

  if (!todo) {
    return res.status(404).json({ message: "Todo not found" });
  }

  res.json(todo);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  const todo = await db.orm.public.Todo.where({ id, userId: req.userId }).delete();

  if (!todo) {
    return res.status(404).json({ message: "Todo not found" });
  }

  res.json({ message: "Todo deleted" });
});

export default router;
