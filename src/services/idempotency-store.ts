interface IdempotencyRecord<T> {
  tenantId: string;
  method: string;
  route: string;
  key: string;
  createdAt: number;
  statusCode: number;
  payload: T;
}

const records = new Map<string, IdempotencyRecord<unknown>>();
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
  const existing = records.get(compositeKey) as IdempotencyRecord<T> | undefined;
  if (!existing) {
    return null;
  }

  if (Date.now() - existing.createdAt > TWENTY_FOUR_HOURS_MS) {
    records.delete(compositeKey);
    return null;
  }

  return {
    statusCode: existing.statusCode,
    payload: existing.payload,
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
  records.set(compositeKey, {
    tenantId: params.tenantId,
    method: params.method.toUpperCase(),
    route: params.route,
    key: params.key,
    createdAt: Date.now(),
    statusCode: params.statusCode,
    payload: params.payload,
  });
}
