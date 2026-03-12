import Database from "better-sqlite3";
import { existsSync, mkdirSync, rmSync } from "fs";
import { dirname, resolve } from "path";
import { config } from "../config.js";

interface DatasetRow {
  payload: string;
}

class DurableStore {
  private readonly db: Database.Database;

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

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenant_datasets (
        tenant_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fallback_datasets (
        tenant_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  getTenantDatasetPayload(tenantId: string): string | null {
    const row = this.db
      .prepare("SELECT payload FROM tenant_datasets WHERE tenant_id = ?")
      .get(tenantId) as DatasetRow | undefined;

    return row?.payload ?? null;
  }

  saveTenantDatasetPayload(tenantId: string, payload: string): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO tenant_datasets (tenant_id, payload, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(tenant_id)
        DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
        `
      )
      .run(tenantId, payload, now);
  }

  getFallbackDatasetPayload(tenantId: string): string | null {
    const row = this.db
      .prepare("SELECT payload FROM fallback_datasets WHERE tenant_id = ?")
      .get(tenantId) as DatasetRow | undefined;

    return row?.payload ?? null;
  }

  saveFallbackDatasetPayload(tenantId: string, payload: string): void {
    const now = new Date().toISOString();

    this.db
      .prepare(
        `
        INSERT INTO fallback_datasets (tenant_id, payload, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(tenant_id)
        DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
        `
      )
      .run(tenantId, payload, now);
  }
}

export const durableStore = new DurableStore();
