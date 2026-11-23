import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../prisma/db.ts";

const router = express.Router();

const DEFAULT_TODO = "Hello :) Add your first todo!";

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // The user and their first todo are created together or not at all
    const user = await db.transaction(async (tx) => {
      const created = await tx.orm.public.User.create({
        username,
        password: hashedPassword,
      });

      await tx.orm.public.Todo.create({
        task: DEFAULT_TODO,
        userId: created.id,
      });

      return created;
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.status(201).json({ token });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(503).json({ message: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await db.orm.public.User.where({ username }).first();

    if (!user) {
      return res.status(404).json({ message: "Invalid credentials" });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(404).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(503).json({ message: "Internal server error" });
  }
});

export default router;
