import { durableStore } from "./durable-store.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

function makeCompositeKey(params: {
  tenantId: string;
  method: string;
  route: string;
  key: string;
}): string {
  return `${params.tenantId}:${params.method.toUpperCase()}:${params.route}:${params.key}`;
}

export function getIdempotentReplay<T>(params: {
  tenantId: string;
  method: string;
  route: string;
  key: string;
}): { statusCode: number; payload: T } | null {
  const compositeKey = makeCompositeKey(params);
  const row = durableStore.getIdempotencyRecord(compositeKey);
  if (!row) {
    return null;
  }

  if (Date.now() - row.created_at > TWENTY_FOUR_HOURS_MS) {
    // Expired — clean up
    durableStore.deleteExpiredIdempotencyRecords(TWENTY_FOUR_HOURS_MS);
    return null;
  }

  return {
    statusCode: row.status_code,
    payload: JSON.parse(row.payload) as T,
  };
}

export function saveIdempotentResult<T>(params: {
  tenantId: string;
  method: string;
  route: string;
  key: string;
  statusCode: number;
  payload: T;
}): void {
  const compositeKey = makeCompositeKey(params);
  durableStore.upsertIdempotencyRecord({
    composite_key: compositeKey,
    tenant_id: params.tenantId,
    method: params.method.toUpperCase(),
    route: params.route,
    idem_key: params.key,
    created_at: Date.now(),
    status_code: params.statusCode,
    payload: JSON.stringify(params.payload),
  });
}
