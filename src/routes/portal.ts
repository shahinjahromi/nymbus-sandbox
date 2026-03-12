import { Router, type Request, type Response, type NextFunction } from "express";
import { enforceEnvironmentScope } from "../auth/middleware.js";
import {
  authenticatePortalUser,
  confirmResetOtp,
  getPortalUserProfile,
  issueResetOtp,
  registerPortalUser,
  validatePortalSession,
} from "../services/portal-auth.js";
import {
  createTenantCredential,
  listTenantCredentials,
  revokeTenantCredential,
  rotateTenantCredential,
} from "../services/developer-registry.js";
import { listApiActivityForTenant } from "../services/api-activity-log.js";
import { listTenantAuditEntries, writeAuditEntry } from "../services/audit-log.js";
import {
  getActiveContractMetadata,
  getContractChangeLog,
  getContractDeprecations,
} from "../services/openapi-contract.js";
import {
  accrueDailyInterest,
  createTenantAccount,
  createTenantCustomer,
  getTenantAccountById,
  getYieldConfig,
  listTenantAccounts,
  listTenantCustomers,
  listTenantTransactionsByAccountId,
  resetTenantDataset,
  resetTenantAccountData,
  seedTenantDataset,
  seedTenantAccountData,
  simulateCardNetworkEvent,
  simulateIncomingRailTransfer,
  simulateOutgoingAchTransfer,
  upsertYieldConfig,
} from "../services/tenant-store.js";
import { checkPortalAuthRateLimit } from "../services/security-rate-limit.js";

export const portalRouter = Router();

async function requirePortalSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Portal session required" });
    return;
  }

  const token = auth.slice(7);
  const { valid, email, tenantId } = await validatePortalSession(token);
  if (!valid || !email || !tenantId) {
    res.status(401).json({ code: "INVALID_PORTAL_SESSION", message: "Portal session expired" });
    return;
  }

  if (!enforceEnvironmentScope(req, res)) {
    return;
  }

  req.portalUserEmail = email;
  req.portalTenantId = tenantId;
  next();
}

portalRouter.post("/portal-api/register", (req: Request, res: Response) => {
  const { email, password, name } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ code: "BAD_REQUEST", message: "email and password are required" });
    return;
  }

  try {
    const user = registerPortalUser({ email, password, name });
    writeAuditEntry({
      tenantId: user.tenantId,
      actor: user.email,
      action: "portal.register",
      outcome: "success",
    });
    res.status(201).json({ user, environment: "sandbox" });
  } catch (error) {
    if ((error as Error).message === "EMAIL_ALREADY_EXISTS") {
      res.status(409).json({ code: "EMAIL_ALREADY_EXISTS", message: "Email already registered" });
      return;
    }
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Unable to register user" });
  }
});

portalRouter.post("/portal-api/login", (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    res.status(400).json({ code: "BAD_REQUEST", message: "email and password are required" });
    return;
  }

  const rateLimitResult = checkPortalAuthRateLimit(String(email));
  if (!rateLimitResult.allowed) {
    res.setHeader("Retry-After", String(rateLimitResult.retryAfterSeconds ?? 60));
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Too many portal authentication attempts. Retry later.",
    });
    return;
  }

  try {
    const session = authenticatePortalUser({ email, password });
    writeAuditEntry({
      tenantId: session.tenantId,
      actor: session.email,
      action: "portal.login",
      outcome: "success",
      requestId: res.getHeader("x-request-id")?.toString(),
    });
    res.json({
      portal_token: session.portalToken,
      user: {
        email: session.email,
        name: session.name,
        tenantId: session.tenantId,
      },
      environment: "sandbox",
    });
  } catch (error) {
    if ((error as Error).message === "LOGIN_TEMPORARILY_BLOCKED") {
      res.status(429).json({
        code: "LOGIN_TEMPORARILY_BLOCKED",
        message: "Too many failed attempts. Try again shortly.",
      });
      return;
    }

    res.status(401).json({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
  }
});

portalRouter.post("/portal-api/password-reset/request", (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ code: "BAD_REQUEST", message: "email is required" });
    return;
  }

  const rateLimitResult = checkPortalAuthRateLimit(`reset-request:${String(email)}`);
  if (!rateLimitResult.allowed) {
    res.setHeader("Retry-After", String(rateLimitResult.retryAfterSeconds ?? 60));
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Too many OTP reset requests. Retry later.",
    });
    return;
  }

  const response = issueResetOtp(email);
  res.json({
    ...response,
    note: "Sandbox only: otpPreview is returned for local testing.",
  });
});

