import { randomBytes } from "crypto";
import { config } from "../config.js";
import { markCredentialUsed, validateClient } from "../services/developer-registry.js";
import type { TokenResponse } from "../types/index.js";

const accessTokens = new Map<
  string,
  { clientId: string; tenantId: string; credentialId?: string; expiresAt: number }
>();
const refreshTokens = new Map<
  string,
  { clientId: string; tenantId: string; credentialId?: string; expiresAt: number }
>();

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function issueTokens(clientId: string, tenantId: string, credentialId?: string): TokenResponse {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const now = Date.now();
  const accessExpiresAt = now + config.oauth.tokenTtlSeconds * 1000;
  const refreshExpiresAt =
    now + config.oauth.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

  accessTokens.set(accessToken, {
    clientId,
    tenantId,
    credentialId,
    expiresAt: accessExpiresAt,
  });
  refreshTokens.set(refreshToken, {
    clientId,
    tenantId,
    credentialId,
    expiresAt: refreshExpiresAt,
  });

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: config.oauth.tokenTtlSeconds,
    refresh_token: refreshToken,
    scope: "sandbox",
  };
}

export function validateAccessToken(token: string): {
  valid: boolean;
  clientId?: string;
  tenantId?: string;
  credentialId?: string;
} {
  const entry = accessTokens.get(token);
  if (!entry || Date.now() > entry.expiresAt) {
    return { valid: false };
  }
  return {
    valid: true,
    clientId: entry.clientId,
    tenantId: entry.tenantId,
    credentialId: entry.credentialId,
  };
}

export function refreshAccessToken(refreshToken: string): TokenResponse | null {
  const entry = refreshTokens.get(refreshToken);
  if (!entry || Date.now() > entry.expiresAt) {
    return null;
  }
  return issueTokens(entry.clientId, entry.tenantId, entry.credentialId);
}

/** Client credentials grant: validate client_id + client_secret and return tokens. */
export function handleClientCredentialsGrant(
  clientId: string,
  clientSecret: string
): TokenResponse | null {
  const { valid, tenantId, credentialId } = validateClient(clientId, clientSecret);
  if (!valid) return null;
  markCredentialUsed(clientId);
  return issueTokens(clientId, tenantId!, credentialId);
}
