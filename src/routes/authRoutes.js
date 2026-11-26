import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../prisma/db.ts";

const router = express.Router();

const DEFAULT_TODO = "Hello :) Add your first todo!";

// Checks the credentials in a request body before any bcrypt or database call.
// Returns { username, password } (username trimmed) or { error } with the 400 message.
// Length limits apply to register only, so accounts made under older rules can still log in.
function parseCredentials(body, { checkLengths }) {
  const { username, password } =
    body && typeof body === "object" && !Array.isArray(body) ? body : {};

  const trimmed = typeof username === "string" ? username.trim() : "";
  if (!trimmed) return { error: "Username is required" };
  if (typeof password !== "string" || !password) return { error: "Password is required" };

  if (checkLengths) {
    const usernameLength = [...trimmed].length;
    if (usernameLength < 3 || usernameLength > 254) {
      return { error: "Username must be between 3 and 254 characters" };
    }
    if ([...password].length < 8) return { error: "Password must be at least 8 characters" };
    // bcrypt ignores everything after 72 bytes, so longer passwords are refused, not truncated
    if (Buffer.byteLength(password, "utf8") > 72) {
      return { error: "Password is too long (max 72 bytes)" };
    }
  }

  return { username: trimmed, password };
}

router.post("/register", async (req, res) => {
  const { username, password, error } = parseCredentials(req.body, { checkLengths: true });
  if (error) return res.status(400).json({ message: error });

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
    // 23505 = unique violation: the username is already registered
    if (error?.sqlState === "23505") {
      return res.status(409).json({ message: "Username already taken" });
    }
    console.error("Error registering user:", error);
    res.status(503).json({ message: "Internal server error" });
  }
});

router.post("/login", async (req, res) => {
  const { username, password, error } = parseCredentials(req.body, { checkLengths: false });
  if (error) return res.status(400).json({ message: error });

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