portalRouter.post("/portal-api/password-reset/confirm", (req: Request, res: Response) => {
  const { email, otp, new_password: newPassword } = req.body ?? {};
  if (!email || !otp || !newPassword) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "email, otp, and new_password are required",
    });
    return;
  }

  const rateLimitResult = checkPortalAuthRateLimit(`reset-confirm:${String(email)}`);
  if (!rateLimitResult.allowed) {
    res.setHeader("Retry-After", String(rateLimitResult.retryAfterSeconds ?? 60));
    res.status(429).json({
      code: "RATE_LIMITED",
      message: "Too many OTP confirmation attempts. Retry later.",
    });
    return;
  }

  try {
    confirmResetOtp({ email, otp, newPassword });
    const profile = getPortalUserProfile(email);
    if (profile) {
      writeAuditEntry({
        tenantId: profile.tenantId,
        actor: profile.email,
        action: "portal.password_reset",
        outcome: "success",
      });
    }
    res.json({ ok: true });
  } catch {
    res.status(400).json({ code: "INVALID_OTP", message: "OTP invalid or expired" });
  }
});

portalRouter.get("/portal-api/me", requirePortalSession, (req: Request, res: Response) => {
  const profile = getPortalUserProfile(req.portalUserEmail!);
  if (!profile) {
    res.status(404).json({ code: "NOT_FOUND", message: "Portal user not found" });
    return;
  }

  res.json({
    user: profile,
    environment: "sandbox",
  });
});

portalRouter.get("/portal-api/credentials", requirePortalSession, (req: Request, res: Response) => {
  const credentials = listTenantCredentials(req.portalTenantId!);
  res.json({ data: credentials, environment: "sandbox" });
});

portalRouter.post("/portal-api/credentials", requirePortalSession, (req: Request, res: Response) => {
  const { label, expires_at: expiresAt } = req.body ?? {};

  const created = createTenantCredential({
    tenantId: req.portalTenantId!,
    label,
    ownerEmail: req.portalUserEmail,
    expiresAt,
  });

  writeAuditEntry({
    tenantId: req.portalTenantId!,
    actor: req.portalUserEmail!,
    action: "credential.create",
    outcome: "success",
    details: { credentialId: created.credential.id },
  });

  res.status(201).json({
    credential: created.credential,
    client_secret: created.clientSecret,
    note: "Store client_secret now. It is not returned by list endpoints.",
  });
});

portalRouter.post(
  "/portal-api/credentials/:id/revoke",
  requirePortalSession,
  (req: Request, res: Response) => {
    const revoked = revokeTenantCredential(req.portalTenantId!, req.params.id);
    if (!revoked) {
      res.status(404).json({ code: "NOT_FOUND", message: "Credential not found" });
      return;
    }

    writeAuditEntry({
      tenantId: req.portalTenantId!,
      actor: req.portalUserEmail!,
      action: "credential.revoke",
      outcome: "success",
      details: { credentialId: revoked.id },
    });

    res.json({ credential: revoked });
  }
);

portalRouter.post(
  "/portal-api/credentials/:id/rotate",
  requirePortalSession,
  (req: Request, res: Response) => {
    const rotated = rotateTenantCredential(req.portalTenantId!, req.params.id);
    if (!rotated) {
      res.status(404).json({ code: "NOT_FOUND", message: "Credential not found" });
      return;
    }

    writeAuditEntry({
      tenantId: req.portalTenantId!,
      actor: req.portalUserEmail!,
      action: "credential.rotate",
      outcome: "success",
      details: { credentialId: rotated.credential.id },
    });

    res.json({
      credential: rotated.credential,
      client_secret: rotated.clientSecret,
      note: "Store client_secret now. It is not returned by list endpoints.",
    });
  }
);

portalRouter.get("/portal-api/users", requirePortalSession, (req: Request, res: Response) => {
  res.json({
    data: listTenantCustomers(req.portalTenantId!),
    environment: "sandbox",
  });
});

portalRouter.post("/portal-api/users", requirePortalSession, (req: Request, res: Response) => {
  const {
    first_name: firstName,
    last_name: lastName,
    email,
    external_id: externalId,
  } = req.body ?? {};

  if (!firstName || !lastName || !email) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "first_name, last_name, and email are required",
    });
    return;
  }

  const user = createTenantCustomer({
    tenantId: req.portalTenantId!,
    firstName,
    lastName,
    email,
    externalId,
  });

  if (!user) {
    res.status(409).json({ code: "CONFLICT", message: "User email already exists" });
    return;
  }

  writeAuditEntry({
    tenantId: req.portalTenantId!,
    actor: req.portalUserEmail!,
    action: "user.create",
    outcome: "success",
    details: { userId: user.id },
  });

  res.status(201).json({ user, environment: "sandbox" });
});

