/**
 * REQ-F-008: Transfer and card simulation controls.
 * Success of this test proves ACH/wire/card simulation actions affect ledger and history.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

async function portalSession() {
  const email = `sim_${Date.now()}@example.com`;
  const password = "Portal!123";

  await request(app)
    .post("/portal-api/register")
    .set("Content-Type", "application/json")
    .send({ email, password, name: "Simulation Tester" })
    .expect(201);

  const loginRes = await request(app)
    .post("/portal-api/login")
    .set("Content-Type", "application/json")
    .send({ email, password })
    .expect(200);

  return loginRes.body.portal_token as string;
}

describe("REQ-F-008: ACH, wire, and card simulation", () => {
  it("simulates incoming ACH and wire plus card post and updates account balance", async () => {
    const portalToken = await portalSession();
    const accountId = "acct_sand_001";

    const beforeAccountRes = await request(app)
      .get(`/portal-api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const startingBalance = Number(beforeAccountRes.body.account.balance);

    await request(app)
      .post("/portal-api/simulations/ach-incoming")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ account_id: accountId, amount: 100 })
      .expect(201);

    await request(app)
      .post("/portal-api/simulations/wire-incoming")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ account_id: accountId, amount: 75 })
      .expect(201);

    const cardPostRes = await request(app)
      .post("/portal-api/simulations/card")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ account_id: accountId, amount: 20, event_type: "post" })
      .expect(201);

    expect(cardPostRes.body.transaction).toHaveProperty("referenceId");
    expect(cardPostRes.body.transaction.type).toBe("debit");

    const afterAccountRes = await request(app)
      .get(`/portal-api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const endingBalance = Number(afterAccountRes.body.account.balance);
    expect(endingBalance).toBeCloseTo(startingBalance + 100 + 75 - 20, 2);

    const transactionsRes = await request(app)
      .get(`/portal-api/accounts/${accountId}/transactions`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const hasAchCredit = transactionsRes.body.data.some(
      (txn: { description: string; amount: number }) =>
        typeof txn.description === "string" && txn.description.toLowerCase().includes("ach") && txn.amount > 0
    );
    const hasWireCredit = transactionsRes.body.data.some(
      (txn: { description: string; amount: number }) =>
        typeof txn.description === "string" && txn.description.toLowerCase().includes("wire") && txn.amount > 0
    );
    const hasCardDebit = transactionsRes.body.data.some(
      (txn: { description: string; amount: number; type: string }) =>
        txn.type === "debit" && typeof txn.description === "string" && txn.description.toLowerCase().includes("card")
    );

    expect(hasAchCredit).toBe(true);
    expect(hasWireCredit).toBe(true);
    expect(hasCardDebit).toBe(true);
  });
});
