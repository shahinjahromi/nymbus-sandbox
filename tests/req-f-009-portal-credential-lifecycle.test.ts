/**
 * REQ-F-009: Sandbox credential lifecycle controls.
 * Success of this test proves create/list/revoke/rotate lifecycle behavior and OAuth enforcement.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-009: Credential lifecycle APIs", () => {
  it("creates credentials, hides secrets on list, revokes and rotates correctly", async () => {
    const email = `cred_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Credential Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const createCredentialRes = await request(app)
      .post("/portal-api/credentials")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ label: "Primary Integration" })
      .expect(201);

    expect(createCredentialRes.body).toHaveProperty("client_secret");
    expect(createCredentialRes.body.credential).toHaveProperty("clientId");
    const credentialId = createCredentialRes.body.credential.id as string;
    const clientId = createCredentialRes.body.credential.clientId as string;
    const clientSecret = createCredentialRes.body.client_secret as string;

    const listCredentialsRes = await request(app)
      .get("/portal-api/credentials")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const listedCredential = listCredentialsRes.body.data.find((entry: { id: string }) => entry.id === credentialId);
    expect(listedCredential).toBeDefined();
    expect(listedCredential.client_secret).toBeUndefined();

    await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" })
      .expect(200);

    await request(app)
      .post(`/portal-api/credentials/${credentialId}/revoke`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" })
      .expect(401);

    const createSecondCredentialRes = await request(app)
      .post("/portal-api/credentials")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ label: "Secondary Integration" })
      .expect(201);

    const secondCredentialId = createSecondCredentialRes.body.credential.id as string;
    const secondClientId = createSecondCredentialRes.body.credential.clientId as string;
    const secondClientSecret = createSecondCredentialRes.body.client_secret as string;

    const rotateRes = await request(app)
      .post(`/portal-api/credentials/${secondCredentialId}/rotate`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(rotateRes.body).toHaveProperty("client_secret");
    const rotatedSecret = rotateRes.body.client_secret as string;

    await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({ client_id: secondClientId, client_secret: secondClientSecret, grant_type: "client_credentials" })
      .expect(401);

    await request(app)
      .post("/oauth/token")
      .set("Content-Type", "application/json")
      .send({ client_id: secondClientId, client_secret: rotatedSecret, grant_type: "client_credentials" })
      .expect(200);
  });
});
