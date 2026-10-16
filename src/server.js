import express from "express";
import authRoutes from "./routes/authRoutes.js";
import todoRoutes from "./routes/todoRoutes.js";
import authMiddleware from "./middleware/authMiddleware.js";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 8080;

// Get the file path from the URL of the current module
const __filename = fileURLToPath(import.meta.url);
// Get the directory name from the file path
const __dirname = dirname(__filename);

// Middleware
app.use(express.json());
// Serves the HTML file from the /public directory
// Tells express to serve all files from the public folder as static assets / file. Any requests for the css files will be resolved to the public directory.
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use("/auth", authRoutes);
// Apply the authentication middleware to all routes in todoRoutes
app.use("/todos", authMiddleware, todoRoutes);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
