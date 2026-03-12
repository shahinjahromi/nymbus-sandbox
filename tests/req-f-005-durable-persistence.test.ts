/**
 * REQ-F-005: Durable persistence backing.
 * Success proves tenant data survives runtime cache reset using durable SQLite store.
 */
import { existsSync } from "fs";
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { config } from "../src/config.js";
import { resetTenantStoreRuntimeCacheForTests } from "../src/services/tenant-store.js";

describe("REQ-F-005: durable persistence", () => {
  it("persists core entities in durable store across runtime cache reset", async () => {
    const tokenRes = await request(app)
      .post("/v1.0/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: "sandbox_dev_001",
        client_secret: "sandbox_secret_change_in_production",
        grant_type: "client_credentials",
      })
      .expect(200);

    const accessToken = tokenRes.body.access_token as string;

    const customerRes = await request(app)
      .post("/v1.0/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        first_name: "Durable",
        last_name: "Store",
        email: `durable-${Date.now()}@example.test`,
      })
      .expect(201);

    const customerId = customerRes.body.customer.id as string;

    const accountRes = await request(app)
      .post(`/v1.0/customers/${customerId}/accounts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        type: "checking",
        initial_balance: 75,
      })
      .expect(201);

    const accountId = accountRes.body.account.id as string;

    const transferRes = await request(app)
      .post("/v1.0/transfers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        type: "internal",
        from_account_id: accountId,
        to_account_id: "acct_sand_001",
        amount: 12,
      })
      .expect(201);

    const transferId = transferRes.body.id as string;

    await resetTenantStoreRuntimeCacheForTests();

    const transferReadRes = await request(app)
      .get(`/v1.0/transfers/${transferId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(transferReadRes.body.id).toBe(transferId);

    const accountReadRes = await request(app)
      .get(`/v1.0/accounts/${accountId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(accountReadRes.body.id).toBe(accountId);

    if (config.persistence.sqlitePath !== ":memory:") {
      expect(existsSync(config.persistence.sqlitePath)).toBe(true);
    }
  });
});
