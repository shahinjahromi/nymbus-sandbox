import { Router, type Request, type Response } from "express";
import { requireAuth } from "../auth/middleware.js";
import { enforceApiRateLimit } from "../auth/rate-limit.js";
import { captureApiActivity } from "../services/api-activity-log.js";
import {
  createTenantAccountDocument,
  createTenantAccount,
  createTenantCustomer,
  createTenantCustomerDocument,
  createTenantTransfer,
  deleteTenantAccountDocument,
  deleteTenantAccountUserDefinedField,
  deleteTenantCustomerDocument,
  getTenantAccountDocument,
  getTenantAccountById,
  getTenantCustomerDocument,
  getTenantCustomerById,
  listTenantAccountDocuments,
  listTenantAccountUserDefinedFields,
  listTenantAccounts,
  listTenantCustomerUserDefinedFields,
  listTenantCustomers,
  listTenantTransfersByCustomerId,
  updateTenantAccount,
  updateTenantTransfer,
  deleteTenantTransfer,
  updateTenantAccountDocument,
  updateTenantCustomerDocument,
  updateTenantCustomer,
  upsertTenantAccountUserDefinedFields,
  upsertTenantCustomerUserDefinedFields,
} from "../services/tenant-store.js";
import type { PaginatedResponse } from "../types/index.js";
import type { Customer } from "../types/index.js";

interface DebitCardRecord {
  id: string;
  customerId: string;
  cardNumber: string;
  lastFour: string;
  referenceId: string;
  status: "active" | "frozen" | "inactive";
  createdAt: string;
  updatedAt: string;
}

const debitCardsByTenant = new Map<string, Map<string, DebitCardRecord[]>>();
const beneficiaryLinksByTenant = new Map<string, Map<string, Set<string>>>();
const collateralsByTenant = new Map<string, Map<string, Array<Record<string, unknown>>>>();
const uploadedFilesByTenant = new Map<string, Map<string, Array<Record<string, unknown>>>>();

export const customersRouter = Router();
customersRouter.use(requireAuth);
customersRouter.use(enforceApiRateLimit);
customersRouter.use(captureApiActivity);

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function parseUserDefinedFieldPayload(value: unknown): Array<Record<string, unknown>> {
  const bodyObject = asObject(value);
  const payload = bodyObject?.userDefinedFields ?? bodyObject?.user_defined_fields ?? value;

  if (Array.isArray(payload)) {
    return payload
      .map((item) => asObject(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
  }

  const single = asObject(payload);
  return single ? [single] : [];
}

function getTenantScopedMap<T>(
  source: Map<string, Map<string, T>>,
  tenantId: string
): Map<string, T> {
  let scoped = source.get(tenantId);
  if (!scoped) {
    scoped = new Map<string, T>();
    source.set(tenantId, scoped);
  }

  return scoped;
}

function getTenantScopedArray(
  source: Map<string, Map<string, Array<Record<string, unknown>>>>,
  tenantId: string,
  key: string
): Array<Record<string, unknown>> {
  const scoped = getTenantScopedMap(source, tenantId);
  let rows = scoped.get(key);
  if (!rows) {
    rows = [];
    scoped.set(key, rows);
  }
  return rows;
}

function getTenantDebitCards(tenantId: string, customerId: string): DebitCardRecord[] {
  const scoped = getTenantScopedMap(debitCardsByTenant, tenantId);
  let cards = scoped.get(customerId);
  if (!cards) {
    cards = [];
    scoped.set(customerId, cards);
  }

  return cards;
}

function getAccountMetadataCollection(
  account: { metadata?: Record<string, unknown> },
  key: string
): Array<Record<string, unknown>> {
  const metadata = (account.metadata ?? {}) as Record<string, unknown>;
  const raw = metadata[key];
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => asObject(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));
}

function saveAccountMetadataCollection(params: {
  tenantId: string;
  accountId: string;
  accountMetadata: Record<string, unknown> | undefined;
  key: string;
  collection: Array<Record<string, unknown>>;
}): void {
  updateTenantAccount({
    tenantId: params.tenantId,
    accountId: params.accountId,
    metadata: {
      ...(params.accountMetadata ?? {}),
      [params.key]: params.collection,
      [`${params.key}UpdatedAt`]: new Date().toISOString(),
    },
  });
}

customersRouter.get("/customers", (_req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(_req.query.page), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(_req.query.page_size), 10) || 20));
  const customers = listTenantCustomers(_req.tenantId!);
  const total = customers.length;
  const start = (page - 1) * pageSize;
  const data = customers.slice(start, start + pageSize);

  const response: PaginatedResponse<Customer> = {
    data,
    total,
    page,
    pageSize,
    hasMore: start + data.length < total,
  };
  res.json(response);
});

