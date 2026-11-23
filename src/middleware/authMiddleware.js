import jwt from "jsonwebtoken";
import { db } from "../prisma/db.ts";

// Accepts "Bearer <token>" (scheme matched case-insensitively) and, for backward
// compatibility, a raw token. Any other value is treated as a raw token.
function extractToken(header) {
  const value = (header ?? "").trim();
  const bearer = value.match(/^bearer(?:\s+(.*))?$/i);
  return bearer ? (bearer[1] ?? "").trim() : value;
}

const authMiddleware = async (req, res, next) => {
  const token = extractToken(req.header("authorization"));
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token using the secret key

    const user = await db.orm.public.User.select("id").first({ id: decoded.id });
    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.userId = user.id; // Attach the user ID to the request object for further use
    next(); // Call the next middleware or route handler
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;
