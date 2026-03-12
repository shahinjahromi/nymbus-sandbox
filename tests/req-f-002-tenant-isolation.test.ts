/**
 * REQ-F-002: Developer tenancy and isolated ID spaces.
 * Success of this test proves tenant-scoped entity creation and cross-tenant isolation.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

async function createPortalSession(prefix: string): Promise<string> {
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

  return loginRes.body.portal_token as string;
}

describe("REQ-F-002: Tenant isolation", () => {
  it("creates tenant-scoped users/accounts and blocks cross-tenant access", async () => {
    const tenantAToken = await createPortalSession("tenant_a");
    const tenantBToken = await createPortalSession("tenant_b");

    const createUserRes = await request(app)
      .post("/portal-api/users")
      .set("Authorization", `Bearer ${tenantAToken}`)
      .set("Content-Type", "application/json")
      .send({
        first_name: "Taylor",
        last_name: "TenantA",
        email: `taylor_${Date.now()}@example.com`,
      })
      .expect(201);

    const tenantAUserId = createUserRes.body.user.id as string;

    const createAccountRes = await request(app)
      .post("/portal-api/accounts")
      .set("Authorization", `Bearer ${tenantAToken}`)
      .set("Content-Type", "application/json")
      .send({
        customer_id: tenantAUserId,
        type: "checking",
        initial_balance: 500,
      })
      .expect(201);

    const tenantAAccountId = createAccountRes.body.account.id as string;

    const tenantAAccountsRes = await request(app)
      .get("/portal-api/accounts")
      .set("Authorization", `Bearer ${tenantAToken}`)
      .expect(200);

    expect(
      tenantAAccountsRes.body.data.some((account: { id: string }) => account.id === tenantAAccountId)
    ).toBe(true);

    const tenantBAccountsRes = await request(app)
      .get("/portal-api/accounts")
      .set("Authorization", `Bearer ${tenantBToken}`)
      .expect(200);

    expect(
      tenantBAccountsRes.body.data.some((account: { id: string }) => account.id === tenantAAccountId)
    ).toBe(false);

    await request(app)
      .get(`/portal-api/accounts/${tenantAAccountId}`)
      .set("Authorization", `Bearer ${tenantBToken}`)
      .expect(404);

    const tenantBCredentialRes = await request(app)
      .post("/portal-api/credentials")
      .set("Authorization", `Bearer ${tenantBToken}`)
      .set("Content-Type", "application/json")
      .send({ label: "Tenant B API Credential" })
      .expect(201);

    const tenantBOauthRes = await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({
        client_id: tenantBCredentialRes.body.credential.clientId,
        client_secret: tenantBCredentialRes.body.client_secret,
        grant_type: "client_credentials",
      })
      .expect(200);

    await request(app)
      .get(`/accounts/${tenantAAccountId}`)
      .set("Authorization", `Bearer ${tenantBOauthRes.body.access_token as string}`)
      .expect(404);
  });
});