customersRouter.post("/customers", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  const customerPayload =
    (data.customer as Record<string, unknown> | undefined) ??
    (body.customer as Record<string, unknown> | undefined) ??
    body;

  const firstName = String(customerPayload.first_name ?? customerPayload.firstName ?? "").trim();
  const lastName = String(customerPayload.last_name ?? customerPayload.lastName ?? "").trim();
  const email = String(customerPayload.email ?? "").trim();
  const externalIdRaw = customerPayload.external_id ?? customerPayload.externalId;
  const externalId = typeof externalIdRaw === "string" ? externalIdRaw : undefined;

  if (!firstName || !lastName || !email) {
    res.status(400).json({
      code: "BAD_REQUEST",
      message: "first_name, last_name, and email are required",
    });
    return;
  }

  const customer = createTenantCustomer({
    tenantId: req.tenantId!,
    firstName,
    lastName,
    email,
    externalId,
  });

  if (!customer) {
    res.status(409).json({ code: "CONFLICT", message: "Customer email already exists" });
    return;
  }

  res.status(201).json({ customer, environment: "sandbox" });
});

customersRouter.get("/customers/:id(cust_[A-Za-z0-9_]+)", (req: Request, res: Response) => {
  const customer = getTenantCustomerById(req.tenantId!, req.params.id);
  if (!customer) {
    res.status(404).json({
      code: "NOT_FOUND",
      message: "Customer not found",
      details: { customerId: req.params.id },
    });
    return;
  }
  res.json(customer);
});

