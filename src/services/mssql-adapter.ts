/**
 * MSSQL adapter for DurableStore — uses mssql/tedious for Azure SQL.
 * Used in production deployment on Azure.
 */

import sql from "mssql";
import { config } from "../config.js";
import {
  DurableStore,
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
/*  T-SQL Schema DDL                                                          */
/* -------------------------------------------------------------------------- */

const MSSQL_SCHEMA_STATEMENTS: string[] = [
  // Legacy blob tables
  `IF OBJECT_ID('dbo.tenant_datasets','U') IS NULL
   CREATE TABLE dbo.tenant_datasets (
     tenant_id  NVARCHAR(255) PRIMARY KEY,
     payload    NVARCHAR(MAX) NOT NULL,
     updated_at NVARCHAR(50)  NOT NULL
   )`,
  `IF OBJECT_ID('dbo.fallback_datasets','U') IS NULL
   CREATE TABLE dbo.fallback_datasets (
     tenant_id  NVARCHAR(255) PRIMARY KEY,
     payload    NVARCHAR(MAX) NOT NULL,
     updated_at NVARCHAR(50)  NOT NULL
   )`,

  // Core domain
  `IF OBJECT_ID('dbo.customers','U') IS NULL
   CREATE TABLE dbo.customers (
     id          NVARCHAR(255) NOT NULL,
     tenant_id   NVARCHAR(255) NOT NULL,
     external_id NVARCHAR(255),
     first_name  NVARCHAR(255) NOT NULL,
     last_name   NVARCHAR(255) NOT NULL,
     email       NVARCHAR(255) NOT NULL,
     status      NVARCHAR(50)  NOT NULL DEFAULT 'active',
     kyc_status  NVARCHAR(50),
     created_at  NVARCHAR(50)  NOT NULL,
     metadata    NVARCHAR(MAX),
     CONSTRAINT PK_customers PRIMARY KEY (tenant_id, id)
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_customers_tenant')
   CREATE INDEX idx_customers_tenant ON dbo.customers(tenant_id)`,

  `IF OBJECT_ID('dbo.accounts','U') IS NULL
   CREATE TABLE dbo.accounts (
     id                      NVARCHAR(255) NOT NULL,
     tenant_id               NVARCHAR(255) NOT NULL,
     customer_id             NVARCHAR(255) NOT NULL,
     type                    NVARCHAR(50)  NOT NULL,
     status                  NVARCHAR(50)  NOT NULL DEFAULT 'active',
     currency                NVARCHAR(10)  NOT NULL DEFAULT 'USD',
     balance_cents           INT           NOT NULL DEFAULT 0,
     available_balance_cents INT           NOT NULL DEFAULT 0,
     last_four               NVARCHAR(10),
     opened_at               NVARCHAR(50)  NOT NULL,
     metadata                NVARCHAR(MAX),
     CONSTRAINT PK_accounts PRIMARY KEY (tenant_id, id)
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_accounts_tenant')
   CREATE INDEX idx_accounts_tenant ON dbo.accounts(tenant_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_accounts_customer')
   CREATE INDEX idx_accounts_customer ON dbo.accounts(tenant_id, customer_id)`,

  `IF OBJECT_ID('dbo.transactions','U') IS NULL
   CREATE TABLE dbo.transactions (
     id           NVARCHAR(255) NOT NULL,
     tenant_id    NVARCHAR(255) NOT NULL,
     account_id   NVARCHAR(255) NOT NULL,
     type         NVARCHAR(50)  NOT NULL,
     amount_cents INT           NOT NULL,
     currency     NVARCHAR(10)  NOT NULL DEFAULT 'USD',
     status       NVARCHAR(50)  NOT NULL DEFAULT 'pending',
     description  NVARCHAR(MAX),
     counterparty NVARCHAR(255),
     posted_at    NVARCHAR(50)  NOT NULL,
     reference_id NVARCHAR(255),
     metadata     NVARCHAR(MAX),
     CONSTRAINT PK_transactions PRIMARY KEY (tenant_id, id)
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_txn_tenant')
   CREATE INDEX idx_txn_tenant ON dbo.transactions(tenant_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_txn_account')
   CREATE INDEX idx_txn_account ON dbo.transactions(tenant_id, account_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_txn_posted_at')
   CREATE INDEX idx_txn_posted_at ON dbo.transactions(tenant_id, posted_at)`,

  `IF OBJECT_ID('dbo.transfers','U') IS NULL
   CREATE TABLE dbo.transfers (
     id              NVARCHAR(255) NOT NULL,
     tenant_id       NVARCHAR(255) NOT NULL,
     type            NVARCHAR(50)  NOT NULL,
     status          NVARCHAR(50)  NOT NULL DEFAULT 'pending',
     amount_cents    INT           NOT NULL,
     currency        NVARCHAR(10)  NOT NULL DEFAULT 'USD',
     from_account_id NVARCHAR(255) NOT NULL,
     to_account_id   NVARCHAR(255),
     to_external     NVARCHAR(MAX),
     description     NVARCHAR(MAX),
     created_at      NVARCHAR(50)  NOT NULL,
     completed_at    NVARCHAR(50),
     reference_id    NVARCHAR(255),
     CONSTRAINT PK_transfers PRIMARY KEY (tenant_id, id)
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_xfer_tenant')
   CREATE INDEX idx_xfer_tenant ON dbo.transfers(tenant_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_xfer_from_account')
   CREATE INDEX idx_xfer_from_account ON dbo.transfers(tenant_id, from_account_id)`,

  `IF OBJECT_ID('dbo.yield_configs','U') IS NULL
   CREATE TABLE dbo.yield_configs (
     account_id                    NVARCHAR(255) NOT NULL,
     tenant_id                     NVARCHAR(255) NOT NULL,
     apy                           FLOAT         NOT NULL DEFAULT 0,
     enabled                       INT           NOT NULL DEFAULT 0,
     accrued_interest_total_cents   INT           NOT NULL DEFAULT 0,
     last_accrual_date             NVARCHAR(50),
     updated_at                    NVARCHAR(50)  NOT NULL,
     CONSTRAINT PK_yield_configs PRIMARY KEY (tenant_id, account_id)
   )`,

  `IF OBJECT_ID('dbo.loan_payments','U') IS NULL
   CREATE TABLE dbo.loan_payments (
     id                NVARCHAR(255) NOT NULL,
     tenant_id         NVARCHAR(255) NOT NULL,
     account_id        NVARCHAR(255) NOT NULL,
     amount_cents      INT           NOT NULL,
     frequency         NVARCHAR(50)  NOT NULL DEFAULT 'monthly',
     status            NVARCHAR(50)  NOT NULL DEFAULT 'active',
     next_payment_date NVARCHAR(50),
     updated_at        NVARCHAR(50)  NOT NULL,
     CONSTRAINT PK_loan_payments PRIMARY KEY (tenant_id, id)
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_lp_account')
   CREATE INDEX idx_lp_account ON dbo.loan_payments(tenant_id, account_id)`,

  `IF OBJECT_ID('dbo.user_defined_fields','U') IS NULL
   CREATE TABLE dbo.user_defined_fields (
     id         NVARCHAR(255) NOT NULL,
     tenant_id  NVARCHAR(255) NOT NULL,
     scope_type NVARCHAR(50)  NOT NULL,
     scope_key  NVARCHAR(255) NOT NULL,
     field_key  NVARCHAR(255) NOT NULL,
     value      NVARCHAR(MAX) NOT NULL DEFAULT '',
     category   NVARCHAR(255),
     updated_at NVARCHAR(50)  NOT NULL,
     metadata   NVARCHAR(MAX),
     CONSTRAINT PK_udf PRIMARY KEY (tenant_id, scope_type, scope_key, id)
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_udf_scope')
   CREATE INDEX idx_udf_scope ON dbo.user_defined_fields(tenant_id, scope_type, scope_key)`,

  `IF OBJECT_ID('dbo.documents','U') IS NULL
   CREATE TABLE dbo.documents (
     id         NVARCHAR(255) NOT NULL,
     tenant_id  NVARCHAR(255) NOT NULL,
     scope_type NVARCHAR(50)  NOT NULL,
     scope_key  NVARCHAR(255) NOT NULL,
     title      NVARCHAR(255) NOT NULL,
     status     NVARCHAR(50)  NOT NULL DEFAULT 'active',
     type       NVARCHAR(50),
     created_at NVARCHAR(50)  NOT NULL,
     updated_at NVARCHAR(50)  NOT NULL,
     payload    NVARCHAR(MAX),
     CONSTRAINT PK_documents PRIMARY KEY (tenant_id, scope_type, scope_key, id)
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_doc_scope')
   CREATE INDEX idx_doc_scope ON dbo.documents(tenant_id, scope_type, scope_key)`,

  // Portal metadata
  `IF OBJECT_ID('dbo.portal_users','U') IS NULL
   CREATE TABLE dbo.portal_users (
     email                 NVARCHAR(255) PRIMARY KEY,
     password_hash         NVARCHAR(255) NOT NULL,
     name                  NVARCHAR(255),
     tenant_id             NVARCHAR(255) NOT NULL,
     created_at            NVARCHAR(50)  NOT NULL,
     failed_login_attempts INT           NOT NULL DEFAULT 0,
     blocked_until         BIGINT
   )`,

  `IF OBJECT_ID('dbo.portal_sessions','U') IS NULL
   CREATE TABLE dbo.portal_sessions (
     token      NVARCHAR(255) PRIMARY KEY,
     email      NVARCHAR(255) NOT NULL,
     tenant_id  NVARCHAR(255) NOT NULL,
     created_at BIGINT        NOT NULL,
     expires_at BIGINT        NOT NULL
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_sess_email')
   CREATE INDEX idx_sess_email ON dbo.portal_sessions(email)`,

  `IF OBJECT_ID('dbo.credentials','U') IS NULL
   CREATE TABLE dbo.credentials (
     id            NVARCHAR(255) PRIMARY KEY,
     tenant_id     NVARCHAR(255) NOT NULL,
     client_id     NVARCHAR(255) NOT NULL UNIQUE,
     client_secret NVARCHAR(255) NOT NULL,
     label         NVARCHAR(255),
     owner_email   NVARCHAR(255),
     created_at    NVARCHAR(50)  NOT NULL,
     rotated_at    NVARCHAR(50),
     revoked_at    NVARCHAR(50),
     expires_at    NVARCHAR(50),
     last_used_at  NVARCHAR(50),
     status        NVARCHAR(50)  NOT NULL DEFAULT 'active'
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_cred_tenant')
   CREATE INDEX idx_cred_tenant ON dbo.credentials(tenant_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_cred_client_id')
   CREATE INDEX idx_cred_client_id ON dbo.credentials(client_id)`,

  `IF OBJECT_ID('dbo.api_activity','U') IS NULL
   CREATE TABLE dbo.api_activity (
     id                 NVARCHAR(255) PRIMARY KEY,
     tenant_id          NVARCHAR(255) NOT NULL,
     client_id          NVARCHAR(255) NOT NULL,
     credential_id      NVARCHAR(255),
     method             NVARCHAR(10)  NOT NULL,
     path               NVARCHAR(MAX) NOT NULL,
     status_code        INT           NOT NULL,
     request_id         NVARCHAR(255) NOT NULL,
     idempotency_key    NVARCHAR(255),
     idempotency_replay INT           DEFAULT 0,
     environment        NVARCHAR(50)  NOT NULL DEFAULT 'sandbox',
     timestamp          NVARCHAR(50)  NOT NULL,
     duration_ms        INT
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_activity_tenant')
   CREATE INDEX idx_activity_tenant ON dbo.api_activity(tenant_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_activity_timestamp')
   CREATE INDEX idx_activity_timestamp ON dbo.api_activity(tenant_id, timestamp)`,

  `IF OBJECT_ID('dbo.audit_log','U') IS NULL
   CREATE TABLE dbo.audit_log (
     id         NVARCHAR(255) PRIMARY KEY,
     tenant_id  NVARCHAR(255) NOT NULL,
     actor      NVARCHAR(255) NOT NULL,
     action     NVARCHAR(255) NOT NULL,
     outcome    NVARCHAR(50)  NOT NULL,
     timestamp  NVARCHAR(50)  NOT NULL,
     request_id NVARCHAR(255),
     details    NVARCHAR(MAX)
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_audit_tenant')
   CREATE INDEX idx_audit_tenant ON dbo.audit_log(tenant_id)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_audit_timestamp')
   CREATE INDEX idx_audit_timestamp ON dbo.audit_log(tenant_id, timestamp)`,

  `IF OBJECT_ID('dbo.idempotency_records','U') IS NULL
   CREATE TABLE dbo.idempotency_records (
     composite_key NVARCHAR(450) PRIMARY KEY,
     tenant_id     NVARCHAR(255) NOT NULL,
     method        NVARCHAR(10)  NOT NULL,
     route         NVARCHAR(255) NOT NULL,
     idem_key      NVARCHAR(255) NOT NULL,
     created_at    BIGINT        NOT NULL,
     status_code   INT           NOT NULL,
     payload       NVARCHAR(MAX) NOT NULL
   )`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='idx_idem_tenant')
   CREATE INDEX idx_idem_tenant ON dbo.idempotency_records(tenant_id)`,
];

/* -------------------------------------------------------------------------- */
/*  Helper: build a MERGE statement for upsert                                */
/* -------------------------------------------------------------------------- */

function mergeStmt(
  table: string,
  pkCols: string[],
  allCols: string[],
): string {
  const srcCols = allCols.map((c) => `@${c} AS ${c}`).join(", ");
  const onClause = pkCols.map((c) => `t.${c} = s.${c}`).join(" AND ");
  const updateCols = allCols
    .filter((c) => !pkCols.includes(c))
    .map((c) => `t.${c} = s.${c}`)
    .join(", ");
  const insertCols = allCols.join(", ");
  const insertVals = allCols.map((c) => `s.${c}`).join(", ");

  let stmt = `MERGE INTO dbo.${table} AS t USING (SELECT ${srcCols}) AS s ON ${onClause}`;
  if (updateCols) {
    stmt += ` WHEN MATCHED THEN UPDATE SET ${updateCols}`;
  }
  stmt += ` WHEN NOT MATCHED THEN INSERT (${insertCols}) VALUES (${insertVals});`;
  return stmt;
}

/* -------------------------------------------------------------------------- */
/*  MSSQL DurableStore implementation                                         */
/* -------------------------------------------------------------------------- */

export class MssqlDurableStore extends DurableStore {
  private pool!: sql.ConnectionPool;

  async init(): Promise<void> {
    const cfg = config.persistence.mssql;

    this.pool = await sql.connect({
      server: cfg.server,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
      pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    });

    // Create schema
    for (const stmt of MSSQL_SCHEMA_STATEMENTS) {
      await this.pool.request().query(stmt);
    }
  }

  /* ------ Legacy blob --------------------------------------------------- */

  async getTenantDatasetPayload(tenantId: string): Promise<string | null> {
    const r = await this.pool
      .request()
      .input("tid", sql.NVarChar, tenantId)
      .query("SELECT payload FROM dbo.tenant_datasets WHERE tenant_id = @tid");
    return r.recordset[0]?.payload ?? null;
  }

  async saveTenantDatasetPayload(tenantId: string, payload: string): Promise<void> {
    const now = new Date().toISOString();
    await this.pool
      .request()
      .input("tid", sql.NVarChar, tenantId)
      .input("payload", sql.NVarChar, payload)
      .input("updated_at", sql.NVarChar, now)
      .query(
        mergeStmt("tenant_datasets", ["tenant_id"], ["tenant_id", "payload", "updated_at"])
          .replace(/@tenant_id/g, "@tid")
      );
  }

  async getFallbackDatasetPayload(tenantId: string): Promise<string | null> {
    const r = await this.pool
      .request()
      .input("tid", sql.NVarChar, tenantId)
      .query("SELECT payload FROM dbo.fallback_datasets WHERE tenant_id = @tid");
    return r.recordset[0]?.payload ?? null;
  }

  async saveFallbackDatasetPayload(tenantId: string, payload: string): Promise<void> {
    const now = new Date().toISOString();
    await this.pool
      .request()
      .input("tid", sql.NVarChar, tenantId)
      .input("payload", sql.NVarChar, payload)
      .input("updated_at", sql.NVarChar, now)
      .query(
        mergeStmt("fallback_datasets", ["tenant_id"], ["tenant_id", "payload", "updated_at"])
          .replace(/@tenant_id/g, "@tid")
      );
  }

  /* ------ Core domain entities ------------------------------------------ */

  async saveTenantEntities(tenantId: string, data: TenantEntityData): Promise<void> {
    const txn = new sql.Transaction(this.pool);
    await txn.begin();

    try {
      const tables = [
        "documents", "user_defined_fields", "loan_payments", "yield_configs",
        "transfers", "transactions", "accounts", "customers",
      ];
      for (const table of tables) {
        await new sql.Request(txn)
          .input("tid", sql.NVarChar, tenantId)
          .query(`DELETE FROM dbo.${table} WHERE tenant_id = @tid`);
      }

      for (const c of data.customers) {
        await new sql.Request(txn)
          .input("id", sql.NVarChar, c.id)
          .input("tenant_id", sql.NVarChar, c.tenant_id)
          .input("external_id", sql.NVarChar, c.external_id)
          .input("first_name", sql.NVarChar, c.first_name)
          .input("last_name", sql.NVarChar, c.last_name)
          .input("email", sql.NVarChar, c.email)
          .input("status", sql.NVarChar, c.status)
          .input("kyc_status", sql.NVarChar, c.kyc_status)
          .input("created_at", sql.NVarChar, c.created_at)
          .input("metadata", sql.NVarChar, c.metadata)
          .query(`INSERT INTO dbo.customers (id, tenant_id, external_id, first_name, last_name, email, status, kyc_status, created_at, metadata)
                  VALUES (@id, @tenant_id, @external_id, @first_name, @last_name, @email, @status, @kyc_status, @created_at, @metadata)`);
      }

      for (const a of data.accounts) {
        await new sql.Request(txn)
          .input("id", sql.NVarChar, a.id)
          .input("tenant_id", sql.NVarChar, a.tenant_id)
          .input("customer_id", sql.NVarChar, a.customer_id)
          .input("type", sql.NVarChar, a.type)
          .input("status", sql.NVarChar, a.status)
          .input("currency", sql.NVarChar, a.currency)
          .input("balance_cents", sql.Int, a.balance_cents)
          .input("available_balance_cents", sql.Int, a.available_balance_cents)
          .input("last_four", sql.NVarChar, a.last_four)
          .input("opened_at", sql.NVarChar, a.opened_at)
          .input("metadata", sql.NVarChar, a.metadata)
          .query(`INSERT INTO dbo.accounts (id, tenant_id, customer_id, type, status, currency, balance_cents, available_balance_cents, last_four, opened_at, metadata)
                  VALUES (@id, @tenant_id, @customer_id, @type, @status, @currency, @balance_cents, @available_balance_cents, @last_four, @opened_at, @metadata)`);
      }

      for (const t of data.transactions) {
        await new sql.Request(txn)
          .input("id", sql.NVarChar, t.id)
          .input("tenant_id", sql.NVarChar, t.tenant_id)
          .input("account_id", sql.NVarChar, t.account_id)
          .input("type", sql.NVarChar, t.type)
          .input("amount_cents", sql.Int, t.amount_cents)
          .input("currency", sql.NVarChar, t.currency)
          .input("status", sql.NVarChar, t.status)
          .input("description", sql.NVarChar, t.description)
          .input("counterparty", sql.NVarChar, t.counterparty)
          .input("posted_at", sql.NVarChar, t.posted_at)
          .input("reference_id", sql.NVarChar, t.reference_id)
          .input("metadata", sql.NVarChar, t.metadata)
          .query(`INSERT INTO dbo.transactions (id, tenant_id, account_id, type, amount_cents, currency, status, description, counterparty, posted_at, reference_id, metadata)
                  VALUES (@id, @tenant_id, @account_id, @type, @amount_cents, @currency, @status, @description, @counterparty, @posted_at, @reference_id, @metadata)`);
      }

      for (const x of data.transfers) {
        await new sql.Request(txn)
          .input("id", sql.NVarChar, x.id)
          .input("tenant_id", sql.NVarChar, x.tenant_id)
          .input("type", sql.NVarChar, x.type)
          .input("status", sql.NVarChar, x.status)
          .input("amount_cents", sql.Int, x.amount_cents)
          .input("currency", sql.NVarChar, x.currency)
          .input("from_account_id", sql.NVarChar, x.from_account_id)
          .input("to_account_id", sql.NVarChar, x.to_account_id)
          .input("to_external", sql.NVarChar, x.to_external)
          .input("description", sql.NVarChar, x.description)
          .input("created_at", sql.NVarChar, x.created_at)
          .input("completed_at", sql.NVarChar, x.completed_at)
          .input("reference_id", sql.NVarChar, x.reference_id)
          .query(`INSERT INTO dbo.transfers (id, tenant_id, type, status, amount_cents, currency, from_account_id, to_account_id, to_external, description, created_at, completed_at, reference_id)
                  VALUES (@id, @tenant_id, @type, @status, @amount_cents, @currency, @from_account_id, @to_account_id, @to_external, @description, @created_at, @completed_at, @reference_id)`);
      }

      for (const y of data.yieldConfigs) {
        await new sql.Request(txn)
          .input("account_id", sql.NVarChar, y.account_id)
          .input("tenant_id", sql.NVarChar, y.tenant_id)
          .input("apy", sql.Float, y.apy)
          .input("enabled", sql.Int, y.enabled)
          .input("accrued_interest_total_cents", sql.Int, y.accrued_interest_total_cents)
          .input("last_accrual_date", sql.NVarChar, y.last_accrual_date)
          .input("updated_at", sql.NVarChar, y.updated_at)
          .query(`INSERT INTO dbo.yield_configs (account_id, tenant_id, apy, enabled, accrued_interest_total_cents, last_accrual_date, updated_at)
                  VALUES (@account_id, @tenant_id, @apy, @enabled, @accrued_interest_total_cents, @last_accrual_date, @updated_at)`);
      }

      for (const lp of data.loanPayments) {
        await new sql.Request(txn)
          .input("id", sql.NVarChar, lp.id)
          .input("tenant_id", sql.NVarChar, lp.tenant_id)
          .input("account_id", sql.NVarChar, lp.account_id)
          .input("amount_cents", sql.Int, lp.amount_cents)
          .input("frequency", sql.NVarChar, lp.frequency)
          .input("status", sql.NVarChar, lp.status)
          .input("next_payment_date", sql.NVarChar, lp.next_payment_date)
          .input("updated_at", sql.NVarChar, lp.updated_at)
          .query(`INSERT INTO dbo.loan_payments (id, tenant_id, account_id, amount_cents, frequency, status, next_payment_date, updated_at)
                  VALUES (@id, @tenant_id, @account_id, @amount_cents, @frequency, @status, @next_payment_date, @updated_at)`);
      }

      for (const u of data.userDefinedFields) {
        await new sql.Request(txn)
          .input("id", sql.NVarChar, u.id)
          .input("tenant_id", sql.NVarChar, u.tenant_id)
          .input("scope_type", sql.NVarChar, u.scope_type)
          .input("scope_key", sql.NVarChar, u.scope_key)
          .input("field_key", sql.NVarChar, u.field_key)
          .input("value", sql.NVarChar, u.value)
          .input("category", sql.NVarChar, u.category)
          .input("updated_at", sql.NVarChar, u.updated_at)
          .input("metadata", sql.NVarChar, u.metadata)
          .query(`INSERT INTO dbo.user_defined_fields (id, tenant_id, scope_type, scope_key, field_key, value, category, updated_at, metadata)
                  VALUES (@id, @tenant_id, @scope_type, @scope_key, @field_key, @value, @category, @updated_at, @metadata)`);
      }

      for (const d of data.documents) {
        await new sql.Request(txn)
          .input("id", sql.NVarChar, d.id)
          .input("tenant_id", sql.NVarChar, d.tenant_id)
          .input("scope_type", sql.NVarChar, d.scope_type)
          .input("scope_key", sql.NVarChar, d.scope_key)
          .input("title", sql.NVarChar, d.title)
          .input("status", sql.NVarChar, d.status)
          .input("type", sql.NVarChar, d.type)
          .input("created_at", sql.NVarChar, d.created_at)
          .input("updated_at", sql.NVarChar, d.updated_at)
          .input("payload", sql.NVarChar, d.payload)
          .query(`INSERT INTO dbo.documents (id, tenant_id, scope_type, scope_key, title, status, type, created_at, updated_at, payload)
                  VALUES (@id, @tenant_id, @scope_type, @scope_key, @title, @status, @type, @created_at, @updated_at, @payload)`);
      }

      await txn.commit();
    } catch (err) {
      await txn.rollback();
      throw err;
    }
  }

  async loadTenantEntities(tenantId: string): Promise<TenantEntityData | null> {
    const req = () => this.pool.request().input("tid", sql.NVarChar, tenantId);

    const customers = (await req().query("SELECT * FROM dbo.customers WHERE tenant_id = @tid")).recordset as CustomerRow[];
    if (customers.length === 0) {
      const accounts = (await req().query("SELECT * FROM dbo.accounts WHERE tenant_id = @tid")).recordset as AccountRow[];
      if (accounts.length === 0) return null;
    }

    return {
      customers,
      accounts: (await req().query("SELECT * FROM dbo.accounts WHERE tenant_id = @tid")).recordset as AccountRow[],
      transactions: (await req().query("SELECT * FROM dbo.transactions WHERE tenant_id = @tid")).recordset as TransactionRow[],
      transfers: (await req().query("SELECT * FROM dbo.transfers WHERE tenant_id = @tid")).recordset as TransferRow[],
      yieldConfigs: (await req().query("SELECT * FROM dbo.yield_configs WHERE tenant_id = @tid")).recordset as YieldConfigRow[],
      loanPayments: (await req().query("SELECT * FROM dbo.loan_payments WHERE tenant_id = @tid")).recordset as LoanPaymentRow[],
      userDefinedFields: (await req().query("SELECT * FROM dbo.user_defined_fields WHERE tenant_id = @tid")).recordset as UserDefinedFieldRow[],
      documents: (await req().query("SELECT * FROM dbo.documents WHERE tenant_id = @tid")).recordset as DocumentRow[],
    };
  }

  async deleteTenantEntities(tenantId: string): Promise<void> {
    const tables = [
      "documents", "user_defined_fields", "loan_payments", "yield_configs",
      "transfers", "transactions", "accounts", "customers",
    ];
    for (const table of tables) {
      await this.pool
        .request()
        .input("tid", sql.NVarChar, tenantId)
        .query(`DELETE FROM dbo.${table} WHERE tenant_id = @tid`);
    }
  }

  /* ------ Portal users -------------------------------------------------- */

  async upsertPortalUser(user: PortalUserRow): Promise<void> {
    await this.pool
      .request()
      .input("email", sql.NVarChar, user.email)
      .input("password_hash", sql.NVarChar, user.password_hash)
      .input("name", sql.NVarChar, user.name)
      .input("tenant_id", sql.NVarChar, user.tenant_id)
      .input("created_at", sql.NVarChar, user.created_at)
      .input("failed_login_attempts", sql.Int, user.failed_login_attempts)
      .input("blocked_until", sql.BigInt, user.blocked_until)
      .query(mergeStmt("portal_users", ["email"], [
        "email", "password_hash", "name", "tenant_id", "created_at", "failed_login_attempts", "blocked_until",
      ]));
  }

  async getPortalUser(email: string): Promise<PortalUserRow | null> {
    const r = await this.pool
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM dbo.portal_users WHERE email = @email");
    return (r.recordset[0] as PortalUserRow | undefined) ?? null;
  }

  async getAllPortalUsers(): Promise<PortalUserRow[]> {
    const r = await this.pool.request().query("SELECT * FROM dbo.portal_users");
    return r.recordset as PortalUserRow[];
  }

  /* ------ Portal sessions ----------------------------------------------- */

  async upsertPortalSession(session: PortalSessionRow): Promise<void> {
    await this.pool
      .request()
      .input("token", sql.NVarChar, session.token)
      .input("email", sql.NVarChar, session.email)
      .input("tenant_id", sql.NVarChar, session.tenant_id)
      .input("created_at", sql.BigInt, session.created_at)
      .input("expires_at", sql.BigInt, session.expires_at)
      .query(mergeStmt("portal_sessions", ["token"], [
        "token", "email", "tenant_id", "created_at", "expires_at",
      ]));
  }

  async getPortalSession(token: string): Promise<PortalSessionRow | null> {
    const r = await this.pool
      .request()
      .input("token", sql.NVarChar, token)
      .query("SELECT * FROM dbo.portal_sessions WHERE token = @token");
    return (r.recordset[0] as PortalSessionRow | undefined) ?? null;
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.pool
      .request()
      .input("now", sql.BigInt, Date.now())
      .query("DELETE FROM dbo.portal_sessions WHERE expires_at < @now");
  }

  /* ------ Credentials --------------------------------------------------- */

  async upsertCredential(cred: CredentialRow): Promise<void> {
    await this.pool
      .request()
      .input("id", sql.NVarChar, cred.id)
      .input("tenant_id", sql.NVarChar, cred.tenant_id)
      .input("client_id", sql.NVarChar, cred.client_id)
      .input("client_secret", sql.NVarChar, cred.client_secret)
      .input("label", sql.NVarChar, cred.label)
      .input("owner_email", sql.NVarChar, cred.owner_email)
      .input("created_at", sql.NVarChar, cred.created_at)
      .input("rotated_at", sql.NVarChar, cred.rotated_at)
      .input("revoked_at", sql.NVarChar, cred.revoked_at)
      .input("expires_at", sql.NVarChar, cred.expires_at)
      .input("last_used_at", sql.NVarChar, cred.last_used_at)
      .input("status", sql.NVarChar, cred.status)
      .query(mergeStmt("credentials", ["id"], [
        "id", "tenant_id", "client_id", "client_secret", "label", "owner_email",
        "created_at", "rotated_at", "revoked_at", "expires_at", "last_used_at", "status",
      ]));
  }

  async getCredentialById(id: string): Promise<CredentialRow | null> {
    const r = await this.pool
      .request()
      .input("id", sql.NVarChar, id)
      .query("SELECT * FROM dbo.credentials WHERE id = @id");
    return (r.recordset[0] as CredentialRow | undefined) ?? null;
  }

  async getCredentialByClientId(clientId: string): Promise<CredentialRow | null> {
    const r = await this.pool
      .request()
      .input("cid", sql.NVarChar, clientId)
      .query("SELECT * FROM dbo.credentials WHERE client_id = @cid");
    return (r.recordset[0] as CredentialRow | undefined) ?? null;
  }

  async listCredentialsByTenant(tenantId: string): Promise<CredentialRow[]> {
    const r = await this.pool
      .request()
      .input("tid", sql.NVarChar, tenantId)
      .query("SELECT * FROM dbo.credentials WHERE tenant_id = @tid ORDER BY created_at DESC");
    return r.recordset as CredentialRow[];
  }

  async getAllCredentials(): Promise<CredentialRow[]> {
    const r = await this.pool.request().query("SELECT * FROM dbo.credentials");
    return r.recordset as CredentialRow[];
  }

  /* ------ API activity -------------------------------------------------- */

  async insertApiActivity(entry: ApiActivityRow): Promise<void> {
    await this.pool
      .request()
      .input("id", sql.NVarChar, entry.id)
      .input("tenant_id", sql.NVarChar, entry.tenant_id)
      .input("client_id", sql.NVarChar, entry.client_id)
      .input("credential_id", sql.NVarChar, entry.credential_id)
      .input("method", sql.NVarChar, entry.method)
      .input("path", sql.NVarChar, entry.path)
      .input("status_code", sql.Int, entry.status_code)
      .input("request_id", sql.NVarChar, entry.request_id)
      .input("idempotency_key", sql.NVarChar, entry.idempotency_key)
      .input("idempotency_replay", sql.Int, entry.idempotency_replay)
      .input("environment", sql.NVarChar, entry.environment)
      .input("timestamp", sql.NVarChar, entry.timestamp)
      .input("duration_ms", sql.Int, entry.duration_ms)
      .query(`INSERT INTO dbo.api_activity (id, tenant_id, client_id, credential_id, method, path, status_code, request_id, idempotency_key, idempotency_replay, environment, timestamp, duration_ms)
              VALUES (@id, @tenant_id, @client_id, @credential_id, @method, @path, @status_code, @request_id, @idempotency_key, @idempotency_replay, @environment, @timestamp, @duration_ms)`);
  }

  async listApiActivity(params: ApiActivityQueryParams): Promise<ApiActivityRow[]> {
    const req = this.pool.request();
    let where = "WHERE tenant_id = @tid";
    req.input("tid", sql.NVarChar, params.tenantId);

    if (params.environment) {
      where += " AND environment = @env";
      req.input("env", sql.NVarChar, params.environment);
    }
    if (params.method) {
      where += " AND method = @meth";
      req.input("meth", sql.NVarChar, params.method.toUpperCase());
    }
    if (params.pathContains) {
      where += " AND path LIKE @pathLike";
      req.input("pathLike", sql.NVarChar, `%${params.pathContains}%`);
    }
    if (typeof params.statusCode === "number") {
      where += " AND status_code = @sc";
      req.input("sc", sql.Int, params.statusCode);
    }

    const limit = Math.max(1, Math.min(params.limit ?? 100, 500));
    req.input("lim", sql.Int, limit);

    const r = await req.query(
      `SELECT TOP(@lim) * FROM dbo.api_activity ${where} ORDER BY timestamp DESC`
    );
    return r.recordset as ApiActivityRow[];
  }

  async pruneApiActivity(tenantId: string, keepCount: number): Promise<void> {
    await this.pool
      .request()
      .input("tid", sql.NVarChar, tenantId)
      .input("keep", sql.Int, keepCount)
      .query(
        `DELETE FROM dbo.api_activity WHERE tenant_id = @tid AND id NOT IN (
           SELECT TOP(@keep) id FROM dbo.api_activity WHERE tenant_id = @tid ORDER BY timestamp DESC
         )`
      );
  }

  /* ------ Audit log ----------------------------------------------------- */

  async insertAuditEntry(entry: AuditLogRow): Promise<void> {
    await this.pool
      .request()
      .input("id", sql.NVarChar, entry.id)
      .input("tenant_id", sql.NVarChar, entry.tenant_id)
      .input("actor", sql.NVarChar, entry.actor)
      .input("action", sql.NVarChar, entry.action)
      .input("outcome", sql.NVarChar, entry.outcome)
      .input("timestamp", sql.NVarChar, entry.timestamp)
      .input("request_id", sql.NVarChar, entry.request_id)
      .input("details", sql.NVarChar, entry.details)
      .query(`INSERT INTO dbo.audit_log (id, tenant_id, actor, action, outcome, timestamp, request_id, details)
              VALUES (@id, @tenant_id, @actor, @action, @outcome, @timestamp, @request_id, @details)`);
  }

  async listAuditEntries(tenantId: string, limit: number = 100): Promise<AuditLogRow[]> {
    const lim = Math.max(1, Math.min(limit, 500));
    const r = await this.pool
      .request()
      .input("tid", sql.NVarChar, tenantId)
      .input("lim", sql.Int, lim)
      .query("SELECT TOP(@lim) * FROM dbo.audit_log WHERE tenant_id = @tid ORDER BY timestamp DESC");
    return r.recordset as AuditLogRow[];
  }

  async pruneAuditLog(tenantId: string, keepCount: number): Promise<void> {
    await this.pool
      .request()
      .input("tid", sql.NVarChar, tenantId)
      .input("keep", sql.Int, keepCount)
      .query(
        `DELETE FROM dbo.audit_log WHERE tenant_id = @tid AND id NOT IN (
           SELECT TOP(@keep) id FROM dbo.audit_log WHERE tenant_id = @tid ORDER BY timestamp DESC
         )`
      );
  }

  /* ------ Idempotency --------------------------------------------------- */

  async upsertIdempotencyRecord(record: IdempotencyRow): Promise<void> {
    await this.pool
      .request()
      .input("composite_key", sql.NVarChar, record.composite_key)
      .input("tenant_id", sql.NVarChar, record.tenant_id)
      .input("method", sql.NVarChar, record.method)
      .input("route", sql.NVarChar, record.route)
      .input("idem_key", sql.NVarChar, record.idem_key)
      .input("created_at", sql.BigInt, record.created_at)
      .input("status_code", sql.Int, record.status_code)
      .input("payload", sql.NVarChar, record.payload)
      .query(mergeStmt("idempotency_records", ["composite_key"], [
        "composite_key", "tenant_id", "method", "route", "idem_key", "created_at", "status_code", "payload",
      ]));
  }

  async getIdempotencyRecord(compositeKey: string): Promise<IdempotencyRow | null> {
    const r = await this.pool
      .request()
      .input("ck", sql.NVarChar, compositeKey)
      .query("SELECT * FROM dbo.idempotency_records WHERE composite_key = @ck");
    return (r.recordset[0] as IdempotencyRow | undefined) ?? null;
  }

  async deleteExpiredIdempotencyRecords(maxAgeMs: number): Promise<void> {
    const cutoff = Date.now() - maxAgeMs;
    await this.pool
      .request()
      .input("cutoff", sql.BigInt, cutoff)
      .query("DELETE FROM dbo.idempotency_records WHERE created_at < @cutoff");
  }

  async getDistinctTenantIds(): Promise<string[]> {
    const r = await this.pool
      .request()
      .query("SELECT DISTINCT tenant_id FROM dbo.customers UNION SELECT DISTINCT tenant_id FROM dbo.accounts");
    return (r.recordset as Array<{ tenant_id: string }>).map((row) => row.tenant_id);
  }
}
