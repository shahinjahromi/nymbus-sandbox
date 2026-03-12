/**
 * REQ-NF-005: Rate-limit controls.
 * Success of this test proves configurable throttling for OAuth, portal auth, and API operations.
 */
import { beforeEach, afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { resetRateLimitState, setRateLimitPolicy } from "../src/services/security-rate-limit.js";

beforeEach(() => {
  resetRateLimitState();
});

afterEach(() => {
  resetRateLimitState();
});

describe("REQ-NF-005: Rate limit controls", () => {
  it("throttles OAuth token requests by client scope", async () => {
    setRateLimitPolicy({ oauthRequestsPerMinute: 2 });

    await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: "sandbox_dev_001",
        client_secret: "sandbox_secret_change_in_production",
        grant_type: "client_credentials",
      })
      .expect(200);

    await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: "sandbox_dev_001",
        client_secret: "sandbox_secret_change_in_production",
        grant_type: "client_credentials",
      })
      .expect(200);

    const throttled = await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: "sandbox_dev_001",
        client_secret: "sandbox_secret_change_in_production",
        grant_type: "client_credentials",
      })
      .expect(429);

    expect(throttled.headers).toHaveProperty("retry-after");
  });

  it("throttles API requests by tenant/credential scope", async () => {
    setRateLimitPolicy({ oauthRequestsPerMinute: 20, apiRequestsPerMinute: 1 });

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
      .expect(200);

    await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(429);
  });

  it("throttles portal login attempts by email scope", async () => {
    setRateLimitPolicy({ portalAuthRequestsPerMinute: 1 });

    const email = `throttle_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Throttle Tester" })
      .expect(201);

    await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(429);
  });
});
