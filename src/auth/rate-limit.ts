import type { NextFunction, Request, Response } from "express";
import { checkApiRateLimit } from "../services/security-rate-limit.js";

export function enforceApiRateLimit(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenantId || !req.clientId) {
    next();
    return;
  }

  const routeKey = `${req.baseUrl}${req.path}`;
  const result = checkApiRateLimit({
    tenantId: req.tenantId,
    credentialId: req.credentialId,
    method: req.method,
    route: routeKey,
  });

  if (!result.allowed) {
    res.setHeader("Retry-After", String(result.retryAfterSeconds ?? 60));
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Rate limit exceeded for this credential/tenant scope. Retry later.",
    });
    return;
  }

  next();
}