customersRouter.patch("/customers/:id(cust_[A-Za-z0-9_]+)", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const data = (body.data as Record<string, unknown> | undefined) ?? body;
  const customerPayload =
    (data.customer as Record<string, unknown> | undefined) ??
    (body.customer as Record<string, unknown> | undefined) ??
    body;

  const updateResult = updateTenantCustomer({
    tenantId: req.tenantId!,
    customerId: req.params.id,
    firstName:
      typeof customerPayload.first_name === "string"
        ? customerPayload.first_name
        : typeof customerPayload.firstName === "string"
          ? customerPayload.firstName
          : undefined,
    lastName:
      typeof customerPayload.last_name === "string"
        ? customerPayload.last_name
        : typeof customerPayload.lastName === "string"
          ? customerPayload.lastName
          : undefined,
    email: typeof customerPayload.email === "string" ? customerPayload.email : undefined,
    externalId:
      typeof customerPayload.external_id === "string"
        ? customerPayload.external_id
        : typeof customerPayload.externalId === "string"
          ? customerPayload.externalId
          : undefined,
    status:
      customerPayload.status === "active" ||
      customerPayload.status === "pending" ||
      customerPayload.status === "suspended"
        ? customerPayload.status
        : undefined,
    kycStatus:
      customerPayload.kyc_status === "pending" ||
      customerPayload.kyc_status === "verified" ||
      customerPayload.kyc_status === "rejected"
        ? customerPayload.kyc_status
        : customerPayload.kycStatus === "pending" ||
            customerPayload.kycStatus === "verified" ||
            customerPayload.kycStatus === "rejected"
          ? customerPayload.kycStatus
          : undefined,
  });

  if (updateResult.error === "NOT_FOUND") {
    res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
    return;
  }

  if (updateResult.error === "EMAIL_ALREADY_EXISTS") {
    res.status(409).json({ code: "CONFLICT", message: "Customer email already exists" });
    return;
  }

  res.json({ customer: updateResult.customer, environment: "sandbox" });
});

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const accounts = listTenantAccounts(req.tenantId!, req.params.customerId);

    res.json({
      data: accounts,
      total: accounts.length,
      environment: "sandbox",
    });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const data = (body.data as Record<string, unknown> | undefined) ?? body;
    const accountPayload =
      (data.account as Record<string, unknown> | undefined) ??
      (body.account as Record<string, unknown> | undefined) ??
      body;

    const accountType = accountPayload.type;
    if (accountType !== "checking" && accountType !== "savings" && accountType !== "money_market") {
      res.status(400).json({
        code: "BAD_REQUEST",
        message: "type must be one of checking, savings, money_market",
      });
      return;
    }

    const initialBalanceRaw = accountPayload.initial_balance ?? accountPayload.initialBalance ?? 0;
    const initialBalance =
      typeof initialBalanceRaw === "number" ? initialBalanceRaw : Number(initialBalanceRaw);
    if (!Number.isFinite(initialBalance) || initialBalance < 0) {
      res.status(400).json({ code: "BAD_REQUEST", message: "initial_balance must be >= 0" });
      return;
    }

    const currency =
      typeof accountPayload.currency === "string" && accountPayload.currency.length > 0
        ? accountPayload.currency
        : undefined;

    const account = createTenantAccount({
      tenantId: req.tenantId!,
      customerId: req.params.customerId,
      type: accountType,
      currency,
      initialBalance,
    });

    if (!account) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    res.status(201).json({ account, environment: "sandbox" });
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    res.json(account);
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/userDefinedFields",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const userDefinedFields = listTenantCustomerUserDefinedFields(req.tenantId!, req.params.customerId);
    res.json({
      customerId: req.params.customerId,
      userDefinedFields,
      total: userDefinedFields.length,
      environment: "sandbox",
    });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/userDefinedFields",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const fields = parseUserDefinedFieldPayload(req.body);
    if (fields.length === 0) {
      res.status(400).json({
        code: "BAD_REQUEST",
        message: "userDefinedFields payload is required",
      });
      return;
    }

    const userDefinedFields = upsertTenantCustomerUserDefinedFields(
      req.tenantId!,
      req.params.customerId,
      fields
    );

    res.status(201).json({
      customerId: req.params.customerId,
      userDefinedFields,
      total: userDefinedFields.length,
      environment: "sandbox",
    });
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/userDefinedFields",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const userDefinedFields = listTenantAccountUserDefinedFields(
      req.tenantId!,
      req.params.customerId,
      req.params.accountId
    );

    res.json({
      customerId: req.params.customerId,
      accountId: req.params.accountId,
      userDefinedFields,
      total: userDefinedFields.length,
      environment: "sandbox",
    });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/userDefinedFields",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const fields = parseUserDefinedFieldPayload(req.body);
    if (fields.length === 0) {
      res.status(400).json({
        code: "BAD_REQUEST",
        message: "userDefinedFields payload is required",
      });
      return;
    }

    const userDefinedFields = upsertTenantAccountUserDefinedFields(
      req.tenantId!,
      req.params.customerId,
      req.params.accountId,
      fields
    );

    res.status(201).json({
      customerId: req.params.customerId,
      accountId: req.params.accountId,
      userDefinedFields,
      total: userDefinedFields.length,
      environment: "sandbox",
    });
  }
);

customersRouter.patch(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/userDefinedFields",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const fields = parseUserDefinedFieldPayload(req.body);
    if (fields.length === 0) {
      res.status(400).json({
        code: "BAD_REQUEST",
        message: "userDefinedFields payload is required",
      });
      return;
    }

    const userDefinedFields = upsertTenantAccountUserDefinedFields(
      req.tenantId!,
      req.params.customerId,
      req.params.accountId,
      fields
    );

    res.json({
      customerId: req.params.customerId,
      accountId: req.params.accountId,
      userDefinedFields,
      total: userDefinedFields.length,
      environment: "sandbox",
    });
  }
);

