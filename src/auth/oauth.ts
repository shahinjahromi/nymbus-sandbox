import { randomBytes } from "crypto";
import { config } from "../config.js";
import { validateClient } from "../services/developer-registry.js";
import type { TokenResponse } from "../types/index.js";

const accessTokens = new Map<string, { clientId: string; expiresAt: number }>();
const refreshTokens = new Map<string, { clientId: string; expiresAt: number }>();

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function issueTokens(clientId: string): TokenResponse {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const now = Date.now();
  const accessExpiresAt = now + config.oauth.tokenTtlSeconds * 1000;
  const refreshExpiresAt =
    now + config.oauth.refreshTokenTtlDays * 24 * 60 * 60 * 1000;

  accessTokens.set(accessToken, { clientId, expiresAt: accessExpiresAt });
  refreshTokens.set(refreshToken, { clientId, expiresAt: refreshExpiresAt });

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: config.oauth.tokenTtlSeconds,
    refresh_token: refreshToken,
    scope: "sandbox",
  };
}

export function validateAccessToken(token: string): { valid: boolean; clientId?: string } {
  const entry = accessTokens.get(token);
  if (!entry || Date.now() > entry.expiresAt) {
    return { valid: false };
  }
  return { valid: true, clientId: entry.clientId };
}

export function refreshAccessToken(refreshToken: string): TokenResponse | null {
  const entry = refreshTokens.get(refreshToken);
  if (!entry || Date.now() > entry.expiresAt) {
    return null;
  }
  return issueTokens(entry.clientId);
}

/** Client credentials grant: validate client_id + client_secret and return tokens. */
export function handleClientCredentialsGrant(
  clientId: string,
  clientSecret: string
): TokenResponse | null {
  const { valid } = validateClient(clientId, clientSecret);
  if (!valid) return null;
  return issueTokens(clientId);
}
