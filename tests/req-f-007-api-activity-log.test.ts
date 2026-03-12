/**
 * REQ-F-007: Tenant-scoped API activity log.
 * Success of this test proves activity entries are visible for the calling tenant and isolated from other tenants.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

async function createPortalTenant(prefix: string) {
  const email = `${prefix}_${Date.now()}@example.com`;
  const password = "Portal!123";

  await request(app)
    .post("/portal-api/register")
    .set("Content-Type", "application/json")
    .send({ email, password, name: `${prefix} Tester` })
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
    .send({ label: `${prefix} credential` })
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

  return {
    portalToken,
    accessToken: oauthRes.body.access_token as string,
  };
}

describe("REQ-F-007: API activity log tenancy", () => {
  it("keeps API activity tenant-scoped", async () => {
    const tenantA = await createPortalTenant("activity_a");
    const tenantB = await createPortalTenant("activity_b");

    await request(app)
      .get("/accounts")
      .set("Authorization", `Bearer ${tenantA.accessToken}`)
      .expect(200);

    const tenantALogsRes = await request(app)
      .get("/portal-api/api-activity")
      .set("Authorization", `Bearer ${tenantA.portalToken}`)
      .expect(200);

    const tenantBLogsRes = await request(app)
      .get("/portal-api/api-activity")
      .set("Authorization", `Bearer ${tenantB.portalToken}`)
      .expect(200);

    const tenantAAccountEntries = tenantALogsRes.body.data.filter(
      (entry: { path: string; method: string }) => entry.path.includes("/accounts") && entry.method === "GET"
    );

    const tenantBAccountEntries = tenantBLogsRes.body.data.filter(
      (entry: { path: string; method: string }) => entry.path.includes("/accounts") && entry.method === "GET"
    );

    expect(tenantAAccountEntries.length).toBeGreaterThan(0);
    expect(tenantBAccountEntries.length).toBe(0);
  });
});
