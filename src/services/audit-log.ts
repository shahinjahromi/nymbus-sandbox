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

const auditEntriesByTenant = new Map<string, AuditEntry[]>();

function addEntry(tenantId: string, entry: AuditEntry): void {
  const current = auditEntriesByTenant.get(tenantId) ?? [];
  current.push(entry);
  if (current.length > 1000) {
    current.splice(0, current.length - 1000);
  }
  auditEntriesByTenant.set(tenantId, current);
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
  addEntry(params.tenantId, {
    id,
    tenantId: params.tenantId,
    actor: params.actor,
    action: params.action,
    outcome: params.outcome,
    timestamp: new Date().toISOString(),
    requestId: params.requestId,
    details: params.details,
  });
}

export function listTenantAuditEntries(tenantId: string, limit = 100): AuditEntry[] {
  const all = auditEntriesByTenant.get(tenantId) ?? [];
  return all.slice().reverse().slice(0, Math.max(1, Math.min(limit, 500)));
}