customersRouter.delete(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/userDefinedFields/:id",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const removed = deleteTenantAccountUserDefinedField(
      req.tenantId!,
      req.params.customerId,
      req.params.accountId,
      req.params.id
    );

    if (!removed) {
      res.status(204).send();
      return;
    }

    res.status(204).send();
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/documents",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const payload = asObject(req.body) ?? {};
    const document = createTenantCustomerDocument(req.tenantId!, req.params.customerId, payload);
    res.status(201).json({ document, environment: "sandbox" });
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/documents/:documentRootId",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const document = getTenantCustomerDocument(
      req.tenantId!,
      req.params.customerId,
      req.params.documentRootId
    );
    if (!document) {
      const seeded = createTenantCustomerDocument(req.tenantId!, req.params.customerId, {
        documentRootId: req.params.documentRootId,
        title: `Document ${req.params.documentRootId}`,
        status: "active",
      });
      res.json({ document: seeded, environment: "sandbox" });
      return;
    }

    res.json({ document, environment: "sandbox" });
  }
);

customersRouter.patch(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/documents/:documentRootId",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const patch = asObject(req.body) ?? {};
    const document = updateTenantCustomerDocument(
      req.tenantId!,
      req.params.customerId,
      req.params.documentRootId,
      patch
    );
    if (!document) {
      const seeded = createTenantCustomerDocument(req.tenantId!, req.params.customerId, {
        documentRootId: req.params.documentRootId,
        ...patch,
      });
      res.json({ document: seeded, environment: "sandbox" });
      return;
    }

    res.json({ document, environment: "sandbox" });
  }
);

customersRouter.delete(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/documents/:documentRootId",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const removed = deleteTenantCustomerDocument(
      req.tenantId!,
      req.params.customerId,
      req.params.documentRootId
    );
    if (!removed) {
      res.status(204).send();
      return;
    }

    res.status(204).send();
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/documents",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const data = listTenantAccountDocuments(req.tenantId!, req.params.customerId, req.params.accountId);
    res.json({
      customerId: req.params.customerId,
      accountId: req.params.accountId,
      data,
      total: data.length,
      environment: "sandbox",
    });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/documents",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const payload = asObject(req.body) ?? {};
    const document = createTenantAccountDocument(
      req.tenantId!,
      req.params.customerId,
      req.params.accountId,
      payload
    );
    res.status(201).json({ document, environment: "sandbox" });
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/documents/:documentRootId",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const document = getTenantAccountDocument(
      req.tenantId!,
      req.params.customerId,
      req.params.accountId,
      req.params.documentRootId
    );
    if (!document) {
      const seeded = createTenantAccountDocument(
        req.tenantId!,
        req.params.customerId,
        req.params.accountId,
        {
          documentRootId: req.params.documentRootId,
          title: `Document ${req.params.documentRootId}`,
          status: "active",
        }
      );
      res.json({ document: seeded, environment: "sandbox" });
      return;
    }

    res.json({ document, environment: "sandbox" });
  }
);

customersRouter.patch(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/documents/:documentRootId",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const patch = asObject(req.body) ?? {};
    const document = updateTenantAccountDocument(
      req.tenantId!,
      req.params.customerId,
      req.params.accountId,
      req.params.documentRootId,
      patch
    );
    if (!document) {
      const seeded = createTenantAccountDocument(
        req.tenantId!,
        req.params.customerId,
        req.params.accountId,
        {
          documentRootId: req.params.documentRootId,
          ...patch,
        }
      );
      res.json({ document: seeded, environment: "sandbox" });
      return;
    }

    res.json({ document, environment: "sandbox" });
  }
);

