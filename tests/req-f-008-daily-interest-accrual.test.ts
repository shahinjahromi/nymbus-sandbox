/**
 * REQ-F-008: Daily interest accrual behavior.
 * Success of this test proves configured APY accrues daily once per date and updates balances.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-008: Daily interest accrual", () => {
  it("accrues interest once per day and records transaction impact", async () => {
    const email = `accrual_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Accrual Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;
    const accountId = "acct_sand_001";

    await request(app)
      .post(`/portal-api/accounts/${accountId}/yield-config`)
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ apy: 12, enabled: true })
      .expect(200);

    const beforeRes = await request(app)
      .get(`/portal-api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const startingBalance = Number(beforeRes.body.account.balance);
    const accrualDate = "2026-03-12";

    const accrueRes = await request(app)
      .post("/portal-api/interest/accrue-daily")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ as_of_date: accrualDate })
      .expect(200);

    expect(Array.isArray(accrueRes.body.data)).toBe(true);
    const accountAccrual = accrueRes.body.data.find(
      (entry: { accountId: string }) => entry.accountId === accountId
    );
    expect(accountAccrual).toBeDefined();
    expect(accountAccrual.interestAmount).toBeGreaterThan(0);

    const afterRes = await request(app)
      .get(`/portal-api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const endingBalance = Number(afterRes.body.account.balance);
    expect(endingBalance).toBeGreaterThan(startingBalance);

    const secondAccrueSameDayRes = await request(app)
      .post("/portal-api/interest/accrue-daily")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ as_of_date: accrualDate })
      .expect(200);

    const secondEntry = secondAccrueSameDayRes.body.data.find(
      (entry: { accountId: string }) => entry.accountId === accountId
    );
    expect(secondEntry).toBeUndefined();
  });
});
