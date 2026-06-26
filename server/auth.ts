import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db, User } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "deadline_guardian_ai_secrett_key";

export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Hash a password string
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verifies a password against its bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a signed JWT token
 */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

/**
 * Verify a JWT token and return the User if valid
 */
export function verifyAuthToken(token: string): User | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return db.getUserById(decoded.userId) || null;
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware to enforce authentication via Authorization headers
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access denied. Access token missing or invalid." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = db.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: "Access denied. User no longer exists." });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("JWT Verification failed:", err);
    return res.status(401).json({ error: "Session expired or invalid authentication token." });
  }
}
