import type { Request, Response, NextFunction } from "express";
import { validateAccessToken } from "./oauth.js";

function resolveRequestedEnvironment(req: Request): string | undefined {
  const direct = req.headers["x-environment"];
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim().toLowerCase();
  }

  const sandboxHeader = req.headers["x-sandbox-environment"];
  if (typeof sandboxHeader === "string" && sandboxHeader.trim().length > 0) {
    return sandboxHeader.trim().toLowerCase();
  }

  return undefined;
}

export function enforceEnvironmentScope(req: Request, res: Response): boolean {
  const requestedEnvironment = resolveRequestedEnvironment(req);
  if (!requestedEnvironment) {
    return true;
  }

  if (requestedEnvironment !== "sandbox") {
    res.status(401).json({
      code: "INVALID_ENVIRONMENT_SCOPE",
      message: "Credential/session is scoped to sandbox environment only.",
      environment: "sandbox",
    });
    return false;
  }

  return true;
}

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
  const { valid, clientId, tenantId, credentialId } = validateAccessToken(token);
  if (!valid) {
    res.status(401).json({
      code: "INVALID_OR_EXPIRED_TOKEN",
      message: "Access token is invalid or expired. Use the token endpoint to obtain a new one.",
    });
    return;
  }

  if (!enforceEnvironmentScope(req, res)) {
    return;
  }

  req.clientId = clientId!;
  req.tenantId = tenantId!;
  req.credentialId = credentialId;
  next();
}

export function requirePortalAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({
      code: "UNAUTHORIZED",
      message: "Missing or invalid Authorization header. Use Bearer <portal_token>.",
    });
    return;
  }

  if (!enforceEnvironmentScope(req, res)) {
    return;
  }

  next();
}
