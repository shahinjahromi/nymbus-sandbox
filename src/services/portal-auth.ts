import { randomBytes, createHash } from "crypto";

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

const usersByEmail = new Map<string, PortalUser>();
const sessionsByToken = new Map<string, PortalSession>();
const resetOtpByEmail = new Map<string, OtpRecord>();

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
  const localPart = normalizeEmail(email).split("@")[0] ?? "tenant";
  const sanitized = localPart.replace(/[^a-z0-9]/gi, "").slice(0, 14) || "tenant";
  return `tenant_${sanitized}`;
}

export function registerPortalUser(params: {
  email: string;
  password: string;
  name?: string;
}): { email: string; tenantId: string; name?: string } {
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
  return { email: user.email, tenantId: user.tenantId, name: user.name };
}

export function authenticatePortalUser(params: {
  email: string;
  password: string;
}): { portalToken: string; tenantId: string; email: string; name?: string } {
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
    throw new Error("INVALID_CREDENTIALS");
  }

  user.failedLoginAttempts = 0;
  user.blockedUntil = undefined;

  const token = generateToken();
  const now = Date.now();
  sessionsByToken.set(token, {
    token,
    email: user.email,
    tenantId: user.tenantId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  return {
    portalToken: token,
    tenantId: user.tenantId,
    email: user.email,
    name: user.name,
  };
}

export function validatePortalSession(token: string): {
  valid: boolean;
  email?: string;
  tenantId?: string;
} {
  const session = sessionsByToken.get(token);
  if (!session || Date.now() > session.expiresAt) {
    return { valid: false };
  }
  return { valid: true, email: session.email, tenantId: session.tenantId };
}

export function issueResetOtp(email: string): { sent: boolean; otpPreview: string } {
  const normalizedEmail = normalizeEmail(email);
  const user = usersByEmail.get(normalizedEmail);
  if (!user) {
    return { sent: true, otpPreview: "000000" };
  }

  const otp = generateOtp();
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
  resetOtpByEmail.delete(email);
  return { ok: true };
}

export function getPortalUserProfile(email: string): {
  email: string;
  tenantId: string;
  name?: string;
} | null {
  const user = usersByEmail.get(normalizeEmail(email));
  if (!user) {
    return null;
  }
  return { email: user.email, tenantId: user.tenantId, name: user.name };
}
