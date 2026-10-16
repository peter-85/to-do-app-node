import express from "express";
import db from "../db.js";

const router = express.Router();

router.get("/", (req, res) => {
  const getTodos = db.prepare("SELECT * FROM todos WHERE user_id = ?");
  const todos = getTodos.all(req.userId);

  res.json(todos);
});

router.post("/", (req, res) => {
  const { task } = req.body;
  const addTodo = db.prepare("INSERT INTO todos (user_id, task) VALUES (?, ?)");
  addTodo.run(req.userId, task);
  res.json({ id: addTodo.lastInsertRowid, task, completed: false });
});

router.put("/:id", (req, res) => {
  const { completed } = req.body;
  const updateTodo = db.prepare("UPDATE todos SET completed = ? WHERE id = ?");
  updateTodo.run(completed, req.params.id);
  res.json({ id: req.params.id, completed });
});

router.delete("/:id", (req, res) => {
  const deleteTodo = db.prepare(
    "DELETE FROM todos WHERE id = ? AND user_id = ?",
  );
  deleteTodo.run(req.params.id, req.userId);
  res.json({ message: "Todo deleted" });
});

export default router;
