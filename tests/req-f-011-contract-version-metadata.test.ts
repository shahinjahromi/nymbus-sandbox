/**
 * REQ-F-011: Contract version metadata visibility.
 * Success of this test proves portal surfaces active contract source/version metadata.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-011: Contract metadata", () => {
  it("returns active bundled contract metadata and comparison baseline", async () => {
    const email = `contract_meta_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Contract Meta Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const metadataRes = await request(app)
      .get("/portal-api/contract/metadata")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(metadataRes.body.environment).toBe("sandbox");
    expect(metadataRes.body.active.sourceFile).toBe("openapi/nymbus-baas-bundled.yml");
    expect(metadataRes.body.active.contractVersion).toBeTruthy();
    expect(metadataRes.body.active.operationCount).toBeGreaterThan(0);
    expect(Array.isArray(metadataRes.body.active.apiVersions)).toBe(true);
    expect(metadataRes.body.compareTo.sourceFile).toBe("openapi/nymbus-baas-original.yml");
  });
});
