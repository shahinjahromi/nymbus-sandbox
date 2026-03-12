import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { config } from "../config.js";

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

/* -------------------------------------------------------------------------- */
/*  Schema DDL                                                                */
/* -------------------------------------------------------------------------- */

const SCHEMA_DDL = `
  -- Legacy blob tables (kept for migration; new code uses entity tables)
  CREATE TABLE IF NOT EXISTS tenant_datasets (
    tenant_id TEXT PRIMARY KEY,
    payload   TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fallback_datasets (
    tenant_id TEXT PRIMARY KEY,
    payload   TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  /* ====================================================================== */
  /*  CORE DOMAIN — relational, tenant-scoped, FK-enforced                  */
  /* ====================================================================== */

  CREATE TABLE IF NOT EXISTS customers (
    id          TEXT NOT NULL,
    tenant_id   TEXT NOT NULL,
    external_id TEXT,
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    email       TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active',
    kyc_status  TEXT,
    created_at  TEXT NOT NULL,
    metadata    TEXT,
    PRIMARY KEY (tenant_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);

  CREATE TABLE IF NOT EXISTS accounts (
    id                      TEXT    NOT NULL,
    tenant_id               TEXT    NOT NULL,
    customer_id             TEXT    NOT NULL,
    type                    TEXT    NOT NULL,
    status                  TEXT    NOT NULL DEFAULT 'active',
    currency                TEXT    NOT NULL DEFAULT 'USD',
    balance_cents           INTEGER NOT NULL DEFAULT 0,
    available_balance_cents INTEGER NOT NULL DEFAULT 0,
    last_four               TEXT,
    opened_at               TEXT    NOT NULL,
    metadata                TEXT,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, customer_id) REFERENCES customers(tenant_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_accounts_tenant   ON accounts(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_customer ON accounts(tenant_id, customer_id);

  CREATE TABLE IF NOT EXISTS transactions (
    id           TEXT    NOT NULL,
    tenant_id    TEXT    NOT NULL,
    account_id   TEXT    NOT NULL,
    type         TEXT    NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency     TEXT    NOT NULL DEFAULT 'USD',
    status       TEXT    NOT NULL DEFAULT 'pending',
    description  TEXT,
    counterparty TEXT,
    posted_at    TEXT    NOT NULL,
    reference_id TEXT,
    metadata     TEXT,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_txn_tenant    ON transactions(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_txn_account   ON transactions(tenant_id, account_id);
  CREATE INDEX IF NOT EXISTS idx_txn_posted_at ON transactions(tenant_id, posted_at);

  CREATE TABLE IF NOT EXISTS transfers (
    id              TEXT    NOT NULL,
    tenant_id       TEXT    NOT NULL,
    type            TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'pending',
    amount_cents    INTEGER NOT NULL,
    currency        TEXT    NOT NULL DEFAULT 'USD',
    from_account_id TEXT    NOT NULL,
    to_account_id   TEXT,
    to_external     TEXT,
    description     TEXT,
    created_at      TEXT    NOT NULL,
    completed_at    TEXT,
    reference_id    TEXT,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, from_account_id) REFERENCES accounts(tenant_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_xfer_tenant       ON transfers(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_xfer_from_account  ON transfers(tenant_id, from_account_id);

  CREATE TABLE IF NOT EXISTS yield_configs (
    account_id                TEXT    NOT NULL,
    tenant_id                 TEXT    NOT NULL,
    apy                       REAL    NOT NULL DEFAULT 0,
    enabled                   INTEGER NOT NULL DEFAULT 0,
    accrued_interest_total_cents INTEGER NOT NULL DEFAULT 0,
    last_accrual_date         TEXT,
    updated_at                TEXT    NOT NULL,
    PRIMARY KEY (tenant_id, account_id),
    FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id)
  );

  CREATE TABLE IF NOT EXISTS loan_payments (
    id                TEXT    NOT NULL,
    tenant_id         TEXT    NOT NULL,
    account_id        TEXT    NOT NULL,
    amount_cents      INTEGER NOT NULL,
    frequency         TEXT    NOT NULL DEFAULT 'monthly',
    status            TEXT    NOT NULL DEFAULT 'active',
    next_payment_date TEXT,
    updated_at        TEXT    NOT NULL,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, account_id) REFERENCES accounts(tenant_id, id)
  );
  CREATE INDEX IF NOT EXISTS idx_lp_account ON loan_payments(tenant_id, account_id);

  CREATE TABLE IF NOT EXISTS user_defined_fields (
    id         TEXT NOT NULL,
    tenant_id  TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    scope_key  TEXT NOT NULL,
    field_key  TEXT NOT NULL,
    value      TEXT NOT NULL DEFAULT '',
    category   TEXT,
    updated_at TEXT NOT NULL,
    metadata   TEXT,
    PRIMARY KEY (tenant_id, scope_type, scope_key, id)
  );
  CREATE INDEX IF NOT EXISTS idx_udf_scope ON user_defined_fields(tenant_id, scope_type, scope_key);

  CREATE TABLE IF NOT EXISTS documents (
    id         TEXT NOT NULL,
    tenant_id  TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    scope_key  TEXT NOT NULL,
    title      TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'active',
    type       TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    payload    TEXT,
    PRIMARY KEY (tenant_id, scope_type, scope_key, id)
  );
  CREATE INDEX IF NOT EXISTS idx_doc_scope ON documents(tenant_id, scope_type, scope_key);

  /* ====================================================================== */
  /*  PORTAL METADATA — developer interaction state                         */
  /* ====================================================================== */

  CREATE TABLE IF NOT EXISTS portal_users (
    email                 TEXT PRIMARY KEY,
    password_hash         TEXT    NOT NULL,
    name                  TEXT,
    tenant_id             TEXT    NOT NULL,
    created_at            TEXT    NOT NULL,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    blocked_until         INTEGER
  );

  CREATE TABLE IF NOT EXISTS portal_sessions (
    token      TEXT PRIMARY KEY,
    email      TEXT    NOT NULL,
    tenant_id  TEXT    NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (email) REFERENCES portal_users(email)
  );
  CREATE INDEX IF NOT EXISTS idx_sess_email ON portal_sessions(email);

  CREATE TABLE IF NOT EXISTS credentials (
    id            TEXT PRIMARY KEY,
    tenant_id     TEXT NOT NULL,
    client_id     TEXT NOT NULL UNIQUE,
    client_secret TEXT NOT NULL,
    label         TEXT,
    owner_email   TEXT,
    created_at    TEXT NOT NULL,
    rotated_at    TEXT,
    revoked_at    TEXT,
    expires_at    TEXT,
    last_used_at  TEXT,
    status        TEXT NOT NULL DEFAULT 'active'
  );
  CREATE INDEX IF NOT EXISTS idx_cred_tenant    ON credentials(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_cred_client_id ON credentials(client_id);

  CREATE TABLE IF NOT EXISTS api_activity (
    id               TEXT    PRIMARY KEY,
    tenant_id        TEXT    NOT NULL,
    client_id        TEXT    NOT NULL,
    credential_id    TEXT,
    method           TEXT    NOT NULL,
    path             TEXT    NOT NULL,
    status_code      INTEGER NOT NULL,
    request_id       TEXT    NOT NULL,
    idempotency_key  TEXT,
    idempotency_replay INTEGER DEFAULT 0,
    environment      TEXT    NOT NULL DEFAULT 'sandbox',
    timestamp        TEXT    NOT NULL,
    duration_ms      INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_activity_tenant    ON api_activity(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON api_activity(tenant_id, timestamp);

  CREATE TABLE IF NOT EXISTS audit_log (
    id         TEXT PRIMARY KEY,
    tenant_id  TEXT NOT NULL,
    actor      TEXT NOT NULL,
    action     TEXT NOT NULL,
    outcome    TEXT NOT NULL,
    timestamp  TEXT NOT NULL,
    request_id TEXT,
    details    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_audit_tenant    ON audit_log(tenant_id);
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(tenant_id, timestamp);

  CREATE TABLE IF NOT EXISTS idempotency_records (
    composite_key TEXT PRIMARY KEY,
    tenant_id     TEXT    NOT NULL,
    method        TEXT    NOT NULL,
    route         TEXT    NOT NULL,
    idem_key      TEXT    NOT NULL,
    created_at    INTEGER NOT NULL,
    status_code   INTEGER NOT NULL,
    payload       TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_idem_tenant ON idempotency_records(tenant_id);
`;

