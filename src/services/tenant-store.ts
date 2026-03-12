import { v4 as uuidv4 } from "uuid";
import {
  mockAccounts,
  mockCustomers,
  mockTransactions,
  mockTransfers,
} from "./mock-data.js";
import type { Account, Customer, Transaction, Transfer } from "../types/index.js";
import { durableStore } from "./durable-store.js";
import type {
  CustomerRow,
  AccountRow,
  TransactionRow,
  TransferRow,
  YieldConfigRow,
  LoanPaymentRow,
  UserDefinedFieldRow,
  DocumentRow,
} from "./durable-store.js";

type JsonObject = Record<string, unknown>;

export interface LoanPaymentRecord {
  id: string;
  accountId: string;
  amount: number;
  frequency: string;
  status: string;
  nextPaymentDate?: string;
  updatedAt: string;
}

export interface UserDefinedFieldRecord {
  id: string;
  key: string;
  value: string;
  category?: string;
  updatedAt: string;
  metadata?: JsonObject;
}

export interface DocumentRecord {
  id: string;
  title: string;
  status: string;
  type?: string;
  createdAt: string;
  updatedAt: string;
  payload: JsonObject;
}

export interface YieldConfig {
  accountId: string;
  apy: number;
  enabled: boolean;
  accruedInterestTotal: number;
  lastAccrualDate?: string;
  updatedAt: string;
}

interface TenantDataset {
  accounts: Account[];
  customers: Customer[];
  transactions: Transaction[];
  transfers: Transfer[];
  yieldConfigs: Map<string, YieldConfig>;
  loanPaymentsByAccount: Map<string, LoanPaymentRecord[]>;
  customerUserDefinedFields: Map<string, UserDefinedFieldRecord[]>;
  accountUserDefinedFields: Map<string, UserDefinedFieldRecord[]>;
  customerDocuments: Map<string, DocumentRecord[]>;
  accountDocuments: Map<string, DocumentRecord[]>;
}

// PersistedTenantDataset interface removed — replaced by relational entity tables

const datasets = new Map<string, TenantDataset>();

function nowIso(): string {
  return new Date().toISOString();
}

function toDateOnly(value?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function baselineAccountById(accountId: string): Account | undefined {
  return mockAccounts.find((account) => account.id === accountId);
}

function cloneDataset(): TenantDataset {
  return {
    accounts: structuredClone(mockAccounts),
    customers: structuredClone(mockCustomers),
    transactions: structuredClone(mockTransactions),
    transfers: structuredClone(mockTransfers),
    yieldConfigs: new Map(),
    loanPaymentsByAccount: new Map(),
    customerUserDefinedFields: new Map(),
    accountUserDefinedFields: new Map(),
    customerDocuments: new Map(),
    accountDocuments: new Map(),
  };
}

function scopedAccountKey(customerId: string, accountId: string): string {
  return `${customerId}:${accountId}`;
}

function toObject(value: unknown): JsonObject | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as JsonObject;
}

function toStringValue(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
}

function toNumberValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function getLoanPaymentCollection(dataset: TenantDataset, accountId: string): LoanPaymentRecord[] {
  let records = dataset.loanPaymentsByAccount.get(accountId);
  if (!records) {
    records = [
      {
        id: `lp_${uuidv4().slice(0, 8)}`,
        accountId,
        amount: 100,
        frequency: "monthly",
        status: "active",
        nextPaymentDate: toDateOnly(nowIso()),
        updatedAt: nowIso(),
      },
    ];
    dataset.loanPaymentsByAccount.set(accountId, records);
  }

  return records;
}

function normalizeUserDefinedField(input: JsonObject, fallbackId?: string): UserDefinedFieldRecord {
  const now = nowIso();

  const id = toStringValue(input.id ?? input.fieldId ?? input.field_id, fallbackId ?? `udf_${uuidv4().slice(0, 8)}`);
  const key = toStringValue(input.key ?? input.name, "field");
  const value = toStringValue(input.value, "");
  const categoryValue = input.category ?? input.scope;
  const category = typeof categoryValue === "string" && categoryValue.trim().length > 0 ? categoryValue : undefined;

  return {
    id,
    key,
    value,
    category,
    updatedAt: now,
    metadata: toObject(input.metadata),
  };
}

function getUserDefinedFieldCollection(
  map: Map<string, UserDefinedFieldRecord[]>,
  scopedKey: string
): UserDefinedFieldRecord[] {
  let records = map.get(scopedKey);
  if (!records) {
    records = [];
    map.set(scopedKey, records);
  }

  return records;
}

function upsertUserDefinedFields(
  map: Map<string, UserDefinedFieldRecord[]>,
  scopedKey: string,
  fields: JsonObject[]
): UserDefinedFieldRecord[] {
  const collection = getUserDefinedFieldCollection(map, scopedKey);

  for (const field of fields) {
    const normalized = normalizeUserDefinedField(field);
    const index = collection.findIndex((item) => item.id === normalized.id);
    if (index >= 0) {
      collection[index] = {
        ...collection[index],
        ...normalized,
      };
      continue;
    }

    collection.push(normalized);
  }

  return [...collection];
}

function getDocumentCollection(
  map: Map<string, DocumentRecord[]>,
  scopedKey: string
): DocumentRecord[] {
  let collection = map.get(scopedKey);
  if (!collection) {
    collection = [];
    map.set(scopedKey, collection);
  }

  return collection;
}

function normalizeDocument(input: JsonObject, fallbackId?: string): DocumentRecord {
  const now = nowIso();
  const id = toStringValue(
    input.documentRootId ?? input.document_root_id ?? input.id,
    fallbackId ?? `doc_${uuidv4().slice(0, 8)}`
  );

  return {
    id,
    title: toStringValue(input.title ?? input.name, `Document ${id}`),
    status: toStringValue(input.status, "active"),
    type: typeof input.type === "string" ? input.type : undefined,
    createdAt: now,
    updatedAt: now,
    payload: {
      ...input,
      documentRootId: id,
    },
  };
}

function createDocument(
  map: Map<string, DocumentRecord[]>,
  scopedKey: string,
  input: JsonObject
): DocumentRecord {
  const collection = getDocumentCollection(map, scopedKey);
  const normalized = normalizeDocument(input);
  const existingIndex = collection.findIndex((item) => item.id === normalized.id);

  if (existingIndex >= 0) {
    const existing = collection[existingIndex];
    const updated: DocumentRecord = {
      ...existing,
      ...normalized,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
      payload: {
        ...existing.payload,
        ...normalized.payload,
      },
    };
    collection[existingIndex] = updated;
    return updated;
  }

  collection.push(normalized);
  return normalized;
}

