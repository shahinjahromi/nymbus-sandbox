import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { enforceApiRateLimit } from "../auth/rate-limit.js";
import { captureApiActivity } from "../services/api-activity-log.js";
import {
  getTenantTransactionById,
  listTenantTransactionsByAccountId,
} from "../services/tenant-store.js";
import type { PaginatedResponse } from "../types/index.js";
import type { Transaction } from "../types/index.js";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);
transactionsRouter.use(enforceApiRateLimit);
transactionsRouter.use(captureApiActivity);

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
