import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { mockTransactions, getTransactionsByAccountId } from "../services/mock-data.js";
import type { PaginatedResponse } from "../types/index.js";
import type { Transaction } from "../types/index.js";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

transactionsRouter.get("/transactions", (req: Request, res: Response) => {
  const accountId = req.query.account_id as string | undefined;
  if (!accountId) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "account_id query parameter is required",
    });
    return;
  }

  const data = getTransactionsByAccountId(accountId);
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

transactionsRouter.get("/transactions/:id", (req: Request, res: Response) => {
  const txn = mockTransactions.find((t) => t.id === req.params.id);
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
