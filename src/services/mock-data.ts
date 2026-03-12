import { v4 as uuidv4 } from "uuid";
import type { Account, Transaction, Customer, Transfer } from "../types/index.js";

/** Deterministic mock data for production-like sandbox responses. */

const CUSTOMER_IDS = ["cust_sand_001", "cust_sand_002", "cust_sand_003"];
const ACCOUNT_IDS = ["acct_sand_001", "acct_sand_002", "acct_sand_003", "acct_sand_004"];

export const mockCustomers: Customer[] = [
  {
    id: CUSTOMER_IDS[0],
    externalId: "ext_cust_001",
    firstName: "Jordan",
    lastName: "Smith",
    email: "jordan.smith@example.com",
    status: "active",
    createdAt: "2024-01-15T10:00:00Z",
    kycStatus: "verified",
  },
  {
    id: CUSTOMER_IDS[1],
    externalId: "ext_cust_002",
    firstName: "Alex",
    lastName: "Chen",
    email: "alex.chen@example.com",
    status: "active",
    createdAt: "2024-02-20T14:30:00Z",
    kycStatus: "verified",
  },
  {
    id: CUSTOMER_IDS[2],
    firstName: "Sam",
    lastName: "Williams",
    email: "sam.williams@example.com",
    status: "pending",
    createdAt: "2024-03-01T09:00:00Z",
    kycStatus: "pending",
  },
];

export const mockAccounts: Account[] = [
  {
    id: ACCOUNT_IDS[0],
    customerId: CUSTOMER_IDS[0],
    type: "checking",
    status: "active",
    currency: "USD",
    balance: 15420.5,
    availableBalance: 15200.0,
    lastFour: "4521",
    openedAt: "2024-01-16T00:00:00Z",
  },
  {
    id: ACCOUNT_IDS[1],
    customerId: CUSTOMER_IDS[0],
    type: "savings",
    status: "active",
    currency: "USD",
    balance: 25000.0,
    availableBalance: 25000.0,
    lastFour: "7832",
    openedAt: "2024-01-16T00:00:00Z",
  },
  {
    id: ACCOUNT_IDS[2],
    customerId: CUSTOMER_IDS[1],
    type: "checking",
    status: "active",
    currency: "USD",
    balance: 3200.75,
    availableBalance: 3200.75,
    lastFour: "9012",
    openedAt: "2024-02-21T00:00:00Z",
  },
  {
    id: ACCOUNT_IDS[3],
    customerId: CUSTOMER_IDS[2],
    type: "checking",
    status: "pending",
    currency: "USD",
    balance: 0,
    availableBalance: 0,
    lastFour: "3456",
    openedAt: "2024-03-02T00:00:00Z",
  },
];

export const mockTransactions: Transaction[] = [
  {
    id: "txn_sand_001",
    accountId: ACCOUNT_IDS[0],
    type: "debit",
    amount: -150.0,
    currency: "USD",
    status: "posted",
    description: "POS Purchase - Merchant ABC",
    counterparty: "Merchant ABC",
    postedAt: "2024-03-10T14:22:00Z",
    referenceId: "ref_001",
  },
  {
    id: "txn_sand_002",
    accountId: ACCOUNT_IDS[0],
    type: "credit",
    amount: 3200.0,
    currency: "USD",
    status: "posted",
    description: "ACH Credit - Payroll",
    counterparty: "Employer Inc",
    postedAt: "2024-03-08T06:00:00Z",
    referenceId: "ref_002",
  },
  {
    id: "txn_sand_003",
    accountId: ACCOUNT_IDS[0],
    type: "debit",
    amount: -45.99,
    currency: "USD",
    status: "posted",
    description: "Recurring - Streaming Service",
    postedAt: "2024-03-07T00:00:00Z",
  },
  {
    id: "txn_sand_004",
    accountId: ACCOUNT_IDS[1],
    type: "credit",
    amount: 500.0,
    currency: "USD",
    status: "posted",
    description: "Internal transfer from checking",
    postedAt: "2024-03-09T12:00:00Z",
  },
  {
    id: "txn_sand_005",
    accountId: ACCOUNT_IDS[2],
    type: "debit",
    amount: -220.5,
    currency: "USD",
    status: "pending",
    description: "Wire Out - Vendor Payment",
    postedAt: "2024-03-11T09:00:00Z",
  },
];

export const mockTransfers: Transfer[] = [
  {
    id: "trf_sand_001",
    type: "ach",
    status: "completed",
    amount: 500.0,
    currency: "USD",
    fromAccountId: ACCOUNT_IDS[0],
    toAccountId: ACCOUNT_IDS[1],
    description: "Savings transfer",
    createdAt: "2024-03-09T11:55:00Z",
    completedAt: "2024-03-09T12:00:00Z",
    referenceId: "ach_ref_001",
  },
  {
    id: "trf_sand_002",
    type: "wire",
    status: "pending",
    amount: 220.5,
    currency: "USD",
    fromAccountId: ACCOUNT_IDS[2],
    toExternal: { routingNumber: "021000021", accountNumber: "****1234", name: "Vendor Co" },
    description: "Vendor payment",
    createdAt: "2024-03-11T09:00:00Z",
    referenceId: "wire_ref_001",
  },
];

export function getAccountById(id: string): Account | undefined {
  return mockAccounts.find((a) => a.id === id);
}

export function getTransactionsByAccountId(accountId: string): Transaction[] {
  return mockTransactions.filter((t) => t.accountId === accountId);
}

export function getCustomerById(id: string): Customer | undefined {
  return mockCustomers.find((c) => c.id === id);
}

export function getTransfersByAccountId(accountId: string): Transfer[] {
  return mockTransfers.filter(
    (t) => t.fromAccountId === accountId || t.toAccountId === accountId
  );
}

/** Create a simulated new transfer (sandbox: always succeeds after a short delay). */
export function createMockTransfer(params: {
  type: "ach" | "wire" | "internal" | "instant";
  amount: number;
  fromAccountId: string;
  toAccountId?: string;
  toExternal?: { routingNumber: string; accountNumber: string; name?: string };
  description?: string;
}): Transfer {
  const id = `trf_sand_${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();
  return {
    id,
    type: params.type,
    status: "pending",
    amount: params.amount,
    currency: "USD",
    fromAccountId: params.fromAccountId,
    toAccountId: params.toAccountId,
    toExternal: params.toExternal,
    description: params.description,
    createdAt: now,
    referenceId: `ref_${id}`,
  };
}
