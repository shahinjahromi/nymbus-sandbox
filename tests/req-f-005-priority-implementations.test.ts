/**
 * REQ-F-005: Prioritized implementation tranche.
 * Success proves high-impact fallback endpoints now use concrete tenant-store behavior.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-005: prioritized endpoint implementations", () => {
  it("supports customer-account nesting, account search, and transfer transaction flows", async () => {
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

    const createCustomerRes = await request(app)
      .post("/v1.0/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        first_name: "Priority",
        last_name: "Customer",
        email: `priority-${Date.now()}@example.test`,
      })
      .expect(201);

    const customerId = createCustomerRes.body.customer.id as string;
    expect(customerId).toMatch(/^cust_/);

    const createAccountRes = await request(app)
      .post(`/v1.0/customers/${customerId}/accounts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        type: "checking",
        initial_balance: 250,
      })
      .expect(201);

    const accountId = createAccountRes.body.account.id as string;
    expect(accountId).toMatch(/^acct_/);

    const customerAccountsRes = await request(app)
      .get(`/v1.0/customers/${customerId}/accounts`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(customerAccountsRes.body.total).toBeGreaterThanOrEqual(1);
    expect(customerAccountsRes.body.data.some((account: { id: string }) => account.id === accountId)).toBe(true);

    const accountSearchRes = await request(app)
      .post("/v1.0/accounts/search")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ customer_id: customerId })
      .expect(200);

    expect(accountSearchRes.body.data.some((account: { id: string }) => account.id === accountId)).toBe(true);

    const transferRes = await request(app)
      .post(`/v1.0/customers/${customerId}/transfers/transfer`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        from_account_id: accountId,
        to_account_id: "acct_sand_001",
        amount: 25,
        type: "internal",
      })
      .expect(201);

    expect(transferRes.body).toHaveProperty("id");

    const customerTransfersRes = await request(app)
      .get(`/v1.0/customers/${customerId}/transfers`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(customerTransfersRes.body.total).toBeGreaterThanOrEqual(1);

    const accountTransactionsRes = await request(app)
      .get(`/v1.0/accounts/${accountId}/transactions`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(accountTransactionsRes.body.total).toBeGreaterThanOrEqual(1);

    const externalTransferRes = await request(app)
      .post("/v1.0/transactions/externalTransfer")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        from_account_id: accountId,
        routing_number: "021000021",
        account_number: "1234567890",
        amount: 15,
      })
      .expect(201);

    expect(externalTransferRes.body.toExternal).toBeDefined();
    expect(externalTransferRes.body.fromAccountId).toBe(accountId);
  });
});
