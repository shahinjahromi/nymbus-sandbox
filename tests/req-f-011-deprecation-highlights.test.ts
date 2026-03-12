/**
 * REQ-F-011: Deprecation highlights.
 * Success of this test proves portal surfaces deprecations with guidance.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-011: Deprecation highlights", () => {
  it("returns deprecated operations/schema fields and migration guidance", async () => {
    const email = `contract_dep_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Contract Deprecation Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const deprecationsRes = await request(app)
      .get("/portal-api/contract/deprecations")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(deprecationsRes.body.environment).toBe("sandbox");
    expect(Array.isArray(deprecationsRes.body.operations)).toBe(true);
    expect(Array.isArray(deprecationsRes.body.schemaFields)).toBe(true);
    expect(Array.isArray(deprecationsRes.body.guidance)).toBe(true);
    expect(deprecationsRes.body.guidance.length).toBeGreaterThan(0);
  });
});
