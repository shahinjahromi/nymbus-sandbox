/**
 * Durable Store — abstract async interface, row types, and factory.
 *
 * Two backends:
 *   - SQLite  (better-sqlite3) — local dev + tests  (DB_TYPE=sqlite or unset)
 *   - MSSQL   (mssql/tedious)  — Azure production   (DB_TYPE=mssql)
 *
 * All public methods are async regardless of backend.
 */

/* -------------------------------------------------------------------------- */
/*  Row-type interfaces for SELECT results                                    */
/* -------------------------------------------------------------------------- */

interface PayloadRow {
  payload: string;
}

export interface CustomerRow {
  id: string;
  tenant_id: string;
  external_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  kyc_status: string | null;
  created_at: string;
  metadata: string | null;
}

export interface AccountRow {
  id: string;
  tenant_id: string;
  customer_id: string;
  type: string;
  status: string;
  currency: string;
  balance_cents: number;
  available_balance_cents: number;
  last_four: string | null;
  opened_at: string;
  metadata: string | null;
}

export interface TransactionRow {
  id: string;
  tenant_id: string;
  account_id: string;
  type: string;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  counterparty: string | null;
  posted_at: string;
  reference_id: string | null;
  metadata: string | null;
}

export interface TransferRow {
  id: string;
  tenant_id: string;
  type: string;
  status: string;
  amount_cents: number;
  currency: string;
  from_account_id: string;
  to_account_id: string | null;
  to_external: string | null;
  description: string | null;
  created_at: string;
  completed_at: string | null;
  reference_id: string | null;
}

export interface YieldConfigRow {
  account_id: string;
  tenant_id: string;
  apy: number;
  enabled: number;
  accrued_interest_total_cents: number;
  last_accrual_date: string | null;
  updated_at: string;
}

export interface LoanPaymentRow {
  id: string;
  tenant_id: string;
  account_id: string;
  amount_cents: number;
  frequency: string;
  status: string;
  next_payment_date: string | null;
  updated_at: string;
}

export interface UserDefinedFieldRow {
  id: string;
  tenant_id: string;
  scope_type: string;
  scope_key: string;
  field_key: string;
  value: string;
  category: string | null;
  updated_at: string;
  metadata: string | null;
}

export interface DocumentRow {
  id: string;
  tenant_id: string;
  scope_type: string;
  scope_key: string;
  title: string;
  status: string;
  type: string | null;
  created_at: string;
  updated_at: string;
  payload: string | null;
}

export interface PortalUserRow {
  email: string;
  password_hash: string;
  name: string | null;
  tenant_id: string;
  created_at: string;
  failed_login_attempts: number;
  blocked_until: number | null;
}

export interface PortalSessionRow {
  token: string;
  email: string;
  tenant_id: string;
  created_at: number;
  expires_at: number;
}

export interface CredentialRow {
  id: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  label: string | null;
  owner_email: string | null;
  created_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
  expires_at: string | null;
  last_used_at: string | null;
  status: string;
}

export interface ApiActivityRow {
  id: string;
  tenant_id: string;
  client_id: string;
  credential_id: string | null;
  method: string;
  path: string;
  status_code: number;
  request_id: string;
  idempotency_key: string | null;
  idempotency_replay: number;
  environment: string;
  timestamp: string;
  duration_ms: number | null;
}

export interface AuditLogRow {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  outcome: string;
  timestamp: string;
  request_id: string | null;
  details: string | null;
}

export interface IdempotencyRow {
  composite_key: string;
  tenant_id: string;
  method: string;
  route: string;
  idem_key: string;
  created_at: number;
  status_code: number;
  payload: string;
}

export { PayloadRow };

/* -------------------------------------------------------------------------- */
/*  Tenant entity data bundle                                                 */
/* -------------------------------------------------------------------------- */

