import type { Request, Response, NextFunction } from "express";
import { durableStore } from "./durable-store.js";

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
  durationMs?: number;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function persistActivity(entry: ApiActivityEntry): Promise<void> {
  await durableStore.insertApiActivity({
    id: entry.id,
    tenant_id: entry.tenantId,
    client_id: entry.clientId,
    credential_id: entry.credentialId ?? null,
    method: entry.method,
    path: entry.path,
    status_code: entry.statusCode,
    request_id: entry.requestId,
    idempotency_key: entry.idempotencyKey ?? null,
    idempotency_replay: entry.idempotencyReplay ? 1 : 0,
    environment: entry.environment,
    timestamp: entry.timestamp,
    duration_ms: entry.durationMs ?? null,
  });
  // Keep at most 1000 entries per tenant
  await durableStore.pruneApiActivity(entry.tenantId, 1000);
}

export async function listApiActivityForTenant(params: {
  tenantId: string;
  environment?: "sandbox";
  method?: string;
  pathContains?: string;
  statusCode?: number;
  limit?: number;
}): Promise<ApiActivityEntry[]> {
  const rows = await durableStore.listApiActivity({
    tenantId: params.tenantId,
    environment: params.environment,
    method: params.method,
    pathContains: params.pathContains,
    statusCode: params.statusCode,
    limit: params.limit,
  });

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    clientId: r.client_id,
    credentialId: r.credential_id ?? undefined,
    method: r.method,
    path: r.path,
    statusCode: r.status_code,
    requestId: r.request_id,
    idempotencyKey: r.idempotency_key ?? undefined,
    idempotencyReplay: r.idempotency_replay === 1,
    timestamp: r.timestamp,
    environment: r.environment as "sandbox",
    durationMs: r.duration_ms ?? undefined,
  }));
}

export function captureApiActivity(req: Request, res: Response, next: NextFunction): void {
  const requestIdHeader = req.headers["x-request-id"];
  const requestId =
    typeof requestIdHeader === "string" && requestIdHeader.trim().length > 0
      ? requestIdHeader
      : generateRequestId();

  res.setHeader("x-request-id", requestId);

  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const idempotencyKeyHeader = req.headers["x-idempotency-key"];
  const idempotencyKey =
    typeof idempotencyKeyHeader === "string" && idempotencyKeyHeader.trim().length > 0
      ? idempotencyKeyHeader
      : undefined;

  res.on("finish", () => {
    if (!req.tenantId || !req.clientId) {
      return;
    }

    const entry: ApiActivityEntry = {
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
      durationMs: Date.now() - startMs,
    };

    persistActivity(entry).catch((err) =>
      console.error("[api-activity-log] persist failed:", err),
    );
  });

  next();
}