function updateDocument(
  map: Map<string, DocumentRecord[]>,
  scopedKey: string,
  documentId: string,
  patch: JsonObject
): DocumentRecord | undefined {
  const collection = getDocumentCollection(map, scopedKey);
  const index = collection.findIndex((item) => item.id === documentId);
  if (index < 0) {
    return undefined;
  }

  const current = collection[index];
  const updated: DocumentRecord = {
    ...current,
    title: toStringValue(patch.title ?? current.title, current.title),
    status: toStringValue(patch.status ?? current.status, current.status),
    type: typeof patch.type === "string" ? patch.type : current.type,
    updatedAt: nowIso(),
    payload: {
      ...current.payload,
      ...patch,
      documentRootId: documentId,
    },
  };

  collection[index] = updated;
  return updated;
}

/* -------------------------------------------------------------------------- */
/*  Relational persistence helpers — convert domain ↔ DB rows                */
/* -------------------------------------------------------------------------- */

function toCents(value: number): number {
  return Math.round(value * 100);
}

function fromCents(value: number): number {
  return Number((value / 100).toFixed(2));
}

function customerToRow(tenantId: string, c: Customer): CustomerRow {
  return {
    id: c.id,
    tenant_id: tenantId,
    external_id: c.externalId ?? null,
    first_name: c.firstName,
    last_name: c.lastName,
    email: c.email,
    status: c.status,
    kyc_status: c.kycStatus ?? null,
    created_at: c.createdAt,
    metadata: c.metadata ? JSON.stringify(c.metadata) : null,
  };
}

function rowToCustomer(r: CustomerRow): Customer {
  return {
    id: r.id,
    externalId: r.external_id ?? undefined,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    status: r.status as Customer["status"],
    createdAt: r.created_at,
    kycStatus: (r.kyc_status as Customer["kycStatus"]) ?? undefined,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  };
}

function accountToRow(tenantId: string, a: Account): AccountRow {
  return {
    id: a.id,
    tenant_id: tenantId,
    customer_id: a.customerId,
    type: a.type,
    status: a.status,
    currency: a.currency,
    balance_cents: toCents(a.balance),
    available_balance_cents: toCents(a.availableBalance),
    last_four: a.lastFour ?? null,
    opened_at: a.openedAt,
    metadata: a.metadata ? JSON.stringify(a.metadata) : null,
  };
}

function rowToAccount(r: AccountRow): Account {
  return {
    id: r.id,
    customerId: r.customer_id,
    type: r.type as Account["type"],
    status: r.status as Account["status"],
    currency: r.currency,
    balance: fromCents(r.balance_cents),
    availableBalance: fromCents(r.available_balance_cents),
    lastFour: r.last_four ?? "",
    openedAt: r.opened_at,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  };
}

function transactionToRow(tenantId: string, t: Transaction): TransactionRow {
  return {
    id: t.id,
    tenant_id: tenantId,
    account_id: t.accountId,
    type: t.type,
    amount_cents: toCents(t.amount),
    currency: t.currency,
    status: t.status,
    description: t.description ?? null,
    counterparty: t.counterparty ?? null,
    posted_at: t.postedAt,
    reference_id: t.referenceId ?? null,
    metadata: t.metadata ? JSON.stringify(t.metadata) : null,
  };
}

function rowToTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    accountId: r.account_id,
    type: r.type as Transaction["type"],
    amount: fromCents(r.amount_cents),
    currency: r.currency,
    status: r.status as Transaction["status"],
    description: r.description ?? "",
    counterparty: r.counterparty ?? undefined,
    postedAt: r.posted_at,
    referenceId: r.reference_id ?? undefined,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  };
}

function transferToRow(tenantId: string, x: Transfer): TransferRow {
  return {
    id: x.id,
    tenant_id: tenantId,
    type: x.type,
    status: x.status,
    amount_cents: toCents(x.amount),
    currency: x.currency,
    from_account_id: x.fromAccountId,
    to_account_id: x.toAccountId ?? null,
    to_external: x.toExternal ? JSON.stringify(x.toExternal) : null,
    description: x.description ?? null,
    created_at: x.createdAt,
    completed_at: x.completedAt ?? null,
    reference_id: x.referenceId ?? null,
  };
}

function rowToTransfer(r: TransferRow): Transfer {
  return {
    id: r.id,
    type: r.type as Transfer["type"],
    status: r.status as Transfer["status"],
    amount: fromCents(r.amount_cents),
    currency: r.currency,
    fromAccountId: r.from_account_id,
    toAccountId: r.to_account_id ?? undefined,
    toExternal: r.to_external ? JSON.parse(r.to_external) : undefined,
    description: r.description ?? undefined,
    createdAt: r.created_at,
    completedAt: r.completed_at ?? undefined,
    referenceId: r.reference_id ?? undefined,
  };
}

function yieldConfigToRow(tenantId: string, y: YieldConfig): YieldConfigRow {
  return {
    account_id: y.accountId,
    tenant_id: tenantId,
    apy: y.apy,
    enabled: y.enabled ? 1 : 0,
    accrued_interest_total_cents: toCents(y.accruedInterestTotal),
    last_accrual_date: y.lastAccrualDate ?? null,
    updated_at: y.updatedAt,
  };
}

function rowToYieldConfig(r: YieldConfigRow): YieldConfig {
  return {
    accountId: r.account_id,
    apy: r.apy,
    enabled: r.enabled === 1,
    accruedInterestTotal: fromCents(r.accrued_interest_total_cents),
    lastAccrualDate: r.last_accrual_date ?? undefined,
    updatedAt: r.updated_at,
  };
}

function loanPaymentToRow(tenantId: string, lp: LoanPaymentRecord): LoanPaymentRow {
  return {
    id: lp.id,
    tenant_id: tenantId,
    account_id: lp.accountId,
    amount_cents: toCents(lp.amount),
    frequency: lp.frequency,
    status: lp.status,
    next_payment_date: lp.nextPaymentDate ?? null,
    updated_at: lp.updatedAt,
  };
}

function rowToLoanPayment(r: LoanPaymentRow): LoanPaymentRecord {
  return {
    id: r.id,
    accountId: r.account_id,
    amount: fromCents(r.amount_cents),
    frequency: r.frequency,
    status: r.status,
    nextPaymentDate: r.next_payment_date ?? undefined,
    updatedAt: r.updated_at,
  };
}

