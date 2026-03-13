import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { enforceApiRateLimit } from "../auth/rate-limit.js";
import { captureApiActivity } from "../services/api-activity-log.js";
import {
  createTenantTransfer,
  getTenantAccountById,
  getTenantTransferById,
  getTenantTransactionById,
  listTenantTransactionsByAccountId,
  simulateIncomingRailTransfer,
  simulateOutgoingAchTransfer,
  updateTenantTransfer,
} from "../services/tenant-store.js";
import type { PaginatedResponse } from "../types/index.js";
import type { Transaction } from "../types/index.js";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);
transactionsRouter.use(enforceApiRateLimit);
transactionsRouter.use(captureApiActivity);

function transferStatusFromInput(value: unknown):
  | "pending"
  | "completed"
  | "failed"
  | "returned"
  | undefined {
  if (value === "pending" || value === "completed" || value === "failed" || value === "returned") {
    return value;
  }

  return undefined;
}

transactionsRouter.get("/transactions", (req: Request, res: Response) => {
  const accountId = req.query.account_id as string | undefined;
  if (!accountId) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "account_id query parameter is required",
    });
    return;
  }

  const data = listTenantTransactionsByAccountId(req.tenantId!, accountId);
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.page_size), 10) || 20));
  const total = data.length;
  const start = (page - 1) * pageSize;
  const pagedData = data.slice(start, start + pageSize);

  const response: PaginatedResponse<Transaction> = {
    data: pagedData,
    total,
    page,
    pageSize,
    hasMore: start + pagedData.length < total,
  };
  res.json(response);
});

transactionsRouter.get("/transactions/:id(txn_[A-Za-z0-9_]+)", (req: Request, res: Response) => {
  const txn = getTenantTransactionById(req.tenantId!, req.params.id);
  if (!txn) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Transaction not found",
      details: { transactionId: req.params.id },
    });
    return;
  }
  res.json(txn);
});

transactionsRouter.post("/transactions", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    type?: "ach" | "wire" | "internal" | "instant";
    amount?: number;
    from_account_id?: string;
    to_account_id?: string;
    routing_number?: string;
    account_number?: string;
    recipient_name?: string;
    description?: string;
  };

  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const fromAccountId = body.from_account_id;

  if (!fromAccountId || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "from_account_id and positive amount are required",
    });
    return;
  }

  const fromAccount = getTenantAccountById(req.tenantId!, fromAccountId);
  if (!fromAccount) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "From account not found",
      details: { accountId: fromAccountId },
    });
    return;
  }

  if (body.to_account_id) {
    const transfer = createTenantTransfer({
      tenantId: req.tenantId!,
      type: body.type ?? "internal",
      amount,
      fromAccountId,
      toAccountId: body.to_account_id,
      description: body.description,
    });
    res.status(201).json(transfer);
    return;
  }

  if (body.routing_number && body.account_number) {
    const transfer = createTenantTransfer({
      tenantId: req.tenantId!,
      type: body.type === "wire" ? "wire" : "ach",
      amount,
      fromAccountId,
      toExternal: {
        routingNumber: body.routing_number,
        accountNumber: body.account_number,
        name: body.recipient_name,
      },
      description: body.description,
    });
    res.status(201).json(transfer);
    return;
  }

  res.status(400).json({
    code: "BAD_REQUEST",
    message: "Either to_account_id or routing_number/account_number is required",
  });
});

transactionsRouter.post("/transactions/transfer", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    type?: "ach" | "wire" | "internal" | "instant";
    amount?: number;
    from_account_id?: string;
    to_account_id?: string;
    description?: string;
  };

  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const fromAccountId = body.from_account_id;
  const toAccountId = body.to_account_id;

  if (!fromAccountId || !toAccountId || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "from_account_id, to_account_id, and positive amount are required",
    });
    return;
  }

  const fromAccount = getTenantAccountById(req.tenantId!, fromAccountId);
  if (!fromAccount) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "From account not found",
      details: { accountId: fromAccountId },
    });
    return;
  }

  const transfer = createTenantTransfer({
    tenantId: req.tenantId!,
    type: body.type ?? "internal",
    amount,
    fromAccountId,
    toAccountId,
    description: body.description,
  });

  res.status(201).json(transfer);
});