portalRouter.get("/portal-api/accounts", requirePortalSession, (req: Request, res: Response) => {
  res.json({
    data: listTenantAccounts(req.portalTenantId!),
    environment: "sandbox",
  });
});

portalRouter.post("/portal-api/accounts", requirePortalSession, (req: Request, res: Response) => {
  const {
    customer_id: customerId,
    type,
    currency,
    initial_balance: initialBalance,
  } = req.body ?? {};

  if (!customerId || !type) {
    res.status(400).json({ code: "BAD_REQUEST", message: "customer_id and type are required" });
    return;
  }

  if (!["checking", "savings", "money_market"].includes(type)) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "type must be one of checking, savings, money_market",
    });
    return;
  }

  const parsedInitialBalance =
    initialBalance === undefined ? 0 : typeof initialBalance === "number" ? initialBalance : Number(initialBalance);
  if (!Number.isFinite(parsedInitialBalance) || parsedInitialBalance < 0) {
    res.status(400).json({ code: "BAD_REQUEST", message: "initial_balance must be >= 0" });
    return;
  }

  const account = createTenantAccount({
    tenantId: req.portalTenantId!,
    customerId,
    type,
    currency,
    initialBalance: parsedInitialBalance,
  });

  if (!account) {
    res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
    return;
  }

  writeAuditEntry({
    tenantId: req.portalTenantId!,
    actor: req.portalUserEmail!,
    action: "account.create",
    outcome: "success",
    details: { accountId: account.id, customerId },
  });

  res.status(201).json({ account, environment: "sandbox" });
});

portalRouter.post("/portal-api/tenant/reset", requirePortalSession, (req: Request, res: Response) => {
  const result = resetTenantDataset(req.portalTenantId!);

  writeAuditEntry({
    tenantId: req.portalTenantId!,
    actor: req.portalUserEmail!,
    action: "tenant.reset",
    outcome: "success",
    details: result,
  });

  res.json({ result, environment: "sandbox" });
});

portalRouter.post("/portal-api/tenant/seed", requirePortalSession, (req: Request, res: Response) => {
  const result = seedTenantDataset(req.portalTenantId!);

  writeAuditEntry({
    tenantId: req.portalTenantId!,
    actor: req.portalUserEmail!,
    action: "tenant.seed",
    outcome: "success",
    details: result,
  });

  res.json({ result, environment: "sandbox" });
});

portalRouter.get("/portal-api/accounts/:id", requirePortalSession, (req: Request, res: Response) => {
  const account = getTenantAccountById(req.portalTenantId!, req.params.id);
  if (!account) {
    res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
    return;
  }

  res.json({
    account,
    yield_config: getYieldConfig(req.portalTenantId!, req.params.id),
    environment: "sandbox",
  });
});

portalRouter.get(
  "/portal-api/accounts/:id/transactions",
  requirePortalSession,
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.portalTenantId!, req.params.id);
    if (!account) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    res.json({
      data: listTenantTransactionsByAccountId(req.portalTenantId!, req.params.id),
      environment: "sandbox",
    });
  }
);

portalRouter.post(
  "/portal-api/accounts/:id/seed",
  requirePortalSession,
  (req: Request, res: Response) => {
    const seeded = seedTenantAccountData(req.portalTenantId!, req.params.id);
    if (!seeded) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    writeAuditEntry({
      tenantId: req.portalTenantId!,
      actor: req.portalUserEmail!,
      action: "account.seed",
      outcome: "success",
      details: { accountId: req.params.id },
    });

    res.json({
      account: seeded.account,
      seeded_transactions: seeded.seededTransactions,
      seeded_transfers: seeded.seededTransfers,
      environment: "sandbox",
    });
  }
);

portalRouter.post(
  "/portal-api/accounts/:id/reset",
  requirePortalSession,
  (req: Request, res: Response) => {
    const account = resetTenantAccountData(req.portalTenantId!, req.params.id);
    if (!account) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    writeAuditEntry({
      tenantId: req.portalTenantId!,
      actor: req.portalUserEmail!,
      action: "account.reset",
      outcome: "success",
      details: { accountId: req.params.id },
    });

    res.json({ account, environment: "sandbox" });
  }
);