function udfToRow(tenantId: string, scopeType: string, scopeKey: string, udf: UserDefinedFieldRecord): UserDefinedFieldRow {
  return {
    id: udf.id,
    tenant_id: tenantId,
    scope_type: scopeType,
    scope_key: scopeKey,
    field_key: udf.key,
    value: udf.value,
    category: udf.category ?? null,
    updated_at: udf.updatedAt,
    metadata: udf.metadata ? JSON.stringify(udf.metadata) : null,
  };
}

function rowToUdf(r: UserDefinedFieldRow): UserDefinedFieldRecord {
  return {
    id: r.id,
    key: r.field_key,
    value: r.value,
    category: r.category ?? undefined,
    updatedAt: r.updated_at,
    metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
  };
}

function documentToRow(tenantId: string, scopeType: string, scopeKey: string, doc: DocumentRecord): DocumentRow {
  return {
    id: doc.id,
    tenant_id: tenantId,
    scope_type: scopeType,
    scope_key: scopeKey,
    title: doc.title,
    status: doc.status,
    type: doc.type ?? null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    payload: JSON.stringify(doc.payload),
  };
}

function rowToDocument(r: DocumentRow): DocumentRecord {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    type: r.type ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    payload: r.payload ? JSON.parse(r.payload) : {},
  };
}

/* -------------------------------------------------------------------------- */
/*  Flush / load using relational entity tables                               */
/* -------------------------------------------------------------------------- */

function saveTenantDataset(tenantId: string, dataset: TenantDataset): void {
  // Collect all UDF rows
  const udfRows: UserDefinedFieldRow[] = [];
  for (const [scopeKey, records] of dataset.customerUserDefinedFields.entries()) {
    for (const r of records) udfRows.push(udfToRow(tenantId, "customer", scopeKey, r));
  }
  for (const [scopeKey, records] of dataset.accountUserDefinedFields.entries()) {
    for (const r of records) udfRows.push(udfToRow(tenantId, "account", scopeKey, r));
  }

  // Collect all document rows
  const docRows: DocumentRow[] = [];
  for (const [scopeKey, records] of dataset.customerDocuments.entries()) {
    for (const r of records) docRows.push(documentToRow(tenantId, "customer", scopeKey, r));
  }
  for (const [scopeKey, records] of dataset.accountDocuments.entries()) {
    for (const r of records) docRows.push(documentToRow(tenantId, "account", scopeKey, r));
  }

  // Collect all loan payment rows
  const lpRows: LoanPaymentRow[] = [];
  for (const [, records] of dataset.loanPaymentsByAccount.entries()) {
    for (const r of records) lpRows.push(loanPaymentToRow(tenantId, r));
  }

  durableStore.saveTenantEntities(tenantId, {
    customers: dataset.customers.map((c) => customerToRow(tenantId, c)),
    accounts: dataset.accounts.map((a) => accountToRow(tenantId, a)),
    transactions: dataset.transactions.map((t) => transactionToRow(tenantId, t)),
    transfers: dataset.transfers.map((x) => transferToRow(tenantId, x)),
    yieldConfigs: [...dataset.yieldConfigs.values()].map((y) => yieldConfigToRow(tenantId, y)),
    loanPayments: lpRows,
    userDefinedFields: udfRows,
    documents: docRows,
  });
}

function loadTenantDatasetFromDb(tenantId: string): TenantDataset | null {
  const loaded = durableStore.loadTenantEntities(tenantId);
  if (!loaded) return null;

  const yieldConfigs = new Map<string, YieldConfig>();
  for (const r of loaded.yieldConfigs) {
    yieldConfigs.set(r.account_id, rowToYieldConfig(r));
  }

  const loanPaymentsByAccount = new Map<string, LoanPaymentRecord[]>();
  for (const r of loaded.loanPayments) {
    const list = loanPaymentsByAccount.get(r.account_id) ?? [];
    list.push(rowToLoanPayment(r));
    loanPaymentsByAccount.set(r.account_id, list);
  }

  const customerUserDefinedFields = new Map<string, UserDefinedFieldRecord[]>();
  const accountUserDefinedFields = new Map<string, UserDefinedFieldRecord[]>();
  for (const r of loaded.userDefinedFields) {
    const map = r.scope_type === "customer" ? customerUserDefinedFields : accountUserDefinedFields;
    const list = map.get(r.scope_key) ?? [];
    list.push(rowToUdf(r));
    map.set(r.scope_key, list);
  }

  const customerDocuments = new Map<string, DocumentRecord[]>();
  const accountDocuments = new Map<string, DocumentRecord[]>();
  for (const r of loaded.documents) {
    const map = r.scope_type === "customer" ? customerDocuments : accountDocuments;
    const list = map.get(r.scope_key) ?? [];
    list.push(rowToDocument(r));
    map.set(r.scope_key, list);
  }

  return {
    accounts: loaded.accounts.map(rowToAccount),
    customers: loaded.customers.map(rowToCustomer),
    transactions: loaded.transactions.map(rowToTransaction),
    transfers: loaded.transfers.map(rowToTransfer),
    yieldConfigs,
    loanPaymentsByAccount,
    customerUserDefinedFields,
    accountUserDefinedFields,
    customerDocuments,
    accountDocuments,
  };
}

