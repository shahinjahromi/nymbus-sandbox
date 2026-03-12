import type { Request } from "express";
import { config } from "../config.js";

interface WindowCounter {
  count: number;
  windowStart: number;
}

interface LimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface RateLimitPolicy {
  oauthRequestsPerMinute: number;
  apiRequestsPerMinute: number;
  portalAuthRequestsPerMinute: number;
}

const ONE_MINUTE_MS = 60_000;
const counters = new Map<string, WindowCounter>();

let policy: RateLimitPolicy = {
  oauthRequestsPerMinute: config.security.oauthRequestsPerMinute,
  apiRequestsPerMinute: config.security.apiRequestsPerMinute,
  portalAuthRequestsPerMinute: config.security.portalAuthRequestsPerMinute,
};

function consumeWithinWindow(key: string, limit: number, windowMs: number): LimitResult {
  const now = Date.now();
  const current = counters.get(key);

  if (!current || now - current.windowStart >= windowMs) {
    counters.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (current.count >= limit) {
    const retryAfterMs = Math.max(0, current.windowStart + windowMs - now);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  current.count += 1;
  counters.set(key, current);
  return { allowed: true };
}

export function checkOauthRateLimit(clientId: string): LimitResult {
  return consumeWithinWindow(`oauth:${clientId}`, policy.oauthRequestsPerMinute, ONE_MINUTE_MS);
}

export function checkApiRateLimit(params: {
  tenantId: string;
  credentialId?: string;
  method: string;
  route: string;
}): LimitResult {
  const credentialSegment = params.credentialId ?? "credential_unknown";
  const key = `api:${params.tenantId}:${credentialSegment}:${params.method.toUpperCase()}:${params.route}`;
  return consumeWithinWindow(key, policy.apiRequestsPerMinute, ONE_MINUTE_MS);
}

export function checkPortalAuthRateLimit(emailOrKey: string): LimitResult {
  return consumeWithinWindow(
    `portal-auth:${emailOrKey.toLowerCase()}`,
    policy.portalAuthRequestsPerMinute,
    ONE_MINUTE_MS
  );
}

export function oauthClientKey(req: Request, clientId?: string): string {
  const explicitClient = (clientId ?? "").trim();
  if (explicitClient.length > 0) {
    return explicitClient;
  }
  return req.ip || "unknown_ip";
}

export function setRateLimitPolicy(overrides: Partial<RateLimitPolicy>): void {
  policy = {
    ...policy,
    ...overrides,
  };
}

export function resetRateLimitState(): void {
  counters.clear();
  policy = {
    oauthRequestsPerMinute: config.security.oauthRequestsPerMinute,
    apiRequestsPerMinute: config.security.apiRequestsPerMinute,
    portalAuthRequestsPerMinute: config.security.portalAuthRequestsPerMinute,
  };
}
