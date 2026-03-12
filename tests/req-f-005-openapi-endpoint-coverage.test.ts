/**
 * REQ-F-005: OpenAPI endpoint coverage (current implementation tranche).
 * Success of this test proves versioned core endpoints from bundled OpenAPI are routable in the simulator.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { readFileSync } from "fs";
import { app } from "../src/app.js";

describe("REQ-F-005: OpenAPI endpoint coverage", () => {
  it("serves implemented core resources under bundled OpenAPI versioned paths", async () => {
    const bundled = readFileSync("openapi/nymbus-baas-bundled.yml", "utf-8");
    const contractPaths = [
      "/v1.0/accounts:",
      "/v1.1/accounts:",
      "/v1.5/accounts:",
      "/v1.0/customers:",
      "/v1.0/transactions:",
    ];

    for (const path of contractPaths) {
      expect(bundled.includes(path)).toBe(true);
    }

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

    await request(app)
      .get("/v1.0/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .get("/v1.1/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .get("/v1.5/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .get("/v1.0/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    await request(app)
      .get("/v1.0/transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .query({ account_id: "acct_sand_001" })
      .expect(200);

    await request(app)
      .get("/v9.9/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(404);
  });
});
