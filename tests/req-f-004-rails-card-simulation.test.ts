/**
 * REQ-F-004: Payment-rail and card lifecycle simulation.
 * Success of this test proves incoming/outgoing rail flows and card lifecycle validity checks.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-004: Rails and card lifecycle", () => {
  it("simulates outgoing ACH, incoming wire, and valid/invalid card transitions", async () => {
    const email = `rails_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Rails Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;
    const accountId = "acct_sand_001";

    const beforeRes = await request(app)
      .get(`/portal-api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const startingBalance = Number(beforeRes.body.account.balance);

    const achOutgoingRes = await request(app)
      .post("/portal-api/simulations/ach-outgoing")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({
        account_id: accountId,
        amount: 60,
        routing_number: "021000021",
        account_number: "123456789",
        recipient_name: "Landlord",
      })
      .expect(201);

    expect(achOutgoingRes.body.transfer.type).toBe("ach");
    expect(achOutgoingRes.body.transfer.status).toBe("completed");

    const wireIncomingRes = await request(app)
      .post("/portal-api/simulations/wire-incoming")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ account_id: accountId, amount: 125 })
      .expect(201);

    expect(wireIncomingRes.body.transfer.type).toBe("wire");

    const cardReferenceId = `card_ref_${Date.now()}`;

    await request(app)
      .post("/portal-api/simulations/card")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({
        account_id: accountId,
        amount: 30,
        event_type: "authorization",
        reference_id: cardReferenceId,
      })
      .expect(201);

    await request(app)
      .post("/portal-api/simulations/card")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({
        account_id: accountId,
        amount: 30,
        event_type: "post",
        reference_id: cardReferenceId,
      })
      .expect(201);

    await request(app)
      .post("/portal-api/simulations/card")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({
        account_id: accountId,
        amount: 20,
        event_type: "refund",
        reference_id: cardReferenceId,
      })
      .expect(201);

    await request(app)
      .post("/portal-api/simulations/card")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({
        account_id: accountId,
        amount: 10,
        event_type: "void",
        reference_id: `missing_void_${Date.now()}`,
      })
      .expect(409);

    const invalidRefundRes = await request(app)
      .post("/portal-api/simulations/card")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({
        account_id: accountId,
        amount: 10,
        event_type: "refund",
        reference_id: `missing_refund_${Date.now()}`,
      })
      .expect(409);

    expect(invalidRefundRes.body.code).toBe("INVALID_STATE_TRANSITION");

    const afterRes = await request(app)
      .get(`/portal-api/accounts/${accountId}`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const endingBalance = Number(afterRes.body.account.balance);
    expect(endingBalance).toBeCloseTo(startingBalance + 55, 2);
  });
});
