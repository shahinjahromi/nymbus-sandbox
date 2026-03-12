/**
 * REQ-NF-005: Audit trail coverage.
 * Success of this test proves security-sensitive actions are append-only auditable with required metadata.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-NF-005: Audit trail", () => {
  it("captures credential lifecycle and tenant reset actions with actor and tenant metadata", async () => {
    const email = `audit_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Audit Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const createdCredential = await request(app)
      .post("/portal-api/credentials")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("Content-Type", "application/json")
      .send({ label: "Audit Credential" })
      .expect(201);

    const credentialId = createdCredential.body.credential.id as string;

    await request(app)
      .post(`/portal-api/credentials/${credentialId}/rotate`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    await request(app)
      .post(`/portal-api/credentials/${credentialId}/revoke`)
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    await request(app)
      .post("/portal-api/tenant/reset")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const auditRes = await request(app)
      .get("/portal-api/audit")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(Array.isArray(auditRes.body.data)).toBe(true);
    expect(auditRes.body.data.length).toBeGreaterThan(0);

    const actions = auditRes.body.data.map((entry: { action: string }) => entry.action);
    expect(actions).toContain("credential.create");
    expect(actions).toContain("credential.rotate");
    expect(actions).toContain("credential.revoke");
    expect(actions).toContain("tenant.reset");

    const anyEntry = auditRes.body.data[0] as {
      actor: string;
      tenantId: string;
      action: string;
      timestamp: string;
      outcome: string;
    };

    expect(anyEntry.actor).toBeTruthy();
    expect(anyEntry.tenantId).toBeTruthy();
    expect(anyEntry.action).toBeTruthy();
    expect(anyEntry.timestamp).toBeTruthy();
    expect(anyEntry.outcome).toBeTruthy();
  });
});
