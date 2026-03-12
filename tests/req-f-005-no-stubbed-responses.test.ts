/**
 * REQ-F-005: No stubbed fallback responses.
 * Success of this test proves contract fallback endpoints execute stateful logic without stub headers/messages.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-005: No fallback stubs", () => {
  it("serves fallback endpoints without stub markers and with persisted behavior", async () => {
    const tokenRes = await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: "sandbox_dev_001",
        client_secret: "sandbox_secret_change_in_production",
        grant_type: "client_credentials",
      })
      .expect(200);

    const accessToken = tokenRes.body.access_token as string;
    const customerId = `customer_${Date.now()}`;

    const patchRes = await request(app)
      .patch(`/v1.0/customers/${customerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .set("Content-Type", "application/json")
      .send({
        firstName: "Pat",
        lastName: "Fallback",
        email: "pat.fallback@example.com",
      })
      .expect(200);

    expect(patchRes.headers["x-sandbox-contract-stub"]).toBeUndefined();
    expect(JSON.stringify(patchRes.body).toLowerCase().includes("served by sandbox contract stub")).toBe(false);

    const getRes = await request(app)
      .get(`/v1.0/customers/${customerId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(getRes.headers["x-sandbox-contract-stub"]).toBeUndefined();
    expect(JSON.stringify(getRes.body).toLowerCase().includes("served by sandbox contract stub")).toBe(false);

    const serialized = JSON.stringify(getRes.body).toLowerCase();
    expect(serialized.includes("pat")).toBe(true);
    expect(serialized.includes("fallback")).toBe(true);
  });
});
