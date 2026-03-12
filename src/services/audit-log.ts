import { durableStore } from "./durable-store.js";

export interface AuditEntry {
  id: string;
  tenantId: string;
  actor: string;
  action: string;
  outcome: "success" | "failure";
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export function writeAuditEntry(params: {
  tenantId: string;
  actor: string;
  action: string;
  outcome: "success" | "failure";
  requestId?: string;
  details?: Record<string, unknown>;
}): void {
  const id = `aud_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  durableStore.insertAuditEntry({
    id,
    tenant_id: params.tenantId,
    actor: params.actor,
    action: params.action,
    outcome: params.outcome,
    timestamp: new Date().toISOString(),
    request_id: params.requestId ?? null,
    details: params.details ? JSON.stringify(params.details) : null,
  });

  // Keep at most 1000 entries per tenant
  durableStore.pruneAuditLog(params.tenantId, 1000);
}

export function listTenantAuditEntries(tenantId: string, limit = 100): AuditEntry[] {
  const rows = durableStore.listAuditEntries(tenantId, limit);

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    actor: r.actor,
    action: r.action,
    outcome: r.outcome as "success" | "failure",
    timestamp: r.timestamp,
    requestId: r.request_id ?? undefined,
    details: r.details ? JSON.parse(r.details) : undefined,
  }));
}
