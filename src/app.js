import express from "express";
import authRoutes from "./routes/authRoutes.js";
import todoRoutes from "./routes/todoRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import path, { dirname } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

// Builds the Express app without listening, so tests can start it on any port.
// src/server.js starts it for real.
export const app = express();

// Get the file path from the URL of the current module
const __filename = fileURLToPath(import.meta.url);
// Get the directory name from the file path
const __dirname = dirname(__filename);
// The frontend lives in ../public when running from src/, and in ./public
// next to the bundle when running the build output (dist/server.mjs).
const publicDir = existsSync(path.join(__dirname, "public"))
  ? path.join(__dirname, "public")
  : path.join(__dirname, "../public");

// Middleware
app.use(express.json());
// Serves the HTML file from the /public directory
// Tells express to serve all files from the public folder as static assets / file. Any requests for the css files will be resolved to the public directory.
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use("/auth", authRoutes);
// Apply the authentication middleware to all routes in todoRoutes
app.use("/todos", authMiddleware, todoRoutes);
