import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { enforceApiRateLimit } from "../auth/rate-limit.js";
import { captureApiActivity } from "../services/api-activity-log.js";
import {
  deleteTenantLoanPayment,
  getTenantAccountById,
  getTenantTransactionById,
  listTenantAccounts,
  listTenantCustomers,
  listTenantLoanPayments,
  listTenantTransactionsByAccountId,
  upsertTenantLoanPayment,
  updateTenantAccount,
} from "../services/tenant-store.js";
import type { PaginatedResponse } from "../types/index.js";
import type { Account } from "../types/index.js";

export const accountsRouter = Router();
accountsRouter.use(requireAuth);
accountsRouter.use(enforceApiRateLimit);
accountsRouter.use(captureApiActivity);

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

accountsRouter.get("/accounts", (_req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(_req.query.page), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(_req.query.page_size), 10) || 20));
  const customerId = _req.query.customer_id as string | undefined;

  let data = listTenantAccounts(_req.tenantId!, customerId);

  const total = data.length;
  const start = (page - 1) * pageSize;
  data = data.slice(start, start + pageSize);

  const response: PaginatedResponse<Account> = {
    data,
    total,
    page,
    pageSize,
    hasMore: start + data.length < total,
  };
  res.json(response);
});

accountsRouter.post("/accounts/search", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as {
    customer_id?: string;
    customerId?: string;
    type?: string;
    status?: string;
    currency?: string;
    text?: string;
  };

  const customerId = body.customer_id ?? body.customerId;
  const accountType = body.type;
  const accountStatus = body.status;
  const currency = body.currency ? String(body.currency).toUpperCase() : undefined;
  const text = body.text ? String(body.text).toLowerCase() : undefined;

  let data = listTenantAccounts(req.tenantId!, customerId);

  if (accountType) {
    data = data.filter((account) => account.type === accountType);
  }

  if (accountStatus) {
    data = data.filter((account) => account.status === accountStatus);
  }

  if (currency) {
    data = data.filter((account) => account.currency.toUpperCase() === currency);
  }

  if (text) {
    data = data.filter(
      (account) => account.id.toLowerCase().includes(text) || account.lastFour.toLowerCase().includes(text)
    );
  }

  res.json({
    data,
    total: data.length,
    environment: "sandbox",
  });
});

accountsRouter.get("/accounts-ext", (req: Request, res: Response) => {
  const customerId =
    typeof req.query.customer_id === "string"
      ? req.query.customer_id
      : typeof req.query.customerId === "string"
        ? req.query.customerId
        : undefined;

  const accounts = listTenantAccounts(req.tenantId!, customerId);
  const customersById = new Map(
    listTenantCustomers(req.tenantId!).map((customer) => [customer.id, customer])
  );

  const data = accounts.map((account) => {
    const customer = customersById.get(account.customerId);
    return {
      ...account,
      customer,
      product: `${account.type}-account`,
      environment: "sandbox",
    };
  });

  res.json({
    data,
    total: data.length,
    environment: "sandbox",
  });
});

accountsRouter.get("/accounts/:id(acct_[A-Za-z0-9_]+)", (req: Request, res: Response) => {
  const account = getTenantAccountById(req.tenantId!, req.params.id);
  if (!account) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Account not found",
      details: { accountId: req.params.id },
    });
    return;
  }
  res.json(account);
});

accountsRouter.get(
  "/accounts/:accountId(acct_[A-Za-z0-9_]+)/transactions",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Account not found",
        details: { accountId: req.params.accountId },
      });
      return;
    }

    const data = listTenantTransactionsByAccountId(req.tenantId!, req.params.accountId);
    res.json({
      data,
      total: data.length,
      environment: "sandbox",
    });
  }
);

accountsRouter.get(
  "/accounts/:accountId(acct_[A-Za-z0-9_]+)/transactions/:transactionId(txn_[A-Za-z0-9_]+)",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Account not found",
        details: { accountId: req.params.accountId },
      });
      return;
    }

    const transaction = getTenantTransactionById(req.tenantId!, req.params.transactionId);
    if (!transaction || transaction.accountId !== req.params.accountId) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Transaction not found",
        details: { transactionId: req.params.transactionId },
      });
      return;
    }

    res.json(transaction);
  }
);

