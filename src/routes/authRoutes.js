import express from "express";
import bcrypt from "bcryptjs";
import prisma from "../prismaClient.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Define your authentication routes here

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  //hash the password before storing it in the database
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });

    // now that we have a user, I want to add their first todo for them
    const defaultTodo = `Hello :) Add your first todo!`;
    await prisma.todo.create({
      data: {
        task: defaultTodo,
        userId: user.id,
      },
    });

    const token = jwt.sign(
      { id: result.lastInsertRowid },
      process.env.JWT_SECRET,
      { expiresIn: "1h" },
    );

    res.status(201).json({ token });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(503).json({ message: "Internal server error" });
  }
});

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  try {
    // Retrieve the user from the database (replace this with your actual database logic)
    const getUser = db.prepare("SELECT * FROM users WHERE username = ?");
    const user = getUser.get(username);

    if (!user) {
      return res.status(404).json({ message: "Invalid credentials" });
    }

    // Compare the provided password with the hashed password in the database
    const isPasswordValid = bcrypt.compareSync(password, user.password);

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
