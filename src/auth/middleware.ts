import type { Request, Response, NextFunction } from "express";
import { validateAccessToken } from "./oauth.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Missing or invalid Authorization header. Use Bearer <access_token>.",
    });
    return;
  }
  const token = auth.slice(7);
  const { valid, clientId } = validateAccessToken(token);
  if (!valid) {
    res.status(401).json({
      code: "INVALID_OR_EXPIRED_TOKEN",
      message: "Access token is invalid or expired. Use the token endpoint to obtain a new one.",
    });
    return;
  }
  (req as Request & { clientId: string }).clientId = clientId!;
  next();
}
