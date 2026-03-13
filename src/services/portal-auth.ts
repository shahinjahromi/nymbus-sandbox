import { randomBytes, createHash } from "crypto";
import { durableStore } from "./durable-store.js";

interface PortalUser {
  email: string;
  passwordHash: string;
  name?: string;
  tenantId: string;
  createdAt: string;
  failedLoginAttempts: number;
  blockedUntil?: number;
}

interface PortalSession {
  token: string;
  email: string;
  tenantId: string;
  createdAt: number;
  expiresAt: number;
}

interface OtpRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

// In-memory caches (loaded from DB on first access)
const usersByEmail = new Map<string, PortalUser>();
const sessionsByToken = new Map<string, PortalSession>();
const resetOtpByEmail = new Map<string, OtpRecord>(); // OTPs are ephemeral — no DB persistence needed
let cacheLoaded = false;

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_WINDOW_MS = 5 * 60 * 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function generateOtp(): string {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

function tenantIdFromEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  return `tenant_${hash}`;
}

/** Load users and sessions from DB into in-memory cache (once) */
export async function initPortalAuth(): Promise<void> {
  if (cacheLoaded) return;
  cacheLoaded = true;

  for (const row of await durableStore.getAllPortalUsers()) {
    usersByEmail.set(row.email, {
      email: row.email,
      passwordHash: row.password_hash,
      name: row.name ?? undefined,
      tenantId: row.tenant_id,
      createdAt: row.created_at,
      failedLoginAttempts: row.failed_login_attempts,
      blockedUntil: row.blocked_until ?? undefined,
    });
  }

  // Sessions are short-lived; we don't reload stale ones
  await durableStore.deleteExpiredSessions();
}

function ensureCache(): void {
  if (!cacheLoaded) {
    throw new Error("Portal auth not initialised — call initPortalAuth() at startup");
  }
}

function persistUser(user: PortalUser): void {
  durableStore.upsertPortalUser({
    email: user.email,
    password_hash: user.passwordHash,
    name: user.name ?? null,
    tenant_id: user.tenantId,
    created_at: user.createdAt,
    failed_login_attempts: user.failedLoginAttempts,
    blocked_until: user.blockedUntil ?? null,
  }).catch((err) => console.error("[portal-auth] persist user failed:", err));
}

function persistSession(session: PortalSession): void {
  durableStore.upsertPortalSession({
    token: session.token,
    email: session.email,
    tenant_id: session.tenantId,
    created_at: session.createdAt,
    expires_at: session.expiresAt,
  }).catch((err) => console.error("[portal-auth] persist session failed:", err));
}

export function registerPortalUser(params: {
  email: string;
  password: string;
  name?: string;
}): { email: string; tenantId: string; name?: string } {
  ensureCache();
  const email = normalizeEmail(params.email);
  if (usersByEmail.has(email)) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const user: PortalUser = {
    email,
    passwordHash: hashPassword(params.password),
    name: params.name,
    tenantId: tenantIdFromEmail(email),
    createdAt: new Date().toISOString(),
    failedLoginAttempts: 0,
  };

  usersByEmail.set(email, user);
  persistUser(user);
  return { email: user.email, tenantId: user.tenantId, name: user.name };
}

export function authenticatePortalUser(params: {
  email: string;
  password: string;
}): { portalToken: string; tenantId: string; email: string; name?: string } {
  ensureCache();
  const email = normalizeEmail(params.email);
  const user = usersByEmail.get(email);
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  if (user.blockedUntil && Date.now() < user.blockedUntil) {
    throw new Error("LOGIN_TEMPORARILY_BLOCKED");
  }

  const passwordHash = hashPassword(params.password);
  if (passwordHash !== user.passwordHash) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.blockedUntil = Date.now() + BLOCK_WINDOW_MS;
      user.failedLoginAttempts = 0;
    }
    persistUser(user);
    throw new Error("INVALID_CREDENTIALS");
  }

  user.failedLoginAttempts = 0;
  user.blockedUntil = undefined;
  persistUser(user);

  const token = generateToken();
  const now = Date.now();
  const session: PortalSession = {
    token,
    email: user.email,
    tenantId: user.tenantId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
  sessionsByToken.set(token, session);
  persistSession(session);

  return {
    portalToken: token,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
  };
}

export async function validatePortalSession(token: string): Promise<{
  valid: boolean;
  email?: string;
  tenantId?: string;
}> {
  ensureCache();

  // Check in-memory first
  let session = sessionsByToken.get(token);
  if (!session) {
    // Try DB (session might have been created in a previous process)
    const row = await durableStore.getPortalSession(token);
    if (row && Date.now() <= row.expires_at) {
      session = {
        token: row.token,
        email: row.email,
        tenantId: row.tenant_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      };
      sessionsByToken.set(token, session);
    }
  }

  if (!session || Date.now() > session.expiresAt) {
    return { valid: false };
  }
  return { valid: true, email: session.email, tenantId: session.tenantId };
}

export function issueResetOtp(email: string): { sent: boolean; otpPreview: string } {
  ensureCache();
  const normalizedEmail = normalizeEmail(email);
  const user = usersByEmail.get(normalizedEmail);

  // Generate a real OTP regardless of whether the user exists.
  // This avoids leaking user-existence info and ensures the sandbox
  // OTP preview always matches a stored code.
  const otp = user ? generateOtp() : generateOtp();
  resetOtpByEmail.set(normalizedEmail, {
    code: otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  return { sent: true, otpPreview: otp };
}

export function confirmResetOtp(params: {
  email: string;
  otp: string;
  newPassword: string;
}): { ok: true } {
  ensureCache();
  const email = normalizeEmail(params.email);
  const user = usersByEmail.get(email);
  const otpRecord = resetOtpByEmail.get(email);
  if (!user || !otpRecord) {
    throw new Error("INVALID_OTP");
  }

  if (Date.now() > otpRecord.expiresAt) {
    resetOtpByEmail.delete(email);
    throw new Error("INVALID_OTP");
  }

  otpRecord.attempts += 1;
  if (otpRecord.attempts > MAX_FAILED_ATTEMPTS) {
    resetOtpByEmail.delete(email);
    throw new Error("INVALID_OTP");
  }

  if (otpRecord.code !== params.otp) {
    throw new Error("INVALID_OTP");
  }

  user.passwordHash = hashPassword(params.newPassword);
  persistUser(user);
  resetOtpByEmail.delete(email);
  return { ok: true };
}

export function getPortalUserProfile(email: string): {
  email: string;
  tenantId: string;
  name?: string;
} | null {
  ensureCache();
  const user = usersByEmail.get(normalizeEmail(email));
  if (!user) {
    return null;
  }
  return { email: user.email, tenantId: user.tenantId, name: user.name };
}
