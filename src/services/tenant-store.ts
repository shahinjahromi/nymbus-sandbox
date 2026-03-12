import { v4 as uuidv4 } from "uuid";
import {
  mockAccounts,
  mockCustomers,
  mockTransactions,
  mockTransfers,
} from "./mock-data.js";
import type { Account, Customer, Transaction, Transfer } from "../types/index.js";

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

function ensureTenantDataset(tenantId: string): TenantDataset {
  let dataset = datasets.get(tenantId);
  if (!dataset) {
    dataset = cloneDataset();
    datasets.set(tenantId, dataset);
  }
  return dataset;
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