function ensureTenantDataset(tenantId: string): TenantDataset {
  let dataset = datasets.get(tenantId);
  if (!dataset) {
    // Try loading from relational entity tables
    const fromDb = loadTenantDatasetFromDb(tenantId);
    if (fromDb) {
      dataset = fromDb;
    } else {
      // Fall back to legacy blob (migration path), then to baseline clone
      const persisted = durableStore.getTenantDatasetPayload(tenantId);
      if (persisted) {
        try {
          const parsed = JSON.parse(persisted) as Record<string, unknown>;
          dataset = {
            accounts: Array.isArray(parsed.accounts) ? (parsed.accounts as Account[]) : [],
            customers: Array.isArray(parsed.customers) ? (parsed.customers as Customer[]) : [],
            transactions: Array.isArray(parsed.transactions) ? (parsed.transactions as Transaction[]) : [],
            transfers: Array.isArray(parsed.transfers) ? (parsed.transfers as Transfer[]) : [],
            yieldConfigs: new Map(Array.isArray(parsed.yieldConfigs) ? (parsed.yieldConfigs as Array<[string, YieldConfig]>) : []),
            loanPaymentsByAccount: new Map(Array.isArray(parsed.loanPaymentsByAccount) ? (parsed.loanPaymentsByAccount as Array<[string, LoanPaymentRecord[]]>) : []),
            customerUserDefinedFields: new Map(Array.isArray(parsed.customerUserDefinedFields) ? (parsed.customerUserDefinedFields as Array<[string, UserDefinedFieldRecord[]]>) : []),
            accountUserDefinedFields: new Map(Array.isArray(parsed.accountUserDefinedFields) ? (parsed.accountUserDefinedFields as Array<[string, UserDefinedFieldRecord[]]>) : []),
            customerDocuments: new Map(Array.isArray(parsed.customerDocuments) ? (parsed.customerDocuments as Array<[string, DocumentRecord[]]>) : []),
            accountDocuments: new Map(Array.isArray(parsed.accountDocuments) ? (parsed.accountDocuments as Array<[string, DocumentRecord[]]>) : []),
          };
          // Migrate: save to entity tables
          saveTenantDataset(tenantId, dataset);
        } catch {
          dataset = cloneDataset();
          saveTenantDataset(tenantId, dataset);
        }
      } else {
        dataset = cloneDataset();
        saveTenantDataset(tenantId, dataset);
      }
    }

    datasets.set(tenantId, dataset);
  }
  return dataset;
}

export function flushTenantStore(): void {
  for (const [tenantId, dataset] of datasets.entries()) {
    saveTenantDataset(tenantId, dataset);
  }
}

export function resetTenantStoreRuntimeCacheForTests(): void {
  datasets.clear();
}

export function listTenantAccounts(tenantId: string, customerId?: string): Account[] {
  const dataset = ensureTenantDataset(tenantId);
  if (!customerId) {
    return [...dataset.accounts];
  }
  return dataset.accounts.filter((account) => account.customerId === customerId);
}

export function getTenantAccountById(tenantId: string, accountId: string): Account | undefined {
  const dataset = ensureTenantDataset(tenantId);
  return dataset.accounts.find((account) => account.id === accountId);
}

export function listTenantCustomers(tenantId: string): Customer[] {
  const dataset = ensureTenantDataset(tenantId);
  return [...dataset.customers];
}

export function createTenantCustomer(params: {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  externalId?: string;
}): Customer | null {
  const dataset = ensureTenantDataset(params.tenantId);
  const normalizedEmail = params.email.trim().toLowerCase();

  const duplicate = dataset.customers.some(
    (customer) => customer.email.trim().toLowerCase() === normalizedEmail
  );
  if (duplicate) {
    return null;
  }

  const customer: Customer = {
    id: `cust_tenant_${uuidv4().slice(0, 8)}`,
    externalId: params.externalId,
    firstName: params.firstName,
    lastName: params.lastName,
    email: normalizedEmail,
    status: "active",
    createdAt: nowIso(),
    kycStatus: "pending",
  };

  dataset.customers.push(customer);
  return customer;
}

export function getTenantCustomerById(tenantId: string, customerId: string): Customer | undefined {
  const dataset = ensureTenantDataset(tenantId);
  return dataset.customers.find((customer) => customer.id === customerId);
}

export function updateTenantCustomer(params: {
  tenantId: string;
  customerId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  externalId?: string;
  status?: Customer["status"];
  kycStatus?: Customer["kycStatus"];
}): { customer?: Customer; error?: "NOT_FOUND" | "EMAIL_ALREADY_EXISTS" } {
  const dataset = ensureTenantDataset(params.tenantId);
  const customer = dataset.customers.find((item) => item.id === params.customerId);
  if (!customer) {
    return { error: "NOT_FOUND" };
  }

  if (params.email) {
    const normalizedEmail = params.email.trim().toLowerCase();
    const duplicate = dataset.customers.some(
      (item) =>
        item.id !== params.customerId && item.email.trim().toLowerCase() === normalizedEmail
    );
    if (duplicate) {
      return { error: "EMAIL_ALREADY_EXISTS" };
    }
    customer.email = normalizedEmail;
  }

  if (params.firstName) {
    customer.firstName = params.firstName;
  }

  if (params.lastName) {
    customer.lastName = params.lastName;
  }

  if (params.externalId !== undefined) {
    customer.externalId = params.externalId;
  }

  if (params.status) {
    customer.status = params.status;
  }

  if (params.kycStatus) {
    customer.kycStatus = params.kycStatus;
  }

  return { customer };
}

export function createTenantAccount(params: {
  tenantId: string;
  customerId: string;
  type: "checking" | "savings" | "money_market";
  currency?: string;
  initialBalance?: number;
}): Account | null {
  const dataset = ensureTenantDataset(params.tenantId);
  const customerExists = dataset.customers.some((customer) => customer.id === params.customerId);
  if (!customerExists) {
    return null;
  }

  const openingBalance = roundMoney(Math.max(0, params.initialBalance ?? 0));
  const account: Account = {
    id: `acct_tenant_${uuidv4().slice(0, 8)}`,
    customerId: params.customerId,
    type: params.type,
    status: "active",
    currency: params.currency ?? "USD",
    balance: openingBalance,
    availableBalance: openingBalance,
    lastFour: uuidv4().replace(/-/g, "").slice(0, 4),
    openedAt: nowIso(),
  };

  dataset.accounts.push(account);

  if (openingBalance > 0) {
    dataset.transactions.push({
      id: `txn_sand_${uuidv4().slice(0, 8)}`,
      accountId: account.id,
      type: "credit",
      amount: openingBalance,
      currency: account.currency,
      status: "posted",
      description: "Opening balance",
      postedAt: nowIso(),
      referenceId: `opening_${account.id}`,
    });
  }

  return account;
}

export function listTenantTransactionsByAccountId(
  tenantId: string,
  accountId: string
): Transaction[] {
  const dataset = ensureTenantDataset(tenantId);
  return dataset.transactions.filter((transaction) => transaction.accountId === accountId);
}

export function getTenantTransactionById(
  tenantId: string,
  transactionId: string
): Transaction | undefined {
  const dataset = ensureTenantDataset(tenantId);
  return dataset.transactions.find((transaction) => transaction.id === transactionId);
}

export function listTenantTransfersByAccountId(tenantId: string, accountId: string): Transfer[] {
  const dataset = ensureTenantDataset(tenantId);
  return dataset.transfers.filter(
    (transfer) => transfer.fromAccountId === accountId || transfer.toAccountId === accountId
  );
}

export function getTenantTransferById(tenantId: string, transferId: string): Transfer | undefined {
  const dataset = ensureTenantDataset(tenantId);
  return dataset.transfers.find((transfer) => transfer.id === transferId);
}