accountsRouter.get(
  "/accounts/:accountId(acct_[A-Za-z0-9_]+)/transactions/:transactionId(txn_[A-Za-z0-9_]+)/image",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Account not found",
        details: { accountId: req.params.accountId },
      });
      return;
    }

    const transaction = getTenantTransactionById(req.tenantId!, req.params.transactionId);
    if (!transaction || transaction.accountId !== req.params.accountId) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Transaction not found",
        details: { transactionId: req.params.transactionId },
      });
      return;
    }

    res.json({
      transactionId: transaction.id,
      imageUrl: `https://sandbox.local/images/${transaction.id}.png`,
      mimeType: "image/png",
      environment: "sandbox",
    });
  }
);

accountsRouter.patch(
  "/accounts/:accountId(acct_[A-Za-z0-9_]+)/updateRewardProgramLevel",
  (req: Request, res: Response) => {
    const levelRaw = (req.body as Record<string, unknown> | undefined)?.rewardProgramLevel;
    const level = typeof levelRaw === "string" && levelRaw.trim().length > 0 ? levelRaw : undefined;

    if (!level) {
      res.status(400).json({
        code: "BAD_REQUEST",
        message: "rewardProgramLevel is required",
      });
      return;
    }

    const account = updateTenantAccount({
      tenantId: req.tenantId!,
      accountId: req.params.accountId,
      metadata: {
        rewardProgramLevel: level,
        rewardProgramLevelUpdatedAt: new Date().toISOString(),
      },
    });

    if (!account) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Account not found",
        details: { accountId: req.params.accountId },
      });
      return;
    }

    res.json({
      accountId: account.id,
      rewardProgramLevel: level,
      environment: "sandbox",
    });
  }
);

accountsRouter.get(
  "/accounts/:accountId(acct_[A-Za-z0-9_]+)/loanPayments",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Account not found",
        details: { accountId: req.params.accountId },
      });
      return;
    }

    const loanPayments = listTenantLoanPayments(req.tenantId!, req.params.accountId);
    res.json({
      accountId: req.params.accountId,
      loanPayments,
      total: loanPayments.length,
      environment: "sandbox",
    });
  }
);

accountsRouter.patch(
  "/accounts/:accountId(acct_[A-Za-z0-9_]+)/loanPayments",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Account not found",
        details: { accountId: req.params.accountId },
      });
      return;
    }

    const body = req.body;
    const bodyObject = asObject(body);
    const inputCollection = Array.isArray(bodyObject?.loanPayments)
      ? bodyObject.loanPayments
      : Array.isArray(body)
        ? body
        : bodyObject?.loanPayments
          ? [bodyObject.loanPayments]
          : bodyObject
            ? [bodyObject]
            : [];

    if (inputCollection.length === 0) {
      res.status(400).json({
        code: "BAD_REQUEST",
        message: "loanPayments payload is required",
      });
      return;
    }

    for (const item of inputCollection) {
      const input = asObject(item);
      if (!input) {
        continue;
      }
      upsertTenantLoanPayment(req.tenantId!, req.params.accountId, input);
    }

    const loanPayments = listTenantLoanPayments(req.tenantId!, req.params.accountId);
    res.json({
      accountId: req.params.accountId,
      loanPayments,
      total: loanPayments.length,
      environment: "sandbox",
    });
  }
);

accountsRouter.delete(
  "/accounts/:accountId(acct_[A-Za-z0-9_]+)/loanPayments/:paymentId",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account) {
      res.status(404).json({
        code: "NOT_FOUND",
        message: "Account not found",
        details: { accountId: req.params.accountId },
      });
      return;
    }

    const removed = deleteTenantLoanPayment(req.tenantId!, req.params.accountId, req.params.paymentId);
    if (!removed) {
      res.status(204).send();
      return;
    }

    res.status(204).send();
  }
);