/* -------------------------------------------------------------------------- */
/*  DurableStore class                                                        */
/* -------------------------------------------------------------------------- */

class DurableStore {
  readonly db: Database.Database;

  constructor() {
    const configuredPath = config.persistence.sqlitePath;
    const dbPath = configuredPath === ":memory:" ? configuredPath : resolve(configuredPath);

    if (dbPath !== ":memory:") {
      const dbDir = dirname(dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      if (config.persistence.resetOnBoot && existsSync(dbPath)) {
        rmSync(dbPath);
      }
    }

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");

    this.db.exec(SCHEMA_DDL);
  }

  /* ---------------------------------------------------------------------- */
  /*  Legacy blob methods (backward compat — used by fallback datasets)     */
  /* ---------------------------------------------------------------------- */

  getTenantDatasetPayload(tenantId: string): string | null {
    const row = this.db
      .prepare("SELECT payload FROM tenant_datasets WHERE tenant_id = ?")
      .get(tenantId) as PayloadRow | undefined;

    return row?.payload ?? null;
  }

  saveTenantDatasetPayload(tenantId: string, payload: string): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO tenant_datasets (tenant_id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
      )
      .run(tenantId, payload, now);
  }

  getFallbackDatasetPayload(tenantId: string): string | null {
    const row = this.db
      .prepare("SELECT payload FROM fallback_datasets WHERE tenant_id = ?")
      .get(tenantId) as PayloadRow | undefined;

    return row?.payload ?? null;
  }

