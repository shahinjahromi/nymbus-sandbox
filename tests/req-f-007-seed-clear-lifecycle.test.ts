/**
 * REQ-F-007: Seed/reset lifecycle operations.
 * Success of this test proves per-account seed and reset controls operate as expected.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-007: Seed and reset lifecycle", () => {
  it("seeds deterministic account data and resets back to clean baseline", async () => {
    const email = `seed_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Seed Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;
    const accountId = "acct_sand_001";

    const seedRes = await request(app)
      .post(`/portal-api/accounts/${accountId}/seed`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(seedRes.body.seeded_transactions.length).toBeGreaterThan(0);
    expect(
      seedRes.body.seeded_transactions.every((txn: { id: string }) => txn.id.startsWith(`seed_txn_${accountId}`))
    ).toBe(true);

    const afterSeedTxnRes = await request(app)
      .get(`/portal-api/accounts/${accountId}/transactions`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(
      afterSeedTxnRes.body.data.some((txn: { id: string }) => txn.id.startsWith(`seed_txn_${accountId}`))
    ).toBe(true);

    await request(app)
      .post(`/portal-api/accounts/${accountId}/reset`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const afterResetTxnRes = await request(app)
      .get(`/portal-api/accounts/${accountId}/transactions`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(
      afterResetTxnRes.body.data.some((txn: { id: string }) => txn.id.startsWith(`seed_txn_${accountId}`))
    ).toBe(false);
  });
});
