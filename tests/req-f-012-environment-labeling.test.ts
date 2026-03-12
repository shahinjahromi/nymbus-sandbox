/**
 * REQ-F-012: Environment labeling.
 * Success of this test proves portal views explicitly surface sandbox environment context.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("REQ-F-012: Environment labeling", () => {
  it("returns environment labels on authenticated portal views", async () => {
    const email = `env_label_${Date.now()}@example.com`;
    const password = "Portal!123";

    await request(app)
      .post("/portal-api/register")
      .set("Content-Type", "application/json")
      .send({ email, password, name: "Env Label Tester" })
      .expect(201);

    const loginRes = await request(app)
      .post("/portal-api/login")
      .set("Content-Type", "application/json")
      .send({ email, password })
      .expect(200);

    const portalToken = loginRes.body.portal_token as string;

    const meRes = await request(app)
      .get("/portal-api/me")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    const credentialsRes = await request(app)
      .get("/portal-api/credentials")
      .set("Authorization", `Bearer ${portalToken}`)
      .expect(200);

    expect(meRes.body.environment).toBe("sandbox");
    expect(credentialsRes.body.environment).toBe("sandbox");
  });
});