portalRouter.post(
  "/portal-api/simulations/ach-incoming",
  requirePortalSession,
  (req: Request, res: Response) => {
    const { account_id: accountId, amount, description, external_name: externalName } = req.body ?? {};
    const parsedAmount = typeof amount === "number" ? amount : Number(amount);

    if (!accountId || !parsedAmount || parsedAmount <= 0) {
      res.status(400).json({ code: "BAD_REQUEST", message: "account_id and positive amount are required" });
      return;
    }

    const simulated = simulateIncomingRailTransfer({
      tenantId: req.portalTenantId!,
      accountId,
      amount: parsedAmount,
      rail: "ach",
      description,
      externalName,
    });

    if (!simulated) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    writeAuditEntry({
      tenantId: req.portalTenantId!,
      actor: req.portalUserEmail!,
      action: "simulation.ach_incoming",
      outcome: "success",
      details: { accountId, amount: parsedAmount },
    });

    res.status(201).json({
      ...simulated,
      environment: "sandbox",
    });
  }
);

portalRouter.post(
  "/portal-api/simulations/wire-incoming",
  requirePortalSession,
  (req: Request, res: Response) => {
    const { account_id: accountId, amount, description, external_name: externalName } = req.body ?? {};
    const parsedAmount = typeof amount === "number" ? amount : Number(amount);

    if (!accountId || !parsedAmount || parsedAmount <= 0) {
      res.status(400).json({ code: "BAD_REQUEST", message: "account_id and positive amount are required" });
      return;
    }

    const simulated = simulateIncomingRailTransfer({
      tenantId: req.portalTenantId!,
      accountId,
      amount: parsedAmount,
      rail: "wire",
      description,
      externalName,
    });

    if (!simulated) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    writeAuditEntry({
      tenantId: req.portalTenantId!,
      actor: req.portalUserEmail!,
      action: "simulation.wire_incoming",
      outcome: "success",
      details: { accountId, amount: parsedAmount },
    });

    res.status(201).json({
      ...simulated,
      environment: "sandbox",
    });
  }
);

portalRouter.post(
  "/portal-api/simulations/ach-outgoing",
  requirePortalSession,
  (req: Request, res: Response) => {
    const {
      account_id: accountId,
      amount,
      routing_number: routingNumber,
      account_number: accountNumber,
      recipient_name: recipientName,
      description,
    } = req.body ?? {};
    const parsedAmount = typeof amount === "number" ? amount : Number(amount);

    if (!accountId || !parsedAmount || parsedAmount <= 0 || !routingNumber || !accountNumber) {
      res.status(400).json({
        code: "BAD_REQUEST",
        message:
          "account_id, routing_number, account_number, and positive amount are required",
      });
      return;
    }

    const simulated = simulateOutgoingAchTransfer({
      tenantId: req.portalTenantId!,
      accountId,
      amount: parsedAmount,
      routingNumber,
      accountNumber,
      recipientName,
      description,
    });

    if (!simulated) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    writeAuditEntry({
      tenantId: req.portalTenantId!,
      actor: req.portalUserEmail!,
      action: "simulation.ach_outgoing",
      outcome: "success",
      details: { accountId, amount: parsedAmount },
    });

    res.status(201).json({
      ...simulated,
      environment: "sandbox",
    });
  }
);

portalRouter.post("/portal-api/simulations/card", requirePortalSession, (req: Request, res: Response) => {
  const {
    account_id: accountId,
    amount,
    event_type: eventType,
    reference_id: referenceId,
    description,
  } = req.body ?? {};
  const parsedAmount = typeof amount === "number" ? amount : Number(amount);
  const normalizedEventType =
    typeof eventType === "string" && eventType.trim().length > 0 ? eventType : "post";

  if (!accountId || !parsedAmount || parsedAmount <= 0) {
    res.status(400).json({ code: "BAD_REQUEST", message: "account_id and positive amount are required" });
    return;
  }

  if (!["authorization", "post", "void", "refund"].includes(normalizedEventType)) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "event_type must be one of authorization, post, void, refund",
    });
    return;
  }

  const account = getTenantAccountById(req.portalTenantId!, accountId);
  if (!account) {
    res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
    return;
  }

  const simulated = simulateCardNetworkEvent({
    tenantId: req.portalTenantId!,
    accountId,
    amount: parsedAmount,
    eventType: normalizedEventType as "authorization" | "post" | "void" | "refund",
    referenceId,
    description,
  });

  if (!simulated) {
    const messageByEventType: Record<string, string> = {
      void: "Matching pending authorization hold not found for void operation",
      refund: "Matching posted card transaction not found for refund operation",
      post: "Matching pending authorization hold not found for post operation",
      authorization: "Invalid card authorization request",
    };

    res.status(409).json({
      code: "INVALID_STATE_TRANSITION",
      message: messageByEventType[normalizedEventType],
    });
    return;
  }

  writeAuditEntry({
    tenantId: req.portalTenantId!,
    actor: req.portalUserEmail!,
    action: `simulation.card_${normalizedEventType}`,
    outcome: "success",
    details: { accountId, amount: parsedAmount, referenceId },
  });

  res.status(201).json({
    ...simulated,
    environment: "sandbox",
  });
});

