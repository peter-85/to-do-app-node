import jwt from "jsonwebtoken";
import { db } from "../prisma/db.ts";

const authMiddleware = async (req, res, next) => {
  const token = req.header("authorization"); // Get the token from the Authorization header
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
