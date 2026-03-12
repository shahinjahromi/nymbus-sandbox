/**
 * REQ-F-007: Tenant data visibility.
 * Success of this test proves portal can view tenant users/accounts and account transactions.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-007: Tenant data visibility", () => {
  it("lists tenant users/accounts and account transaction history", async () => {
    const email = `ops_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Ops Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const usersRes = await request(app)
      .get("/portal-api/users")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const accountsRes = await request(app)
      .get("/portal-api/accounts")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(Array.isArray(usersRes.body.data)).toBe(true);
    expect(Array.isArray(accountsRes.body.data)).toBe(true);
    expect(accountsRes.body.data.length).toBeGreaterThan(0);

    const accountId = accountsRes.body.data[0].id as string;
    const accountDetailRes = await request(app)
      .get(`/portal-api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(accountDetailRes.body.account).toHaveProperty("balance");

    const transactionsRes = await request(app)
      .get(`/portal-api/accounts/${accountId}/transactions`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(Array.isArray(transactionsRes.body.data)).toBe(true);
  });
});
