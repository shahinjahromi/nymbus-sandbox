import { config } from "../config.js";
import type { DeveloperCredentials } from "../types/index.js";

/** In-memory developer registry for sandbox. Replace with DB in production sandbox deployment. */
const developers = new Map<string, { secret: string; name?: string }>();

function ensureDefaultDeveloper(): void {
  const { defaultClientId, defaultClientSecret } = config.oauth;
  if (!developers.has(defaultClientId)) {
    developers.set(defaultClientId, {
      secret: defaultClientSecret,
      name: "Sandbox default developer",
    });
  }
}

ensureDefaultDeveloper();

export function registerDeveloper(credentials: DeveloperCredentials): void {
  developers.set(credentials.clientId, {
    secret: credentials.clientSecret,
    name: credentials.name,
  });
}

export function validateClient(
  clientId: string,
  clientSecret: string
): { valid: boolean; name?: string } {
  const dev = developers.get(clientId);
  if (!dev || dev.secret !== clientSecret) {
    return { valid: false };
  }
  return { valid: true, name: dev.name };
}

export function getDeveloper(clientId: string): { secret: string; name?: string } | undefined {
  return developers.get(clientId);
}
