import express from "express";
import { db } from "../prisma/db.ts";

const router = express.Router();

router.get("/", async (req, res) => {
  const todos = await db.orm.public.Todo.where({ userId: req.userId })
    .orderBy((todo) => todo.id.asc())
    .all();

  res.json(todos);
});

// ISO 8601 date (YYYY-MM-DD), optionally followed by "T" and a time with an
// optional "Z" or ±hh:mm offset. Only the date as written is kept.
const ISO_DATE_OR_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

// Returns the due date as "YYYY-MM-DD", null when absent, or undefined when invalid.
function parseDueDate(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;

  const match = ISO_DATE_OR_DATE_TIME.exec(value);
  if (!match) return undefined;

  // Reject dates that don't exist on the calendar, such as 2026-02-30
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return value.slice(0, 10);
}

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

router.put("/:id", async (req, res) => {
  const { completed } = req.body;
  const id = Number(req.params.id);

  const todo = await db.orm.public.Todo.where({ id, userId: req.userId }).update({
    // The client sends 0/1, so normalise to a boolean before writing
    completed: Boolean(completed),
  });

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
