/**
 * REQ-F-005: Contract model parity (representative).
 * Success of this test proves representative versioned request/response shapes match the sandbox contract style.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-005: Contract model parity", () => {
  it("returns contract-like success and error models on versioned endpoints", async () => {
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

    const accountsRes = await request(app)
      .get("/v1.0/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(accountsRes.body).toHaveProperty("data");
    expect(accountsRes.body).toHaveProperty("total");
    expect(accountsRes.body).toHaveProperty("page");
    expect(accountsRes.body).toHaveProperty("pageSize");
    expect(accountsRes.body).toHaveProperty("hasMore");

    const validationErrorRes = await request(app)
      .post("/v1.0/transfers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({ type: "internal", from_account_id: "acct_sand_001" })
      .expect(400);

    expect(validationErrorRes.body).toHaveProperty("code");
    expect(validationErrorRes.body).toHaveProperty("message");

    const successTransferRes = await request(app)
      .post("/v1.0/transfers")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        type: "internal",
        from_account_id: "acct_sand_001",
        to_account_id: "acct_sand_002",
        amount: 42,
      })
      .expect(201);

    expect(successTransferRes.body).toHaveProperty("id");
    expect(successTransferRes.body).toHaveProperty("type", "internal");
    expect(successTransferRes.body).toHaveProperty("status");
    expect(successTransferRes.body).toHaveProperty("referenceId");
  });
});
