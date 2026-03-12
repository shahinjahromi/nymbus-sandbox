import { randomBytes } from "crypto";
import { config } from "../config.js";
import type { DeveloperCredentials } from "../types/index.js";

type CredentialStatus = "active" | "revoked" | "expired";

interface CredentialRecord {
  id: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  label?: string;
  ownerEmail?: string;
  createdAt: string;
  rotatedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  status: CredentialStatus;
}

export interface CredentialView {
  id: string;
  tenantId: string;
  clientId: string;
  label?: string;
  ownerEmail?: string;
  createdAt: string;
  rotatedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  lastUsedAt?: string;
  status: CredentialStatus;
  environment: "sandbox";
}

interface ValidationResult {
  valid: boolean;
  tenantId?: string;
  credentialId?: string;
}

const DEFAULT_TENANT_ID = "tenant_default";
const credentialsById = new Map<string, CredentialRecord>();
const credentialIdByClientId = new Map<string, string>();

function nowIso(): string {
  return new Date().toISOString();
}

function generateSecret(size = 24): string {
  return randomBytes(size).toString("hex");
}

function generateClientId(tenantId: string): string {
  const suffix = randomBytes(4).toString("hex");
  const normalizedTenant = tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || "tenant";
  return `sandbox_${normalizedTenant}_${suffix}`;
}

function toCredentialView(record: CredentialRecord): CredentialView {
  return {
    id: record.id,
    tenantId: record.tenantId,
    clientId: record.clientId,
    label: record.label,
    ownerEmail: record.ownerEmail,
    createdAt: record.createdAt,
    rotatedAt: record.rotatedAt,
    revokedAt: record.revokedAt,
    expiresAt: record.expiresAt,
    lastUsedAt: record.lastUsedAt,
    status: record.status,
    environment: "sandbox",
  };
}

function isExpired(record: CredentialRecord): boolean {
  return Boolean(record.expiresAt && Date.now() > Date.parse(record.expiresAt));
}

function ensureDefaultDeveloper(): void {
  const { defaultClientId, defaultClientSecret } = config.oauth;
  if (credentialIdByClientId.has(defaultClientId)) {
    return;
  }

  const id = "cred_default";
  const record: CredentialRecord = {
    id,
    tenantId: DEFAULT_TENANT_ID,
    clientId: defaultClientId,
    clientSecret: defaultClientSecret,
    label: "Default sandbox credential",
    createdAt: nowIso(),
    status: "active",
  };

  credentialsById.set(id, record);
  credentialIdByClientId.set(defaultClientId, id);
}

ensureDefaultDeveloper();

export function getDefaultTenantId(): string {
  return DEFAULT_TENANT_ID;
}

export function registerDeveloper(credentials: DeveloperCredentials): void {
  const existingCredentialId = credentialIdByClientId.get(credentials.clientId);
  const createdAt = nowIso();

  if (existingCredentialId) {
    const existing = credentialsById.get(existingCredentialId);
    if (existing) {
      existing.clientSecret = credentials.clientSecret;
      existing.label = credentials.name ?? existing.label;
      existing.status = "active";
      existing.revokedAt = undefined;
      existing.createdAt = createdAt;
      existing.rotatedAt = createdAt;
      existing.expiresAt = undefined;
    }
    return;
  }

  const id = `cred_${randomBytes(6).toString("hex")}`;
  const record: CredentialRecord = {
    id,
    tenantId: DEFAULT_TENANT_ID,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    label: credentials.name,
    createdAt,
    status: "active",
  };

  credentialsById.set(id, record);
  credentialIdByClientId.set(credentials.clientId, id);
}

export function validateClient(clientId: string, clientSecret: string): ValidationResult {
  const credentialId = credentialIdByClientId.get(clientId);
  if (!credentialId) {
    return { valid: false };
  }

  const record = credentialsById.get(credentialId);
  if (!record || record.clientSecret !== clientSecret) {
    return { valid: false };
  }

  if (record.status === "revoked") {
    return { valid: false };
  }

  if (isExpired(record)) {
    record.status = "expired";
    return { valid: false };
  }

  return {
    valid: true,
    tenantId: record.tenantId,
    credentialId: record.id,
  };
}

export function markCredentialUsed(clientId: string): void {
  const credentialId = credentialIdByClientId.get(clientId);
  if (!credentialId) {
    return;
  }
  const record = credentialsById.get(credentialId);
  if (!record) {
    return;
  }
  record.lastUsedAt = nowIso();
}

export function listTenantCredentials(tenantId: string): CredentialView[] {
  return [...credentialsById.values()]
    .filter((record) => record.tenantId === tenantId)
    .map(toCredentialView)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createTenantCredential(params: {
  tenantId: string;
  label?: string;
  ownerEmail?: string;
  expiresAt?: string;
}): { credential: CredentialView; clientSecret: string } {
  const id = `cred_${randomBytes(6).toString("hex")}`;
  const clientId = generateClientId(params.tenantId);
  const clientSecret = generateSecret();
  const record: CredentialRecord = {
    id,
    tenantId: params.tenantId,
    clientId,
    clientSecret,
    label: params.label,
    ownerEmail: params.ownerEmail,
    createdAt: nowIso(),
    expiresAt: params.expiresAt,
    status: "active",
  };

  credentialsById.set(id, record);
  credentialIdByClientId.set(clientId, id);

  return {
    credential: toCredentialView(record),
    clientSecret,
  };
}

export function revokeTenantCredential(
  tenantId: string,
  credentialId: string
): CredentialView | null {
  const record = credentialsById.get(credentialId);
  if (!record || record.tenantId !== tenantId) {
    return null;
  }
  record.status = "revoked";
  record.revokedAt = nowIso();
  return toCredentialView(record);
}

export function rotateTenantCredential(
  tenantId: string,
  credentialId: string
): { credential: CredentialView; clientSecret: string } | null {
  const record = credentialsById.get(credentialId);
  if (!record || record.tenantId !== tenantId) {
    return null;
  }

  const clientSecret = generateSecret();
  const rotatedAt = nowIso();
  record.clientSecret = clientSecret;
  record.rotatedAt = rotatedAt;
  record.revokedAt = undefined;
  record.status = isExpired(record) ? "expired" : "active";

  return {
    credential: toCredentialView(record),
    clientSecret,
  };
}