export function updateTenantAccount(params: {
  tenantId: string;
  accountId: string;
  status?: Account["status"];
  type?: Account["type"];
  metadata?: Record<string, unknown>;
}): Account | undefined {
  const dataset = ensureTenantDataset(params.tenantId);
  const account = dataset.accounts.find((item) => item.id === params.accountId);
  if (!account) {
    return undefined;
  }

  if (params.status) {
    account.status = params.status;
  }

  if (params.type) {
    account.type = params.type;
  }

  if (params.metadata) {
    account.metadata = {
      ...(account.metadata ?? {}),
      ...params.metadata,
    };
  }

  return account;
}

export function updateTenantTransfer(params: {
  tenantId: string;
  transferId: string;
  status?: Transfer["status"];
  description?: string;
}): Transfer | undefined {
  const dataset = ensureTenantDataset(params.tenantId);
  const transfer = dataset.transfers.find((item) => item.id === params.transferId);
  if (!transfer) {
    return undefined;
  }

  if (params.status) {
    transfer.status = params.status;
    if (params.status === "completed") {
      transfer.completedAt = nowIso();
    }
  }

  if (params.description !== undefined) {
    transfer.description = params.description;
  }

  return transfer;
}

export function deleteTenantTransfer(tenantId: string, transferId: string): boolean {
  const dataset = ensureTenantDataset(tenantId);
  const index = dataset.transfers.findIndex((item) => item.id === transferId);
  if (index < 0) {
    return false;
  }

  dataset.transfers.splice(index, 1);
  return true;
}

export function listTenantTransfersByCustomerId(tenantId: string, customerId: string): Transfer[] {
  const dataset = ensureTenantDataset(tenantId);
  const customerAccountIds = new Set(
    dataset.accounts
      .filter((account) => account.customerId === customerId)
      .map((account) => account.id)
  );

  return dataset.transfers.filter(
    (transfer) =>
      customerAccountIds.has(transfer.fromAccountId) ||
      (transfer.toAccountId ? customerAccountIds.has(transfer.toAccountId) : false)
  );
}

export function listTenantLoanPayments(tenantId: string, accountId: string): LoanPaymentRecord[] {
  const dataset = ensureTenantDataset(tenantId);
  return [...getLoanPaymentCollection(dataset, accountId)];
}

export function upsertTenantLoanPayment(
  tenantId: string,
  accountId: string,
  input: JsonObject
): LoanPaymentRecord {
  const dataset = ensureTenantDataset(tenantId);
  const collection = getLoanPaymentCollection(dataset, accountId);
  const id = toStringValue(input.id ?? input.paymentId ?? input.payment_id, `lp_${uuidv4().slice(0, 8)}`);
  const index = collection.findIndex((item) => item.id === id);

  const current =
    index >= 0
      ? collection[index]
      : {
          id,
          accountId,
          amount: 0,
          frequency: "monthly",
          status: "active",
          updatedAt: nowIso(),
        };

  const next: LoanPaymentRecord = {
    ...current,
    id,
    accountId,
    amount: roundMoney(Math.max(0, toNumberValue(input.amount, current.amount))),
    frequency: toStringValue(input.frequency, current.frequency),
    status: toStringValue(input.status, current.status),
    nextPaymentDate:
      typeof input.nextPaymentDate === "string"
        ? toDateOnly(input.nextPaymentDate)
        : typeof input.next_payment_date === "string"
          ? toDateOnly(input.next_payment_date)
          : current.nextPaymentDate,
    updatedAt: nowIso(),
  };

  if (index >= 0) {
    collection[index] = next;
  } else {
    collection.push(next);
  }

  return next;
}

export function deleteTenantLoanPayment(
  tenantId: string,
  accountId: string,
  paymentId: string
): boolean {
  const dataset = ensureTenantDataset(tenantId);
  const collection = getLoanPaymentCollection(dataset, accountId);
  const index = collection.findIndex((item) => item.id === paymentId);
  if (index < 0) {
    return false;
  }

  collection.splice(index, 1);
  return true;
}

export function listTenantCustomerUserDefinedFields(
  tenantId: string,
  customerId: string
): UserDefinedFieldRecord[] {
  const dataset = ensureTenantDataset(tenantId);
  return [...getUserDefinedFieldCollection(dataset.customerUserDefinedFields, customerId)];
}

export function upsertTenantCustomerUserDefinedFields(
  tenantId: string,
  customerId: string,
  fields: JsonObject[]
): UserDefinedFieldRecord[] {
  const dataset = ensureTenantDataset(tenantId);
  return upsertUserDefinedFields(dataset.customerUserDefinedFields, customerId, fields);
}

export function listTenantAccountUserDefinedFields(
  tenantId: string,
  customerId: string,
  accountId: string
): UserDefinedFieldRecord[] {
  const dataset = ensureTenantDataset(tenantId);
  const key = scopedAccountKey(customerId, accountId);
  return [...getUserDefinedFieldCollection(dataset.accountUserDefinedFields, key)];
}

export function upsertTenantAccountUserDefinedFields(
  tenantId: string,
  customerId: string,
  accountId: string,
  fields: JsonObject[]
): UserDefinedFieldRecord[] {
  const dataset = ensureTenantDataset(tenantId);
  const key = scopedAccountKey(customerId, accountId);
  return upsertUserDefinedFields(dataset.accountUserDefinedFields, key, fields);
}

export function deleteTenantAccountUserDefinedField(
  tenantId: string,
  customerId: string,
  accountId: string,
  fieldId: string
): boolean {
  const dataset = ensureTenantDataset(tenantId);
  const key = scopedAccountKey(customerId, accountId);
  const collection = getUserDefinedFieldCollection(dataset.accountUserDefinedFields, key);
  const index = collection.findIndex((item) => item.id === fieldId);
  if (index < 0) {
    return false;
  }

  collection.splice(index, 1);
  return true;
}

export function createTenantCustomerDocument(
  tenantId: string,
  customerId: string,
  input: JsonObject
): DocumentRecord {
  const dataset = ensureTenantDataset(tenantId);
  return createDocument(dataset.customerDocuments, customerId, input);
}

export function getTenantCustomerDocument(
  tenantId: string,
  customerId: string,
  documentId: string
): DocumentRecord | undefined {
  const dataset = ensureTenantDataset(tenantId);
  const collection = getDocumentCollection(dataset.customerDocuments, customerId);
  return collection.find((item) => item.id === documentId);
}

