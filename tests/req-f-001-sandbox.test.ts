/**
 * REQ-F-001: Sandbox environment with OAuth and production-like APIs.
 * Success of this test proves the requirement is implemented correctly.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-001: Sandbox environment with OAuth and production-like APIs", () => {
  it("health returns ok and environment sandbox", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", environment: "sandbox" });
  });

  it("oauth token endpoint accepts client_credentials and returns access_token", async () => {
    const res = await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: "sandbox_dev_001",
        client_secret: "sandbox_secret_change_in_production",
        grant_type: "client_credentials",
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("access_token");
    expect(res.body.token_type).toBe("Bearer");
    expect(res.body).toHaveProperty("expires_in");
  });

  it("protected accounts endpoint requires Bearer token and returns production-like shape", async () => {
    const tokenRes = await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: "sandbox_dev_001",
        client_secret: "sandbox_secret_change_in_production",
      });
    const token = tokenRes.body.access_token as string;
    expect(token).toBeDefined();

    const accountsRes = await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${token}`);
    expect(accountsRes.status).toBe(200);
    expect(accountsRes.body).toHaveProperty("data");
    expect(Array.isArray(accountsRes.body.data)).toBe(true);
    expect(accountsRes.body).toHaveProperty("total");
    expect(accountsRes.body).toHaveProperty("page");
    expect(accountsRes.body).toHaveProperty("pageSize");
    expect(accountsRes.body).toHaveProperty("hasMore");

    if (accountsRes.body.data.length > 0) {
      const first = accountsRes.body.data[0];
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("customerId");
      expect(first).toHaveProperty("type");
      expect(first).toHaveProperty("status");
      expect(first).toHaveProperty("currency");
      expect(first).toHaveProperty("balance");
      expect(first).toHaveProperty("availableBalance");
      expect(first).toHaveProperty("lastFour");
      expect(first).toHaveProperty("openedAt");
    }
  });

  it("accounts endpoint returns 401 without token", async () => {
    const res = await request(app).get("/accounts");
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
