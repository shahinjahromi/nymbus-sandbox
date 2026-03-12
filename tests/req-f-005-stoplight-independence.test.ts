/**
 * REQ-F-005: Stoplight runtime independence.
 * Success of this test proves local request handling and persistence work without any external mock runtime dependency.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-005: Stoplight independence", () => {
  it("persists simulator writes locally and serves docs/endpoints directly from this backend", async () => {
    const docsRes = await request(app).get("/docs").expect(200);
    expect(typeof docsRes.text).toBe("string");
    expect(docsRes.text.length).toBeGreaterThan(0);

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
    const idempotencyKey = `v1-transfer-${Date.now()}`;

    const createTransferRes = await request(app)
      .post("/v1.0/transfers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .set("x-idempotency-key", idempotencyKey)
      .send({
        type: "internal",
        from_account_id: "acct_sand_001",
        to_account_id: "acct_sand_002",
        amount: 25,
      })
      .expect(201);

    const transferId = createTransferRes.body.id as string;

    const getTransferRes = await request(app)
      .get(`/v1.0/transfers/${transferId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(getTransferRes.body.id).toBe(transferId);

    const replayRes = await request(app)
      .post("/v1.0/transfers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .set("x-idempotency-key", idempotencyKey)
      .send({
        type: "internal",
        from_account_id: "acct_sand_001",
        to_account_id: "acct_sand_002",
        amount: 25,
      })
      .expect(201);

    expect(replayRes.headers["x-idempotent-replay"]).toBe("true");
    expect(replayRes.body.id).toBe(transferId);
  });
});
