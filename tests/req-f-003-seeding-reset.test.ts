/**
 * REQ-F-003: Tenant seeding, test data lifecycle, and reset.
 * Success of this test proves deterministic seed/reset behavior at tenant scope.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-003: Tenant seed and reset lifecycle", () => {
  it("wipes tenant data and reseeds deterministic baseline", async () => {
    const email = `seed_lifecycle_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Seed Lifecycle Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    await request(app)
      .post("/portal-api/tenant/reset")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const emptyUsersRes = await request(app)
      .get("/portal-api/users")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const emptyAccountsRes = await request(app)
      .get("/portal-api/accounts")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(emptyUsersRes.body.data).toHaveLength(0);
    expect(emptyAccountsRes.body.data).toHaveLength(0);

    const firstSeedRes = await request(app)
      .post("/portal-api/tenant/seed")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(firstSeedRes.body.result.customersSeeded).toBeGreaterThan(0);
    expect(firstSeedRes.body.result.accountsSeeded).toBeGreaterThan(0);

    const firstAccountsRes = await request(app)
      .get("/portal-api/accounts")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const firstIds = firstAccountsRes.body.data
      .map((account: { id: string }) => account.id)
      .sort();
    expect(firstIds.length).toBeGreaterThan(0);

    await request(app)
      .post("/portal-api/tenant/reset")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    await request(app)
      .post("/portal-api/tenant/seed")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const secondAccountsRes = await request(app)
      .get("/portal-api/accounts")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const secondIds = secondAccountsRes.body.data
      .map((account: { id: string }) => account.id)
      .sort();

    expect(secondIds).toEqual(firstIds);
  });
});
