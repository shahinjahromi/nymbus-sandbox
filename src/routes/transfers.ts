import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import {
  createTenantTransfer,
  getTenantAccountById,
  getTenantTransferById,
  listTenantTransfersByAccountId,
} from "../services/tenant-store.js";
import type { PaginatedResponse, Transfer } from "../types/index.js";
import { captureApiActivity } from "../services/api-activity-log.js";
import { getIdempotentReplay, saveIdempotentResult } from "../services/idempotency-store.js";

export const transfersRouter = Router();
transfersRouter.use(requireAuth);
transfersRouter.use(captureApiActivity);

transfersRouter.get("/transfers", (req: Request, res: Response) => {
  const accountId = req.query.account_id as string | undefined;
  if (!accountId) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "account_id query parameter is required",
    });
    return;
  }

  const data = listTenantTransfersByAccountId(req.tenantId!, accountId);
  const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.page_size), 10) || 20));
  const total = data.length;
  const start = (page - 1) * pageSize;
  const pagedData = data.slice(start, start + pageSize);

  const response: PaginatedResponse<Transfer> = {
    data: pagedData,
    total,
    page,
    pageSize,
    hasMore: start + pagedData.length < total,
  };
  res.json(response);
});

transfersRouter.get("/transfers/:id", (req: Request, res: Response) => {
  const transfer = getTenantTransferById(req.tenantId!, req.params.id);
  if (!transfer) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Transfer not found",
      details: { transferId: req.params.id },
    });
    return;
  }
  res.json(transfer);
});

transfersRouter.post("/transfers", (req: Request, res: Response) => {
  const body = req.body as {
    type?: "ach" | "wire" | "internal" | "instant";
    amount?: number;
    from_account_id?: string;
    to_account_id?: string;
    to_external?: { routing_number: string; account_number: string; name?: string };
    description?: string;
  };

  const type = body?.type ?? "ach";
  const amount = typeof body?.amount === "number" ? body.amount : Number(body?.amount);
  const fromAccountId = body?.from_account_id;
  const toAccountId = body?.to_account_id;
  const toExternal = body?.to_external
    ? {
        routingNumber: body.to_external.routing_number,
        accountNumber: body.to_external.account_number,
        name: body.to_external.name,
      }
    : undefined;
  const description = body?.description;
  const idempotencyKeyHeader = req.headers["x-idempotency-key"];
  const idempotencyKey =
    typeof idempotencyKeyHeader === "string" ? idempotencyKeyHeader.trim() : "";

  if (idempotencyKey.length > 40) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "x-idempotency-key must be <= 40 characters",
    });
    return;
  }

  if (idempotencyKey.length > 0) {
    const replay = getIdempotentReplay<Transfer>({
      tenantId: req.tenantId!,
      method: req.method,
      route: "/transfers",
      key: idempotencyKey,
    });

    if (replay) {
      res.setHeader("x-idempotent-replay", "true");
      res.status(replay.statusCode).json(replay.payload);
      return;
    }
  }

  if (!fromAccountId || !amount || amount <= 0) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "from_account_id and a positive amount are required",
    });
    return;
  }

  if (!toAccountId && !toExternal) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "Either to_account_id or to_external is required",
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
    type,
    amount,
    fromAccountId,
    toAccountId,
    toExternal,
    description,
  });

  if (idempotencyKey.length > 0) {
    saveIdempotentResult({
      tenantId: req.tenantId!,
      method: req.method,
      route: "/transfers",
      key: idempotencyKey,
      statusCode: 201,
      payload: transfer,
    });
  }

  res.status(201).json(transfer);
});