  saveFallbackDatasetPayload(tenantId: string, payload: string): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO fallback_datasets (tenant_id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
      )
      .run(tenantId, payload, now);
  }

  /* ---------------------------------------------------------------------- */
  /*  Transaction helper                                                    */
  /* ---------------------------------------------------------------------- */

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  /* ---------------------------------------------------------------------- */
  /*  Core-domain entity persistence (tenant-scoped)                        */
  /* ---------------------------------------------------------------------- */

  saveTenantEntities(
    tenantId: string,
    data: {
      customers: CustomerRow[];
      accounts: AccountRow[];
      transactions: TransactionRow[];
      transfers: TransferRow[];
      yieldConfigs: YieldConfigRow[];
      loanPayments: LoanPaymentRow[];
      userDefinedFields: UserDefinedFieldRow[];
      documents: DocumentRow[];
    }
  ): void {
    // PRAGMA foreign_keys cannot be changed inside a transaction —
    // disable before, re-enable after to allow bulk replace without ordering issues
    this.db.pragma("foreign_keys = OFF");

    this.db.transaction(() => {
      // Clear existing tenant data
      const tables = [
        "documents",
        "user_defined_fields",
        "loan_payments",
        "yield_configs",
        "transfers",
        "transactions",
        "accounts",
        "customers",
      ];
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table} WHERE tenant_id = ?`).run(tenantId);
      }

      // Insert customers
      const insertCustomer = this.db.prepare(
        `INSERT INTO customers (id, tenant_id, external_id, first_name, last_name, email, status, kyc_status, created_at, metadata)
         VALUES (@id, @tenant_id, @external_id, @first_name, @last_name, @email, @status, @kyc_status, @created_at, @metadata)`
      );
      for (const c of data.customers) insertCustomer.run(c);

      // Insert accounts
      const insertAccount = this.db.prepare(
        `INSERT INTO accounts (id, tenant_id, customer_id, type, status, currency, balance_cents, available_balance_cents, last_four, opened_at, metadata)
         VALUES (@id, @tenant_id, @customer_id, @type, @status, @currency, @balance_cents, @available_balance_cents, @last_four, @opened_at, @metadata)`
      );
      for (const a of data.accounts) insertAccount.run(a);

      // Insert transactions
      const insertTxn = this.db.prepare(
        `INSERT INTO transactions (id, tenant_id, account_id, type, amount_cents, currency, status, description, counterparty, posted_at, reference_id, metadata)
         VALUES (@id, @tenant_id, @account_id, @type, @amount_cents, @currency, @status, @description, @counterparty, @posted_at, @reference_id, @metadata)`
      );
      for (const t of data.transactions) insertTxn.run(t);

      // Insert transfers
      const insertXfer = this.db.prepare(
        `INSERT INTO transfers (id, tenant_id, type, status, amount_cents, currency, from_account_id, to_account_id, to_external, description, created_at, completed_at, reference_id)
         VALUES (@id, @tenant_id, @type, @status, @amount_cents, @currency, @from_account_id, @to_account_id, @to_external, @description, @created_at, @completed_at, @reference_id)`
      );
      for (const x of data.transfers) insertXfer.run(x);

      // Insert yield configs
      const insertYield = this.db.prepare(
        `INSERT INTO yield_configs (account_id, tenant_id, apy, enabled, accrued_interest_total_cents, last_accrual_date, updated_at)
         VALUES (@account_id, @tenant_id, @apy, @enabled, @accrued_interest_total_cents, @last_accrual_date, @updated_at)`
      );
      for (const y of data.yieldConfigs) insertYield.run(y);

      // Insert loan payments
      const insertLP = this.db.prepare(
        `INSERT INTO loan_payments (id, tenant_id, account_id, amount_cents, frequency, status, next_payment_date, updated_at)
         VALUES (@id, @tenant_id, @account_id, @amount_cents, @frequency, @status, @next_payment_date, @updated_at)`
      );
      for (const lp of data.loanPayments) insertLP.run(lp);

      // Insert user-defined fields
      const insertUDF = this.db.prepare(
        `INSERT INTO user_defined_fields (id, tenant_id, scope_type, scope_key, field_key, value, category, updated_at, metadata)
         VALUES (@id, @tenant_id, @scope_type, @scope_key, @field_key, @value, @category, @updated_at, @metadata)`
      );
      for (const u of data.userDefinedFields) insertUDF.run(u);

      // Insert documents
      const insertDoc = this.db.prepare(
        `INSERT INTO documents (id, tenant_id, scope_type, scope_key, title, status, type, created_at, updated_at, payload)
         VALUES (@id, @tenant_id, @scope_type, @scope_key, @title, @status, @type, @created_at, @updated_at, @payload)`
      );
      for (const d of data.documents) insertDoc.run(d);
    })();

    // Re-enable FK checks after bulk save
    this.db.pragma("foreign_keys = ON");
  }

  loadTenantEntities(tenantId: string): {
    customers: CustomerRow[];
    accounts: AccountRow[];
    transactions: TransactionRow[];
    transfers: TransferRow[];
    yieldConfigs: YieldConfigRow[];
    loanPayments: LoanPaymentRow[];
    userDefinedFields: UserDefinedFieldRow[];
    documents: DocumentRow[];
  } | null {
    const customers = this.db
      .prepare("SELECT * FROM customers WHERE tenant_id = ?")
      .all(tenantId) as CustomerRow[];

    // If no customers exist for this tenant, return null to signal "not yet persisted"
    if (customers.length === 0) {
      const accounts = this.db
        .prepare("SELECT * FROM accounts WHERE tenant_id = ?")
        .all(tenantId) as AccountRow[];
      if (accounts.length === 0) {
        return null;
      }
    }

    return {
      customers,
      accounts: this.db.prepare("SELECT * FROM accounts WHERE tenant_id = ?").all(tenantId) as AccountRow[],
      transactions: this.db.prepare("SELECT * FROM transactions WHERE tenant_id = ?").all(tenantId) as TransactionRow[],
      transfers: this.db.prepare("SELECT * FROM transfers WHERE tenant_id = ?").all(tenantId) as TransferRow[],
      yieldConfigs: this.db.prepare("SELECT * FROM yield_configs WHERE tenant_id = ?").all(tenantId) as YieldConfigRow[],
      loanPayments: this.db.prepare("SELECT * FROM loan_payments WHERE tenant_id = ?").all(tenantId) as LoanPaymentRow[],
      userDefinedFields: this.db.prepare("SELECT * FROM user_defined_fields WHERE tenant_id = ?").all(tenantId) as UserDefinedFieldRow[],
      documents: this.db.prepare("SELECT * FROM documents WHERE tenant_id = ?").all(tenantId) as DocumentRow[],
    };
  }

  deleteTenantEntities(tenantId: string): void {
    this.db.pragma("foreign_keys = OFF");
    this.db.transaction(() => {
      const tables = [
        "documents", "user_defined_fields", "loan_payments", "yield_configs",
        "transfers", "transactions", "accounts", "customers",
      ];
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table} WHERE tenant_id = ?`).run(tenantId);
      }
    })();
    this.db.pragma("foreign_keys = ON");
  }

  /* ---------------------------------------------------------------------- */
  /*  Portal user persistence                                               */
  /* ---------------------------------------------------------------------- */

  upsertPortalUser(user: PortalUserRow): void {
    this.db.prepare(
      `INSERT INTO portal_users (email, password_hash, name, tenant_id, created_at, failed_login_attempts, blocked_until)
       VALUES (@email, @password_hash, @name, @tenant_id, @created_at, @failed_login_attempts, @blocked_until)
       ON CONFLICT(email) DO UPDATE SET
         password_hash = excluded.password_hash,
         name = excluded.name,
         failed_login_attempts = excluded.failed_login_attempts,
         blocked_until = excluded.blocked_until`
    ).run(user);
  }

  getPortalUser(email: string): PortalUserRow | null {
    return (this.db.prepare("SELECT * FROM portal_users WHERE email = ?").get(email) as PortalUserRow | undefined) ?? null;
  }

  getAllPortalUsers(): PortalUserRow[] {
    return this.db.prepare("SELECT * FROM portal_users").all() as PortalUserRow[];
  }

  /* ---------------------------------------------------------------------- */
  /*  Portal session persistence                                            */
  /* ---------------------------------------------------------------------- */

  upsertPortalSession(session: PortalSessionRow): void {
    this.db.prepare(
      `INSERT INTO portal_sessions (token, email, tenant_id, created_at, expires_at)
       VALUES (@token, @email, @tenant_id, @created_at, @expires_at)
       ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at`
    ).run(session);
  }

  getPortalSession(token: string): PortalSessionRow | null {
    return (this.db.prepare("SELECT * FROM portal_sessions WHERE token = ?").get(token) as PortalSessionRow | undefined) ?? null;
  }

  deleteExpiredSessions(): void {
    this.db.prepare("DELETE FROM portal_sessions WHERE expires_at < ?").run(Date.now());
  }

  /* ---------------------------------------------------------------------- */
  /*  Credential persistence                                                */
  /* ---------------------------------------------------------------------- */

  upsertCredential(cred: CredentialRow): void {
    this.db.prepare(
      `INSERT INTO credentials (id, tenant_id, client_id, client_secret, label, owner_email, created_at, rotated_at, revoked_at, expires_at, last_used_at, status)
       VALUES (@id, @tenant_id, @client_id, @client_secret, @label, @owner_email, @created_at, @rotated_at, @revoked_at, @expires_at, @last_used_at, @status)
       ON CONFLICT(id) DO UPDATE SET
         client_secret = excluded.client_secret,
         label = excluded.label,
         owner_email = excluded.owner_email,
         rotated_at = excluded.rotated_at,
         revoked_at = excluded.revoked_at,
         expires_at = excluded.expires_at,
         last_used_at = excluded.last_used_at,
         status = excluded.status`
    ).run(cred);
  }

  getCredentialById(id: string): CredentialRow | null {
    return (this.db.prepare("SELECT * FROM credentials WHERE id = ?").get(id) as CredentialRow | undefined) ?? null;
  }

  getCredentialByClientId(clientId: string): CredentialRow | null {
    return (this.db.prepare("SELECT * FROM credentials WHERE client_id = ?").get(clientId) as CredentialRow | undefined) ?? null;
  }

  listCredentialsByTenant(tenantId: string): CredentialRow[] {
    return this.db.prepare("SELECT * FROM credentials WHERE tenant_id = ? ORDER BY created_at DESC").all(tenantId) as CredentialRow[];
  }

  getAllCredentials(): CredentialRow[] {
    return this.db.prepare("SELECT * FROM credentials").all() as CredentialRow[];
  }

  /* ---------------------------------------------------------------------- */
  /*  API activity persistence                                              */
  /* ---------------------------------------------------------------------- */

  insertApiActivity(entry: ApiActivityRow): void {
    this.db.prepare(
      `INSERT INTO api_activity (id, tenant_id, client_id, credential_id, method, path, status_code, request_id, idempotency_key, idempotency_replay, environment, timestamp, duration_ms)
       VALUES (@id, @tenant_id, @client_id, @credential_id, @method, @path, @status_code, @request_id, @idempotency_key, @idempotency_replay, @environment, @timestamp, @duration_ms)`
    ).run(entry);
  }

  listApiActivity(params: {
    tenantId: string;
    environment?: string;
    method?: string;
    pathContains?: string;
    statusCode?: number;
    limit?: number;
  }): ApiActivityRow[] {
    let sql = "SELECT * FROM api_activity WHERE tenant_id = ?";
    const binds: unknown[] = [params.tenantId];

    if (params.environment) {
      sql += " AND environment = ?";
      binds.push(params.environment);
    }
    if (params.method) {
      sql += " AND method = ?";
      binds.push(params.method.toUpperCase());
    }
    if (params.pathContains) {
      sql += " AND path LIKE ?";
      binds.push(`%${params.pathContains}%`);
    }
    if (typeof params.statusCode === "number") {
      sql += " AND status_code = ?";
      binds.push(params.statusCode);
    }

    sql += " ORDER BY timestamp DESC LIMIT ?";
    binds.push(Math.max(1, Math.min(params.limit ?? 100, 500)));

    return this.db.prepare(sql).all(...binds) as ApiActivityRow[];
  }

  pruneApiActivity(tenantId: string, keepCount: number): void {
    this.db.prepare(
      `DELETE FROM api_activity WHERE tenant_id = ? AND id NOT IN (
         SELECT id FROM api_activity WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?
       )`
    ).run(tenantId, tenantId, keepCount);
  }

  /* ---------------------------------------------------------------------- */
  /*  Audit log persistence                                                 */
  /* ---------------------------------------------------------------------- */

  insertAuditEntry(entry: AuditLogRow): void {
    this.db.prepare(
      `INSERT INTO audit_log (id, tenant_id, actor, action, outcome, timestamp, request_id, details)
       VALUES (@id, @tenant_id, @actor, @action, @outcome, @timestamp, @request_id, @details)`
    ).run(entry);
  }

  listAuditEntries(tenantId: string, limit: number = 100): AuditLogRow[] {
    return this.db
      .prepare("SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?")
      .all(tenantId, Math.max(1, Math.min(limit, 500))) as AuditLogRow[];
  }

  pruneAuditLog(tenantId: string, keepCount: number): void {
    this.db.prepare(
      `DELETE FROM audit_log WHERE tenant_id = ? AND id NOT IN (
         SELECT id FROM audit_log WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?
       )`
    ).run(tenantId, tenantId, keepCount);
  }

  /* ---------------------------------------------------------------------- */
  /*  Idempotency record persistence                                        */
  /* ---------------------------------------------------------------------- */

  upsertIdempotencyRecord(record: IdempotencyRow): void {
    this.db.prepare(
      `INSERT INTO idempotency_records (composite_key, tenant_id, method, route, idem_key, created_at, status_code, payload)
       VALUES (@composite_key, @tenant_id, @method, @route, @idem_key, @created_at, @status_code, @payload)
       ON CONFLICT(composite_key) DO UPDATE SET
         status_code = excluded.status_code,
         payload = excluded.payload,
         created_at = excluded.created_at`
    ).run(record);
  }

  getIdempotencyRecord(compositeKey: string): IdempotencyRow | null {
    return (this.db.prepare("SELECT * FROM idempotency_records WHERE composite_key = ?").get(compositeKey) as IdempotencyRow | undefined) ?? null;
  }

  deleteExpiredIdempotencyRecords(maxAgeMs: number): void {
    const cutoff = Date.now() - maxAgeMs;
    this.db.prepare("DELETE FROM idempotency_records WHERE created_at < ?").run(cutoff);
  }
}

export const durableStore = new DurableStore();
