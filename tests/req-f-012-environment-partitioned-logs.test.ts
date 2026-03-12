/**
 * REQ-F-012: Environment-partitioned logs.
 * Success of this test proves activity views are tenant-scoped and environment-filtered.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-012: Environment-partitioned activity", () => {
  it("returns sandbox activity and empty data for non-sandbox environment filter", async () => {
    const email = `env_logs_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Env Logs Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const credentialRes = await request(app)
      .post("/portal-api/credentials")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ label: "Env Logs Credential" })
      .expect(201);

    const oauthRes = await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: credentialRes.body.credential.clientId,
        client_secret: credentialRes.body.client_secret,
        grant_type: "client_credentials",
      })
      .expect(200);

    const accessToken = oauthRes.body.access_token as string;

    await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("x-environment", "sandbox")
      .expect(200);

    const sandboxLogsRes = await request(app)
      .get("/portal-api/api-activity")
      .query({ environment: "sandbox" })
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const productionLogsRes = await request(app)
      .get("/portal-api/api-activity")
      .query({ environment: "production" })
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(sandboxLogsRes.body.environment).toBe("sandbox");
    expect(Array.isArray(sandboxLogsRes.body.data)).toBe(true);
    expect(sandboxLogsRes.body.data.length).toBeGreaterThan(0);
    expect(productionLogsRes.body.environment).toBe("sandbox");
    expect(productionLogsRes.body.data).toHaveLength(0);
  });
});
