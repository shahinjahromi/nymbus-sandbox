/**
 * REQ-F-011: Contract change log visibility.
 * Success of this test proves portal can return human-readable contract delta summaries.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-011: Contract change log", () => {
  it("returns added/removed/modified operation summaries with migration notes", async () => {
    const email = `contract_diff_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Contract Diff Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const diffRes = await request(app)
      .get("/portal-api/contract/changelog")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(diffRes.body.environment).toBe("sandbox");
    expect(diffRes.body.summary).toHaveProperty("addedOperations");
    expect(diffRes.body.summary).toHaveProperty("removedOperations");
    expect(diffRes.body.summary).toHaveProperty("modifiedOperations");
    expect(diffRes.body.summary).toHaveProperty("breakingChangeCount");
    expect(Array.isArray(diffRes.body.added)).toBe(true);
    expect(Array.isArray(diffRes.body.removed)).toBe(true);
    expect(Array.isArray(diffRes.body.modified)).toBe(true);
    expect(Array.isArray(diffRes.body.migrationNotes)).toBe(true);
  });
});
