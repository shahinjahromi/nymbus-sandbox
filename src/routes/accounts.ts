import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { captureApiActivity } from "../services/api-activity-log.js";
import { getTenantAccountById, listTenantAccounts } from "../services/tenant-store.js";
import type { PaginatedResponse } from "../types/index.js";
import type { Account } from "../types/index.js";

export const accountsRouter = Router();
accountsRouter.use(requireAuth);
accountsRouter.use(captureApiActivity);

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

accountsRouter.get("/accounts/:id", (req: Request, res: Response) => {
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