export interface TenantEntityData {
  customers: CustomerRow[];
  accounts: AccountRow[];
  transactions: TransactionRow[];
  transfers: TransferRow[];
  yieldConfigs: YieldConfigRow[];
  loanPayments: LoanPaymentRow[];
  userDefinedFields: UserDefinedFieldRow[];
  documents: DocumentRow[];
}

export interface ApiActivityQueryParams {
  tenantId: string;
  environment?: string;
  method?: string;
  pathContains?: string;
  statusCode?: number;
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/*  Abstract DurableStore — async interface                                   */
/* -------------------------------------------------------------------------- */

export abstract class DurableStore {
  abstract init(): Promise<void>;

  /* Legacy blob methods */
  abstract getTenantDatasetPayload(tenantId: string): Promise<string | null>;
  abstract saveTenantDatasetPayload(tenantId: string, payload: string): Promise<void>;
  abstract getFallbackDatasetPayload(tenantId: string): Promise<string | null>;
  abstract saveFallbackDatasetPayload(tenantId: string, payload: string): Promise<void>;

  /* Core domain entity persistence */
  abstract saveTenantEntities(tenantId: string, data: TenantEntityData): Promise<void>;
  abstract loadTenantEntities(tenantId: string): Promise<TenantEntityData | null>;
  abstract deleteTenantEntities(tenantId: string): Promise<void>;

  /* Portal users */
  abstract upsertPortalUser(user: PortalUserRow): Promise<void>;
  abstract getPortalUser(email: string): Promise<PortalUserRow | null>;
  abstract getAllPortalUsers(): Promise<PortalUserRow[]>;

  /* Portal sessions */
  abstract upsertPortalSession(session: PortalSessionRow): Promise<void>;
  abstract getPortalSession(token: string): Promise<PortalSessionRow | null>;
  abstract deleteExpiredSessions(): Promise<void>;

  /* Credentials */
  abstract upsertCredential(cred: CredentialRow): Promise<void>;
  abstract getCredentialById(id: string): Promise<CredentialRow | null>;
  abstract getCredentialByClientId(clientId: string): Promise<CredentialRow | null>;
  abstract listCredentialsByTenant(tenantId: string): Promise<CredentialRow[]>;
  abstract getAllCredentials(): Promise<CredentialRow[]>;

  /* API activity */
  abstract insertApiActivity(entry: ApiActivityRow): Promise<void>;
  abstract listApiActivity(params: ApiActivityQueryParams): Promise<ApiActivityRow[]>;
  abstract pruneApiActivity(tenantId: string, keepCount: number): Promise<void>;

  /* Audit log */
  abstract insertAuditEntry(entry: AuditLogRow): Promise<void>;
  abstract listAuditEntries(tenantId: string, limit?: number): Promise<AuditLogRow[]>;
  abstract pruneAuditLog(tenantId: string, keepCount: number): Promise<void>;

  /* Idempotency */
  abstract upsertIdempotencyRecord(record: IdempotencyRow): Promise<void>;
  abstract getIdempotencyRecord(compositeKey: string): Promise<IdempotencyRow | null>;
  abstract deleteExpiredIdempotencyRecords(maxAgeMs: number): Promise<void>;

  /* Tenant enumeration (for startup pre-load) */
  abstract getDistinctTenantIds(): Promise<string[]>;
}

/* -------------------------------------------------------------------------- */
/*  Singleton + factory                                                       */
/* -------------------------------------------------------------------------- */

// eslint-disable-next-line import/no-mutable-exports
export let durableStore: DurableStore;

export async function initDurableStore(): Promise<void> {
  const { config } = await import("../config.js");

  if (config.persistence.dbType === "mssql") {
    const { MssqlDurableStore } = await import("./mssql-adapter.js");
    durableStore = new MssqlDurableStore();
  } else {
    const { SqliteDurableStore } = await import("./sqlite-adapter.js");
    durableStore = new SqliteDurableStore();
  }

  await durableStore.init();
}
