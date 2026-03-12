import { Router, type Request, type Response, type NextFunction } from "express";
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

function requirePortalSession(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Portal session required" });
    return;
  }

  const token = auth.slice(7);
  const { valid, email, tenantId } = validatePortalSession(token);
  if (!valid || !email || !tenantId) {
    res.status(401).json({ code: "INVALID_PORTAL_SESSION", message: "Portal session expired" });
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

portalRouter.get("/portal-api/api-activity", requirePortalSession, (req: Request, res: Response) => {
  const { method, path_contains: pathContains, status, limit } = req.query;
  const entries = listApiActivityForTenant({
    tenantId: req.portalTenantId!,
    method: typeof method === "string" ? method : undefined,
    pathContains: typeof pathContains === "string" ? pathContains : undefined,
    statusCode:
      typeof status === "string" && status.trim().length > 0 ? Number.parseInt(status, 10) : undefined,
    limit: typeof limit === "string" ? Number.parseInt(limit, 10) : undefined,
  });

  res.json({ data: entries, environment: "sandbox" });
});

portalRouter.get("/portal-api/audit", requirePortalSession, (req: Request, res: Response) => {
  const limit =
    typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined;
  res.json({
    data: listTenantAuditEntries(req.portalTenantId!, limit),
    environment: "sandbox",
  });
});

portalRouter.get("/portal", (_req: Request, res: Response) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nymbus Sandbox Portal</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 24px; max-width: 960px; }
    h1, h2 { margin-bottom: 8px; }
    section { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    input, button { padding: 8px; margin: 4px 0; }
    input { width: 100%; max-width: 360px; display: block; }
    button { cursor: pointer; }
    pre { background: #111; color: #f5f5f5; padding: 12px; border-radius: 8px; overflow: auto; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; }
  </style>
</head>
<body>
  <h1>Nymbus Sandbox Developer Portal</h1>
  <p>Environment: <strong>sandbox</strong></p>

  <section>
    <h2>Register</h2>
    <input id="register-email" placeholder="Email" />
    <input id="register-password" type="password" placeholder="Password" />
    <input id="register-name" placeholder="Display name (optional)" />
    <button onclick="registerUser()">Register</button>
  </section>

  <section>
    <h2>Login</h2>
    <input id="login-email" placeholder="Email" />
    <input id="login-password" type="password" placeholder="Password" />
    <button onclick="loginUser()">Login</button>
    <button onclick="loadMe()">Load Profile</button>
  </section>

  <section>
    <h2>Password reset (OTP)</h2>
    <input id="reset-email" placeholder="Email" />
    <div class="row">
      <button onclick="requestResetOtp()">Request OTP</button>
    </div>
    <input id="reset-otp" placeholder="OTP" />
    <input id="reset-new-password" type="password" placeholder="New password" />
    <button onclick="confirmResetOtp()">Confirm Reset</button>
  </section>

  <section>
    <h2>Credential lifecycle</h2>
    <input id="cred-label" placeholder="Credential label" />
    <button onclick="createCredential()">Generate Credential</button>
    <button onclick="listCredentials()">List Credentials</button>
    <input id="cred-id" placeholder="Credential ID for rotate/revoke" />
    <div class="row">
      <button onclick="rotateCredential()">Rotate</button>
      <button onclick="revokeCredential()">Revoke</button>
    </div>
  </section>

  <section>
    <h2>Tenant operations</h2>
    <button onclick="loadUsers()">Load Users</button>
    <button onclick="loadAccounts()">Load Accounts</button>
    <input id="ops-account-id" placeholder="Account ID for transactions/seed/reset" />
    <div class="row">
      <button onclick="loadAccountTransactions()">Load Account Transactions</button>
      <button onclick="seedAccountData()">Seed Account</button>
      <button onclick="resetAccountData()">Reset Account</button>
    </div>
  </section>

  <section>
    <h2>Simulation and interest controls</h2>
    <input id="sim-account-id" placeholder="Account ID" />
    <input id="sim-amount" placeholder="Amount" />
    <div class="row">
      <button onclick="simulateIncomingAch()">Simulate ACH Incoming</button>
      <button onclick="simulateIncomingWire()">Simulate Wire Incoming</button>
    </div>
    <input id="card-event-type" placeholder="Card event: authorization|post|void|refund" />
    <input id="card-reference-id" placeholder="Card reference ID (for void/refund optional)" />
    <button onclick="simulateCardEvent()">Simulate Card Event</button>
    <input id="yield-apy" placeholder="APY (e.g., 3.5)" />
    <div class="row">
      <button onclick="setYieldConfig()">Set Yield Config</button>
      <button onclick="getYieldConfig()">Get Yield Config</button>
    </div>
    <input id="accrual-date" placeholder="Accrual date YYYY-MM-DD (optional)" />
    <button onclick="runDailyAccrual()">Run Daily Accrual</button>
  </section>

  <section>
    <h2>Observability</h2>
    <button onclick="loadApiActivity()">Load API Activity</button>
    <button onclick="loadAudit()">Load Audit Trail</button>
  </section>

  <pre id="output">Ready.</pre>

  <script>
    const output = document.getElementById('output');
    const API = '/portal-api';

    function setOutput(value) {
      output.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    }

    function getToken() {
      return localStorage.getItem('portal_token') || '';
    }

    async function call(path, options = {}) {
      const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
      const token = getToken();
      if (token) {
        headers.Authorization = 'Bearer ' + token;
      }
      const res = await fetch(API + path, { ...options, headers });
      const body = await res.json().catch(() => ({}));
      return { status: res.status, body };
    }

    async function registerUser() {
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const name = document.getElementById('register-name').value;
      setOutput(await call('/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }));
    }

    async function loginUser() {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const result = await call('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (result.body?.portal_token) {
        localStorage.setItem('portal_token', result.body.portal_token);
      }
      setOutput(result);
    }

    async function loadMe() {
      setOutput(await call('/me'));
    }

    async function requestResetOtp() {
      const email = document.getElementById('reset-email').value;
      setOutput(await call('/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }));
    }

    async function confirmResetOtp() {
      const email = document.getElementById('reset-email').value;
      const otp = document.getElementById('reset-otp').value;
      const new_password = document.getElementById('reset-new-password').value;
      setOutput(await call('/password-reset/confirm', { method: 'POST', body: JSON.stringify({ email, otp, new_password }) }));
    }

    async function createCredential() {
      const label = document.getElementById('cred-label').value;
      setOutput(await call('/credentials', { method: 'POST', body: JSON.stringify({ label }) }));
    }

    async function listCredentials() {
      setOutput(await call('/credentials'));
    }

    async function rotateCredential() {
      const id = document.getElementById('cred-id').value;
      setOutput(await call('/credentials/' + id + '/rotate', { method: 'POST' }));
    }

    async function revokeCredential() {
      const id = document.getElementById('cred-id').value;
      setOutput(await call('/credentials/' + id + '/revoke', { method: 'POST' }));
    }

    async function loadUsers() {
      setOutput(await call('/users'));
    }

    async function loadAccounts() {
      setOutput(await call('/accounts'));
    }

    async function loadAccountTransactions() {
      const accountId = document.getElementById('ops-account-id').value;
      setOutput(await call('/accounts/' + accountId + '/transactions'));
    }

    async function seedAccountData() {
      const accountId = document.getElementById('ops-account-id').value;
      setOutput(await call('/accounts/' + accountId + '/seed', { method: 'POST' }));
    }

    async function resetAccountData() {
      const accountId = document.getElementById('ops-account-id').value;
      setOutput(await call('/accounts/' + accountId + '/reset', { method: 'POST' }));
    }

    async function simulateIncomingAch() {
      const accountId = document.getElementById('sim-account-id').value;
      const amount = Number(document.getElementById('sim-amount').value);
      setOutput(await call('/simulations/ach-incoming', {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId, amount })
      }));
    }

    async function simulateIncomingWire() {
      const accountId = document.getElementById('sim-account-id').value;
      const amount = Number(document.getElementById('sim-amount').value);
      setOutput(await call('/simulations/wire-incoming', {
        method: 'POST',
        body: JSON.stringify({ account_id: accountId, amount })
      }));
    }

    async function simulateCardEvent() {
      const accountId = document.getElementById('sim-account-id').value;
      const amount = Number(document.getElementById('sim-amount').value);
      const eventType = document.getElementById('card-event-type').value || 'post';
      const referenceId = document.getElementById('card-reference-id').value || undefined;
      setOutput(await call('/simulations/card', {
        method: 'POST',
        body: JSON.stringify({
          account_id: accountId,
          amount,
          event_type: eventType,
          reference_id: referenceId,
        })
      }));
    }

    async function setYieldConfig() {
      const accountId = document.getElementById('sim-account-id').value;
      const apy = Number(document.getElementById('yield-apy').value);
      setOutput(await call('/accounts/' + accountId + '/yield-config', {
        method: 'POST',
        body: JSON.stringify({ apy, enabled: true })
      }));
    }

    async function getYieldConfig() {
      const accountId = document.getElementById('sim-account-id').value;
      setOutput(await call('/accounts/' + accountId + '/yield-config'));
    }

    async function runDailyAccrual() {
      const asOfDate = document.getElementById('accrual-date').value;
      setOutput(await call('/interest/accrue-daily', {
        method: 'POST',
        body: JSON.stringify({ as_of_date: asOfDate || undefined })
      }));
    }

    async function loadApiActivity() {
      setOutput(await call('/api-activity'));
    }

    async function loadAudit() {
      setOutput(await call('/audit'));
    }
  </script>
</body>
</html>`);
});
