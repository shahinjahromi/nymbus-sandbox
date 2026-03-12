import type { Request, Response, NextFunction } from "express";

export interface ApiActivityEntry {
  id: string;
  tenantId: string;
  clientId: string;
  credentialId?: string;
  method: string;
  path: string;
  statusCode: number;
  requestId: string;
  idempotencyKey?: string;
  idempotencyReplay?: boolean;
  timestamp: string;
  environment: "sandbox";
}

const apiActivityByTenant = new Map<string, ApiActivityEntry[]>();

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function pushActivity(tenantId: string, entry: ApiActivityEntry): void {
  const current = apiActivityByTenant.get(tenantId) ?? [];
  current.push(entry);
  if (current.length > 1000) {
    current.splice(0, current.length - 1000);
  }
  apiActivityByTenant.set(tenantId, current);
}

export function listApiActivityForTenant(params: {
  tenantId: string;
  method?: string;
  pathContains?: string;
  statusCode?: number;
  limit?: number;
}): ApiActivityEntry[] {
  const all = apiActivityByTenant.get(params.tenantId) ?? [];

  return all
    .filter((entry) => {
      if (params.method && entry.method !== params.method.toUpperCase()) {
        return false;
      }
      if (params.pathContains && !entry.path.includes(params.pathContains)) {
        return false;
      }
      if (typeof params.statusCode === "number" && entry.statusCode !== params.statusCode) {
        return false;
      }
      return true;
    })
    .slice()
    .reverse()
    .slice(0, Math.max(1, Math.min(params.limit ?? 100, 500)));
}

export function captureApiActivity(req: Request, res: Response, next: NextFunction): void {
  const requestIdHeader = req.headers["x-request-id"];
  const requestId =
    typeof requestIdHeader === "string" && requestIdHeader.trim().length > 0
      ? requestIdHeader
      : generateRequestId();

  res.setHeader("x-request-id", requestId);

  const startedAt = new Date().toISOString();
  const idempotencyKeyHeader = req.headers["x-idempotency-key"];
  const idempotencyKey =
    typeof idempotencyKeyHeader === "string" && idempotencyKeyHeader.trim().length > 0
      ? idempotencyKeyHeader
      : undefined;

  res.on("finish", () => {
    if (!req.tenantId || !req.clientId) {
      return;
    }

    pushActivity(req.tenantId, {
      id: `${requestId}:${res.statusCode}`,
      tenantId: req.tenantId,
      clientId: req.clientId,
      credentialId: req.credentialId,
      method: req.method.toUpperCase(),
      path: req.originalUrl,
      statusCode: res.statusCode,
      requestId,
      idempotencyKey,
      idempotencyReplay: res.getHeader("x-idempotent-replay") === "true",
      timestamp: startedAt,
      environment: "sandbox",
    });
  });

  next();
}
