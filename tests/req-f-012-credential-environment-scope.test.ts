/**
 * REQ-F-012: Credential environment scoping.
 * Success of this test proves sandbox credentials cannot be used with non-sandbox environment context.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-012: Credential environment scope", () => {
  it("rejects authenticated API use when requested environment is not sandbox", async () => {
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

    await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-environment", "sandbox")
      .expect(200);

    const outOfScopeRes = await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-environment", "production")
      .expect(401);

    expect(outOfScopeRes.body.code).toBe("INVALID_ENVIRONMENT_SCOPE");
    expect(outOfScopeRes.body.environment).toBe("sandbox");
  });
});