export function updateTenantCustomerDocument(
  tenantId: string,
  customerId: string,
  documentId: string,
  patch: JsonObject
): DocumentRecord | undefined {
  const dataset = ensureTenantDataset(tenantId);
  return updateDocument(dataset.customerDocuments, customerId, documentId, patch);
}

export function deleteTenantCustomerDocument(
  tenantId: string,
  customerId: string,
  documentId: string
): boolean {
  const dataset = ensureTenantDataset(tenantId);
  const collection = getDocumentCollection(dataset.customerDocuments, customerId);
  const index = collection.findIndex((item) => item.id === documentId);
  if (index < 0) {
    return false;
  }

  collection.splice(index, 1);
  return true;
}

export function createTenantAccountDocument(
  tenantId: string,
  customerId: string,
  accountId: string,
  input: JsonObject
): DocumentRecord {
  const dataset = ensureTenantDataset(tenantId);
  const key = scopedAccountKey(customerId, accountId);
  return createDocument(dataset.accountDocuments, key, input);
}

export function listTenantAccountDocuments(
  tenantId: string,
  customerId: string,
  accountId: string
): DocumentRecord[] {
  const dataset = ensureTenantDataset(tenantId);
  const key = scopedAccountKey(customerId, accountId);
  return [...getDocumentCollection(dataset.accountDocuments, key)];
}

export function getTenantAccountDocument(
  tenantId: string,
  customerId: string,
  accountId: string,
  documentId: string
): DocumentRecord | undefined {
  const dataset = ensureTenantDataset(tenantId);
  const key = scopedAccountKey(customerId, accountId);
  const collection = getDocumentCollection(dataset.accountDocuments, key);
  return collection.find((item) => item.id === documentId);
}

export function updateTenantAccountDocument(
  tenantId: string,
  customerId: string,
  accountId: string,
  documentId: string,
  patch: JsonObject
): DocumentRecord | undefined {
  const dataset = ensureTenantDataset(tenantId);
  const key = scopedAccountKey(customerId, accountId);
  return updateDocument(dataset.accountDocuments, key, documentId, patch);
}

export function deleteTenantAccountDocument(
  tenantId: string,
  customerId: string,
  accountId: string,
  documentId: string
): boolean {
  const dataset = ensureTenantDataset(tenantId);
  const key = scopedAccountKey(customerId, accountId);
  const collection = getDocumentCollection(dataset.accountDocuments, key);
  const index = collection.findIndex((item) => item.id === documentId);
  if (index < 0) {
    return false;
  }

  collection.splice(index, 1);
  return true;
}

export function createTenantTransfer(params: {
  tenantId: string;
  type: "ach" | "wire" | "internal" | "instant";
  amount: number;
  fromAccountId: string;
  toAccountId?: string;
  toExternal?: { routingNumber: string; accountNumber: string; name?: string };
  description?: string;
}): Transfer {
  const dataset = ensureTenantDataset(params.tenantId);
  const transferId = `trf_sand_${uuidv4().slice(0, 8)}`;
  const now = nowIso();

  const transfer: Transfer = {
    id: transferId,
    type: params.type,
    status: params.type === "internal" ? "completed" : "pending",
    amount: params.amount,
    currency: "USD",
    fromAccountId: params.fromAccountId,
    toAccountId: params.toAccountId,
    toExternal: params.toExternal,
    description: params.description,
    createdAt: now,
    completedAt: params.type === "internal" ? now : undefined,
    referenceId: `ref_${transferId}`,
  };

  dataset.transfers.push(transfer);

  const fromAccount = dataset.accounts.find((account) => account.id === params.fromAccountId);
  if (fromAccount) {
    fromAccount.balance = roundMoney(fromAccount.balance - params.amount);
    fromAccount.availableBalance = roundMoney(fromAccount.availableBalance - params.amount);
  }

  if (params.toAccountId) {
    const toAccount = dataset.accounts.find((account) => account.id === params.toAccountId);
    if (toAccount) {
      toAccount.balance = roundMoney(toAccount.balance + params.amount);
      toAccount.availableBalance = roundMoney(toAccount.availableBalance + params.amount);
    }
  }

  const debitTxn: Transaction = {
    id: `txn_sand_${uuidv4().slice(0, 8)}`,
    accountId: params.fromAccountId,
    type: "debit",
    amount: -params.amount,
    currency: "USD",
    status: transfer.status === "completed" ? "posted" : "pending",
    description: params.description ?? `Transfer ${params.type}`,
    counterparty: params.toExternal?.name,
    postedAt: now,
    referenceId: transfer.referenceId,
  };
  dataset.transactions.push(debitTxn);

  if (params.toAccountId) {
    const creditTxn: Transaction = {
      id: `txn_sand_${uuidv4().slice(0, 8)}`,
      accountId: params.toAccountId,
      type: "credit",
      amount: params.amount,
      currency: "USD",
      status: transfer.status === "completed" ? "posted" : "pending",
      description: params.description ?? `Transfer ${params.type}`,
      postedAt: now,
      referenceId: transfer.referenceId,
    };
    dataset.transactions.push(creditTxn);
  }

  return transfer;
}

function removeAccountGeneratedData(dataset: TenantDataset, accountId: string): void {
  dataset.transactions = dataset.transactions.filter(
    (transaction) =>
      transaction.accountId !== accountId &&
      !(typeof transaction.referenceId === "string" && transaction.referenceId.includes(accountId))
  );

  dataset.transfers = dataset.transfers.filter(
    (transfer) => transfer.fromAccountId !== accountId && transfer.toAccountId !== accountId
  );
}

