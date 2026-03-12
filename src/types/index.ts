/** Shared types for sandbox API — aligned with production-like response shapes */

export interface DeveloperCredentials {
  clientId: string;
  clientSecret: string;
  name?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface Account {
  id: string;
  customerId: string;
  type: "checking" | "savings" | "money_market";
  status: "active" | "pending" | "closed" | "frozen";
  currency: string;
  balance: number;
  availableBalance: number;
  lastFour: string;
  openedAt: string;
  metadata?: Record<string, unknown>;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: "credit" | "debit" | "hold" | "release";
  amount: number;
  currency: string;
  status: "posted" | "pending" | "reversed" | "failed";
  description: string;
  counterparty?: string;
  postedAt: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

export interface Customer {
  id: string;
  externalId?: string;
  firstName: string;
  lastName: string;
  email: string;
  status: "active" | "pending" | "suspended";
  createdAt: string;
  kycStatus?: "pending" | "verified" | "rejected";
  metadata?: Record<string, unknown>;
}

export interface Transfer {
  id: string;
  type: "ach" | "wire" | "internal" | "instant";
  status: "pending" | "completed" | "failed" | "returned";
  amount: number;
  currency: string;
  fromAccountId: string;
  toAccountId?: string;
  toExternal?: { routingNumber: string; accountNumber: string; name?: string };
  description?: string;
  createdAt: string;
  completedAt?: string;
  referenceId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
