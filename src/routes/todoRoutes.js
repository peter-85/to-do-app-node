import express from "express";
import { db } from "../prisma/db.ts";

const router = express.Router();

router.get("/", async (req, res) => {
  const todos = await db.orm.public.Todo.where({ userId: req.userId })
    .orderBy((todo) => todo.id.asc())
    .all();

  res.json(todos);
});

router.post("/", async (req, res) => {
  const { task } = req.body;

  const todo = await db.orm.public.Todo.create({
    task,
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