export function seedTenantAccountData(
  tenantId: string,
  accountId: string
): { account: Account; seededTransactions: Transaction[]; seededTransfers: Transfer[] } | null {
  const dataset = ensureTenantDataset(tenantId);
  const account = dataset.accounts.find((item) => item.id === accountId);
  if (!account) {
    return null;
  }

  removeAccountGeneratedData(dataset, accountId);
  const baseline = baselineAccountById(accountId);
  if (baseline) {
    account.balance = baseline.balance;
    account.availableBalance = baseline.availableBalance;
    account.status = baseline.status;
  }

  const now = nowIso();
  const seededTransactions: Transaction[] = [
    {
      id: `seed_txn_${accountId}_1`,
      accountId,
      type: "credit",
      amount: 2500,
      currency: "USD",
      status: "posted",
      description: "Seed Incoming ACH Payroll",
      postedAt: now,
      referenceId: `seed_ref_${accountId}_1`,
    },
    {
      id: `seed_txn_${accountId}_2`,
      accountId,
      type: "debit",
      amount: -125.55,
      currency: "USD",
      status: "posted",
      description: "Seed Utility ACH Debit",
      postedAt: now,
      referenceId: `seed_ref_${accountId}_2`,
    },
    {
      id: `seed_txn_${accountId}_3`,
      accountId,
      type: "debit",
      amount: -42.1,
      currency: "USD",
      status: "posted",
      description: "Seed Card Purchase",
      postedAt: now,
      referenceId: `seed_ref_${accountId}_3`,
    },
  ];

  const seededTransfers: Transfer[] = [
    {
      id: `seed_trf_${accountId}_1`,
      type: "ach",
      status: "completed",
      amount: 2500,
      currency: "USD",
      fromAccountId: `external_seed_${accountId}`,
      toAccountId: accountId,
      description: "Seed Incoming ACH Payroll",
      createdAt: now,
      completedAt: now,
      referenceId: `seed_ref_${accountId}_1`,
    },
  ];

  dataset.transactions.push(...seededTransactions);
  dataset.transfers.push(...seededTransfers);

  const netChange = seededTransactions
    .filter((transaction) => transaction.status === "posted")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  account.balance = roundMoney(account.balance + netChange);
  account.availableBalance = roundMoney(account.availableBalance + netChange);

  return {
    account,
    seededTransactions,
    seededTransfers,
  };
}

export function resetTenantAccountData(tenantId: string, accountId: string): Account | null {
  const dataset = ensureTenantDataset(tenantId);
  const account = dataset.accounts.find((item) => item.id === accountId);
  if (!account) {
    return null;
  }

  removeAccountGeneratedData(dataset, accountId);
  const baseline = baselineAccountById(accountId);
  if (baseline) {
    account.balance = baseline.balance;
    account.availableBalance = baseline.availableBalance;
    account.status = baseline.status;
    account.type = baseline.type;
  } else {
    account.balance = 0;
    account.availableBalance = 0;
  }

  dataset.yieldConfigs.delete(accountId);
  return account;
}

export function resetTenantDataset(tenantId: string): {
  customersCleared: number;
  accountsCleared: number;
  transactionsCleared: number;
  transfersCleared: number;
} {
  const dataset = ensureTenantDataset(tenantId);
  const result = {
    customersCleared: dataset.customers.length,
    accountsCleared: dataset.accounts.length,
    transactionsCleared: dataset.transactions.length,
    transfersCleared: dataset.transfers.length,
  };

  dataset.customers = [];
  dataset.accounts = [];
  dataset.transactions = [];
  dataset.transfers = [];
  dataset.yieldConfigs.clear();

  return result;
}

export function seedTenantDataset(tenantId: string): {
  customersSeeded: number;
  accountsSeeded: number;
  transactionsSeeded: number;
  transfersSeeded: number;
} {
  const seeded = cloneDataset();
  datasets.set(tenantId, seeded);

  return {
    customersSeeded: seeded.customers.length,
    accountsSeeded: seeded.accounts.length,
    transactionsSeeded: seeded.transactions.length,
    transfersSeeded: seeded.transfers.length,
  };
}

export function simulateIncomingRailTransfer(params: {
  tenantId: string;
  accountId: string;
  amount: number;
  rail: "ach" | "wire";
  description?: string;
  externalName?: string;
}): { transfer: Transfer; transaction: Transaction } | null {
  const dataset = ensureTenantDataset(params.tenantId);
  const account = dataset.accounts.find((item) => item.id === params.accountId);
  if (!account) {
    return null;
  }

  const now = nowIso();
  const transferId = `trf_sand_${uuidv4().slice(0, 8)}`;
  const referenceId = `ref_${transferId}`;

  const transfer: Transfer = {
    id: transferId,
    type: params.rail,
    status: "completed",
    amount: params.amount,
    currency: "USD",
    fromAccountId: `external_${params.rail}_${uuidv4().slice(0, 6)}`,
    toAccountId: params.accountId,
    description: params.description ?? `Incoming ${params.rail.toUpperCase()} transfer`,
    createdAt: now,
    completedAt: now,
    referenceId,
  };

  const transaction: Transaction = {
    id: `txn_sand_${uuidv4().slice(0, 8)}`,
    accountId: params.accountId,
    type: "credit",
    amount: params.amount,
    currency: "USD",
    status: "posted",
    description: transfer.description ?? "Incoming transfer",
    counterparty: params.externalName,
    postedAt: now,
    referenceId,
  };

  dataset.transfers.push(transfer);
  dataset.transactions.push(transaction);

  account.balance = roundMoney(account.balance + params.amount);
  account.availableBalance = roundMoney(account.availableBalance + params.amount);

  return { transfer, transaction };
}

export function simulateOutgoingAchTransfer(params: {
  tenantId: string;
  accountId: string;
  amount: number;
  routingNumber: string;
  accountNumber: string;
  recipientName?: string;
  description?: string;
}): { transfer: Transfer; transaction: Transaction } | null {
  const dataset = ensureTenantDataset(params.tenantId);
  const account = dataset.accounts.find((item) => item.id === params.accountId);
  if (!account) {
    return null;
  }

  const now = nowIso();
  const transferId = `trf_sand_${uuidv4().slice(0, 8)}`;
  const referenceId = `ref_${transferId}`;

  const transfer: Transfer = {
    id: transferId,
    type: "ach",
    status: "completed",
    amount: params.amount,
    currency: "USD",
    fromAccountId: params.accountId,
    toExternal: {
      routingNumber: params.routingNumber,
      accountNumber: params.accountNumber,
      name: params.recipientName,
    },
    description: params.description ?? "Outgoing ACH transfer",
    createdAt: now,
    completedAt: now,
    referenceId,
  };

  const transaction: Transaction = {
    id: `txn_sand_${uuidv4().slice(0, 8)}`,
    accountId: params.accountId,
    type: "debit",
    amount: -Math.abs(params.amount),
    currency: "USD",
    status: "posted",
    description: transfer.description ?? "Outgoing ACH transfer",
    counterparty: params.recipientName,
    postedAt: now,
    referenceId,
  };

  dataset.transfers.push(transfer);
  dataset.transactions.push(transaction);

  account.balance = roundMoney(account.balance - Math.abs(params.amount));
  account.availableBalance = roundMoney(account.availableBalance - Math.abs(params.amount));

  return { transfer, transaction };
}