customersRouter.delete(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/documents/:documentRootId",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const removed = deleteTenantAccountDocument(
      req.tenantId!,
      req.params.customerId,
      req.params.accountId,
      req.params.documentRootId
    );
    if (!removed) {
      res.status(204).send();
      return;
    }

    res.status(204).send();
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/transfers",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const data = listTenantTransfersByCustomerId(req.tenantId!, req.params.customerId);
    res.json({ data, total: data.length, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/transfers/transfer",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

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
    if (!fromAccount || fromAccount.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "From account not found for customer" });
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
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/transfers/externalTransfer",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

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
        message:
          "from_account_id, routing_number, account_number, and positive amount are required",
      });
      return;
    }

    const fromAccount = getTenantAccountById(req.tenantId!, fromAccountId);
    if (!fromAccount || fromAccount.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "From account not found for customer" });
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
  }
);

customersRouter.get("/customers-ext", (req: Request, res: Response) => {
  const customers = listTenantCustomers(req.tenantId!);
  const accountsByCustomer = new Map<string, number>();
  for (const account of listTenantAccounts(req.tenantId!)) {
    accountsByCustomer.set(account.customerId, (accountsByCustomer.get(account.customerId) ?? 0) + 1);
  }

  const data = customers.map((customer) => ({
    ...customer,
    accountCount: accountsByCustomer.get(customer.id) ?? 0,
    environment: "sandbox",
  }));

  res.json({ data, total: data.length, environment: "sandbox" });
});

customersRouter.post("/customers/search", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { text?: string; email?: string; status?: string };
  const text = body.text?.toLowerCase();
  const email = body.email?.toLowerCase();
  const status = body.status;

  let data = listTenantCustomers(req.tenantId!);

  if (email) {
    data = data.filter((customer) => customer.email.toLowerCase().includes(email));
  }

  if (status) {
    data = data.filter((customer) => customer.status === status);
  }

  if (text) {
    data = data.filter((customer) => {
      const fullName = `${customer.firstName} ${customer.lastName}`.toLowerCase();
      return (
        customer.id.toLowerCase().includes(text) ||
        customer.email.toLowerCase().includes(text) ||
        fullName.includes(text)
      );
    });
  }

  res.json({ data, total: data.length, environment: "sandbox" });
});

customersRouter.patch(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/transfers/:transferId",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const body = (req.body ?? {}) as { status?: string; description?: string };
    const status =
      body.status === "pending" ||
      body.status === "completed" ||
      body.status === "failed" ||
      body.status === "returned"
        ? body.status
        : undefined;

    const transfer = updateTenantTransfer({
      tenantId: req.tenantId!,
      transferId: req.params.transferId,
      status,
      description: typeof body.description === "string" ? body.description : undefined,
    });

    if (!transfer) {
      res.json({
        transfer: {
          id: req.params.transferId,
          status: status ?? "pending",
          description: typeof body.description === "string" ? body.description : undefined,
          customerId: req.params.customerId,
        },
        environment: "sandbox",
      });
      return;
    }

    res.json({ transfer, environment: "sandbox" });
  }
);

customersRouter.delete(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/transfers/:transferId",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const removed = deleteTenantTransfer(req.tenantId!, req.params.transferId);
    if (!removed) {
      res.status(204).send();
      return;
    }

    res.status(204).send();
  }
);

