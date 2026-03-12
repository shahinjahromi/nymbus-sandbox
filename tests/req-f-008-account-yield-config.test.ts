/**
 * REQ-F-008: Account yield configuration controls.
 * Success of this test proves APY configuration is persisted and retrievable per account.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-008: Yield configuration", () => {
  it("sets and retrieves account yield config", async () => {
    const email = `yield_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Yield Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;
    const accountId = "acct_sand_002";

    const upsertRes = await request(app)
      .post(`/portal-api/accounts/${accountId}/yield-config`)
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ apy: 3.25, enabled: true })
      .expect(200);

    expect(upsertRes.body.yield_config).toMatchObject({
      accountId,
      apy: 3.25,
      enabled: true,
    });

    const getRes = await request(app)
      .get(`/portal-api/accounts/${accountId}/yield-config`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(getRes.body.yield_config).toMatchObject({
      accountId,
      apy: 3.25,
      enabled: true,
    });
  });
});