export function simulateCardNetworkEvent(params: {
  tenantId: string;
  accountId: string;
  amount: number;
  eventType: "authorization" | "post" | "void" | "refund";
  referenceId?: string;
  description?: string;
}): { transaction: Transaction; relatedTransaction?: Transaction } | null {
  const dataset = ensureTenantDataset(params.tenantId);
  const account = dataset.accounts.find((item) => item.id === params.accountId);
  if (!account) {
    return null;
  }

  const now = nowIso();
  const baseReferenceId = params.referenceId ?? `card_ref_${uuidv4().slice(0, 8)}`;

  if (params.eventType === "authorization") {
    const transaction: Transaction = {
      id: `txn_sand_${uuidv4().slice(0, 8)}`,
      accountId: params.accountId,
      type: "hold",
      amount: -Math.abs(params.amount),
      currency: "USD",
      status: "pending",
      description: params.description ?? "Card authorization hold",
      postedAt: now,
      referenceId: baseReferenceId,
    };
    dataset.transactions.push(transaction);
    return { transaction };
  }

  if (params.eventType === "void") {
    const related = dataset.transactions
      .slice()
      .reverse()
      .find(
        (transaction) =>
          transaction.accountId === params.accountId &&
          transaction.referenceId === baseReferenceId &&
          transaction.type === "hold" &&
          transaction.status === "pending"
      );
    if (!related) {
      return null;
    }

    related.status = "reversed";

    const release: Transaction = {
      id: `txn_sand_${uuidv4().slice(0, 8)}`,
      accountId: params.accountId,
      type: "release",
      amount: Math.abs(related.amount),
      currency: "USD",
      status: "posted",
      description: params.description ?? "Card authorization void release",
      postedAt: now,
      referenceId: baseReferenceId,
    };

    dataset.transactions.push(release);
    return { transaction: release, relatedTransaction: related };
  }

  if (params.eventType === "refund") {
    const eligiblePost = dataset.transactions
      .slice()
      .reverse()
      .find(
        (transaction) =>
          transaction.accountId === params.accountId &&
          transaction.referenceId === baseReferenceId &&
          transaction.type === "debit" &&
          transaction.status === "posted"
      );
    if (!eligiblePost) {
      return null;
    }

    const refund: Transaction = {
      id: `txn_sand_${uuidv4().slice(0, 8)}`,
      accountId: params.accountId,
      type: "credit",
      amount: Math.min(Math.abs(params.amount), Math.abs(eligiblePost.amount)),
      currency: "USD",
      status: "posted",
      description: params.description ?? "Card refund",
      postedAt: now,
      referenceId: baseReferenceId,
    };

    dataset.transactions.push(refund);
    account.balance = roundMoney(account.balance + refund.amount);
    account.availableBalance = roundMoney(account.availableBalance + refund.amount);
    return { transaction: refund, relatedTransaction: eligiblePost };
  }

  if (params.referenceId) {
    const eligibleHold = dataset.transactions
      .slice()
      .reverse()
      .find(
        (transaction) =>
          transaction.accountId === params.accountId &&
          transaction.referenceId === baseReferenceId &&
          transaction.type === "hold" &&
          transaction.status === "pending"
      );

    if (!eligibleHold) {
      return null;
    }

    eligibleHold.status = "reversed";
  }

  const postTxn: Transaction = {
    id: `txn_sand_${uuidv4().slice(0, 8)}`,
    accountId: params.accountId,
    type: "debit",
    amount: -Math.abs(params.amount),
    currency: "USD",
    status: "posted",
    description: params.description ?? "Card post",
    postedAt: now,
    referenceId: baseReferenceId,
  };

  dataset.transactions.push(postTxn);
  account.balance = roundMoney(account.balance - Math.abs(params.amount));
  account.availableBalance = roundMoney(account.availableBalance - Math.abs(params.amount));
  return { transaction: postTxn };
}

export function upsertYieldConfig(params: {
  tenantId: string;
  accountId: string;
  apy: number;
  enabled: boolean;
}): YieldConfig | null {
  const dataset = ensureTenantDataset(params.tenantId);
  const account = dataset.accounts.find((item) => item.id === params.accountId);
  if (!account) {
    return null;
  }

  const existing = dataset.yieldConfigs.get(params.accountId);
  const next: YieldConfig = {
    accountId: params.accountId,
    apy: params.apy,
    enabled: params.enabled,
    accruedInterestTotal: existing?.accruedInterestTotal ?? 0,
    lastAccrualDate: existing?.lastAccrualDate,
    updatedAt: nowIso(),
  };

  dataset.yieldConfigs.set(params.accountId, next);
  return next;
}

export function getYieldConfig(tenantId: string, accountId: string): YieldConfig | null {
  const dataset = ensureTenantDataset(tenantId);
  return dataset.yieldConfigs.get(accountId) ?? null;
}

export function accrueDailyInterest(params: {
  tenantId: string;
  asOfDate?: string;
}): Array<{ accountId: string; interestAmount: number; transactionId: string }> {
  const dataset = ensureTenantDataset(params.tenantId);
  const asOfDate = toDateOnly(params.asOfDate);
  const results: Array<{ accountId: string; interestAmount: number; transactionId: string }> = [];

  for (const [accountId, config] of dataset.yieldConfigs.entries()) {
    if (!config.enabled || config.apy <= 0 || config.lastAccrualDate === asOfDate) {
      continue;
    }

    const account = dataset.accounts.find((item) => item.id === accountId);
    if (!account) {
      continue;
    }

    const dailyRate = config.apy / 100 / 365;
    const interestAmount = roundMoney(account.balance * dailyRate);

    config.lastAccrualDate = asOfDate;

    if (interestAmount <= 0) {
      continue;
    }

    const transaction: Transaction = {
      id: `txn_sand_${uuidv4().slice(0, 8)}`,
      accountId,
      type: "credit",
      amount: interestAmount,
      currency: "USD",
      status: "posted",
      description: `Daily interest accrual (${config.apy}% APY)`,
      postedAt: `${asOfDate}T00:00:00.000Z`,
      referenceId: `interest_${accountId}_${asOfDate}`,
    };

    dataset.transactions.push(transaction);
    account.balance = roundMoney(account.balance + interestAmount);
    account.availableBalance = roundMoney(account.availableBalance + interestAmount);
    config.accruedInterestTotal = roundMoney(config.accruedInterestTotal + interestAmount);

    results.push({
      accountId,
      interestAmount,
      transactionId: transaction.id,
    });
  }

  return results;
}