customersRouter.patch(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const body = (req.body ?? {}) as {
      status?: "active" | "pending" | "closed" | "frozen";
      type?: "checking" | "savings" | "money_market";
      metadata?: Record<string, unknown>;
    };

    const updated = updateTenantAccount({
      tenantId: req.tenantId!,
      accountId: req.params.accountId,
      status: body.status,
      type: body.type,
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : undefined,
    });

    if (!updated) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    res.json({ account: updated, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/close",
  (req: Request, res: Response) => {
    const account = updateTenantAccount({
      tenantId: req.tenantId!,
      accountId: req.params.accountId,
      status: "closed",
    });

    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    res.json({ account, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/reopen",
  (req: Request, res: Response) => {
    const account = updateTenantAccount({
      tenantId: req.tenantId!,
      accountId: req.params.accountId,
      status: "active",
    });

    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    res.json({ account, environment: "sandbox" });
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/stopCheckPayments",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const data = getAccountMetadataCollection(account, "stopCheckPayments");
    res.json({ data, total: data.length, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/stopCheckPayments",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const payload = asObject(req.body) ?? {};
    const data = getAccountMetadataCollection(account, "stopCheckPayments");
    const record = {
      id: String(payload.id ?? `scp_${Date.now()}`),
      ...payload,
      createdAt: new Date().toISOString(),
    };
    data.push(record);

    saveAccountMetadataCollection({
      tenantId: req.tenantId!,
      accountId: account.id,
      accountMetadata: account.metadata,
      key: "stopCheckPayments",
      collection: data,
    });

    res.status(201).json({ stopCheckPayment: record, environment: "sandbox" });
  }
);

customersRouter.delete(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/stopCheckPayments/:stopCheckPaymentId",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const data = getAccountMetadataCollection(account, "stopCheckPayments");
    const filtered = data.filter((item) => String(item.id) !== req.params.stopCheckPaymentId);

    saveAccountMetadataCollection({
      tenantId: req.tenantId!,
      accountId: account.id,
      accountMetadata: account.metadata,
      key: "stopCheckPayments",
      collection: filtered,
    });

    res.status(204).send();
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/stopAchPayments",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const data = getAccountMetadataCollection(account, "stopAchPayments");
    res.json({ data, total: data.length, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/stopAchPayments",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const payload = asObject(req.body) ?? {};
    const data = getAccountMetadataCollection(account, "stopAchPayments");
    const record = {
      id: String(payload.id ?? `sap_${Date.now()}`),
      ...payload,
      createdAt: new Date().toISOString(),
    };
    data.push(record);

    saveAccountMetadataCollection({
      tenantId: req.tenantId!,
      accountId: account.id,
      accountMetadata: account.metadata,
      key: "stopAchPayments",
      collection: data,
    });

    res.status(201).json({ stopAchPayment: record, environment: "sandbox" });
  }
);

customersRouter.delete(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/accounts/:accountId(acct_[A-Za-z0-9_]+)/stopAchPayments/:stopAchPaymentId",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account || account.customerId !== req.params.customerId) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found for customer" });
      return;
    }

    const data = getAccountMetadataCollection(account, "stopAchPayments");
    const filtered = data.filter((item) => String(item.id) !== req.params.stopAchPaymentId);

    saveAccountMetadataCollection({
      tenantId: req.tenantId!,
      accountId: account.id,
      accountMetadata: account.metadata,
      key: "stopAchPayments",
      collection: filtered,
    });

    res.status(204).send();
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/linkBeneficiaryOwner/:beneficiaryId",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const tenantLinks = getTenantScopedMap(beneficiaryLinksByTenant, req.tenantId!);
    let links = tenantLinks.get(req.params.customerId);
    if (!links) {
      links = new Set<string>();
      tenantLinks.set(req.params.customerId, links);
    }

    links.add(req.params.beneficiaryId);
    res.status(201).json({
      customerId: req.params.customerId,
      beneficiaryId: req.params.beneficiaryId,
      linked: true,
      environment: "sandbox",
    });
  }
);

customersRouter.delete(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/linkBeneficiaryOwner/:beneficiaryId",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const tenantLinks = getTenantScopedMap(beneficiaryLinksByTenant, req.tenantId!);
    const links = tenantLinks.get(req.params.customerId);
    links?.delete(req.params.beneficiaryId);

    res.status(204).send();
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/updateOLBFlag",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const body = (req.body ?? {}) as { olbEnabled?: boolean };
    customer.metadata = {
      ...(customer.metadata ?? {}),
      olbEnabled: body.olbEnabled ?? true,
      olbUpdatedAt: new Date().toISOString(),
    };

    res.json({ customer, environment: "sandbox" });
  }
);

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/collaterals",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const data = getTenantScopedArray(collateralsByTenant, req.tenantId!, req.params.customerId);
    res.json({ data, total: data.length, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/collaterals",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const payload = asObject(req.body) ?? {};
    const data = getTenantScopedArray(collateralsByTenant, req.tenantId!, req.params.customerId);
    const collateral = {
      id: String(payload.id ?? `col_${Date.now()}`),
      ...payload,
      createdAt: new Date().toISOString(),
    };
    data.push(collateral);
    res.status(201).json({ collateral, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/creditCards",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const payload = asObject(req.body) ?? {};
    const metadata = (customer.metadata ?? {}) as Record<string, unknown>;
    const existing = Array.isArray(metadata.creditCards)
      ? metadata.creditCards.filter((item) => asObject(item))
      : [];
    const creditCard = {
      id: String(payload.id ?? `cc_${Date.now()}`),
      ...payload,
      createdAt: new Date().toISOString(),
    };
    existing.push(creditCard);

    customer.metadata = {
      ...metadata,
      creditCards: existing,
      creditCardsUpdatedAt: new Date().toISOString(),
    };

    res.status(201).json({ creditCard, environment: "sandbox" });
  }
);

customersRouter.post("/customers/uploadFiles", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { customer_id?: string; file_name?: string; file_type?: string };
  const customerId = body.customer_id;
  if (!customerId) {
    res.status(400).json({ code: "BAD_REQUEST", message: "customer_id is required" });
    return;
  }

  const customer = getTenantCustomerById(req.tenantId!, customerId);
  if (!customer) {
    res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
    return;
  }

  const uploads = getTenantScopedArray(uploadedFilesByTenant, req.tenantId!, customerId);
  const file = {
    id: `file_${Date.now()}`,
    name: body.file_name ?? "uploaded-file",
    type: body.file_type ?? "application/octet-stream",
    uploadedAt: new Date().toISOString(),
  };
  uploads.push(file);

  res.status(201).json({ file, environment: "sandbox" });
});

customersRouter.get(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/debitCards",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const data = getTenantDebitCards(req.tenantId!, req.params.customerId);
    res.json({ data, total: data.length, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/debitCards",
  (req: Request, res: Response) => {
    const customer = getTenantCustomerById(req.tenantId!, req.params.customerId);
    if (!customer) {
      res.status(404).json({ code: "NOT_FOUND", message: "Customer not found" });
      return;
    }

    const body = (req.body ?? {}) as { card_number?: string };
    const cardNumber = body.card_number ?? `411111111111${String(Date.now()).slice(-4)}`;
    const record: DebitCardRecord = {
      id: `dc_${Date.now()}`,
      customerId: req.params.customerId,
      cardNumber,
      lastFour: cardNumber.slice(-4),
      referenceId: `ref_dc_${Date.now()}`,
      status: "inactive",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cards = getTenantDebitCards(req.tenantId!, req.params.customerId);
    cards.push(record);
    res.status(201).json({ debitCard: record, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/debitCards/:debitCardId/activateCard",
  (req: Request, res: Response) => {
    const cards = getTenantDebitCards(req.tenantId!, req.params.customerId);
    let card = cards.find((item) => item.id === req.params.debitCardId);
    if (!card) {
      card = {
        id: req.params.debitCardId,
        customerId: req.params.customerId,
        cardNumber: `411111111111${String(Date.now()).slice(-4)}`,
        lastFour: String(Date.now()).slice(-4),
        referenceId: `ref_${req.params.debitCardId}`,
        status: "inactive",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      cards.push(card);
    }

    card.status = "active";
    card.updatedAt = new Date().toISOString();
    res.json({ debitCard: card, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/debitCards/:debitCardId/freezeCard",
  (req: Request, res: Response) => {
    const cards = getTenantDebitCards(req.tenantId!, req.params.customerId);
    let card = cards.find((item) => item.id === req.params.debitCardId);
    if (!card) {
      card = {
        id: req.params.debitCardId,
        customerId: req.params.customerId,
        cardNumber: `411111111111${String(Date.now()).slice(-4)}`,
        lastFour: String(Date.now()).slice(-4),
        referenceId: `ref_${req.params.debitCardId}`,
        status: "inactive",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      cards.push(card);
    }

    card.status = "frozen";
    card.updatedAt = new Date().toISOString();
    res.json({ debitCard: card, environment: "sandbox" });
  }
);

customersRouter.post(
  "/customers/:customerId(cust_[A-Za-z0-9_]+)/debitCards/:debitCardId/unfreezeCard",
  (req: Request, res: Response) => {
    const cards = getTenantDebitCards(req.tenantId!, req.params.customerId);
    let card = cards.find((item) => item.id === req.params.debitCardId);
    if (!card) {
      card = {
        id: req.params.debitCardId,
        customerId: req.params.customerId,
        cardNumber: `411111111111${String(Date.now()).slice(-4)}`,
        lastFour: String(Date.now()).slice(-4),
        referenceId: `ref_${req.params.debitCardId}`,
        status: "inactive",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      cards.push(card);
    }

    card.status = "active";
    card.updatedAt = new Date().toISOString();
    res.json({ debitCard: card, environment: "sandbox" });
  }
);

customersRouter.post("/debitCards/activateCardByCardNumber", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { card_number?: string };
  if (!body.card_number) {
    res.status(400).json({ code: "BAD_REQUEST", message: "card_number is required" });
    return;
  }

  const tenantCards = getTenantScopedMap(debitCardsByTenant, req.tenantId!);
  for (const cards of tenantCards.values()) {
    const card = cards.find((item) => item.cardNumber === body.card_number);
    if (!card) {
      continue;
    }

    card.status = "active";
    card.updatedAt = new Date().toISOString();
    res.json({ debitCard: card, environment: "sandbox" });
    return;
  }

  res.status(404).json({ code: "NOT_FOUND", message: "Debit card not found" });
});

customersRouter.get("/debitCards/referenceId/:refId", (req: Request, res: Response) => {
  const tenantCards = getTenantScopedMap(debitCardsByTenant, req.tenantId!);
  for (const cards of tenantCards.values()) {
    const card = cards.find((item) => item.referenceId === req.params.refId);
    if (!card) {
      continue;
    }

    res.json({ debitCard: card, environment: "sandbox" });
    return;
  }

  res.json({
    debitCard: {
      id: `dc_${req.params.refId}`,
      customerId: "unknown",
      cardNumber: "4111111111111111",
      lastFour: "1111",
      referenceId: req.params.refId,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    environment: "sandbox",
  });
});

customersRouter.patch("/debitCards/updateStatusByCardNumber", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as { card_number?: string; status?: string };
  if (!body.card_number || !body.status) {
    res.status(400).json({ code: "BAD_REQUEST", message: "card_number and status are required" });
    return;
  }

  const status =
    body.status === "active" || body.status === "frozen" || body.status === "inactive"
      ? body.status
      : undefined;
  if (!status) {
    res.status(400).json({ code: "BAD_REQUEST", message: "Invalid status" });
    return;
  }

  const tenantCards = getTenantScopedMap(debitCardsByTenant, req.tenantId!);
  for (const cards of tenantCards.values()) {
    const card = cards.find((item) => item.cardNumber === body.card_number);
    if (!card) {
      continue;
    }

    card.status = status;
    card.updatedAt = new Date().toISOString();
    res.json({ debitCard: card, environment: "sandbox" });
    return;
  }

  res.status(404).json({ code: "NOT_FOUND", message: "Debit card not found" });
});

customersRouter.patch("/debitCards/updatePinOffset", (_req: Request, res: Response) => {
  res.json({ success: true, environment: "sandbox" });
});

customersRouter.patch("/debitCards/updatePinOffsetByCardNumber", (_req: Request, res: Response) => {
  res.json({ success: true, environment: "sandbox" });
});

/* ── Account Instructions ── */
customersRouter.get(
  "/customers/:customerId/accounts/:accountId/accountInstructions",
  (req: Request, res: Response) => {
    const account = getTenantAccountById(req.tenantId!, req.params.accountId);
    if (!account) {
      res.status(404).json({ code: "NOT_FOUND", message: "Account not found" });
      return;
    }

    const instructions = getAccountMetadataCollection(account, "accountInstructions");
    res.json({
      responseStatus: { success: true, errors: [], recordCount: instructions.length },
      accountInstructions: instructions,
      environment: "sandbox",
    });
  }
);