transactionsRouter.post("/transactions/externalTransfer", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    type?: "ach" | "wire" | "internal" | "instant";
    amount?: number;
    from_account_id?: string;
    routing_number?: string;
    account_number?: string;
    recipient_name?: string;
    description?: string;
  };

  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  const fromAccountId = body.from_account_id;
  const routingNumber = body.routing_number;
  const accountNumber = body.account_number;

  if (
    !fromAccountId ||
    !routingNumber ||
    !accountNumber ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "from_account_id, routing_number, account_number, and positive amount are required",
    });
    return;
  }

  const fromAccount = getTenantAccountById(req.tenantId!, fromAccountId);
  if (!fromAccount) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "From account not found",
      details: { accountId: fromAccountId },
    });
    return;
  }

  const transfer = createTenantTransfer({
    tenantId: req.tenantId!,
    type: body.type === "wire" ? "wire" : "ach",
    amount,
    fromAccountId,
    toExternal: {
      routingNumber,
      accountNumber,
      name: body.recipient_name,
    },
    description: body.description,
  });

  res.status(201).json(transfer);
});

transactionsRouter.post("/transactions/createIncomingWire", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    account_id?: string;
    amount?: number;
    description?: string;
    external_name?: string;
  };

  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!body.account_id || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "account_id and positive amount are required",
    });
    return;
  }

  const simulated = simulateIncomingRailTransfer({
    tenantId: req.tenantId!,
    accountId: body.account_id,
    amount,
    rail: "wire",
    description: body.description,
    externalName: body.external_name,
  });

  if (!simulated) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Account not found",
      details: { accountId: body.account_id },
    });
    return;
  }

  res.status(201).json(simulated);
});

transactionsRouter.post("/transactions/createOutgoingWire", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    account_id?: string;
    from_account_id?: string;
    amount?: number;
    routing_number?: string;
    account_number?: string;
    recipient_name?: string;
    description?: string;
  };

  const accountId = body.from_account_id ?? body.account_id;
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!accountId || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "from_account_id/account_id and positive amount are required",
    });
    return;
  }

  const routingNumber = body.routing_number ?? "021000021";
  const accountNumber = body.account_number ?? "000123456789";

  const simulated = simulateOutgoingAchTransfer({
    tenantId: req.tenantId!,
    accountId,
    amount,
    routingNumber,
    accountNumber,
    recipientName: body.recipient_name,
    description: body.description ?? "Outgoing wire transfer",
  });

  if (!simulated) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Account not found",
      details: { accountId },
    });
    return;
  }

  const transfer = updateTenantTransfer({
    tenantId: req.tenantId!,
    transferId: simulated.transfer.id,
    status: "pending",
    description: body.description ?? "Outgoing wire transfer",
  });

  res.status(201).json({
    transfer: transfer ?? simulated.transfer,
    transaction: simulated.transaction,
    environment: "sandbox",
  });
});

transactionsRouter.post("/transactions/updateIncomingWireStatus", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { transfer_id?: string; status?: string };
  const transferId = body.transfer_id;
  const nextStatus = transferStatusFromInput(body.status) ?? "completed";

  if (!transferId) {
    res.json({ success: true, status: nextStatus, environment: "sandbox" });
    return;
  }

  const transfer = updateTenantTransfer({
    tenantId: req.tenantId!,
    transferId,
    status: nextStatus,
  });

  if (!transfer) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Transfer not found",
      details: { transferId },
    });
    return;
  }

  res.json({ transfer, environment: "sandbox" });
});

transactionsRouter.post("/transactions/updateOutgoingWireStatus", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { transfer_id?: string; status?: string };
  const transferId = body.transfer_id;
  const nextStatus = transferStatusFromInput(body.status) ?? "completed";

  if (!transferId) {
    res.json({ success: true, status: nextStatus, environment: "sandbox" });
    return;
  }

  const transfer = updateTenantTransfer({
    tenantId: req.tenantId!,
    transferId,
    status: nextStatus,
  });

  if (!transfer) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Transfer not found",
      details: { transferId },
    });
    return;
  }

  res.json({ transfer, environment: "sandbox" });
});