portalRouter.get(
  "/portal-api/accounts/:id/yield-config",
  requirePortalSession,
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.portalTenantId!, req.params.id);
    if (!account) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    res.json({
      account_id: req.params.id,
      yield_config: getYieldConfig(req.portalTenantId!, req.params.id),
      environment: "sandbox",
    });
  }
);

portalRouter.post(
  "/portal-api/accounts/:id/yield-config",
  requirePortalSession,
  (req: Request, res: Response) => {
    const { apy, enabled } = req.body ?? {};
    const parsedApy = typeof apy === "number" ? apy : Number(apy);
    const parsedEnabled = typeof enabled === "boolean" ? enabled : true;

    if (!Number.isFinite(parsedApy) || parsedApy < 0 || parsedApy > 100) {
      res.status(400).json({ code: "BAD_REQUEST", message: "apy must be between 0 and 100" });
      return;
    }

    const config = upsertYieldConfig({
      tenantId: req.portalTenantId!,
      accountId: req.params.id,
      apy: parsedApy,
      enabled: parsedEnabled,
    });

    if (!config) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    writeAuditEntry({
      tenantId: req.portalTenantId!,
      actor: req.portalUserEmail!,
      action: "interest.yield_config_upsert",
      outcome: "success",
      details: { accountId: req.params.id, apy: parsedApy, enabled: parsedEnabled },
    });

    res.json({
      account_id: req.params.id,
      yield_config: config,
      environment: "sandbox",
    });
  }
);

portalRouter.post("/portal-api/interest/accrue-daily", requirePortalSession, (req: Request, res: Response) => {
  const { as_of_date: asOfDate } = req.body ?? {};
  const accrued = accrueDailyInterest({
    tenantId: req.portalTenantId!,
    asOfDate,
  });

  writeAuditEntry({
    tenantId: req.portalTenantId!,
    actor: req.portalUserEmail!,
    action: "interest.accrue_daily",
    outcome: "success",
    details: { asOfDate, accountsAccrued: accrued.length },
  });

  res.json({
    data: accrued,
    as_of_date: asOfDate,
    environment: "sandbox",
  });
});

portalRouter.get("/portal-api/api-activity", requirePortalSession, async (req: Request, res: Response) => {
  const { method, path_contains: pathContains, status, limit, environment } = req.query;
  const normalizedEnvironment =
    typeof environment === "string" && environment.trim().length > 0
      ? environment.trim().toLowerCase()
      : "sandbox";

  if (normalizedEnvironment !== "sandbox") {
    res.json({ data: [], environment: "sandbox" });
    return;
  }

  const entries = await listApiActivityForTenant({
    tenantId: req.portalTenantId!,
    environment: "sandbox",
    method: typeof method === "string" ? method : undefined,
    pathContains: typeof pathContains === "string" ? pathContains : undefined,
    statusCode:
      typeof status === "string" && status.trim().length > 0 ? Number.parseInt(status, 10) : undefined,
    limit: typeof limit === "string" ? Number.parseInt(limit, 10) : undefined,
  });

  res.json({ data: entries, environment: "sandbox" });
});

portalRouter.get("/portal-api/contract/metadata", requirePortalSession, (_req: Request, res: Response) => {
  res.json(getActiveContractMetadata());
});

portalRouter.get("/portal-api/contract/changelog", requirePortalSession, (_req: Request, res: Response) => {
  res.json(getContractChangeLog());
});

portalRouter.get(
  "/portal-api/contract/deprecations",
  requirePortalSession,
  (_req: Request, res: Response) => {
    res.json(getContractDeprecations());
  }
);

portalRouter.get("/portal-api/audit", requirePortalSession, async (req: Request, res: Response) => {
  const limit =
    typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
  res.json({
    data: await listTenantAuditEntries(req.portalTenantId!, limit),
    environment: "sandbox",
  });
});

