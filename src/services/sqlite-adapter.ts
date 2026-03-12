/**
 * SQLite adapter for DurableStore — wraps better-sqlite3 synchronous API
 * in async methods to match the abstract interface.
 * Used for local development and tests.
 */

import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { config } from "../config.js";
import {
  DurableStore,
  type PayloadRow,
  type CustomerRow,
  type AccountRow,
  type TransactionRow,
  type TransferRow,
  type YieldConfigRow,
  type LoanPaymentRow,
  type UserDefinedFieldRow,
  type DocumentRow,
  type PortalUserRow,
  type PortalSessionRow,
  type CredentialRow,
  type ApiActivityRow,
  type AuditLogRow,
  type IdempotencyRow,
  type TenantEntityData,
  type ApiActivityQueryParams,
} from "./durable-store.js";

/* -------------------------------------------------------------------------- */
/*  SQLite Schema DDL                                                         */
/* -------------------------------------------------------------------------- */

const SCHEMA_DDL = `
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
/*  SQLite DurableStore implementation                                        */
/* -------------------------------------------------------------------------- */

export class SqliteDurableStore extends DurableStore {
  private db!: Database.Database;

  async init(): Promise<void> {
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

  /* ------ Legacy blob --------------------------------------------------- */

  async getTenantDatasetPayload(tenantId: string): Promise<string | null> {
    const row = this.db
      .prepare("SELECT payload FROM tenant_datasets WHERE tenant_id = ?")
      .get(tenantId) as PayloadRow | undefined;
    return row?.payload ?? null;
  }

  async saveTenantDatasetPayload(tenantId: string, payload: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tenant_datasets (tenant_id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
      )
      .run(tenantId, payload, now);
  }

  async getFallbackDatasetPayload(tenantId: string): Promise<string | null> {
    const row = this.db
      .prepare("SELECT payload FROM fallback_datasets WHERE tenant_id = ?")
      .get(tenantId) as PayloadRow | undefined;
    return row?.payload ?? null;
  }

  async saveFallbackDatasetPayload(tenantId: string, payload: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO fallback_datasets (tenant_id, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
      )
      .run(tenantId, payload, now);
  }

  /* ------ Core domain entities ------------------------------------------ */

  async saveTenantEntities(tenantId: string, data: TenantEntityData): Promise<void> {
    this.db.pragma("foreign_keys = OFF");

    this.db.transaction(() => {
      const tables = [
        "documents", "user_defined_fields", "loan_payments", "yield_configs",
        "transfers", "transactions", "accounts", "customers",
      ];
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table} WHERE tenant_id = ?`).run(tenantId);
      }

      const insertCustomer = this.db.prepare(
        `INSERT INTO customers (id, tenant_id, external_id, first_name, last_name, email, status, kyc_status, created_at, metadata)
         VALUES (@id, @tenant_id, @external_id, @first_name, @last_name, @email, @status, @kyc_status, @created_at, @metadata)`
      );
      for (const c of data.customers) insertCustomer.run(c);

      const insertAccount = this.db.prepare(
        `INSERT INTO accounts (id, tenant_id, customer_id, type, status, currency, balance_cents, available_balance_cents, last_four, opened_at, metadata)
         VALUES (@id, @tenant_id, @customer_id, @type, @status, @currency, @balance_cents, @available_balance_cents, @last_four, @opened_at, @metadata)`
      );
      for (const a of data.accounts) insertAccount.run(a);

      const insertTxn = this.db.prepare(
        `INSERT INTO transactions (id, tenant_id, account_id, type, amount_cents, currency, status, description, counterparty, posted_at, reference_id, metadata)
         VALUES (@id, @tenant_id, @account_id, @type, @amount_cents, @currency, @status, @description, @counterparty, @posted_at, @reference_id, @metadata)`
      );
      for (const t of data.transactions) insertTxn.run(t);

      const insertXfer = this.db.prepare(
        `INSERT INTO transfers (id, tenant_id, type, status, amount_cents, currency, from_account_id, to_account_id, to_external, description, created_at, completed_at, reference_id)
         VALUES (@id, @tenant_id, @type, @status, @amount_cents, @currency, @from_account_id, @to_account_id, @to_external, @description, @created_at, @completed_at, @reference_id)`
      );
      for (const x of data.transfers) insertXfer.run(x);

      const insertYield = this.db.prepare(
        `INSERT INTO yield_configs (account_id, tenant_id, apy, enabled, accrued_interest_total_cents, last_accrual_date, updated_at)
         VALUES (@account_id, @tenant_id, @apy, @enabled, @accrued_interest_total_cents, @last_accrual_date, @updated_at)`
      );
      for (const y of data.yieldConfigs) insertYield.run(y);

      const insertLP = this.db.prepare(
        `INSERT INTO loan_payments (id, tenant_id, account_id, amount_cents, frequency, status, next_payment_date, updated_at)
         VALUES (@id, @tenant_id, @account_id, @amount_cents, @frequency, @status, @next_payment_date, @updated_at)`
      );
      for (const lp of data.loanPayments) insertLP.run(lp);

      const insertUDF = this.db.prepare(
        `INSERT INTO user_defined_fields (id, tenant_id, scope_type, scope_key, field_key, value, category, updated_at, metadata)
         VALUES (@id, @tenant_id, @scope_type, @scope_key, @field_key, @value, @category, @updated_at, @metadata)`
      );
      for (const u of data.userDefinedFields) insertUDF.run(u);

      const insertDoc = this.db.prepare(
        `INSERT INTO documents (id, tenant_id, scope_type, scope_key, title, status, type, created_at, updated_at, payload)
         VALUES (@id, @tenant_id, @scope_type, @scope_key, @title, @status, @type, @created_at, @updated_at, @payload)`
      );
      for (const d of data.documents) insertDoc.run(d);
    })();

    this.db.pragma("foreign_keys = ON");
  }

  async loadTenantEntities(tenantId: string): Promise<TenantEntityData | null> {
    const customers = this.db
      .prepare("SELECT * FROM customers WHERE tenant_id = ?")
      .all(tenantId) as CustomerRow[];

    if (customers.length === 0) {
      const accounts = this.db
        .prepare("SELECT * FROM accounts WHERE tenant_id = ?")
        .all(tenantId) as AccountRow[];
      if (accounts.length === 0) return null;
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

  async deleteTenantEntities(tenantId: string): Promise<void> {
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

  /* ------ Portal users -------------------------------------------------- */

  async upsertPortalUser(user: PortalUserRow): Promise<void> {
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

  async getPortalUser(email: string): Promise<PortalUserRow | null> {
    return (this.db.prepare("SELECT * FROM portal_users WHERE email = ?").get(email) as PortalUserRow | undefined) ?? null;
  }

  async getAllPortalUsers(): Promise<PortalUserRow[]> {
    return this.db.prepare("SELECT * FROM portal_users").all() as PortalUserRow[];
  }

  /* ------ Portal sessions ----------------------------------------------- */

  async upsertPortalSession(session: PortalSessionRow): Promise<void> {
    this.db.prepare(
      `INSERT INTO portal_sessions (token, email, tenant_id, created_at, expires_at)
       VALUES (@token, @email, @tenant_id, @created_at, @expires_at)
       ON CONFLICT(token) DO UPDATE SET expires_at = excluded.expires_at`
    ).run(session);
  }

  async getPortalSession(token: string): Promise<PortalSessionRow | null> {
    return (this.db.prepare("SELECT * FROM portal_sessions WHERE token = ?").get(token) as PortalSessionRow | undefined) ?? null;
  }

  async deleteExpiredSessions(): Promise<void> {
    this.db.prepare("DELETE FROM portal_sessions WHERE expires_at < ?").run(Date.now());
  }

  /* ------ Credentials --------------------------------------------------- */

  async upsertCredential(cred: CredentialRow): Promise<void> {
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

  async getCredentialById(id: string): Promise<CredentialRow | null> {
    return (this.db.prepare("SELECT * FROM credentials WHERE id = ?").get(id) as CredentialRow | undefined) ?? null;
  }

  async getCredentialByClientId(clientId: string): Promise<CredentialRow | null> {
    return (this.db.prepare("SELECT * FROM credentials WHERE client_id = ?").get(clientId) as CredentialRow | undefined) ?? null;
  }

  async listCredentialsByTenant(tenantId: string): Promise<CredentialRow[]> {
    return this.db.prepare("SELECT * FROM credentials WHERE tenant_id = ? ORDER BY created_at DESC").all(tenantId) as CredentialRow[];
  }

  async getAllCredentials(): Promise<CredentialRow[]> {
    return this.db.prepare("SELECT * FROM credentials").all() as CredentialRow[];
  }

  /* ------ API activity -------------------------------------------------- */

  async insertApiActivity(entry: ApiActivityRow): Promise<void> {
    this.db.prepare(
      `INSERT INTO api_activity (id, tenant_id, client_id, credential_id, method, path, status_code, request_id, idempotency_key, idempotency_replay, environment, timestamp, duration_ms)
       VALUES (@id, @tenant_id, @client_id, @credential_id, @method, @path, @status_code, @request_id, @idempotency_key, @idempotency_replay, @environment, @timestamp, @duration_ms)`
    ).run(entry);
  }

  async listApiActivity(params: ApiActivityQueryParams): Promise<ApiActivityRow[]> {
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

  async pruneApiActivity(tenantId: string, keepCount: number): Promise<void> {
    this.db.prepare(
      `DELETE FROM api_activity WHERE tenant_id = ? AND id NOT IN (
         SELECT id FROM api_activity WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?
       )`
    ).run(tenantId, tenantId, keepCount);
  }

  /* ------ Audit log ----------------------------------------------------- */

  async insertAuditEntry(entry: AuditLogRow): Promise<void> {
    this.db.prepare(
      `INSERT INTO audit_log (id, tenant_id, actor, action, outcome, timestamp, request_id, details)
       VALUES (@id, @tenant_id, @actor, @action, @outcome, @timestamp, @request_id, @details)`
    ).run(entry);
  }

  async listAuditEntries(tenantId: string, limit: number = 100): Promise<AuditLogRow[]> {
    return this.db
      .prepare("SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?")
      .all(tenantId, Math.max(1, Math.min(limit, 500))) as AuditLogRow[];
  }

  async pruneAuditLog(tenantId: string, keepCount: number): Promise<void> {
    this.db.prepare(
      `DELETE FROM audit_log WHERE tenant_id = ? AND id NOT IN (
         SELECT id FROM audit_log WHERE tenant_id = ? ORDER BY timestamp DESC LIMIT ?
       )`
    ).run(tenantId, tenantId, keepCount);
  }

  /* ------ Idempotency --------------------------------------------------- */

  async upsertIdempotencyRecord(record: IdempotencyRow): Promise<void> {
    this.db.prepare(
      `INSERT INTO idempotency_records (composite_key, tenant_id, method, route, idem_key, created_at, status_code, payload)
       VALUES (@composite_key, @tenant_id, @method, @route, @idem_key, @created_at, @status_code, @payload)
       ON CONFLICT(composite_key) DO UPDATE SET
         status_code = excluded.status_code,
         payload = excluded.payload,
         created_at = excluded.created_at`
    ).run(record);
  }

  async getIdempotencyRecord(compositeKey: string): Promise<IdempotencyRow | null> {
    return (this.db.prepare("SELECT * FROM idempotency_records WHERE composite_key = ?").get(compositeKey) as IdempotencyRow | undefined) ?? null;
  }

  async deleteExpiredIdempotencyRecords(maxAgeMs: number): Promise<void> {
    const cutoff = Date.now() - maxAgeMs;
    this.db.prepare("DELETE FROM idempotency_records WHERE created_at < ?").run(cutoff);
  }

  async getDistinctTenantIds(): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT DISTINCT tenant_id FROM customers UNION SELECT DISTINCT tenant_id FROM accounts")
      .all() as Array<{ tenant_id: string }>;
    return rows.map((r) => r.tenant_id);
  }
}