transactionsRouter.post("/transactions/commitWireTransaction", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { transfer_id?: string; reference_id?: string };
  const transferId = body.transfer_id;

  if (!transferId) {
    res.json({ committed: true, environment: "sandbox" });
    return;
  }

  const existing = getTenantTransferById(req.tenantId!, transferId);
  if (!existing) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Transfer not found",
      details: { transferId },
    });
    return;
  }

  const transfer = updateTenantTransfer({
    tenantId: req.tenantId!,
    transferId,
    status: "completed",
  });

  res.json({
    transfer: transfer ?? existing,
    committed: true,
    referenceId: body.reference_id ?? existing.referenceId,
    environment: "sandbox",
  });
});

transactionsRouter.post("/transactions/disbursement", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    from_account_id?: string;
    to_account_id?: string;
    amount?: number;
    description?: string;
  };

  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!body.from_account_id || !body.to_account_id || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "from_account_id, to_account_id, and positive amount are required",
    });
    return;
  }

  const fromAccount = getTenantAccountById(req.tenantId!, body.from_account_id);
  if (!fromAccount) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "From account not found",
      details: { accountId: body.from_account_id },
    });
    return;
  }

  const transfer = createTenantTransfer({
    tenantId: req.tenantId!,
    type: "internal",
    amount,
    fromAccountId: body.from_account_id,
    toAccountId: body.to_account_id,
    description: body.description ?? "Loan disbursement",
  });

  res.status(201).json({ transfer, environment: "sandbox" });
});

transactionsRouter.post("/onboarding/loanOnboardingFunding", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    account_id?: string;
    amount?: number;
    description?: string;
  };

  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!body.account_id || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "account_id and positive amount are required",
    });
    return;
  }

  const account = getTenantAccountById(req.tenantId!, body.account_id);
  if (!account) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Account not found",
      details: { accountId: body.account_id },
    });
    return;
  }

  const transfer = createTenantTransfer({
    tenantId: req.tenantId!,
    type: "internal",
    amount,
    fromAccountId: body.account_id,
    toAccountId: body.account_id,
    description: body.description ?? "Loan onboarding funding",
  });

  res.status(201).json({ transfer, environment: "sandbox" });
});

/* ── Official Check Transactions ── */

// In-memory store for official check transactions (per-tenant)
const officialCheckTxnMap = new Map<string, any[]>();

function getTenantOfficialChecks(tenantId: string): any[] {
  if (!officialCheckTxnMap.has(tenantId)) {
    officialCheckTxnMap.set(tenantId, []);
  }
  return officialCheckTxnMap.get(tenantId)!;
}

transactionsRouter.post(
  "/transactions/officialCheckTransactions",
  (req: Request, res: Response) => {
    const body = req.body ?? {};
    const checks = getTenantOfficialChecks(req.tenantId!);

    const txn = {
      id: `oct_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: "pending",
      transactionType: body.transactionType ?? "officialCheck",
      accountId: body.accountId ?? body.account_id ?? null,
      payee: body.payee ?? null,
      amount: body.amount ?? 0,
      memo: body.memo ?? null,
      checkNumber: body.checkNumber ?? `CHK${Math.floor(100000 + Math.random() * 900000)}`,
      remitter: body.remitter ?? null,
      purchaseDate: body.purchaseDate ?? new Date().toISOString().slice(0, 10),
      fee: body.fee ?? 0,
      createdAt: new Date().toISOString(),
    };

    checks.push(txn);

    res.status(201).json({
      responseStatus: { success: true, errors: [] },
      officialCheck: txn,
      environment: "sandbox",
    });
  }
);

transactionsRouter.post(
  "/transactions/officialCheckTransactions/confirm",
  (req: Request, res: Response) => {
    const body = req.body ?? {};
    const checks = getTenantOfficialChecks(req.tenantId!);
    const txnId = body.id ?? body.transactionId;

    if (txnId) {
      const found = checks.find((c: any) => c.id === txnId);
      if (found) {
        found.status = "confirmed";
        found.confirmedAt = new Date().toISOString();
        res.json({
          responseStatus: { success: true, errors: [] },
          officialCheck: found,
          environment: "sandbox",
        });
        return;
      }
      res.status(404).json({
        responseStatus: { success: false, errors: [{ message: "Transaction not found" }] },
      });
      return;
    }

    // If no ID provided, confirm all pending
    const pending = checks.filter((c: any) => c.status === "pending");
    pending.forEach((c: any) => {
      c.status = "confirmed";
      c.confirmedAt = new Date().toISOString();
    });

    res.json({
      responseStatus: { success: true, errors: [] },
      confirmedCount: pending.length,
      environment: "sandbox",
    });
  }
);
